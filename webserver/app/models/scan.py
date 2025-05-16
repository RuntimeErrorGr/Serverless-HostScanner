from sqlalchemy import Column, String, Integer, ForeignKey, Text, JSON, DateTime, Table
from sqlalchemy.orm import relationship
from sqlalchemy import Enum as SqlEnum

from app.database.base_class import Base
from datetime import datetime
from enum import Enum

scan_target_association = Table(
    "scan_target_association",
    Base.metadata,
    Column("scan_id", Integer, ForeignKey("scans.id", ondelete="CASCADE"), primary_key=True),
    Column("target_id", Integer, ForeignKey("targets.id", ondelete="CASCADE"), primary_key=True),
)

class ScanStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

class ScanType(Enum):
    DEFAULT = "default"
    CUSTOM = "custom"

class Scan(Base):
    __tablename__ = 'scans'

    id = Column(Integer, primary_key=True)
    uuid = Column(String(36))
    status = Column(SqlEnum(ScanStatus, name="scan_status"), default=ScanStatus.PENDING)
    type = Column(SqlEnum(ScanType, name="scan_type"), default=ScanType.DEFAULT)
    output = Column(Text)
    parameters = Column(JSON)
    result = Column(JSON)
    created_at = Column(DateTime, default=datetime.now)
    started_at = Column(DateTime)
    finished_at = Column(DateTime)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    user_id = Column(Integer, ForeignKey('users.id'))
    user = relationship("User", back_populates="scans")

    targets = relationship(
        "Target",
        secondary=scan_target_association,
        back_populates="scans"
    )

    def __repr__(self):
        return f"<Scan(id={self.id}, status={self.status}, output={self.output}, result={self.result}, parameters={self.parameters})>"