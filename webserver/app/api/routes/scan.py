import uuid
import asyncio
import json
import redis
import requests
import re
import ipaddress
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Request, HTTPException, WebSocket, WebSocketDisconnect
from fastapi_keycloak import OIDCUser
from sqlalchemy.orm import Session
import redis.asyncio as aioredis

from app.api.dependencies import idp
from app.log import get_logger
from app.config import settings
from app.schemas.scan import ScanStartRequest
from app.database.db import get_db
from app.models.target import Target
from app.models.scan import Scan, ScanStatus, ScanType
from app.models.user import User
from app.tasks import watch_scan
from app.models.finding import Finding


router = APIRouter()

log = get_logger(__name__)


def is_private_ip(ip_str):
    try:
        ip = ipaddress.ip_address(ip_str)
        return ip.is_private
    except ValueError:
        return False

def clean_target_list(targets):
    cleaned = []

    ip_range_pattern = re.compile(r'^(\d{1,3}(?:\.\d{1,3}){3})-(\d{1,3}(?:\.\d{1,3}){0,3})$')

    for target in targets:
        # Normalize the input
        if target.startswith("http://") or target.startswith("https://"):
            parsed = urlparse(target)
            target = parsed.netloc or parsed.path

        target = target.rstrip("/")

        # Skip empty targets
        if not target:
            continue

        # Handle CIDR (e.g., 192.168.0.0/16)
        try:
            network = ipaddress.ip_network(target, strict=False)
            if network.is_private:
                continue  # Skip private networks
        except ValueError:
            pass  # Not a valid CIDR

        # Handle IP ranges (e.g., 192.168.1.1-20 or 192.168.1.1-192.168.1.20)
        match = ip_range_pattern.match(target)
        if match:
            start_ip = match.group(1)
            end_suffix = match.group(2)

            # If it's a short suffix like "10", expand to full IP
            if not '.' in end_suffix:
                start_parts = start_ip.split('.')
                end_ip = '.'.join(start_parts[:3] + [end_suffix])
            else:
                end_ip = end_suffix

            try:
                if ipaddress.ip_address(start_ip).is_private or ipaddress.ip_address(end_ip).is_private:
                    continue  # Skip private IP ranges
            except ValueError:
                pass  # Skip if not valid IPs

        # Handle plain single IP
        if is_private_ip(target):
            continue

        cleaned.append(target)

    return list(set(cleaned))

@router.get("/")
def index(user: OIDCUser = Depends(idp.get_current_user()), db: Session = Depends(get_db)):
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    
    # Get all scans for this user
    scans = db.query(Scan).filter_by(user_id=db_user.id).order_by(Scan.created_at.desc()).all()
    
    # Format scan data for frontend
    scan_list = []
    for scan in scans:
        # Get target names
        target_names = [target.name for target in scan.targets]
        
        scan_info = {
            "uuid": scan.uuid,
            "name": scan.name,
            "status": scan.status.value if scan.status else None,
            "type": scan.type.value if scan.type else None,
            "created_at": scan.created_at,
            "started_at": scan.started_at,
            "finished_at": scan.finished_at,
            "targets": target_names
        }
        scan_list.append(scan_info)
    
    return {"data": scan_list}


