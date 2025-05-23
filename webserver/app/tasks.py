import redis
import json
import time
import redis.asyncio as aioredis
import asyncio

from celery import Celery
from app.config import settings
from app.log import get_logger
from app.database.db import get_db
from app.models.scan import Scan, ScanStatus
from app.models.target import Target
from app.models.finding import Finding, PortState, Severity
from app.utils.timezone import now_utc

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
        scan.started_at = now_utc()
    elif (status == ScanStatus.COMPLETED or status == ScanStatus.FAILED) and scan.finished_at is None:
        scan.finished_at = now_utc()    
        # When scan completes or fails, also send a final progress=100 to the websocket
        # This ensures the frontend progress bar always reaches 100%
        try:
            r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)
            r.publish(f"{scan_uuid}:progress", "100")
            r.close()
        except Exception as e:
            log.error(f"Error publishing final progress for scan {scan_uuid}: {e}")
    
    scan.status = status
    db.commit()
    log.info(f"Updated scan {scan_uuid} status to {status}")
    return True

@celery_app.task
def watch_scan(scan_uuid):
    """
    Watch a scan's status in Redis and update the database accordingly.
    Also subscribes to scan output channels to write output to database.
    Polls every 2 seconds until the scan is completed or failed.
    """
    async def async_watch_scan():
        r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)
        r_async = aioredis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)
        
        key = f"scan:{scan_uuid}"
        results_key = f"scan_results:{scan_uuid}"
        progress_key = f"scan_progress:{scan_uuid}"
        
        log.info(f"Started watch_scan Celery task for scan_uuid: {scan_uuid}")
        
        # Subscribe to output and progress channels
        pubsub = r_async.pubsub()
        await pubsub.subscribe(f"{scan_uuid}:progress")
        
        try:
            while True:
                # Check for Redis messages (progress only - output is handled by Redis)
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message['type'] == 'message':
                    channel = message['channel'].decode()
                    msg_text = message['data'].decode()
                    
                    if channel == f"{scan_uuid}:progress":
                        # Store current progress in Redis for immediate access
                        try:
                            progress = float(msg_text)
                            r.set(progress_key, str(progress), ex=3600)  # Expire after 1 hour
                        except ValueError:
                            pass
                
                # Check scan status from Redis
                scan_data = r.get(key)
                if scan_data:
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
                            await asyncio.sleep(2)
                            continue
                        
                        # Update the scan status
                        update_scan_status(scan_uuid, new_status, db)
                        
                        # If scan completed or failed, write final output to database
                        if status in ["completed", "failed"]:
                            # Get complete output from Redis and store in database
                            try:
                                output_key = f"scan_output:{scan_uuid}"
                                redis_output_lines = r.lrange(output_key, 0, -1)
                                if redis_output_lines:
                                    complete_output = "\n".join([line.decode() if isinstance(line, bytes) else line for line in redis_output_lines])
                                    scan.output = complete_output
                                    log.info(f"Stored complete output from Redis to database for scan {scan_uuid}")
                                    # Clean up Redis output after storing in DB
                                    r.delete(output_key)
                            except Exception as e:
                                log.warning(f"Failed to transfer output from Redis to database for scan {scan_uuid}: {e}")
                        
                        # Check for scan results in Redis and update the database
                        scan_results_data = r.get(results_key)
                        if scan_results_data:
                            try:
                                scan_results = json.loads(scan_results_data)

                                # Store the raw scan results in the scan.result column
                                scan.result = json.dumps(scan_results)
                                log.info(f"Stored scan results in scan.result for scan {scan_uuid}")

                                new_findings_count = 0

                                for host in scan_results:
                                    ip_addr = host.get("ip_address")
                                    hostname = host.get("hostname")
                                    if not ip_addr and not hostname:
                                        continue

                                    # Get or create the corresponding target for this host
                                    target = (
                                        db.query(Target)
                                        .filter_by(user_id=scan.user_id, name=ip_addr or hostname)
                                        .first()
                                    )

                                    if not target:
                                        target = Target(user_id=scan.user_id, name=ip_addr or hostname)
                                        db.add(target)
                                        db.flush()  # Ensures target.id is populated

                                    # Make sure the scan-target association exists
                                    if target not in scan.targets:
                                        scan.targets.append(target)

                                    # Persist port findings (one finding per open/filtered port)
                                    for port_info in host.get("ports", []):
                                        # Skip the synthetic extraports entries
                                        if port_info.get("port") is None:
                                            continue
                                            
                                        try:
                                            port_number = int(port_info.get("port", 0)) if port_info.get("port") else None
                                        except ValueError:
                                            port_number = None

                                        protocol = port_info.get("protocol")
                                        state_str = (port_info.get("state") or "unknown").lower()
                                        port_state = (
                                            PortState(state_str)
                                            if state_str in PortState._value2member_map_
                                            else PortState.UNKNOWN
                                        )

                                        service_name = ""
                                        if isinstance(port_info.get("service"), dict):
                                            service_name = port_info.get("service", {}).get("name", "")

                                        finding = Finding(
                                            name=f"{hostname or ip_addr}:{port_number}/{protocol}" if port_number else hostname or ip_addr,
                                            description="",
                                            recommendation="",
                                            port=port_number,
                                            port_state=port_state,
                                            protocol=protocol,
                                            service=service_name,
                                            os=host.get("os_info", {}),
                                            traceroute=json.dumps(host.get("traceroute", [])),
                                            severity=Severity.INFO,
                                            target=target,
                                        )
                                        db.add(finding)
                                        new_findings_count += 1

                                db.commit()

                                # Remove the results key so we don't process twice
                                r.delete(results_key)

                                log.info(
                                    f"Processed {new_findings_count} findings and updated scan {scan_uuid} results"
                                )
                            except json.JSONDecodeError:
                                log.error(f"Invalid JSON in Redis scan results for {scan_uuid}")
                        
                        # If scan completed or failed, end the task
                        if status in ["completed", "failed"]:
                            log.info(f"Scan {scan_uuid} finished with status {status}")
                            db.commit()  # Ensure all changes are committed
                            db.close()
                            break
                        
                        db.close()
                        
                    except Exception as e:
                        log.error(f"Error processing scan status for {scan_uuid}: {e}")
                
                # Wait before next iteration
                await asyncio.sleep(2)
                
        finally:
            await pubsub.unsubscribe(f"{scan_uuid}:progress")
            await pubsub.close()
            await r_async.close()
            r.close()
    
    # Run the async function
    asyncio.run(async_watch_scan())
