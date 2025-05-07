from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.orm import relationship
from app.database.base_class import Base
from datetime import datetime

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    keycloack_uuid = Column(String(36), unique=True, index=True)
    name = Column(String(255))
    email = Column(String(255))
    scans = relationship("Scan", back_populates="user")
    targets = relationship("Target", back_populates="user")

    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    def __repr__(self):
        return f"<User(id={self.id}, keycloack_uuid={self.keycloack_uuid}, name={self.name}, email={self.email})>"