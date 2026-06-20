"""Pydantic request/response models."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, model_validator


class LoginRequest(BaseModel): username: str; password: str
class TokenResponse(BaseModel): access_token: str; token_type: str = "bearer"; username: str; display_name: str; role: str; must_change_password: bool = False

class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    display_name: str = ""; role: str = "viewer"

class UserResponse(BaseModel):
    id: int; username: str; display_name: str; role: str; is_active: bool; must_change_password: bool = False; created_at: datetime
    model_config = {"from_attributes": True}

class PasswordStrengthResult(BaseModel): score: int; level: str; feedback: str
class ChangePasswordRequest(BaseModel): old_password: str; new_password: str = Field(min_length=6)

class IPCreate(BaseModel): address: str = Field(min_length=1, max_length=64); label: str = ""
class MACCreate(BaseModel): address: str = Field(min_length=1, max_length=32); label: str = ""
class IPResponse(BaseModel): id: int; address: str; label: str; model_config = {"from_attributes": True}
class MACResponse(BaseModel): id: int; address: str; label: str; model_config = {"from_attributes": True}

class DeviceAccountCreate(BaseModel):
    username: str = Field(min_length=1, max_length=256)
    password: str = Field(min_length=1, max_length=256)
    notes: str = ""

class DeviceAccountResponse(BaseModel):
    id: int; username: str; notes: str; updated_at: Optional[datetime] = None
    password_encrypted: str = ""; password: str = ""
    model_config = {"from_attributes": True}

class DeviceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=256); device_type: str = "其他"
    location: str = ""; notes: str = ""
    ips: List[IPCreate] = []; macs: List[MACCreate] = []; accounts: List[DeviceAccountCreate] = []

class DeviceUpdate(BaseModel):
    name: Optional[str] = None; device_type: Optional[str] = None
    location: Optional[str] = None; notes: Optional[str] = None
    ips: Optional[List[IPCreate]] = None; macs: Optional[List[MACCreate]] = None

class DeviceResponse(BaseModel):
    id: int; name: str; device_type: str; location: str; notes: str
    created_at: datetime; updated_at: datetime
    ips: List[IPResponse] = []; macs: List[MACResponse] = []; accounts: List[DeviceAccountResponse] = []
    model_config = {"from_attributes": True}

class DeviceListItem(BaseModel):
    id: int; name: str; device_type: str; ip_address: str = ""; mac_address: str = ""
    account_count: int = 0; updated_at: datetime
    model_config = {"from_attributes": True}

class PasswordHistoryResponse(BaseModel):
    id: int; account_id: int; changed_by: int
    changed_by_name: str = ""; changed_at: datetime; reason: str
    account_name: str = ""; device_name: str = ""
    model_config = {"from_attributes": True}

class AuditLogResponse(BaseModel):
    id: int; username: str = ""; action: str; target_type: str
    target_id: Optional[int] = None; detail: str; ip_address: str; created_at: datetime
    model_config = {"from_attributes": True}

class BatchImportResult(BaseModel): total: int; success: int; failed: int; errors: List[str] = []
class BackupInfo(BaseModel): filename: str; size_bytes: int; created_at: str
class ExportRequest(BaseModel): format: str = "xlsx"; device_ids: Optional[List[int]] = None
