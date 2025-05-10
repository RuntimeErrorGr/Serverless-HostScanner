from pydantic import BaseModel, IPvAnyAddress, constr, ConfigDict
from datetime import datetime
from typing import Optional, List
from zoneinfo import ZoneInfo
from .scan import ScanOut
from .user import UserOut


class TargetBase(BaseModel):
    ip_address: IPvAnyAddress
    hostname: Optional[constr(max_length=255)] = None


class TargetInDB(TargetBase):
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: lambda dt: dt.astimezone(ZoneInfo("Europe/Bucharest")).isoformat()
        }
    )


class TargetOut(TargetBase):
    id: int
    user_id: int
    created_at: datetime
    scans: Optional[List[ScanOut]] = []
    user: Optional[UserOut] = None 