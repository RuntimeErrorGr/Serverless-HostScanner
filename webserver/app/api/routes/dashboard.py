from fastapi import APIRouter, Depends, HTTPException
from fastapi_keycloak import OIDCUser
from sqlalchemy.orm import Session
from sqlalchemy import func, case, text, extract
from datetime import datetime, timedelta

from app.api.dependencies import idp
from app.database.db import get_db
from app.models.user import User
from app.models.target import Target
from app.models.scan import Scan, ScanStatus
from app.models.finding import Finding, Severity, PortState
from app.log import get_logger


log = get_logger(__name__)

router = APIRouter()

@router.get("/stats")
def get_stats(user: OIDCUser = Depends(idp.get_current_user()), db: Session = Depends(get_db)):
    '''
    Returns penetration testing statistics for the logged-in user:
    - totalTargets (+delta)
    - averageScansPerTarget (+delta)
    - averageScanTime (+delta)
    - activeScans (pending + running)
    '''

    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    if not db_user:
        return {
            "totalTargets": 0,
            "averageScansPerTarget": 0,
            "averageScanTime": "00:00:00",
            "activeScans": 0,
            "pendingScans": 0,
            "runningScans": 0,
            "deltas": {}
        }

    # --- Current month ---
    now = datetime.utcnow()
    current_month_start = datetime(now.year, now.month, 1)
    
    # --- Last month ---
    last_month_end = current_month_start - timedelta(days=1)
    last_month_start = datetime(last_month_end.year, last_month_end.month, 1)

    # --- Targets ---
    current_targets = db.query(Target).filter(Target.user_id == db_user.id).count()
    last_month_targets = db.query(Target).filter(
        Target.user_id == db_user.id,
        Target.created_at >= last_month_start,
        Target.created_at < current_month_start
    ).count()

    # --- Scans (current) ---
    current_scan_stats = db.query(
        func.count(Scan.id).label("total_scans"),
        func.avg(func.timestampdiff(text('SECOND'), Scan.started_at, Scan.finished_at)).label("avg_duration"),
        func.sum(case((Scan.status == ScanStatus.PENDING, 1), else_=0)).label("pending_scans"),
        func.sum(case((Scan.status == ScanStatus.RUNNING, 1), else_=0)).label("running_scans")
    ).filter(Scan.user_id == db_user.id).one()

    # --- Scans (last month only) ---
    last_month_scan_stats = db.query(
        func.count(Scan.id).label("total_scans"),
        func.avg(func.timestampdiff(text('SECOND'), Scan.started_at, Scan.finished_at)).label("avg_duration")
    ).filter(
        Scan.user_id == db_user.id,
        Scan.started_at >= last_month_start,
        Scan.started_at < current_month_start
    ).one()

    avg_scans_per_target = current_scan_stats.total_scans / current_targets if current_targets else 0
    last_avg_scans_per_target = last_month_scan_stats.total_scans / last_month_targets if last_month_targets else 0

    current_avg_duration = int(current_scan_stats.avg_duration or 0)
    last_avg_duration = int(last_month_scan_stats.avg_duration or 0)

    def format_duration(seconds):
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        return f"{hours:02}h:{minutes:02}m:{secs:02}s"

    stats = {
        "totalTargets": current_targets,
        "averageScansPerTarget": round(avg_scans_per_target, 2),
        "averageScanTime": format_duration(current_avg_duration),
        "activeScans": (current_scan_stats.running_scans or 0) + (current_scan_stats.pending_scans or 0),
        "pendingScans": current_scan_stats.pending_scans or 0,
        "runningScans": current_scan_stats.running_scans or 0,
        "deltas": {
            "totalTargets": current_targets - last_month_targets,
            "averageScansPerTarget": round(avg_scans_per_target - last_avg_scans_per_target, 2),
            "averageScanTime": f"{current_avg_duration - last_avg_duration:+d}s"
        }
    }

    return stats


