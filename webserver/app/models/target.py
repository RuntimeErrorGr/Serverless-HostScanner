from sqlalchemy import Column, String, Integer, ForeignKey, Table, DateTime
from sqlalchemy.orm import relationship
from app.database.base_class import Base
from datetime import datetime

scan_target_association = Table(
    'scan_targets', Base.metadata,
    Column('scan_id', Integer, ForeignKey('scans.id')),
    Column('target_id', Integer, ForeignKey('targets.id'))
)

class Target(Base):
    __tablename__ = 'targets'

    id = Column(Integer, primary_key=True)
    ip_address = Column(String(45))  # IPv6 addresses can be up to 45 chars
    hostname = Column(String(255))   # Standard max length for hostnames
    user_id = Column(Integer, ForeignKey('users.id'))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    user = relationship("User", back_populates="targets")
    scans = relationship("Scan", secondary=scan_target_association, back_populates="targets")

    def __repr__(self):
        return f"<Target(id={self.id}, ip_address={self.ip_address}, hostname={self.hostname})>"