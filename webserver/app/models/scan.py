from sqlalchemy import Column, String, Integer, ForeignKey, JSON, DateTime, Table, Float
from sqlalchemy.orm import relationship
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.dialects.mysql import LONGTEXT

from app.database.base_class import Base
from app.utils.timezone import now_utc
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
    DEEP = "deep"

class Scan(Base):
    __tablename__ = 'scans'

    id = Column(Integer, primary_key=True)
    uuid = Column(String(36))
    name = Column(String(255))
    status = Column(SqlEnum(ScanStatus, name="scan_status"), default=ScanStatus.PENDING)
    type = Column(SqlEnum(ScanType, name="scan_type"), default=ScanType.DEFAULT)
    output = Column(LONGTEXT)
    result = Column(LONGTEXT)
    parameters = Column(JSON)
    created_at = Column(DateTime, default=now_utc)
    started_at = Column(DateTime)
    finished_at = Column(DateTime)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc)

    user_id = Column(Integer, ForeignKey('users.id'))
    user = relationship("User", back_populates="scans")
    reports = relationship("Report", back_populates="scan", cascade="all, delete-orphan")

    targets = relationship(
        "Target",
        secondary=scan_target_association,
        back_populates="scans"
    )

    def __repr__(self):
        return f"<Scan(id={self.id}, status={self.status}, output={self.output}, parameters={self.parameters})"