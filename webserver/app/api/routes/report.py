import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from fastapi_keycloak import OIDCUser
from sqlalchemy.orm import Session
from datetime import datetime

from app.api.dependencies import idp
from app.log import get_logger
from app.database.db import get_db
from app.models.report import Report
from app.models.scan import Scan
from app.models.user import User
from app.utils.timezone import now_utc

router = APIRouter()

log = get_logger(__name__)


@router.get("/")
def get_reports(user: OIDCUser = Depends(idp.get_current_user()), db: Session = Depends(get_db)):
    """
    Get all reports for the current user.
    """
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    if not db_user:
        raise HTTPException(status_code=403, detail="User not found")
    
    # Get all reports for scans owned by this user
    reports = (
        db.query(Report)
        .join(Scan)
        .filter(Scan.user_id == db_user.id)
        .order_by(Report.created_at.desc())
        .all()
    )
    
    # Format reports data for frontend
    reports_list = []
    for report in reports:
        report_info = {
            "id": report.id,
            "uuid": report.uuid,
            "name": report.name,
            "type": report.type.value if report.type else None,
            "status": report.status.value if report.status else None,
            "url": report.url,
            "scan_id": report.scan_id,
            "created_at": report.created_at,
            "updated_at": report.updated_at,
            "last_downloaded_at": report.last_downloaded_at
        }
        reports_list.append(report_info)
    
    return {"data": reports_list}


@router.get("/{report_uuid}")
def get_report(
    report_uuid: str,
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    """
    Get a specific report by ID.
    """
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    if not db_user:
        raise HTTPException(status_code=403, detail="User not found")
    
    # Find the report and check ownership through scan
    report = (
        db.query(Report)
        .join(Scan)
        .filter(Report.uuid == report_uuid)
        .filter(Scan.user_id == db_user.id)
        .first()
    )
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return {
        "id": report.id,
        "uuid": report.uuid,
        "name": report.name,
        "type": report.type.value if report.type else None,
        "status": report.status.value if report.status else None,
        "url": report.url,
        "scan_id": report.scan_id,
        "created_at": report.created_at,
        "updated_at": report.updated_at,
        "last_downloaded_at": report.last_downloaded_at
    }


@router.get("/{report_uuid}/download")
def download_report(
    report_uuid: str,
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    """
    Download a report file.
    """
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    if not db_user:
        raise HTTPException(status_code=403, detail="User not found")
    
    # Find the report and check ownership through scan
    report = (
        db.query(Report)
        .join(Scan)
        .filter(Report.uuid == report_uuid)
        .filter(Scan.user_id == db_user.id)
        .first()
    )
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Check if report is generated
    if report.status.value != "generated":
        raise HTTPException(status_code=400, detail="Report is not ready for download")
    
    # Check if file exists
    if not report.url or not os.path.exists(report.url):
        raise HTTPException(status_code=404, detail="Report file not found")
    
    # Update last downloaded timestamp
    report.last_downloaded_at = now_utc()
    db.commit()
    
    # Determine filename and media type
    filename = report.name or f"report-{report.id}"
    if report.type:
        filename += f".{report.type.value}"
    
    media_type = "application/octet-stream"
    if report.type:
        if report.type.value == "pdf":
            media_type = "application/pdf"
        elif report.type.value == "json":
            media_type = "application/json"
        elif report.type.value == "csv":
            media_type = "text/csv"
    
    log.info(f"Report {report_uuid} downloaded by user {db_user.id}")
    
    return FileResponse(
        path=report.url,
        filename=filename,
        media_type=media_type
    )


@router.delete("/{report_uuid}")
def delete_report(
    report_uuid: str,
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    """
    Delete a report by ID.
    """
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    if not db_user:
        raise HTTPException(status_code=403, detail="User not found")
    
    # Find the report and check ownership through scan
    report = (
        db.query(Report)
        .join(Scan)
        .filter(Report.uuid == report_uuid)
        .filter(Scan.user_id == db_user.id)
        .first()
    )
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Delete the file if it exists
    if report.url and os.path.exists(report.url):
        try:
            os.remove(report.url)
            log.info(f"Report file {report.url} deleted")
        except Exception as e:
            log.warning(f"Failed to delete report file {report.url}: {e}")
    
    # Delete the report record
    db.delete(report)
    db.commit()
    
    log.info(f"Report {report_uuid} deleted by user {db_user.id}")
    return {"message": "Report deleted successfully"} 

@router.post("/bulk-delete")
def bulk_delete_reports(
    uuids: list[str],
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    """
    Bulk delete reports by UUIDs.
    """
    # Get the user from db with the keycloak_uuid
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    if not db_user:
        raise HTTPException(status_code=403, detail="User not found")
    
    # Fetch reports
    reports = db.query(Report).filter(Report.uuid.in_(uuids)).all()

    deleted = []

    for report in reports:
        if report.scan.user_id != db_user.id:
            raise HTTPException(status_code=403, detail=f"Not authorized to delete report {report.uuid}")
        db.delete(report)
        deleted.append(report.uuid)

    db.commit()

    log.info(f"Reports {deleted} deleted by user {db_user.id}")
    return {"message": f"{len(deleted)} report(s) deleted successfully."}
