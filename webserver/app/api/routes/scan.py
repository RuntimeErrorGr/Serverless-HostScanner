
import uuid
import asyncio
import json
import redis
import requests
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
from app.models.scan import Scan, ScanStatus
from app.models.user import User


router = APIRouter()

log = get_logger(__name__)

@router.get("/")
def index(user: OIDCUser = Depends(idp.get_current_user())):
    return {"data": f"Welcome {user.preferred_username }! This is the scan page."}

@router.websocket("/ws/{scan_uuid}")
async def websocket_scan(websocket: WebSocket, scan_uuid: str):
    await websocket.accept()
    r = aioredis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)
    pubsub = r.pubsub()
    await pubsub.subscribe(scan_uuid)
    log.info(f"Subscribed to scan_uuid: {scan_uuid}")
    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message and message['type'] == 'message':
                await websocket.send_text(message['data'].decode())
            await asyncio.sleep(0.0001)
    except WebSocketDisconnect:
        log.info(f"Unsubscribed from scan_uuid: {scan_uuid}")
        await pubsub.unsubscribe(scan_uuid)
        await pubsub.close()
        await r.close()
    except Exception as e:
        log.error(f"Error in websocket_scan: {e}")
        raise HTTPException(status_code=500, detail=f"Error in websocket_scan: {e}")

@router.post("/hook")
async def scan_hook(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    log.info(f"Hook called for scan_id: {data}")

    scan_id = data.get("scan_id")
    status = data.get("status", "completed")
    scan_results = data.get("scan_results")

    if not scan_id or not status:
        raise HTTPException(status_code=400, detail="Missing scan_id or status")

    # Update scan in DB
    scan = db.query(Scan).filter_by(uuid=scan_id).first()
    if not scan:
        log.debug(f"Scan not found in DB for scan_id: {scan_id}")
        # insert scan into DB with status failed
        scan = Scan(
            uuid=scan_id,
            status=ScanStatus.FAILED,
            result=scan_results,
        )
        db.add(scan)
        db.commit()

        return {"message": "Scan updated"}

    scan.result = scan_results
    scan.status = ScanStatus(status)
    db.commit()
    log.info(f"Scan {scan_id} updated in DB with results and status {status}")

    return {"message": "Scan updated"}

def create_scan_entries(inserted_targets, db_user, scan_type, scan_uuid, db):
    for target in inserted_targets:
        log.info(f"Creating new scan for target: {target.name}")
        new_scan = Scan(
            user_id=db_user.id,
            target_id=target.id,
            type=scan_type,
            status=ScanStatus.PENDING,
            uuid=scan_uuid
        )
        db.add(new_scan)
    db.commit()

def start_openfaas_job(targets, scan_type, scan_uuid):
    payload = {
        "targets": targets,
        "scan_type": scan_type.value,
        "scan_id": scan_uuid
    }
    callback_url = "http://webserver-service.default.svc.cluster.local/api/scans/hook"
    headers = {"X-Callback-Url": callback_url}
    try:
        response = requests.post(
            settings.OPENFAAS_ASYNC_FUNCTION_URL,
            json=payload,
            headers=headers,
            timeout=60
        )
        log.info(f"OpenFaaS job started: {response}")
    except Exception as e:
        log.error(f"Error starting OpenFaaS job: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start OpenFaaS job: {e}")
    
def get_or_create_targets(target_names, db_user, db):
    inserted_targets = []
    for target in target_names:
        existing = db.query(Target).filter_by(user_id=db_user.id, name=target).first()
        if not existing:
            log.info(f"Creating new target: {target}")
            new_target = Target(
                user_id=db_user.id,
                name=target,
            )
            db.add(new_target)
            db.commit()
            db.refresh(new_target)
            inserted_targets.append(new_target)
        else:
            log.info(f"Target already exists: {target}")
            inserted_targets.append(existing)
    return inserted_targets

@router.post("/start")
def start_scan(
    request: ScanStartRequest,
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    # 1. Parse data
    targets = request.targets
    scan_type = request.type

    # 2. Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()

    # 3. Create targets if they don't exist
    inserted_targets = get_or_create_targets(targets, db_user, db)

    # 4. Create scan entry
    scan_uuid = str(uuid.uuid4())
    create_scan_entries(inserted_targets, db_user, scan_type, scan_uuid, db)

    # 5. Start OpenFaaS job
    start_openfaas_job(targets, scan_type, scan_uuid)

    # 6. Return scan_uuid to frontend
    return {"scan_uuid": scan_uuid}