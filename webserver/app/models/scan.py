from sqlalchemy import Column, String, Integer, ForeignKey, Text, JSON, DateTime
from sqlalchemy.orm import relationship
from app.database.base_class import Base
from datetime import datetime


class Scan(Base):
    __tablename__ = 'scans'

    id = Column(Integer, primary_key=True)
    status = Column(String(50))
    output = Column(Text)
    parameters = Column(JSON)
    result = Column(JSON)
    created_at = Column(DateTime, default=datetime.now)
    started_at = Column(DateTime)
    finished_at = Column(DateTime)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    user_id = Column(Integer, ForeignKey('users.id'))
    user = relationship("User", back_populates="scans")
    targets = relationship("Target", secondary="scan_targets", back_populates="scans")

    def __repr__(self):
        return f"<Scan(id={self.id}, status={self.status}, output={self.output}, result={self.result}, parameters={self.parameters})>"