from fastapi import APIRouter, Depends, HTTPException
from fastapi_keycloak import OIDCUser
from sqlalchemy.orm import Session
import json

from app.api.dependencies import idp
from app.log import get_logger
from app.database.db import get_db
from app.models.finding import Finding, Severity
from app.models.target import Target
from app.models.user import User
from app.schemas.finding import FindingUpdate

router = APIRouter()

log = get_logger(__name__)


@router.get("/")
def get_findings(user: OIDCUser = Depends(idp.get_current_user()), db: Session = Depends(get_db)):
    """
    Get all findings for the current user.
    """
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    
    # Get all targets for this user
    user_target_ids = [target.id for target in db.query(Target).filter_by(user_id=db_user.id).all()]
    
    # Get all findings for user's targets
    findings = db.query(Finding).filter(Finding.target_id.in_(user_target_ids)).order_by(Finding.created_at.desc()).all()
    
    # Format findings data for frontend
    findings_list = []
    for finding in findings:
        finding_info = {
            "id": finding.id,
            "uuid": finding.uuid,
            "name": finding.name,
            "description": finding.description,
            "recommendation": finding.recommendation,
            "evidence": finding.evidence,
            "port": finding.port,
            "port_state": finding.port_state.value if finding.port_state else None,
            "protocol": finding.protocol,
            "service": finding.service,
            "os": finding.os,
            "traceroute": finding.traceroute,
            "severity": finding.severity.value if finding.severity else None,
            "target_id": finding.target_id,
            "target": {
                "id": finding.target.id,
                "name": finding.target.name
            } if finding.target else None,
            "created_at": finding.created_at,
            "updated_at": finding.updated_at
        }
        findings_list.append(finding_info)
    
    return {"data": findings_list}


@router.get("/{finding_uuid}")
def get_finding(
    finding_uuid: str,
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    """
    Get a specific finding by ID.
    """
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    
    # Find the finding
    finding = db.query(Finding).filter_by(uuid=finding_uuid).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    
    # Check if the finding belongs to a target owned by the user
    if finding.target.user_id != db_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this finding")
    
    # try to parse the evidence as json
    try:
        evidence = json.loads(finding.evidence)
    except:
        evidence = finding.evidence

    return {
        "id": finding.id,
        "uuid": finding.uuid,
        "name": finding.name,
        "description": finding.description,
        "recommendation": finding.recommendation,
        "evidence": evidence,
        "port": finding.port,
        "port_state": finding.port_state.value if finding.port_state else None,
        "protocol": finding.protocol,
        "service": finding.service,
        "os": finding.os,
        "traceroute": finding.traceroute,
        "severity": finding.severity.value if finding.severity else None,
        "target_id": finding.target_id,
        "target": {
            "id": finding.target.id,
            "name": finding.target.name
        } if finding.target else None,
        "created_at": finding.created_at,
        "updated_at": finding.updated_at
    }


@router.put("/{finding_uuid}")
def update_finding(
    finding_uuid: str,
    finding_data: FindingUpdate,
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    """
    Update a finding by ID.
    """
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    
    # Find the finding
    finding = db.query(Finding).filter_by(uuid=finding_uuid).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    
    # Check if the finding belongs to a target owned by the user
    if finding.target.user_id != db_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this finding")
    
    # Update finding fields if provided
    if finding_data.description is not None:
        finding.description = finding_data.description
    if finding_data.recommendation is not None:
        finding.recommendation = finding_data.recommendation
    if finding_data.severity is not None:
        finding.severity = Severity(finding_data.severity.lower())
    
    db.commit()
    db.refresh(finding)
    
    log.info(f"Finding {finding_uuid} updated by user {db_user.id}")
    
    return {
        "id": finding.id,
        "uuid": finding.uuid,
        "name": finding.name,
        "description": finding.description,
        "recommendation": finding.recommendation,
        "evidence": finding.evidence,
        "port": finding.port,
        "port_state": finding.port_state.value if finding.port_state else None,
        "protocol": finding.protocol,
        "service": finding.service,
        "os": finding.os,
        "traceroute": finding.traceroute,
        "severity": finding.severity.value if finding.severity else None,
        "target_id": finding.target_id,
        "target": {
            "id": finding.target.id,
            "name": finding.target.name
        } if finding.target else None,
        "created_at": finding.created_at,
        "updated_at": finding.updated_at
    }


@router.delete("/{finding_uuid}")
def delete_finding(
    finding_uuid: str,
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    """
    Delete a finding by ID.
    """
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    
    # Find the finding
    finding = db.query(Finding).filter_by(uuid=finding_uuid).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    
    # Check if the finding belongs to a target owned by the user
    if finding.target.user_id != db_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this finding")
    
    # Delete the finding
    db.delete(finding)
    db.commit()
    
    log.info(f"Finding {finding_uuid} deleted by user {db_user.id}")
    return {"message": "Finding deleted successfully"}

@router.post("/bulk-delete")
def bulk_delete_findings(
    uuids: list[str],
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    """
    Bulk delete findings by UUIDs.
    """
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    
    # Delete the findings
    db.query(Finding).filter(Finding.uuid.in_(uuids)).delete()
    db.commit()

    log.info(f"Findings {uuids} deleted by user {db_user.id}")
    return {"message": "Findings deleted successfully"}

@router.get("/by-target/{target_uuid}")
def get_findings_by_target(
    target_uuid: str,
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    """
    Get all findings for a specific target.
    """
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    
    # Find the target and verify ownership
    target = db.query(Target).filter_by(uuid=target_uuid).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    
    if target.user_id != db_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this target's findings")
    
    # Get all findings for this target
    findings = db.query(Finding).filter_by(target_id=target.id).order_by(Finding.created_at.desc()).all()
    
    # Format findings data for frontend
    findings_list = []
    for finding in findings:
        finding_info = {
            "id": finding.id,
            "uuid": finding.uuid,
            "name": finding.name,
            "description": finding.description,
            "recommendation": finding.recommendation,
            "evidence": finding.evidence,
            "port": finding.port,
            "port_state": finding.port_state.value if finding.port_state else None,
            "protocol": finding.protocol,
            "service": finding.service,
            "os": finding.os,
            "traceroute": finding.traceroute,
            "severity": finding.severity.value if finding.severity else None,
            "target_id": finding.target_id,
            "target_uuid": target_uuid,
            "created_at": finding.created_at,
            "updated_at": finding.updated_at
        }
        findings_list.append(finding_info)
    
    return {"data": findings_list} 