import redis
import json
import time

from celery import Celery
from app.config import settings
from app.log import get_logger
from app.database.db import get_db
from app.models.scan import Scan, ScanStatus
from datetime import datetime

celery_app = Celery(
    "tasks",
    broker=f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0",
    backend=f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0",
)


log = get_logger(__name__)


def update_scan_status(scan_uuid, status, db):
    """
    Update the scan status in the database
    """
    scan = db.query(Scan).filter_by(uuid=scan_uuid).first()
    if not scan:
        log.warning(f"Attempted to update status for non-existent scan: {scan_uuid}")
        return False
    
    # Update status
    if status == ScanStatus.RUNNING and scan.status != ScanStatus.RUNNING:
        scan.started_at = datetime.now()
    elif (status == ScanStatus.COMPLETED or status == ScanStatus.FAILED) and scan.finished_at is None:
        scan.finished_at = datetime.now()
    
    scan.status = status
    db.commit()
    log.info(f"Updated scan {scan_uuid} status to {status}")
    return True

@celery_app.task
def watch_scan(scan_uuid):
    """
    Watch a scan's status in Redis and update the database accordingly.
    Polls every 2 seconds until the scan is completed or failed.
    Also responsible for updating the scan results in the database.
    """
    r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)
    key = f"scan:{scan_uuid}"
    results_key = f"scan_results:{scan_uuid}"
    log.info(f"Started watch_scan Celery task for scan_uuid: {scan_uuid}")

    while True:
        # Get the scan status from Redis
        scan_data = r.get(key)
        if not scan_data:
            time.sleep(2)
            continue
            
        try:
            data = json.loads(scan_data)
            status = data.get("status")
            
            # Get DB session
            db = next(get_db())
            
            # Update scan in database
            scan = db.query(Scan).filter_by(uuid=scan_uuid).first()
            if not scan:
                log.error(f"Scan with UUID {scan_uuid} not found in database")
                db.close()
                return
            
            # Map Redis status to ScanStatus enum
            if status == "running":
                new_status = ScanStatus.RUNNING
            elif status == "completed":
                new_status = ScanStatus.COMPLETED
            elif status == "failed":
                new_status = ScanStatus.FAILED
            else:
                # Unknown status, skip this update
                db.close()
                time.sleep(2)
                continue
            
            # Update the scan status to complete of if redis channel has no more messages
            update_scan_status(scan_uuid, new_status, db)
            
            # Check for scan results in Redis and update the database
            scan_results_data = r.get(results_key)
            if scan_results_data:
                try:
                    scan_results = json.loads(scan_results_data)
                    db.commit()
                    log.info(f"Updated scan {scan_uuid} results from Redis")
                except json.JSONDecodeError:
                    log.error(f"Invalid JSON in Redis scan results for {scan_uuid}")
            
            # If scan completed or failed, end the task
            if status in ["completed", "failed"]:
                log.info(f"Scan {scan_uuid} finished with status {status}")
                db.close()
                return  # End the task when scan is completed or failed
                
        except Exception as e:
            log.error(f"Error processing scan status for {scan_uuid}: {e}")
        
        # Wait 2 seconds before checking again
        time.sleep(2)
