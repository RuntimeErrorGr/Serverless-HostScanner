from sqlalchemy import Column, String, Integer, DateTime, Boolean
from sqlalchemy.orm import relationship
from app.database.base_class import Base
from app.utils.timezone import now_utc

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    keycloak_uuid = Column(String(36), unique=True, index=True)
    username = Column(String(255))
    first_name = Column(String(255))
    last_name = Column(String(255))
    enabled = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)

    email = Column(String(255))
    scans = relationship("Scan", back_populates="user", cascade="all, delete-orphan")
    targets = relationship("Target", back_populates="user", cascade="all, delete-orphan")

    created_at = Column(DateTime, default=now_utc)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc)

    def __repr__(self):
        return f"<User(id={self.id}, keycloak_uuid={self.keycloak_uuid}, username={self.username}, email={self.email})>"