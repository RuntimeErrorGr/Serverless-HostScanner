from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, Dict, Any, List
from zoneinfo import ZoneInfo
from .user import UserOut
from .target import TargetOut


class ScanBase(BaseModel):
    parameters: Dict[str, Any]
    status: Optional[str] = None
    output: Optional[str] = None
    result: Optional[Dict[str, Any]] = None


class ScanInDB(ScanBase):
    user_id: int
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: lambda dt: dt.astimezone(ZoneInfo("Europe/Bucharest")).isoformat()
        }
    )


class ScanOut(ScanBase):
    id: int
    user_id: int
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    user: UserOut = None
    targets: Optional[List[TargetOut]] = []