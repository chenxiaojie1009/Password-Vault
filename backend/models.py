"""Data models"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Enum as SAEnum, Boolean
)
from sqlalchemy.orm import relationship
from database import Base
import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


class DeviceType(str, enum.Enum):
    SERVER = "服务器"
    SWITCH = "交换机"
    ZONGJIA = "纵加设备"
    ROUTER = "路由器"
    FIREWALL = "防火墙"
    STORAGE = "存储设备"
    OTHER = "其他"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    display_name = Column(String(128), default="")
    role = Column(SAEnum(UserRole), default=UserRole.VIEWER, nullable=False)
    is_active = Column(Boolean, default=True)
    must_change_password = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    audit_logs = relationship("AuditLog", back_populates="user")
    password_changes = relationship("PasswordHistory", back_populates="changed_by_user")


class Device(Base):
    __tablename__ = "devices"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(256), nullable=False, index=True)
    device_type = Column(SAEnum(DeviceType), default=DeviceType.OTHER, nullable=False)
    location = Column(String(256), default="")
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    accounts = relationship("DeviceAccount", back_populates="device", cascade="all, delete-orphan")
    ips = relationship("DeviceIP", back_populates="device", cascade="all, delete-orphan")
    macs = relationship("DeviceMAC", back_populates="device", cascade="all, delete-orphan")


class DeviceIP(Base):
    __tablename__ = "device_ips"
    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    address = Column(String(64), nullable=False)
    label = Column(String(128), default="")
    device = relationship("Device", back_populates="ips")


class DeviceMAC(Base):
    __tablename__ = "device_macs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    address = Column(String(32), nullable=False)
    label = Column(String(128), default="")
    device = relationship("Device", back_populates="macs")


class DeviceAccount(Base):
    __tablename__ = "device_accounts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    username = Column(String(256), nullable=False)
    password_encrypted = Column(String(512), nullable=False)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    device = relationship("Device", back_populates="accounts")
    password_history = relationship("PasswordHistory", back_populates="account", cascade="all, delete-orphan")


class PasswordHistory(Base):
    __tablename__ = "password_history"
    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("device_accounts.id", ondelete="CASCADE"), nullable=False)
    old_password_hash = Column(String(512), nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    changed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    reason = Column(String(512), default="")
    account = relationship("DeviceAccount", back_populates="password_history")
    changed_by_user = relationship("User", back_populates="password_changes")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(64), nullable=False, index=True)
    target_type = Column(String(64), default="")
    target_id = Column(Integer, nullable=True)
    detail = Column(Text, default="")
    ip_address = Column(String(64), default="")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    user = relationship("User", back_populates="audit_logs")
