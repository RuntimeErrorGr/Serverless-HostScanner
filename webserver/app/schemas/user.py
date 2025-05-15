from pydantic import BaseModel, EmailStr, constr, ConfigDict
from datetime import datetime
from typing import Optional, List
from zoneinfo import ZoneInfo


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
            datetime: lambda dt: dt.astimezone(ZoneInfo("Europe/Bucharest")).isoformat()
        }
    )


class UserOut(UserBase):
    id: int
    keycloak_uuid: str
    created_at: datetime
    targets: Optional[List] = []
    scans: Optional[List] = []
