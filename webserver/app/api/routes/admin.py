from fastapi import APIRouter, Depends, HTTPException, status
from fastapi_keycloak import OIDCUser
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel

from app.api.dependencies import idp
from app.database.db import get_db
from app.models.user import User
from app.models.target import Target
from app.models.scan import Scan
from app.models.finding import Finding, PortState
from app.models.report import Report
from app.log import get_logger

log = get_logger(__name__)

router = APIRouter()

# Admin role check
def require_admin_role():
    """Dependency to ensure user has admin role"""
    return idp.get_current_user(required_roles=["admin"])

def check_user_admin_status(user_keycloak_uuid: str) -> bool:
    """Helper function to check if a user has admin role"""
    try:
        kc_roles = idp.get_user_roles(user_keycloak_uuid)
        log.debug(f"User roles: {kc_roles}")

        for role in kc_roles:
            if role.name == "admin":
                log.info(f"User {user_keycloak_uuid} has admin role in realmRoles")
                return True
                                    
        log.info(f"User {user_keycloak_uuid} does not have admin privileges")
        return False
        
    except Exception as e:
        log.warning(f"Could not check admin status for user {user_keycloak_uuid}: {e}")
        return False

# Pydantic models for request/response
class BanRequest(BaseModel):
    duration: int  # days
    reason: str

class UserStats(BaseModel):
    id: int
    keycloak_uuid: str
    username: str
    first_name: Optional[str]
    last_name: Optional[str]
    email: Optional[str]
    enabled: bool
    email_verified: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    total_scans: int
    total_targets: int
    total_findings: int
    total_reports: int

class AggregatedStats(BaseModel):
    total_users: int
    total_scans: int
    total_targets: int
    total_findings: int
    total_reports: int
    active_scanning_users: int

# User Management Endpoints
@router.get("/users", response_model=List[UserStats])
def get_all_users(
    user: OIDCUser = Depends(require_admin_role()),
    db: Session = Depends(get_db)
):
    """Get all users with their statistics"""
    try:
        # Query users with their aggregated statistics
        users_with_stats = db.query(
            User,
            func.count(Scan.id.distinct()).label("total_scans"),
            func.count(Target.id.distinct()).label("total_targets"),
            func.count(Finding.id.distinct()).label("total_findings"),
            func.count(Report.id.distinct()).label("total_reports")
        ).outerjoin(
            User.scans
        ).outerjoin(
            User.targets
        ).outerjoin(
            Target.findings
        ).outerjoin(
            Scan.reports
        ).group_by(User.id).all()

        result = []
        for user_data, scans, targets, findings, reports in users_with_stats:
            # Get user from Keycloak to check current enabled status
            try:
                kc_user = idp.get_user(user_id=user_data.keycloak_uuid)
                enabled = kc_user.enabled
                last_login = None  # TODO: Implement last login tracking
            except Exception as e:
                log.warning(f"Could not fetch Keycloak user {user_data.keycloak_uuid}: {e}")
                enabled = user_data.enabled if hasattr(user_data, 'enabled') else True
                last_login = None

            result.append(UserStats(
                id=user_data.id,
                keycloak_uuid=user_data.keycloak_uuid,
                username=user_data.username,
                first_name=user_data.first_name,
                last_name=user_data.last_name,
                email=user_data.email,
                enabled=enabled,
                email_verified=user_data.email_verified,
                created_at=user_data.created_at,
                last_login=last_login,
                total_scans=scans or 0,
                total_targets=targets or 0,
                total_findings=findings or 0,
                total_reports=reports or 0
            ))

        return result

    except Exception as e:
        log.error(f"Error fetching users: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch users")

