import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from fastapi_keycloak import OIDCUser
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.api.dependencies import idp
from app.log import get_logger
from app.database.db import get_db
from app.models.report import Report
from app.models.scan import Scan
from app.models.user import User
from app.utils.timezone import now_utc
from app.utils.email import email_service

router = APIRouter()

log = get_logger(__name__)


class EmailReportRequest(BaseModel):
    to: EmailStr
    subject: str
    message: Optional[str] = ""


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
            media_type = "text/plain"
        elif report.type.value == "csv":
            media_type = "text/csv"
    
    log.info(f"Report {report_uuid} downloaded by user {db_user.id}")
    
    return FileResponse(
        path=report.url,
        filename=filename,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/{report_uuid}/email")
async def email_report(
    report_uuid: str,
    email_request: EmailReportRequest,
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db),
):
    """
    Send a report file via email.
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
        raise HTTPException(status_code=400, detail="Report is not ready for sending")
    
    # Check if file exists
    if not report.url or not os.path.exists(report.url):
        raise HTTPException(status_code=404, detail="Report file not found")
    
    # Get sender details from user
    sender_email = user.email if hasattr(user, 'email') and user.email else db_user.email if hasattr(db_user, 'email') else "noreply@example.com"
    sender_name = user.preferred_username if hasattr(user, 'preferred_username') else db_user.username if hasattr(db_user, 'username') else None
    
    # Prepare email content
    if email_request.message:
        email_body = f"{email_request.message}\n\n---\n\nThis email contains a security scan report generated by the Host Scanner.\n\nReport Details:\n- Name: {report.name}\n- Format: {report.type.value.upper()}\n- Generated: {report.created_at.strftime('%Y-%m-%d %H:%M:%S UTC') if report.created_at else 'Unknown'}"
    else:
        email_body = f"Please find attached the security scan report.\n\nReport Details:\n- Name: {report.name}\n- Format: {report.type.value.upper()}\n- Generated: {report.created_at.strftime('%Y-%m-%d %H:%M:%S UTC') if report.created_at else 'Unknown'}\n\nThis report was automatically generated by the Host Scanner."
    
    # Determine attachment filename
    attachment_name = report.name or f"report-{report.id}"
    if report.type:
        if not attachment_name.endswith(f".{report.type.value}"):
            attachment_name += f".{report.type.value}"
    
    # Send email
    try:
        success = await email_service.send_email_with_attachment(
            sender_email=sender_email,
            sender_name=sender_name,
            recipient_email=str(email_request.to),
            subject=email_request.subject,
            body=email_body,
            attachment_path=report.url,
            attachment_name=attachment_name
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to send email")
        
        log.info(f"Report {report_uuid} emailed to {email_request.to} by user {db_user.id}")
        
        return {
            "message": "Email sent successfully",
            "recipient": str(email_request.to),
            "subject": email_request.subject
        }
        
    except Exception as e:
        log.error(f"Error sending email for report {report_uuid}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to send email")


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
