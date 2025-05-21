from sqlalchemy import Column, String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.database.base_class import Base
from datetime import datetime
from sqlalchemy import Enum as SqlEnum
from enum import Enum

class ReportStatus(Enum):
    PENDING = "pending"
    GENERATED = "generated"
    FAILED = "failed"

class ReportType(Enum):
    PDF = "pdf"
    JSON = "json"
    CSV = "csv"

class Report(Base):
    __tablename__ = 'reports'

    id = Column(Integer, primary_key=True)
    name = Column(String(255))
    
    status = Column(SqlEnum(ReportStatus), default=ReportStatus.PENDING)
    url = Column(String(255))
    type = Column(SqlEnum(ReportType), default=ReportType.PDF)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    last_downloaded_at = Column(DateTime)

    scan_id = Column(Integer, ForeignKey('scans.id', ondelete="CASCADE"))
    scan = relationship("Scan", back_populates="reports")

    def __repr__(self):
        return f"<Report(id={self.id}, name='{self.name}')>"