@router.get("/users/{user_id}")
def get_user_details(
    user_id: str,
    user: OIDCUser = Depends(require_admin_role()),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific user, including related UUIDs and metadata"""
    try:
        db_user = db.query(User).filter(
            or_(
                User.keycloak_uuid == user_id,
                User.id == int(user_id) if user_id.isdigit() else False
            )
        ).first()

        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        try:
            kc_user = idp.get_user(user_id=db_user.keycloak_uuid)
        except Exception as e:
            log.warning(f"Could not fetch Keycloak user {db_user.keycloak_uuid}: {e}")
            raise HTTPException(status_code=404, detail="User not found in Keycloak")

        stats = db.query(
            func.count(Scan.id.distinct()).label("total_scans"),
            func.count(Target.id.distinct()).label("total_targets"),
            func.count(Finding.id.distinct()).label("total_findings"),
            func.count(Report.id.distinct()).label("total_reports")
        ).outerjoin(User.scans).outerjoin(User.targets).outerjoin(Target.findings).outerjoin(Scan.reports).filter(User.id == db_user.id).first()

        # Detailed related data
        scan_data = [
            {
                "uuid": scan.uuid,
                "name": scan.name,
                "created_at": scan.created_at,
                "status": scan.status.value
            }
            for scan in db_user.scans
        ]

        target_data = [
            {
                "uuid": target.uuid,
                "name": target.name,
                "created_at": target.created_at
            }
            for target in db_user.targets
        ]

        report_data = db.query(Report).join(Scan).filter(Scan.user_id == db_user.id).all()
        report_data = [
            {
                "status": report.status.value,
                "name": report.name,
                "created_at": report.created_at
            }
            for report in report_data
        ]

        finding_data = db.query(Finding).join(Target).filter(Target.user_id == db_user.id).all()
        finding_data = [
            {
                "uuid": finding.uuid,
                "name": finding.name,
                "created_at": finding.created_at,
                "severity": finding.severity.value
            }
            for finding in finding_data
        ]

        return {
            "id": db_user.id,
            "keycloak_uuid": db_user.keycloak_uuid,
            "username": kc_user.username,
            "first_name": kc_user.firstName,
            "last_name": kc_user.lastName,
            "email": kc_user.email,
            "enabled": kc_user.enabled,
            "email_verified": kc_user.emailVerified,
            "created_at": datetime.fromtimestamp(kc_user.createdTimestamp / 1000),
            "total_scans": stats.total_scans or 0,
            "total_targets": stats.total_targets or 0,
            "total_findings": stats.total_findings or 0,
            "total_reports": stats.total_reports or 0,
            "scans": scan_data,
            "targets": target_data,
            "reports": report_data,
            "findings": finding_data,
        }

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error fetching user details: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch user details")

@router.post("/users/{user_id}/ban")
def ban_user(
    user_id: str,
    ban_data: BanRequest,
    admin_user: OIDCUser = Depends(require_admin_role()),
    db: Session = Depends(get_db)
):
    """Ban a user by disabling them in Keycloak"""
    try:
        # Find user in database
        db_user = db.query(User).filter(
            or_(User.keycloak_uuid == user_id, User.id == int(user_id) if user_id.isdigit() else False)
        ).first()
        
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        # Get Keycloak user
        try:
            kc_user = idp.get_user(user_id=db_user.keycloak_uuid)
        except Exception as e:
            log.warning(f"Could not fetch Keycloak user {db_user.keycloak_uuid}: {e}")
            raise HTTPException(status_code=404, detail="User not found in Keycloak")

        # Update user in Keycloak to disable them
        kc_user.enabled = False
        
        # Add attributes for ban information
        if not kc_user.attributes:
            kc_user.attributes = {}
        
        ban_expiry = datetime.utcnow() + timedelta(days=ban_data.duration)
        kc_user.attributes.update({
            "ban_reason": [ban_data.reason],
            "ban_expiry": [ban_expiry.isoformat()],
            "banned_by": [admin_user.preferred_username or admin_user.sub],
            "banned_at": [datetime.utcnow().isoformat()]
        })

        # Update in Keycloak
        updated_user = idp.update_user(kc_user)
        
        log.info(f"User {db_user.username} banned by admin {admin_user.preferred_username} for {ban_data.duration} days. Reason: {ban_data.reason}")
        
        return {
            "message": f"User {kc_user.username} has been banned",
            "ban_expiry": ban_expiry.isoformat(),
            "reason": ban_data.reason
        }

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error banning user: {e}")
        raise HTTPException(status_code=500, detail="Failed to ban user")

@router.post("/users/{user_id}/unban")
def unban_user(
    user_id: str,
    admin_user: OIDCUser = Depends(require_admin_role()),
    db: Session = Depends(get_db)
):
    """Unban a user by enabling them in Keycloak"""
    try:
        # Find user in database
        db_user = db.query(User).filter(
            or_(User.keycloak_uuid == user_id, User.id == int(user_id) if user_id.isdigit() else False)
        ).first()
        
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        # Get Keycloak user
        try:
            kc_user = idp.get_user(user_id=db_user.keycloak_uuid)
        except Exception as e:
            log.warning(f"Could not fetch Keycloak user {db_user.keycloak_uuid}: {e}")
            raise HTTPException(status_code=404, detail="User not found in Keycloak")

        # Update user in Keycloak to enable them
        kc_user.enabled = True
        
        # Remove ban attributes
        if kc_user.attributes:
            ban_attrs = ["ban_reason", "ban_expiry", "banned_by", "banned_at"]
            for attr in ban_attrs:
                if attr in kc_user.attributes:
                    del kc_user.attributes[attr]

        # Update in Keycloak
        updated_user = idp.update_user(kc_user)
        
        log.info(f"User {db_user.username} unbanned by admin {admin_user.preferred_username}")
        
        return {
            "message": f"User {kc_user.username} has been unbanned"
        }

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error unbanning user: {e}")
        raise HTTPException(status_code=500, detail="Failed to unban user")

# Aggregated Statistics Endpoints
@router.get("/stats/aggregated")
def get_aggregated_stats(
    user: OIDCUser = Depends(require_admin_role()),
    db: Session = Depends(get_db)
):
    """Get aggregated platform statistics"""
    try:
        # Get counts for all main entities
        total_users = db.query(func.count(User.id)).scalar() or 0
        total_scans = db.query(func.count(Scan.id)).scalar() or 0
        total_targets = db.query(func.count(Target.id)).scalar() or 0
        total_findings = db.query(func.count(Finding.id)).scalar() or 0
        total_reports = db.query(func.count(Report.id)).scalar() or 0
        
        # Get active scanning users (users who have run scans in the last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        active_scanning_users = db.query(
            func.count(func.distinct(Scan.user_id))
        ).filter(Scan.created_at >= thirty_days_ago).scalar() or 0

        return AggregatedStats(
            total_users=total_users,
            total_scans=total_scans,
            total_targets=total_targets,
            total_findings=total_findings,
            total_reports=total_reports,
            active_scanning_users=active_scanning_users
        )

    except Exception as e:
        log.error(f"Error fetching aggregated stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch aggregated statistics")

@router.get("/stats/scan-trends")
def get_scan_trends(
    user: OIDCUser = Depends(require_admin_role()),
    db: Session = Depends(get_db)
):
    """Get scan trends over the last 12 months"""
    try:
        # Get scan counts by month for the last 12 months
        results = db.query(
            func.date_format(Scan.created_at, '%b').label("month"),
            func.count(Scan.id).label("value")
        ).filter(
            Scan.created_at >= datetime.utcnow() - timedelta(days=365)
        ).group_by(
            func.date_format(Scan.created_at, '%b')
        ).all()

        # Create month mapping
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        scan_trends = [{"name": month, "value": 0} for month in months]
        
        # Fill in actual data
        for month, value in results:
            for trend in scan_trends:
                if trend["name"] == month:
                    trend["value"] = value
                    break

        return scan_trends

    except Exception as e:
        log.error(f"Error fetching scan trends: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch scan trends")

@router.get("/stats/findings-by-port")
def get_findings_by_port(
    user: OIDCUser = Depends(require_admin_role()),
    db: Session = Depends(get_db)
):
    """Get top findings by port"""
    try:
        results = db.query(
            Finding.port,
            Finding.protocol,
            func.count(Finding.id).label("value")
        ).filter(
            Finding.port_state == PortState.OPEN
        ).group_by(
            Finding.port, Finding.protocol
        ).order_by(
            func.count(Finding.id).desc()
        ).limit(7).all()

        return [
            {
                "name": f"Port {port}/{protocol}",
                "value": value,
            }
            for port, protocol, value in results
        ]

    except Exception as e:
        log.error(f"Error fetching findings by port: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch findings by port")

@router.get("/stats/findings-by-service")
def get_findings_by_service(
    user: OIDCUser = Depends(require_admin_role()),
    db: Session = Depends(get_db)
):
    """Get findings by service type"""
    try:
        results = db.query(
            Finding.service,
            func.count(Finding.id).label("value")
        ).filter(
            Finding.service.isnot(None),
            Finding.service != ""
        ).group_by(
            Finding.service
        ).order_by(
            func.count(Finding.id).desc()
        ).limit(7).all()

        return [
            {
                "name": service.upper() if service else "UNKNOWN",
                "value": value,
            }
            for service, value in results if service
        ]

    except Exception as e:
        log.error(f"Error fetching findings by service: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch findings by service")

@router.get("/stats/user-activity") 
def get_user_activity(
    user: OIDCUser = Depends(require_admin_role()),
    db: Session = Depends(get_db)
):
    """Get user activity trends over the last 12 months"""
    try:
        # Get active users by month (users who created scans, targets, or had findings)
        results = db.query(
            func.date_format(Scan.created_at, '%b').label("month"),
            func.count(func.distinct(Scan.user_id)).label("value")
        ).filter(
            Scan.created_at >= datetime.utcnow() - timedelta(days=365)
        ).group_by(
            func.date_format(Scan.created_at, '%b')
        ).all()

        # Create month mapping
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        activity_trends = [{"name": month, "value": 0} for month in months]
        
        # Fill in actual data
        for month, value in results:
            for trend in activity_trends:
                if trend["name"] == month:
                    trend["value"] = value
                    break

        return activity_trends

    except Exception as e:
        log.error(f"Error fetching user activity: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch user activity")

@router.get("/stats/target-distribution")
def get_target_distribution(
    user: OIDCUser = Depends(require_admin_role()),
    db: Session = Depends(get_db)
):
    """Get target distribution by type (mock implementation)"""
    try:
        # This is a simplified implementation since we don't have target types in the current schema
        # In a real scenario, you'd have a target_type field or derive it from the target name/IP
        total_targets = db.query(func.count(Target.id)).scalar() or 0
        
        # Mock distribution based on target patterns (you can enhance this logic)
        return [
            {"name": "Web Applications", "value": int(total_targets * 0.4), "color": "#2563eb"},
            {"name": "Network Devices", "value": int(total_targets * 0.25), "color": "#16a34a"},
            {"name": "Servers", "value": int(total_targets * 0.2), "color": "#ca8a04"},
            {"name": "Cloud Resources", "value": int(total_targets * 0.1), "color": "#dc2626"},
            {"name": "IoT Devices", "value": int(total_targets * 0.05), "color": "#9333ea"},
        ]

    except Exception as e:
        log.error(f"Error fetching target distribution: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch target distribution")

@router.get("/stats/report-generation")
def get_report_generation_trends(
    user: OIDCUser = Depends(require_admin_role()),
    db: Session = Depends(get_db)
):
    """Get report generation trends over the last 12 months"""
    try:
        results = db.query(
            func.date_format(Report.created_at, '%b').label("month"),
            func.count(Report.id).label("value")
        ).filter(
            Report.created_at >= datetime.utcnow() - timedelta(days=365)
        ).group_by(
            func.date_format(Report.created_at, '%b')
        ).all()

        # Create month mapping
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        report_trends = [{"name": month, "value": 0} for month in months]
        
        # Fill in actual data
        for month, value in results:
            for trend in report_trends:
                if trend["name"] == month:
                    trend["value"] = value
                    break

        return report_trends

    except Exception as e:
        log.error(f"Error fetching report generation trends: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch report generation trends")

@router.get("/stats/findings-by-severity")
def get_findings_by_severity(
    user: OIDCUser = Depends(require_admin_role()),
    db: Session = Depends(get_db)
):
    """Get findings distribution by severity level"""
    try:
        results = db.query(
            Finding.severity,
            func.count(Finding.id).label("value")
        ).group_by(
            Finding.severity
        ).order_by(
            func.count(Finding.id).desc()
        ).all()


        return [
            {
                "name": severity.value.title() if severity else "Unknown",
                "value": value,
            }
            for severity, value in results
        ]

    except Exception as e:
        log.error(f"Error fetching findings by severity: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch findings by severity")


@router.get("/check-ban-status")
def check_ban_status(
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db)
):
    """Check if the current user is banned"""
    try:
        # Get user from database
        db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
        if not db_user:
            return {"is_banned": False}

        # Get Keycloak user to check ban status
        try:
            kc_user = idp.get_user(user_id=db_user.keycloak_uuid)
            
            # Check if user is disabled (banned)
            if not kc_user.enabled:
                ban_info = {}
                if kc_user.attributes:
                    ban_info = {
                        "reason": kc_user.attributes.get("ban_reason", ["No reason provided"])[0],
                        "expiry": kc_user.attributes.get("ban_expiry", [None])[0],
                        "banned_by": kc_user.attributes.get("banned_by", ["System"])[0],
                        "banned_at": kc_user.attributes.get("banned_at", [None])[0]
                    }
                
                return {
                    "is_banned": True,
                    "ban_info": ban_info
                }
            
            return {"is_banned": False}
            
        except Exception as e:
            log.warning(f"Could not fetch Keycloak user {db_user.keycloak_uuid}: {e}")
            return {"is_banned": False}

    except Exception as e:
        log.error(f"Error checking ban status: {e}")
        return {"is_banned": False}

@router.get("/check-admin-status")
def check_admin_status(
    user: OIDCUser = Depends(idp.get_current_user()),
    db: Session = Depends(get_db)
):
    """Check if the current user has admin privileges"""
    try:
        # Get user from database
        db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
        if not db_user:
            return {"is_admin": False}

        # Check admin status via Keycloak
        is_admin = check_user_admin_status(db_user.keycloak_uuid)
        
        return {"is_admin": is_admin}

    except Exception as e:
        log.error(f"Error checking admin status: {e}")
        return {"is_admin": False} 