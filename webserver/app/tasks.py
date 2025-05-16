from celery import Celery
from app.config import settings
import redis
import json
import time
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

@celery_app.task
def watch_scan(scan_uuid):
    """
    Watch a scan's status in Redis and update the database accordingly.
    Polls every 2 seconds until the scan is completed or failed.
    """
    r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)
    key = f"scan:{scan_uuid}"
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
            
            try:
                # Update scan in database
                scan = db.query(Scan).filter_by(uuid=scan_uuid).first()
                if not scan:
                    log.error(f"Scan with UUID {scan_uuid} not found in database")
                    db.close()
                    return
                
                if status == "running":
                    scan.status = ScanStatus.RUNNING
                    db.commit()
                    log.info(f"Updated scan {scan_uuid} status to RUNNING")
                elif status in ["completed", "failed"]:
                    scan.status = ScanStatus.COMPLETED if status == "completed" else ScanStatus.FAILED
                    scan.finished_at = datetime.now()
                    db.commit()
                    log.info(f"Updated scan {scan_uuid} status to {scan.status}")
                    db.close()
                    return  # End the task when scan is completed or failed
                
            finally:
                db.close()
                
        except Exception as e:
            log.error(f"Error processing scan status for {scan_uuid}: {e}")
        
        # Wait 2 seconds before checking again
        time.sleep(2)
