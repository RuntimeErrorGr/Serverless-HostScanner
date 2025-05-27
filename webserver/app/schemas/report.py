from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional
from app.utils.timezone import format_iso_bucharest, ensure_timezone
from app.models.report import ReportStatus, ReportType


class ReportBase(BaseModel):
    name: Optional[str] = None
    uuid: Optional[str] = None
    type: Optional[ReportType] = None
    status: Optional[ReportStatus] = None


class ReportOut(ReportBase):
    id: int
    scan_id: int
    url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    last_downloaded_at: Optional[datetime] = None

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: lambda dt: format_iso_bucharest(ensure_timezone(dt)) if dt else None
        }
    ) 