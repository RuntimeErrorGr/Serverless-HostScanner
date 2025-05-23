from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Optional

# Define timezone constants
UTC = timezone.utc
BUCHAREST_TZ = ZoneInfo("Europe/Bucharest")

def now_utc() -> datetime:
    """Get current UTC datetime with timezone information"""
    return datetime.now(UTC)

def now_bucharest() -> datetime:
    """Get current Bucharest datetime with timezone information"""
    return datetime.now(BUCHAREST_TZ)

def to_bucharest(dt: datetime) -> datetime:
    """Convert datetime to Bucharest timezone"""
    if dt is None:
        return None
    
    # If datetime is naive, assume it's UTC (server time should be UTC)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    
    return dt.astimezone(BUCHAREST_TZ)

def to_utc(dt: datetime) -> datetime:
    """Convert datetime to UTC timezone"""
    if dt is None:
        return None
    
    # If datetime is naive, assume it's UTC (server time should be UTC)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    
    return dt.astimezone(UTC)

def format_bucharest(dt: datetime, format_str: str = "%Y-%m-%d %H:%M:%S") -> str:
    """Format datetime in Bucharest timezone"""
    if dt is None:
        return "N/A"
    
    bucharest_dt = to_bucharest(dt)
    return bucharest_dt.strftime(format_str)

def format_iso_bucharest(dt: datetime) -> str:
    """Format datetime as ISO string in Bucharest timezone"""
    if dt is None:
        return None
    
    bucharest_dt = to_bucharest(dt)
    return bucharest_dt.isoformat()

def format_iso_utc(dt: datetime) -> str:
    """Format datetime as ISO string in UTC timezone"""
    if dt is None:
        return None
    
    utc_dt = to_utc(dt)
    return utc_dt.isoformat()

# For backward compatibility with existing naive datetime objects
def ensure_timezone(dt: Optional[datetime], assume_utc: bool = True) -> Optional[datetime]:
    """Ensure datetime has timezone information"""
    if dt is None:
        return None
    
    if dt.tzinfo is None:
        if assume_utc:
            return dt.replace(tzinfo=UTC)
        else:
            return dt.replace(tzinfo=BUCHAREST_TZ)
    
    return dt

# For debugging and migration purposes
def convert_naive_to_utc(dt: datetime) -> datetime:
    """Convert a naive datetime to UTC, assuming it was stored as UTC"""
    if dt is None:
        return None
    
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    
    return dt.astimezone(UTC) 