from sqlalchemy import Column, String, Integer, ForeignKey, Table, DateTime
from sqlalchemy.orm import relationship
from app.database.base_class import Base
from datetime import datetime

class Target(Base):
    __tablename__ = 'targets'

    id = Column(Integer, primary_key=True)
    name = Column(String(255))
    user_id = Column(Integer, ForeignKey('users.id'))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    user = relationship("User", back_populates="targets")
    scans = relationship("Scan", back_populates="target")

    def __repr__(self):
        return f"<Target(id={self.id}, name={self.name})>"