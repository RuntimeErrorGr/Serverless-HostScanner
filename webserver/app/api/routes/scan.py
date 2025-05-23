import uuid
import asyncio
import json
import redis
import requests

from fastapi import APIRouter, Depends, Request, HTTPException, WebSocket, WebSocketDisconnect
from fastapi_keycloak import OIDCUser
from sqlalchemy.orm import Session
import redis.asyncio as aioredis
from datetime import timedelta

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
from app.utils.timezone import now_utc

router = APIRouter()

log = get_logger(__name__)


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
            "status": scan.status.value if scan.status else None,
            "type": scan.type.value if scan.type else None,
            "created_at": scan.created_at,
            "started_at": scan.started_at,
            "finished_at": scan.finished_at,
            "targets": target_names
        }
        scan_list.append(scan_info)
    
    return {"data": scan_list}


@router.websocket("/ws/{scan_uuid}")
async def websocket_scan(websocket: WebSocket, scan_uuid: str):

    def write_buffer(scan_uuid, db, buffer):
        scan = db.query(Scan).filter_by(uuid=scan_uuid).first()
        if scan:
            if scan.output:
                scan.output += "\n" + "\n".join(buffer)
            else:
                scan.output = "\n".join(buffer)
            db.commit()

    await websocket.accept()
    r = aioredis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)
    db = next(get_db())
    pubsub = r.pubsub()
    # Subscribe to both main channel and progress channel
    await pubsub.subscribe(scan_uuid, f"{scan_uuid}:progress")
    log.info(f"Subscribed to scan_uuid: {scan_uuid} and progress channel")

    buffer = []
    sent_messages = set()  # Track sent messages to avoid duplicates
    FLUSH_LINES = 20
    FLUSH_INTERVAL = 0.2
    last_flush = now_utc()
    
    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=5.0)
            log.info(f"Message: {message}")
            if message and message['type'] == 'message':
                channel = message['channel'].decode()
                msg_text = message['data'].decode()
                log.info(f"Received message: {msg_text}")
                
                if channel == f"{scan_uuid}:progress":
                    # Send progress update as a special message type
                    try:
                        progress = float(msg_text)
                        await websocket.send_json({
                            "type": "progress",
                            "value": progress
                        })
                    except ValueError:
                        log.error(f"Invalid progress value received: {msg_text}")
                else:
                    # Regular scan output handling
                    if msg_text in sent_messages:
                        continue
                    
                    buffer.append(msg_text)
                    sent_messages.add(msg_text)
                    log.info(f"Sending message: {msg_text}")
                    await websocket.send_json({
                        "type": "output",
                        "value": msg_text
                    })
                
            # Flush if enough lines or enough time has passed
            if buffer and (len(buffer) >= FLUSH_LINES or now_utc() - last_flush > timedelta(seconds=FLUSH_INTERVAL)):
                write_buffer(scan_uuid, db, buffer)
                buffer.clear()
                last_flush = now_utc()
                
                # Periodically clean up sent_messages to prevent memory growth
                if len(sent_messages) > 5000:
                    sent_messages = set(list(sent_messages)[-2000:])
                    
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        # Final flush on disconnect
        if buffer:
           write_buffer(scan_uuid, db, buffer)
        log.info(f"Unsubscribed from scan_uuid: {scan_uuid}")
        await pubsub.unsubscribe(scan_uuid, f"{scan_uuid}:progress")
        await pubsub.close()
        await r.close()
        db.close()
    except Exception as e:
        log.error(f"Error in websocket_scan: {e}")
        await pubsub.unsubscribe(scan_uuid, f"{scan_uuid}:progress")
        await pubsub.close()
        await r.close()
        db.close()


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
        "targets": targets,
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
    
    # Get the target names
    target_names = [target.name for target in scan.targets]
    
    # Parse scan results if available
    scan_results = []
    if scan.result:
        try:
            scan_results = json.loads(scan.result)
        except json.JSONDecodeError:
            log.error(f"Invalid JSON in scan.result for scan {scan_uuid}")
            scan_results = []
    
    return {
        "scan_uuid": scan.uuid,
        "name": scan.name,
        "status": scan.status.value if scan.status else None,
        "type": scan.type.value if scan.type else None,
        "parameters": scan.parameters,
        "output": scan.output,
        "result": scan_results,
        "targets": target_names,
        "created_at": scan.created_at,
        "started_at": scan.started_at,
        "finished_at": scan.finished_at
    }


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


def create_scan_entry(inserted_targets, db_user, payload, db):
    scan_type = payload.get("scan_type", ScanType.DEFAULT)
    scan_options = payload.get("scan_options", {})
    scan_uuid = payload.get("scan_id")
    targets = payload.get("targets", [])
    
    # Create a meaningful scan name based on targets and type
    target_summary = ", ".join(targets[:3])
    if len(targets) > 3:
        target_summary += f" and {len(targets) - 3} more"
    
    scan_name = f"Scan results for {target_summary}"

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