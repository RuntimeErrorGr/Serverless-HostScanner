from pydantic import BaseModel, EmailStr, constr, ConfigDict
from datetime import datetime
from typing import Optional, List
from app.utils.timezone import format_iso_bucharest, ensure_timezone


class UserBase(BaseModel):
    username: constr(min_length=3, max_length=255)
    first_name: Optional[str]
    last_name: Optional[str]
    email: Optional[EmailStr]
    enabled: Optional[bool] = True
    email_verified: Optional[bool] = False


class UserInDB(UserBase):
    keycloak_uuid: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: lambda dt: format_iso_bucharest(ensure_timezone(dt)) if dt else None
        }
    )


class UserOut(UserBase):
    id: int
    keycloak_uuid: str
    created_at: datetime
    targets: Optional[List] = []
    scans: Optional[List] = []

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: lambda dt: format_iso_bucharest(ensure_timezone(dt)) if dt else None
        }
    )
