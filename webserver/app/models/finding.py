from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from app.database.base_class import Base
from datetime import datetime
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
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    target_id = Column(Integer, ForeignKey('targets.id'))
    target = relationship("Target", back_populates="findings")


    