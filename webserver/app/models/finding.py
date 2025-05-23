from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from app.database.base_class import Base
from app.utils.timezone import now_utc
from sqlalchemy import Enum as SqlEnum
from enum import Enum

class PortState(Enum):
    OPEN = "open"
    CLOSED = "closed"
    FILTERED = "filtered"
    UNKNOWN = "unknown"

class Severity(Enum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class Finding(Base):
    __tablename__ = 'findings'

    id = Column(Integer, primary_key=True)
    name = Column(String(255))
    description = Column(String(1024))
    recommendation = Column(String(1024))
    port = Column(Integer)
    port_state = Column(SqlEnum(PortState), default=PortState.FILTERED)
    protocol = Column(String(255))
    service = Column(String(255))
    os = Column(JSON)
    traceroute = Column(JSON)
    severity = Column(SqlEnum(Severity), default=Severity.INFO)
    created_at = Column(DateTime, default=now_utc)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc)

    target_id = Column(Integer, ForeignKey('targets.id'))
    target = relationship("Target", back_populates="findings")

    def __repr__(self):
        return f"<Finding(id={self.id}, name={self.name})>"


    