@router.get("/scan-activity")
def get_scan_activity(user: OIDCUser = Depends(idp.get_current_user()), db: Session = Depends(get_db)):
    '''
    Returns the number of scans per month for the logged-in user.
    The data is returned in the following format:
    [
        {"name": "Jan", "value": 10},
        {"name": "Feb", "value": 20},
        {"name": "Mar", "value": 15},
        {"name": "Apr", "value": 25},
        {"name": "May", "value": 30},
        {"name": "Jun", "value": 20},
        {"name": "Jul", "value": 35},
        ...
    ]
    '''

    # Get user object
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    if not db_user:
        return []

    # Get scan activity
    scan_activity = db.query(
        func.date_format(Scan.started_at, '%b').label("month"),
        func.count(Scan.id).label("scans")
    ).filter_by(user_id=db_user.id).group_by("month").all()

    # Convert to list of dictionaries
    scan_activity = [{"name": row.month, "value": row.scans} for row in scan_activity]

    # Add missing months
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    for month in months:
        if not any(row["name"] == month for row in scan_activity):
            scan_activity.append({"name": month, "value": 0})
    
    # sort in calendar order
    scan_activity.sort(key=lambda x: months.index(x["name"]))
    log.info("Scan activity: %s", scan_activity)
    return scan_activity

@router.get("/vulnerability-trends")
def get_vulnerability_trends(user: OIDCUser = Depends(idp.get_current_user()), db: Session = Depends(get_db)):
    """
    Returns number of findings per severity per month for the current user:
    [
        { name: "Jan", critical: 2, high: 5, medium: 8, low: 12, info: 15 },
        ...
    ]
    """

    # Get the user
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    if not db_user:
        return []

    # Query findings grouped by month and severity
    results = (
        db.query(
            extract('month', Finding.created_at).label("month"),
            func.sum(case((Finding.severity == Severity.CRITICAL, 1), else_=0)).label("critical"),
            func.sum(case((Finding.severity == Severity.HIGH, 1), else_=0)).label("high"),
            func.sum(case((Finding.severity == Severity.MEDIUM, 1), else_=0)).label("medium"),
            func.sum(case((Finding.severity == Severity.LOW, 1), else_=0)).label("low"),
            func.sum(case((Finding.severity == Severity.INFO, 1), else_=0)).label("info")
        )
        .join(Finding.target)
        .filter(Target.user_id == db_user.id)
        .group_by(extract('month', Finding.created_at))
        .order_by(extract('month', Finding.created_at))
        .all()
    )

    # Month number → name mapping
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul",
                   "Aug", "Sep", "Oct", "Nov", "Dec"]

    # Format results
    trends = [
        {
            "name": month_names[int(month) - 1],
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low,
            "info": info
        }
        for month, critical, high, medium, low, info in results
    ]

    # sort in calendar order
    trends.sort(key=lambda x: month_names.index(x["name"]))
    log.info("Vulnerability trends: %s", trends)
    return trends

@router.get("/open-ports")
def get_open_ports(user: OIDCUser = Depends(idp.get_current_user()), db: Session = Depends(get_db)):
    """
    Get the number of open ports from the findings table for the current user.
    Returns a list of dicts: [{ name: "Port 80", value: 124 }, ...]
    """

    # Get the user object
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    if not db_user:
        return []

    # Query: Count open ports from findings related to the user's targets
    results = (
        db.query(Finding.port, func.count(Finding.id).label("count"))
        .join(Finding.target)
        .filter(Target.user_id == db_user.id, Finding.port_state == PortState.OPEN)
        .group_by(Finding.port)
        .order_by(func.count(Finding.id).desc())
        .all()
    )

    # Format the result
    open_ports = [{"name": f"Port {port}", "value": count} for port, count in results]
    log.info("Open ports: %s", open_ports)
    return open_ports


@router.get("/protocols")
def get_protocols(user: OIDCUser = Depends(idp.get_current_user()), db: Session = Depends(get_db)):
    """
    Returns protocol usage frequency for the current user in this format:
    [
        { "name": "HTTP", "value": 124 },
        { "name": "HTTPS", "value": 98 },
        ...
    ]
    """

    # Get the user
    db_user = db.query(User).filter_by(keycloak_uuid=user.sub).first()
    if not db_user:
        return []

    # Query findings by protocol
    results = (
        db.query(Finding.protocol, func.count(Finding.id).label("count"))
        .join(Finding.target)
        .filter(Target.user_id == db_user.id)
        .group_by(Finding.protocol)
        .order_by(func.count(Finding.id).desc())
        .all()
    )

    # Format result
    protocols = [
        {"name": protocol.upper() if protocol else "UNKNOWN", "value": count}
        for protocol, count in results
    ]

    log.info("Protocols: %s", protocols)
    return protocols



