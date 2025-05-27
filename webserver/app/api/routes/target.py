from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi_keycloak import OIDCUser
from sqlalchemy.orm import Session

from app.api.dependencies import idp
from app.log import get_logger
from app.database.db import get_db
from app.models.target import Target
from app.models.user import User
from app.schemas.target import TargetBase, TargetOut
from app.models.finding import Finding
from app.models.scan import Scan
from app.models.scan import scan_target_association
from app.models.scan import ScanStatus
import httpx
import socket

router = APIRouter()

log = get_logger(__name__)


@router.get("/")
def get_targets(user: OIDCUser = Depends(idp.get_current_user()), db: Session = Depends(get_db)):
    """
    Get all targets for the current user.
    """
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    
    # Get all targets for this user
    targets = db.query(Target).filter_by(user_id=db_user.id).order_by(Target.created_at.desc()).all()
    
    # Format target data for frontend
    target_list = []
    for target in targets:
        # Count findings for this target
        findings_count = db.query(Finding).filter_by(target_id=target.id).count()
        
        # Count completed scans for this target
        completed_scans_count = (
            db.query(Scan)
            .join(scan_target_association)
            .filter(
                scan_target_association.c.target_id == target.id,
                Scan.status == ScanStatus.COMPLETED
            )
            .count()
        )
        
        target_info = {
            "id": target.id,
            "uuid": target.uuid,
            "name": target.name,
            "user_id": target.user_id,
            "findings_count": findings_count,
            "completed_scans_count": completed_scans_count,
            "created_at": target.created_at,
            "updated_at": target.updated_at
        }
        target_list.append(target_info)
    
    return {"data": target_list}


@router.get("/{target_uuid}")
def get_target(
    target_uuid: str,
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    """
    Get a specific target by ID.
    """
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    
    # Find the target
    target = db.query(Target).filter_by(uuid=target_uuid).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    
    # Check if the target belongs to the user
    if target.user_id != db_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this target")
    
    return {
        "id": target.id,
        "uuid": target.uuid,
        "name": target.name,
        "user_id": target.user_id,
        "created_at": target.created_at,
        "updated_at": target.updated_at
    }

@router.get("/{target_uuid}/flag")
async def get_target_flag(
    target_uuid: str,
    user: OIDCUser = Depends(idp.get_current_user),
    db: Session = Depends(get_db),
):
    target = db.query(Target).filter_by(uuid=target_uuid).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    
    try:
        ip_address = socket.gethostbyname(target.name)
    except socket.gaierror:
        return None

    try:
        async with httpx.AsyncClient() as client:
            ip_resp = await client.get(f"http://ip-api.com/json/{ip_address}")
            ip_data = ip_resp.json()
            if "countryCode" not in ip_data:
                raise HTTPException(status_code=500, detail="Failed to resolve IP location")

            country_code = ip_data["countryCode"]
            country = ip_data.get("country", "Unknown")
            flag_url = f"https://flagcdn.com/16x12/{country_code.lower()}.png"

        return JSONResponse({
            "country": country,
            "country_code": country_code,
            "flag_url": flag_url
        })
    except Exception as e:
        log.error(f"Error getting target flag: {e}")
        return None


@router.post("/")
def create_target(
    target_data: TargetBase,
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    """
    Create a new target.
    """
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    
    # Check if target with this name already exists for this user
    existing_target = db.query(Target).filter_by(user_id=db_user.id, name=target_data.name).first()
    if existing_target:
        raise HTTPException(status_code=400, detail="Target with this name already exists")
    
    # Create new target
    new_target = Target(
        name=target_data.name,
        user_id=db_user.id
    )
    
    db.add(new_target)
    db.commit()
    db.refresh(new_target)
    
    log.info(f"Target created: {new_target.name} by user {db_user.id}")
    
    return {
        "id": new_target.id,
        "uuid": new_target.uuid,
        "name": new_target.name,
        "user_id": new_target.user_id,
        "created_at": new_target.created_at,
        "updated_at": new_target.updated_at
    }


@router.put("/{target_uuid}")
def update_target(
    target_uuid: str,
    target_data: TargetBase,
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    """
    Update a target by ID.
    """
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    
    # Find the target
    target = db.query(Target).filter_by(uuid=target_uuid).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    
    # Check if the target belongs to the user
    if target.user_id != db_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this target")
    
    # Check if another target with this name already exists for this user
    existing_target = db.query(Target).filter_by(user_id=db_user.id, name=target_data.name).first()
    if existing_target and existing_target.uuid != target_uuid:
        raise HTTPException(status_code=400, detail="Target with this name already exists")
    
    # Update target
    target.name = target_data.name
    db.commit()
    db.refresh(target)
    
    log.info(f"Target updated: {target.name} by user {db_user.id}")
    
    return {
        "id": target.id,
        "uuid": target.uuid,
        "name": target.name,
        "user_id": target.user_id,
        "created_at": target.created_at,
        "updated_at": target.updated_at
    }


@router.delete("/{target_uuid}")
def delete_target(
    target_uuid: str,
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    """
    Delete a target by ID.
    """
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    
    # Find the target
    target = db.query(Target).filter_by(uuid=target_uuid).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    
    # Check if the target belongs to the user
    if target.user_id != db_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this target")
    
    # Delete the target (cascade will handle related records)
    db.delete(target)
    db.commit()
    
    log.info(f"Target {target_uuid} deleted by user {db_user.id}")
    return {"message": "Target deleted successfully"} 

@router.post("/bulk-delete")
def bulk_delete_targets(
    uuids: list[str],
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()

    targets = db.query(Target).filter(Target.uuid.in_(uuids)).all()

    for target in targets:
        if target.user_id != db_user.id:
            raise HTTPException(status_code=403, detail=f"Not authorized to delete target {target.uuid}")
        db.delete(target)

    db.commit()

    log.info(f"Targets {uuids} deleted by user {db_user.id}")
    return {"message": "Targets and associated findings deleted successfully"}
