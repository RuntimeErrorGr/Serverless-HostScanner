from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, Dict, Any, List
from app.utils.timezone import format_iso_bucharest, ensure_timezone
from .user import UserOut
from app.models.scan import ScanType


class ScanStartRequest(BaseModel):
    targets: List[str]
    type: ScanType
    scan_options: Optional[Dict[str, Any]] = None

class ScanBase(BaseModel):
    parameters: Dict[str, Any]
    status: Optional[str] = None
    output: Optional[str] = None


class ScanInDB(ScanBase):
    user_id: int
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: lambda dt: format_iso_bucharest(ensure_timezone(dt)) if dt else None
        }
    )


class ScanOut(ScanBase):
    id: int
    user_id: int
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    user: UserOut = None
    targets: Optional[List[str]] = []

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: lambda dt: format_iso_bucharest(ensure_timezone(dt)) if dt else None
        }
    )