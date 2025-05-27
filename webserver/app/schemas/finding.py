from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, Dict, Any
from app.utils.timezone import format_iso_bucharest, ensure_timezone
from app.models.finding import Severity, PortState


class FindingBase(BaseModel):
    name: Optional[str] = None
    uuid: Optional[str] = None
    description: Optional[str] = None
    recommendation: Optional[str] = None
    evidence: Optional[str] = None
    port: Optional[int] = None
    port_state: Optional[PortState] = None
    protocol: Optional[str] = None
    service: Optional[str] = None
    os: Optional[Dict[str, Any]] = None
    traceroute: Optional[Dict[str, Any]] = None
    severity: Optional[Severity] = None


class FindingUpdate(BaseModel):
    description: Optional[str] = None
    recommendation: Optional[str] = None
    severity: Optional[str] = None


class FindingOut(FindingBase):
    id: int
    target_id: int
    created_at: datetime
    updated_at: datetime
    target: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: lambda dt: format_iso_bucharest(ensure_timezone(dt)) if dt else None
        }
    ) 