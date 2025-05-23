from sqlalchemy import Column, String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.database.base_class import Base
from app.utils.timezone import now_utc
from app.models.scan import scan_target_association

class Target(Base):
    __tablename__ = 'targets'

    id = Column(Integer, primary_key=True)
    name = Column(String(255))
    user_id = Column(Integer, ForeignKey('users.id'))
    created_at = Column(DateTime, default=now_utc)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc)

    user = relationship("User", back_populates="targets")
    findings = relationship("Finding", back_populates="target", cascade="all, delete-orphan")
    scans = relationship(
        "Scan",
        secondary=scan_target_association,
        back_populates="targets"
    )

    def __repr__(self):
        return f"<Target(id={self.id}, name={self.name})>"