@router.websocket("/ws")
async def websocket_scans(websocket: WebSocket, keycloak_uuid: str, db: Session = Depends(get_db)):
    await websocket.accept()
    r = aioredis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)

    try:
        while True:
            scans = (
                db.query(
                    Scan.uuid,
                    Scan.name,
                    Scan.started_at,
                    Scan.status
                )
                .join(User)
                .filter(User.keycloak_uuid == keycloak_uuid)
                .filter(Scan.status != ScanStatus.PENDING)
                .filter(Scan.status != ScanStatus.COMPLETED)
                .all()
            )

            for scan in scans:
                status = None
                finished_at = None
                progress = None
                
                key_status_finished_at = f"scan:{scan.uuid}"
                key_progress_cached = f"scan_progress:{scan.uuid}"

                status_finished_at = await r.get(key_status_finished_at)
                progress = await r.get(key_progress_cached)
                
                if status_finished_at:
                    try:
                        status = json.loads(status_finished_at.decode()).get("status")
                    except json.JSONDecodeError:
                        status = None
                    try:
                        finished_at = json.loads(status_finished_at.decode()).get("finished_at")
                    except json.JSONDecodeError:
                        finished_at = None
                if progress:
                    try:
                        progress = float(progress.decode())
                    except ValueError:
                        progress = None

                await websocket.send_json({
                    "type": "scan_update",
                    "scan_uuid": scan.uuid,
                    "status": status if status else None,
                    "progress": progress if progress else None,
                    "finished_at": finished_at if finished_at else None,
                    "started_at": scan.started_at.isoformat() if scan.started_at else None,
                    "name": scan.name if scan.name else "Waiting for scan to start..."
                })

            await asyncio.sleep(5)

    except WebSocketDisconnect:
        log.info(f"WebSocket disconnected for scans page user_id: {keycloak_uuid}")
    except Exception as e:
        log.error(f"Error in websocket_scans: {e}")
    finally:
        await websocket.close()
        

@router.websocket("/ws/{scan_uuid}")
async def websocket_scan(websocket: WebSocket, scan_uuid: str):
    await websocket.accept()
    r = aioredis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)
    pubsub = r.pubsub()
    # Subscribe to both main channel and progress channel
    await pubsub.subscribe(scan_uuid, f"{scan_uuid}:progress", f"{scan_uuid}:status")
    log.info(f"Subscribed to channels for scan_uuid: {scan_uuid}")

    sent_messages = set()  # Track sent messages to avoid duplicates
    
    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=5.0)
            if message and message['type'] == 'message':
                channel = message['channel'].decode()
                msg_text_raw = message['data']
                
                # Progress updates are numeric strings; status updates & output may be JSON
                if channel == f"{scan_uuid}:progress":
                    msg_text = msg_text_raw.decode() if isinstance(msg_text_raw, (bytes, bytearray)) else str(msg_text_raw)
                    # Send progress update as a special message type
                    try:
                        progress = float(msg_text)
                        await websocket.send_json({
                            "type": "progress",
                            "value": progress
                        })
                    except ValueError:
                        log.error(f"Invalid progress value received: {msg_text}")
                elif channel == f"{scan_uuid}:status":
                    # Forward status change message
                    try:
                        # Message is JSON encoded by watch_scan
                        status_data = json.loads(msg_text_raw.decode() if isinstance(msg_text_raw, (bytes, bytearray)) else msg_text_raw)
                        await websocket.send_json({
                            "type": "status",
                            "value": status_data.get("status"),
                            "started_at": status_data.get("started_at"),
                            "finished_at": status_data.get("finished_at"),
                        })
                    except json.JSONDecodeError:
                        log.warning(f"Received non-JSON status message: {msg_text_raw}")
                else:
                    # Regular scan output handling
                    msg_text = msg_text_raw.decode() if isinstance(msg_text_raw, (bytes, bytearray)) else str(msg_text_raw)
                    if msg_text in sent_messages:
                        continue
                    
                    sent_messages.add(msg_text)
                    await websocket.send_json({
                        "type": "output",
                        "value": msg_text
                    })
                
                # Periodically clean up sent_messages to prevent memory growth
                if len(sent_messages) > 5000:
                    sent_messages = set(list(sent_messages)[-2000:])
                    
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        log.info(f"WebSocket disconnected for scan_uuid: {scan_uuid}")
    except Exception as e:
        log.error(f"Error in websocket_scan: {e}")
    finally:
        await pubsub.unsubscribe(scan_uuid, f"{scan_uuid}:progress", f"{scan_uuid}:status")
        await pubsub.close()
        await r.close()


