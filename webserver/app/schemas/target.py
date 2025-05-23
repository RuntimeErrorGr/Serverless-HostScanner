from pydantic import BaseModel, IPvAnyAddress, constr, ConfigDict
from datetime import datetime
from typing import Optional, List
from app.utils.timezone import format_iso_bucharest, ensure_timezone
from .user import UserOut


class TargetBase(BaseModel):
    name: constr(max_length=255)


class TargetInDB(TargetBase):
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: lambda dt: format_iso_bucharest(ensure_timezone(dt)) if dt else None
        }
    )


class TargetOut(TargetBase):
    id: int
    user_id: int
    created_at: datetime
    scans: Optional[List[str]] = []
    user: Optional[UserOut] = None

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: lambda dt: format_iso_bucharest(ensure_timezone(dt)) if dt else None
        }
    ) 