@router.post("/hook")
async def scan_hook(request: Request, db: Session = Depends(get_db)):
    """
    Webhook called by OpenFaaS when a scan completes.
    This endpoint only updates the scan status and triggers final processing.
    The actual scan results are handled by the Celery task.
    """
    try:
        # Add a timeout to the request.json() call
        data = await asyncio.wait_for(request.json(), timeout=10.0)
        log.info(f"Webhook called for scan_uuid: {data.get('scan_id')} with data: {data}")
        
        scan_id = data.get("scan_id")
        scan_status = data.get("status", "completed")

        # Update scan final status in DB
        scan = db.query(Scan).filter_by(uuid=scan_id).first()
        if scan:
            scan.status = scan_status
            db.commit()
            db.refresh(scan)
            log.info(f"Scan {scan_id} updated in DB with status {scan_status}")
            return {"success": True}
        else:
            log.error(f"Scan {scan_id} not found in DB")
            return {"error": "Scan not found in DB"}

    except Exception as e:
        log.error(f"Error in scan_hook: {e}")
        return {"error": "Failed to parse request body"}


@router.post("/start")
def start_scan(
    request: ScanStartRequest,
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    
    # 1. Parse data
    targets = request.targets
    scan_type = request.type
    scan_options = request.scan_options

    payload = {
        "targets": clean_target_list(targets),
        "scan_type": scan_type,
        "scan_options": scan_options,
        "scan_id": str(uuid.uuid4())
    }
    
    # 2. Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()

    # 3. Create targets if they don't exist
    inserted_targets = get_or_create_targets(targets, db_user, db)

    # 4. Create scan entry
    create_scan_entry(inserted_targets, db_user, payload, db)

    # 5. Start OpenFaaS job
    start_openfaas_job(payload)
    
    # 6. Start Celery watch_scan task to monitor the scan status
    watch_scan.delay(payload.get("scan_id"))
    
    # 7. Return scan_uuid to frontend
    return {"scan_uuid": payload.get("scan_id")}


@router.get("/{scan_uuid}")
def get_scan_by_uuid(
    scan_uuid: str,
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    
    # Find the scan
    scan = db.query(Scan).filter_by(uuid=scan_uuid).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    # Check if the scan belongs to the user
    if scan.user_id != db_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this scan")
    
    # Get the target names and uuids
    # target_names = [target.name for target in scan.targets]

    targets = [{"name": target.name, "uuid": target.uuid} for target in scan.targets]
    
    # Parse scan results if available
    scan_results = []
    if scan.result:
        try:
            scan_results = json.loads(scan.result)
        except json.JSONDecodeError:
            log.error(f"Invalid JSON in scan.result for scan {scan_uuid}")
            scan_results = []
    
    # Get current progress from Redis if scan is running
    current_progress = None
    current_output = scan.output  # Default to database output
    
    if scan.status.value in ["pending", "running"]:
        try:
            r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)
            
            # Get current progress
            progress_key = f"scan_progress:{scan_uuid}"
            progress_value = r.get(progress_key)
            if progress_value:
                current_progress = float(progress_value.decode())
            
            # Get current output from Redis (more up-to-date than database during scan)
            output_key = f"scan_output:{scan_uuid}"
            redis_output_lines = r.lrange(output_key, 0, -1)
            if redis_output_lines:
                current_output = "\n".join([line.decode() if isinstance(line, bytes) else line for line in redis_output_lines])
            
            r.close()
        except Exception as e:
            log.warning(f"Could not fetch real-time data for scan {scan_uuid}: {e}")
    
    response = {
        "scan_uuid": scan.uuid,
        "name": scan.name,
        "status": scan.status.value if scan.status else None,
        "type": scan.type.value if scan.type else None,
        "parameters": scan.parameters,
        "output": current_output,  # Use real-time output when available
        "result": scan_results,
        "targets": targets,
        "created_at": scan.created_at,
        "started_at": scan.started_at,
        "finished_at": scan.finished_at
    }
    
    # Add current progress if available
    if current_progress is not None:
        response["current_progress"] = current_progress
    
    return response


@router.get("/{scan_uuid}/status")
def get_scan_status(
    scan_uuid: str,
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    
    # Find the scan
    scan = db.query(Scan).filter_by(uuid=scan_uuid).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    # Check if the scan belongs to the user
    if scan.user_id != db_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this scan")
    
    return {
        "status": scan.status.value if scan.status else None
    }


@router.get("/{scan_uuid}/findings")
def get_findings_by_scan_uuid(
    scan_uuid: str,
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    """
    Retrieve all findings for a specific scan.
    """
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    
    # Find the scan
    scan = db.query(Scan).filter_by(uuid=scan_uuid).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    # Check if the scan belongs to the user
    if scan.user_id != db_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this scan")
    
    # Get all targets from this scan
    target_ids = [target.id for target in scan.targets]
    
    # Get all findings for these targets
    findings = db.query(Finding).filter(Finding.target_id.in_(target_ids)).all()
    
    # Format findings for response
    findings_data = []
    for finding in findings:
        findings_data.append({
            "id": finding.id,
            "name": finding.name,
            "description": finding.description,
            "recommendation": finding.recommendation,
            "port": finding.port,
            "port_state": finding.port_state.value if finding.port_state else None,
            "protocol": finding.protocol,
            "service": finding.service,
            "os": finding.os,
            "traceroute": finding.traceroute,
            "severity": finding.severity.value if finding.severity else None,
            "target": {
                "id": finding.target.id,
                "name": finding.target.name
            } if finding.target else None,
            "created_at": finding.created_at,
            "updated_at": finding.updated_at
        })
    
    return {"data": findings_data}


@router.post("/{scan_uuid}/report")
def generate_report(
    scan_uuid: str,
    report_data: dict,
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    """
    Generate a report for a specific scan.
    """
    from app.models.report import Report, ReportType, ReportStatus
    
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    
    # Find the scan
    scan = db.query(Scan).filter_by(uuid=scan_uuid).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    # Check if the scan belongs to the user
    if scan.user_id != db_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this scan")
    
    # Check if scan is completed
    if scan.status != ScanStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Cannot generate report for incomplete scan")
    
    # Parse report format
    format_str = report_data.get("format", "json").lower()
    try:
        report_type = ReportType(format_str)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid report format: {format_str}")
    
    # Create report entry
    report_name = f"{scan.name} - {format_str.upper()} Report"
    new_report = Report(
        name=report_name,
        type=report_type,
        status=ReportStatus.PENDING,
        scan_id=scan.id
    )
    
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    
    # TODO: Trigger report generation task (e.g., Celery task)
    # For now, we'll just mark it as generated
    # In a real implementation, you would trigger an async task here
    
    log.info(f"Report generation requested for scan {scan_uuid} by user {db_user.id}")
    
    return {
        "message": "Report generation started",
        "report_id": new_report.id,
        "format": format_str
    }


@router.delete("/{scan_uuid}")
def delete_scan(
    scan_uuid: str,
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    """
    Delete a scan by UUID.
    """
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    
    # Find the scan
    scan = db.query(Scan).filter_by(uuid=scan_uuid).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    # Check if the scan belongs to the user
    if scan.user_id != db_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this scan")
    
    # Check if scan is running or pending - don't allow deletion
    if scan.status in [ScanStatus.RUNNING, ScanStatus.PENDING]:
        raise HTTPException(status_code=400, detail="Cannot delete running or pending scan")
    
    # Delete the scan (cascade will handle related records)
    db.delete(scan)
    db.commit()
    
    log.info(f"Scan {scan_uuid} deleted by user {db_user.id}")
    return {"message": "Scan deleted successfully"}

@router.post("/bulk-delete")
def bulk_delete_scans(
    uuids: list[str],
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    """
    Bulk delete scans by UUIDs.
    """
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()

    # Fetch all scans to delete
    scans = db.query(Scan).filter(Scan.uuid.in_(uuids)).all()

    # Ensure all scans belong to the user
    for scan in scans:
        if scan.user_id != db_user.id:
            raise HTTPException(status_code=403, detail=f"Not authorized to delete scan {scan.uuid}")
        db.delete(scan)

    db.commit()

    log.info(f"Scans {uuids} deleted by user {db_user.id}")
    return {"message": "Scans deleted successfully"}


def create_scan_entry(inserted_targets, db_user, payload, db):
    scan_type = payload.get("scan_type", ScanType.DEFAULT)
    scan_options = payload.get("scan_options", {})
    scan_uuid = payload.get("scan_id")
    targets = payload.get("targets", [])
    
    # Create a meaningful scan name based on targets and type
    target_summary = ", ".join(targets[:3])
    if len(targets) > 3:
        target_summary += f" and {len(targets) - 3} more"
    
    # get all scans names for running/pending scans for the user
    scans = db.query(Scan).filter(Scan.user_id == db_user.id, Scan.status.in_([ScanStatus.RUNNING, ScanStatus.PENDING])).all()
    scan_names = [scan.name for scan in scans]
    if scan_names:
        highest_number = max([int(name.split(" ")[-1]) for name in scan_names if name.startswith("Assessment no.")])
        scan_name = f"Assessment no. {highest_number + 1}"
    else:
        scan_name = "Assessment no. 1"

    new_scan = Scan(
        user_id=db_user.id,
        type=scan_type,
        status=ScanStatus.PENDING,
        uuid=scan_uuid,
        name=scan_name,
        targets=inserted_targets,  # associate all targets
        parameters=scan_options
    )
    db.add(new_scan)
    db.commit()
    db.refresh(new_scan)
    log.info(f"Scan created in DB with id: {new_scan.id} with targets: {[t.name for t in inserted_targets]}")


def start_openfaas_job(payload):
    scan_uuid = payload.get("scan_id")
    scan_options = payload.get("scan_options")
    scan_type = payload.get("scan_type", ScanType.DEFAULT)
    targets = payload.get("targets")

    faas_payload = {
        "targets": targets,
        "scan_type": scan_type.value,
        "scan_id": scan_uuid,
        "scan_options": scan_options
    }
    log.info(f"Starting OpenFaaS job with payload: {faas_payload}")
    callback_url = "http://webserver-service.default.svc.cluster.local/api/scans/hook"
    headers = {"X-Callback-Url": callback_url}
    
    # Initialize Redis with pending status and scan options
    try:
        r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)
        r.set(f"scan:{scan_uuid}", json.dumps({"status": "pending"}))
        # Also store scan options in Redis for reference    
        r.close()
        log.info(f"Initialized Redis keys for scan_uuid: {scan_uuid}")
    except Exception as e:
        if r:
            r.close()
        log.error(f"Error initializing Redis for scan {scan_uuid}: {e}")
        
    try:
        response = requests.post(
            settings.OPENFAAS_ASYNC_FUNCTION_URL,
            json=faas_payload,
            headers=headers,
            timeout=30
        )
        if response.status_code != 202:
            raise HTTPException(status_code=500, detail=f"Failed to start OpenFaaS job: {response}")
        log.info(f"OpenFaaS job started: {response}")
    except Exception as e:
        log.error(f"Error starting OpenFaaS job: {e}")
        # Update Redis with failed status if OpenFaaS job fails to start
        try:
            r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)
            r.set(f"scan:{scan_uuid}", json.dumps({"status": "failed"}))
            r.close()
        except Exception as redis_err:
            if r:
                r.close()
            log.error(f"Error updating Redis for failed scan {scan_uuid}: {redis_err}")


def get_or_create_targets(target_names, db_user, db):
    """
    For each target name, get the existing Target for this user or create a new one.
    Returns a list of Target objects.
    """
    # remove duplicates from targets
    target_names = list(set(target_names))
    # remove empty targets
    target_names = [target for target in target_names if target]
    inserted_targets = []
    for target_name in target_names:
        existing = db.query(Target).filter_by(user_id=db_user.id, name=target_name).first()
        if not existing:
            log.info(f"Creating new target: {target_name}")
            new_target = Target(
                user_id=db_user.id,
                name=target_name,
            )
            db.add(new_target)
            db.commit()
            db.refresh(new_target)
            inserted_targets.append(new_target)
        else:
            log.info(f"Target already exists: {target_name}")
            inserted_targets.append(existing)
    return inserted_targets