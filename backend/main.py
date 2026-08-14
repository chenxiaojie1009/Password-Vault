"""
Password Manager Backend - FastAPI
"""
import os, sys, re, io, json, shutil, uuid, subprocess
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from apscheduler.schedulers.background import BackgroundScheduler

# Base directory: works both in dev and PyInstaller bundle
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
    FRONTEND_DIR = os.path.join(sys._MEIPASS, "frontend", "dist")
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend", "dist")

# Redirect stdout/stderr for noconsole builds (uvicorn needs a valid fd)
if sys.stdout is None:
    sys.stdout = open(os.path.join(BASE_DIR, "server.log"), "a", encoding="utf-8")
if sys.stderr is None:
    sys.stderr = sys.stdout
from database import engine, get_db, Base
from models import (
    User, Device, DeviceIP, DeviceMAC, DeviceAccount,
    PasswordHistory, AuditLog, SystemConfig, DeviceVisibility, DeviceFile, beijing_now
)
from schemas import (
    LoginRequest, TokenResponse, UserCreate, UserResponse,
    DeviceCreate, DeviceUpdate, DeviceResponse, DeviceListItem,
    DeviceAccountCreate, DeviceAccountResponse,
    IPCreate, IPResponse, MACCreate, MACResponse,
    PasswordHistoryResponse, AuditLogResponse,
    PasswordStrengthResult, BatchImportResult, BackupInfo, ExportRequest, ChangePasswordRequest,
    ResetPasswordRequest, UserUpdate, DeviceFileResponse, DeviceFileUploadResult,
)
from auth import (
    hash_password, verify_password, encrypt_password, decrypt_password,
    create_access_token, get_current_user, require_admin, require_write, require_operator,
)

# ---- Device level helpers ----
# Role-level mapping: max device level each role can access
ROLE_MAX_LEVEL = {"admin": 4, "operator": 3, "editor": 2, "viewer": 1}
LEVEL_NUM = {"一级设备": 1, "二级设备": 2, "三级设备": 3, "四级设备": 4}


def role_max_level(role: str) -> int:
    """Max device level (1-4) a role can create/edit/view."""
    return ROLE_MAX_LEVEL.get(role, 1)


def device_level_num(level: str) -> int:
    """Convert device level string to number (default 1)."""
    return LEVEL_NUM.get(level or "", 1)


def allowed_levels(role: str) -> list:
    """List of level strings a role may access."""
    max_lv = role_max_level(role)
    return [lv for lv, n in LEVEL_NUM.items() if n <= max_lv]


def check_level_access(device_level: str, current_user: User, hidden: bool = False):
    """Raise 403/404 if role cannot access device of given level."""
    if device_level_num(device_level) > role_max_level(current_user.role):
        if hidden:
            raise HTTPException(status_code=404, detail="设备不存在")
        raise HTTPException(status_code=403, detail="无权操作该等级设备")

scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 初始化默认管理员（若不存在）
    db = next(get_db())
    try:
        init_admin(db)
    finally:
        db.close()
    # 清理上次升级残留标记（应用重启后视为升级完成）
    try:
        if os.path.exists(UPGRADE_APPLYING_FLAG):
            os.remove(UPGRADE_APPLYING_FLAG)
    except Exception:
        pass
    # 每天凌晨 2:00 自动备份
    scheduler.add_job(perform_backup, "cron", hour=2, minute=0, id="daily_backup")
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="Password Manager", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
Base.metadata.create_all(bind=engine)
BACKUP_DIR = os.path.join(BASE_DIR, "backups")
os.makedirs(BACKUP_DIR, exist_ok=True)

UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ---- Online Upgrade (v2.0) ----
APP_VERSION = "2.0.0"
UPGRADE_DIR = os.path.join(BASE_DIR, "upgrade")
os.makedirs(UPGRADE_DIR, exist_ok=True)
UPGRADE_NEW_EXE = os.path.join(UPGRADE_DIR, "DeviceManager_new.exe")
UPGRADE_VERSION_FILE = os.path.join(UPGRADE_DIR, "version.json")
UPGRADE_APPLYING_FLAG = os.path.join(BASE_DIR, "upgrade_applying.flag")
MAX_UPGRADE_SIZE = 300 * 1024 * 1024  # 300 MB

MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100 MB
ALLOWED_EXTENSIONS = {
    '.doc', '.docx', '.xls', '.xlsx', '.pdf',
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'
}


def init_admin(db: Session):
    if not db.query(User).filter(User.username == "admin").first():
        db.add(User(username="admin", password_hash=hash_password("admin123"),
                    display_name="Administrator", role="admin",
                    must_change_password=True))
        db.commit()


def write_audit(db: Session, user_id: int, action: str, target_type: str = "",
                target_id: int = None, detail: str = "", ip_address: str = ""):
    db.add(AuditLog(user_id=user_id, action=action, target_type=target_type,
                    target_id=target_id, detail=detail, ip_address=ip_address))
    db.commit()


def _account_to_response(a: DeviceAccount) -> DeviceAccountResponse:
    plain = ""
    try: plain = decrypt_password(a.password_encrypted)
    except Exception: plain = "[decrypt error]"
    return DeviceAccountResponse(
        id=a.id, username=a.username, notes=a.notes, updated_at=a.updated_at,
        password_encrypted=a.password_encrypted, password=plain,
    )


def check_password_strength(password: str) -> PasswordStrengthResult:
    score = 0; parts = []
    if len(password) >= 8: score += 1
    else: parts.append("至少8位")
    if re.search(r"[a-z]", password): score += 1
    else: parts.append("需要小写字母")
    if re.search(r"[A-Z]", password): score += 1
    else: parts.append("需要大写字母")
    if re.search(r"[0-9]", password): score += 1
    else: parts.append("需要数字")
    if re.search(r"[^a-zA-Z0-9]", password): score += 1
    else: parts.append("建议特殊字符")
    levels = {0: "weak", 1: "weak", 2: "fair", 3: "good", 4: "strong", 5: "strong"}
    level = levels.get(score, "weak")
    feedback = "; ".join(parts) if score < 4 else "密码强度良好"
    return PasswordStrengthResult(score=score, level=level, feedback=feedback)


# ---- Auth ----
@app.post("/api/auth/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if not user.is_active: raise HTTPException(status_code=403, detail="账户已禁用")
    token = create_access_token(data={"sub": user.id})
    write_audit(db, user.id, "login", "system", detail=f"用户 {user.username} 登录",
                ip_address=request.client.host if request.client else "")
    return TokenResponse(access_token=token, username=user.username,
                         display_name=user.display_name or user.username, role=user.role,
                         must_change_password=user.must_change_password)

@app.get("/api/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)): return current_user

@app.post("/api/auth/change-password")
def change_my_password(body: ChangePasswordRequest, db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    if not verify_password(body.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="原密码错误")
    current_user.password_hash = hash_password(body.new_password)
    current_user.must_change_password = False
    db.commit()
    write_audit(db, current_user.id, "change_password", "user", current_user.id, "修改密码")
    return {"ok": True}


# ---- Users ----
@app.get("/api/users", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(User).order_by(User.created_at.desc()).all()

@app.post("/api/users", response_model=UserResponse)
def create_user(body: UserCreate, db: Session = Depends(get_db), admin_user: User = Depends(require_admin)):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="用户名已存在")
    role = body.role
    if role not in ("admin", "editor", "viewer", "operator"):
        # Allow custom roles from config, but ensure it's not empty
        if not role or not role.strip():
            raise HTTPException(status_code=400, detail="无效角色")
    u = User(username=body.username, password_hash=hash_password(body.password),
             display_name=body.display_name or body.username, role=role,
             must_change_password=True)
    db.add(u); db.commit(); db.refresh(u)
    write_audit(db, admin_user.id, "create_user", "user", u.id, f"创建用户 {u.username}")
    return u

@app.put("/api/users/{user_id}", response_model=UserResponse)
def update_user(user_id: int, body: UserUpdate, db: Session = Depends(get_db),
                admin_user: User = Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u: raise HTTPException(status_code=404, detail="用户不存在")
    if body.display_name is not None: u.display_name = body.display_name
    if body.password is not None and body.password != "":
        u.password_hash = hash_password(body.password)
        u.must_change_password = True
    if body.role is not None:
        if not body.role.strip():
            raise HTTPException(status_code=400, detail="无效角色")
        u.role = body.role
    if body.is_active is not None:
        if u.id == admin_user.id and body.is_active == False:
            raise HTTPException(status_code=400, detail="不可禁用自己")
        u.is_active = body.is_active
    if body.must_change_password is not None: u.must_change_password = body.must_change_password
    db.commit(); db.refresh(u)
    write_audit(db, admin_user.id, "update_user", "user", u.id, f"更新用户 {u.username}")
    return u

@app.put("/api/users/{user_id}/reset-password")
def reset_user_password(user_id: int, body: ResetPasswordRequest, db: Session = Depends(get_db),
                        admin_user: User = Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u: raise HTTPException(status_code=404, detail="用户不存在")
    u.password_hash = hash_password(body.new_password)
    u.must_change_password = True
    db.commit()
    write_audit(db, admin_user.id, "reset_password", "user", u.id, f"重置用户 {u.username} 密码")
    return {"ok": True}

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), admin_user: User = Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u: raise HTTPException(status_code=404, detail="用户不存在")
    if u.role == "admin": raise HTTPException(status_code=400, detail="不可删除管理员")
    db.delete(u); db.commit()
    write_audit(db, admin_user.id, "delete_user", "user", user_id, f"删除用户 {u.username}")
    return {"ok": True}


@app.post("/api/users/import")
async def import_users(file: UploadFile = File(...), db: Session = Depends(get_db),
                       admin_user: User = Depends(require_admin)):
    try: import openpyxl
    except ImportError: raise HTTPException(status_code=500, detail="openpyxl 未安装")
    result = {"total": 0, "success": 0, "failed": 0, "errors": []}
    try:
        contents = await file.read(); wb = openpyxl.load_workbook(io.BytesIO(contents)); ws = wb.active
        rows = list(ws.iter_rows(min_row=2, values_only=True)); result["total"] = len(rows)
        for i, row in enumerate(rows, 2):
            try:
                vals = [str(c).strip() if c else "" for c in row]
                uname = vals[0] if len(vals) > 0 else ""
                pwd = vals[1] if len(vals) > 1 else ""
                dname = vals[2] if len(vals) > 2 else ""
                role = vals[3] if len(vals) > 3 else "viewer"
                if not uname: result["failed"] += 1; result["errors"].append(f"第{i}行：用户名为空"); continue
                if not pwd or len(pwd) < 6: result["failed"] += 1; result["errors"].append(f"第{i}行：密码至少6位"); continue
                if db.query(User).filter(User.username == uname).first():
                    result["failed"] += 1; result["errors"].append(f"第{i}行：用户 {uname} 已存在"); continue
                if role not in ("admin", "editor", "viewer", "operator"): role = "viewer"
                u = User(username=uname, password_hash=hash_password(pwd),
                         display_name=dname or uname, role=role, must_change_password=True)
                db.add(u); result["success"] += 1
            except Exception as e: result["failed"] += 1; result["errors"].append(f"第{i}行：{str(e)}")
        db.commit()
    except Exception as e: raise HTTPException(status_code=400, detail=f"解析失败: {str(e)}")
    write_audit(db, admin_user.id, "import", "user", detail=f"导入用户: {result['success']}成功/{result['failed']}失败")
    return result


# ---- Config ----
@app.get("/api/config/{key}")
def get_config(key: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    items = db.query(SystemConfig).filter(SystemConfig.key == key).all()
    return [{"id": i.id, "key": i.key, "value": i.value} for i in items]

@app.post("/api/config/{key}")
def add_config(key: str, body: dict, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    val = body.get("value", "")
    if not val: raise HTTPException(status_code=400, detail="value 不能为空")
    if db.query(SystemConfig).filter(SystemConfig.key == key, SystemConfig.value == val).first():
        raise HTTPException(status_code=400, detail="已存在")
    item = SystemConfig(key=key, value=val)
    db.add(item); db.commit()
    return {"ok": True, "id": item.id}

@app.delete("/api/config/{item_id}")
def delete_config(item_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    item = db.query(SystemConfig).filter(SystemConfig.id == item_id).first()
    if not item: raise HTTPException(status_code=404, detail="不存在")
    db.delete(item); db.commit()
    return {"ok": True}


# ---- Device Visibility ----
@app.get("/api/devices/{device_id}/visibility")
def get_device_visibility(device_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    rows = db.query(DeviceVisibility).filter(DeviceVisibility.device_id == device_id).all()
    return [{"user_id": r.user_id} for r in rows]

@app.post("/api/devices/{device_id}/visibility")
def set_device_visibility(device_id: int, body: dict, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    # Clear existing
    db.query(DeviceVisibility).filter(DeviceVisibility.device_id == device_id).delete()
    for uid in body.get("user_ids", []):
        db.add(DeviceVisibility(device_id=device_id, user_id=int(uid)))
    db.commit()
    return {"ok": True}

@app.get("/api/users/{user_id}/devices")
def get_user_devices(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    rows = db.query(DeviceVisibility).filter(DeviceVisibility.user_id == user_id).all()
    return [{"device_id": r.device_id} for r in rows]

@app.post("/api/users/{user_id}/devices")
def set_user_devices(user_id: int, body: dict, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    db.query(DeviceVisibility).filter(DeviceVisibility.user_id == user_id).delete()
    for did in body.get("device_ids", []):
        db.add(DeviceVisibility(user_id=user_id, device_id=int(did)))
    db.commit()
    return {"ok": True}


# ---- Password check ----
@app.post("/api/password/check", response_model=PasswordStrengthResult)
def password_check(body: dict, _: User = Depends(get_current_user)):
    return check_password_strength(body.get("password", ""))


def _first_ip(device: Device) -> str:
    return device.ips[0].address if device.ips else ""

def _first_mac(device: Device) -> str:
    return device.macs[0].address if device.macs else ""

def _sync_ips_macs(device: Device, ips: list, macs: list, db: Session):
    if ips is not None:
        for old in device.ips: db.delete(old)
        for ip in ips: db.add(DeviceIP(device_id=device.id, address=ip.address, label=ip.label))
    if macs is not None:
        for old in device.macs: db.delete(old)
        for mac in macs: db.add(DeviceMAC(device_id=device.id, address=mac.address, label=mac.label))


def _visible_devices_query(db: Session, current_user: User):
    """Return a device query filtered by the current user's role visibility.

    - viewer/editor: only non-network-involved devices
    - every role: only devices up to its max level
    """
    q = db.query(Device)
    if current_user.role in ("viewer", "editor"):
        q = q.filter(Device.is_network_involved == False)
    q = q.filter(Device.device_level.in_(allowed_levels(current_user.role)))
    return q


# ---- Devices ----
@app.get("/api/devices")
def list_devices(keyword: str = Query(""), device_type: str = Query(""),
                 page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
                 db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = _visible_devices_query(db, current_user)
    if keyword:
        kw = f"%{keyword}%"
        ip_dev_ids = select(DeviceIP.device_id).where(DeviceIP.address.contains(kw))
        mac_dev_ids = select(DeviceMAC.device_id).where(DeviceMAC.address.contains(kw))
        acct_dev_ids = select(DeviceAccount.device_id).where(DeviceAccount.username.contains(kw))
        q = q.filter(
            Device.name.contains(kw)
            | Device.notes.contains(kw)
            | Device.location.contains(kw)
            | Device.id.in_(ip_dev_ids)
            | Device.id.in_(mac_dev_ids)
            | Device.id.in_(acct_dev_ids)
        )
    if device_type: q = q.filter(Device.device_type == device_type)

    total = q.count(); devices = q.order_by(Device.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [DeviceListItem(
        id=d.id, name=d.name,
        device_type=d.device_type,
        ip_address=_first_ip(d), mac_address=_first_mac(d),
        account_count=db.query(func.count(DeviceAccount.id)).filter(DeviceAccount.device_id == d.id).scalar() or 0,
        is_network_involved=d.is_network_involved, device_level=d.device_level,
        updated_at=d.updated_at,
    ) for d in devices], "total": total}


@app.get("/api/devices/{device_id}", response_model=DeviceResponse)
def get_device(device_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    d = db.query(Device).filter(Device.id == device_id).first()
    if not d: raise HTTPException(status_code=404, detail="设备不存在")
    if current_user.role in ("viewer", "editor") and d.is_network_involved:
        raise HTTPException(status_code=404, detail="设备不存在")
    # Level-based access control (hide as 404 for read)
    check_level_access(d.device_level, current_user, hidden=True)
    return DeviceResponse(
        id=d.id, name=d.name,
        device_type=d.device_type,
        location=d.location, notes=d.notes, is_network_involved=d.is_network_involved, device_level=d.device_level,
        created_at=d.created_at, updated_at=d.updated_at,
        ips=[IPResponse(id=ip.id, address=ip.address, label=ip.label) for ip in d.ips],
        macs=[MACResponse(id=m.id, address=m.address, label=m.label) for m in d.macs],
        accounts=[_account_to_response(a) for a in d.accounts],
    )


@app.post("/api/devices", response_model=DeviceResponse)
def create_device(body: DeviceCreate, request: Request, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    # Level-based creation: role can only create devices up to its max level
    check_level_access(body.device_level or "一级设备", current_user)
    d = Device(name=body.name, device_type=body.device_type or "其他",
               location=body.location, notes=body.notes, created_by=current_user.id, device_level=body.device_level or "一级设备",
               is_network_involved=body.is_network_involved)
    db.add(d); db.flush()
    for ip in (body.ips or []): db.add(DeviceIP(device_id=d.id, address=ip.address, label=ip.label))
    for mac in (body.macs or []): db.add(DeviceMAC(device_id=d.id, address=mac.address, label=mac.label))
    for ac in body.accounts:
        enc = encrypt_password(ac.password)
        a = DeviceAccount(device_id=d.id, username=ac.username, password_encrypted=enc, notes=ac.notes)
        db.add(a); db.flush()
        db.add(PasswordHistory(account_id=a.id, old_password_hash=enc, old_password=ac.password, changed_by=current_user.id, reason="初始创建"))
    db.commit(); db.refresh(d)
    ip = request.client.host if request.client else ""
    write_audit(db, current_user.id, "create", "device", d.id, f"创建设备 {d.name}", ip)
    # Build response directly (not via get_device) so the creator sees it even if
    # network-involved devices are hidden from their role afterwards.
    return DeviceResponse(
        id=d.id, name=d.name,
        device_type=d.device_type,
        location=d.location, notes=d.notes, is_network_involved=d.is_network_involved, device_level=d.device_level,
        created_at=d.created_at, updated_at=d.updated_at,
        ips=[IPResponse(id=ip.id, address=ip.address, label=ip.label) for ip in d.ips],
        macs=[MACResponse(id=m.id, address=m.address, label=m.label) for m in d.macs],
        accounts=[_account_to_response(a) for a in d.accounts],
    )


@app.put("/api/devices/{device_id}", response_model=DeviceResponse)
def update_device(device_id: int, body: DeviceUpdate, request: Request,
                  db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    d = db.query(Device).filter(Device.id == device_id).first()
    if not d: raise HTTPException(status_code=404, detail="设备不存在")
    if current_user.role in ("viewer", "editor") and d.is_network_involved:
        raise HTTPException(status_code=404, detail="设备不存在")
    # Level-based edit: role can only edit devices up to its max level
    check_level_access(d.device_level, current_user)
    if body.device_level is not None:
        # Upgrading level is also limited by role
        check_level_access(body.device_level, current_user)
    if body.name is not None: d.name = body.name
    if body.device_type is not None:
        d.device_type = body.device_type
    if body.location is not None: d.location = body.location
    if body.notes is not None: d.notes = body.notes
    if body.is_network_involved is not None: d.is_network_involved = body.is_network_involved
    if body.device_level is not None: d.device_level = body.device_level
    
    _sync_ips_macs(d, body.ips, body.macs, db)
    d.updated_at = beijing_now()
    db.commit(); db.refresh(d)
    ip = request.client.host if request.client else ""
    write_audit(db, current_user.id, "update", "device", d.id, f"更新设备 {d.name}", ip)
    return get_device(d.id, db, current_user)


@app.delete("/api/devices/{device_id}")
def delete_device(device_id: int, request: Request, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    d = db.query(Device).filter(Device.id == device_id).first()
    if not d: raise HTTPException(status_code=404, detail="设备不存在")
    if current_user.role in ("viewer", "editor") and d.is_network_involved:
        raise HTTPException(status_code=404, detail="设备不存在")
    # Level-based delete: role can only delete devices up to its max level
    check_level_access(d.device_level, current_user)
    name = d.name; db.delete(d); db.commit()
    ip = request.client.host if request.client else ""
    write_audit(db, current_user.id, "delete", "device", device_id, f"删除设备 {name}", ip)
    return {"ok": True}


# ---- Accounts ----
def _check_account_device_access(a: DeviceAccount, db: Session, current_user: User):
    """Resolve account's device and enforce level/network access."""
    dev = db.query(Device).filter(Device.id == a.device_id).first()
    if not dev: raise HTTPException(status_code=404, detail="账号不存在")
    if current_user.role in ("viewer", "editor") and dev.is_network_involved:
        raise HTTPException(status_code=404, detail="账号不存在")
    check_level_access(dev.device_level, current_user)
    return dev


@app.post("/api/devices/{device_id}/accounts", response_model=DeviceAccountResponse)
def add_account(device_id: int, body: DeviceAccountCreate, request: Request,
                db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev: raise HTTPException(status_code=404, detail="设备不存在")
    if current_user.role in ("viewer", "editor") and dev.is_network_involved:
        raise HTTPException(status_code=404, detail="设备不存在")
    check_level_access(dev.device_level, current_user)
    enc = encrypt_password(body.password)
    a = DeviceAccount(device_id=device_id, username=body.username, password_encrypted=enc, notes=body.notes)
    db.add(a); db.flush()
    db.add(PasswordHistory(account_id=a.id, old_password_hash=enc, old_password=body.password, changed_by=current_user.id, reason="新增账号"))
    db.commit(); db.refresh(a)
    write_audit(db, current_user.id, "create", "account", a.id,
                f"为设备 {dev.name} 添加账号 {body.username}",
                request.client.host if request.client else "")
    return _account_to_response(a)


@app.put("/api/accounts/{account_id}", response_model=DeviceAccountResponse)
def update_account_password(account_id: int, body: DeviceAccountCreate, request: Request,
                            db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    a = db.query(DeviceAccount).filter(DeviceAccount.id == account_id).first()
    if not a: raise HTTPException(status_code=404, detail="账号不存在")
    _check_account_device_access(a, db, current_user)
    old_enc = a.password_encrypted
    old_plain = ""
    try: old_plain = decrypt_password(old_enc)
    except Exception: old_plain = ""
    a.password_encrypted = encrypt_password(body.password)
    a.notes = body.notes if body.notes else a.notes
    a.updated_at = beijing_now()
    db.add(PasswordHistory(account_id=a.id, old_password_hash=old_enc, old_password=old_plain, changed_by=current_user.id,
           reason=body.notes or "密码变更"))
    db.commit(); db.refresh(a)
    write_audit(db, current_user.id, "update", "account", a.id,
                f"修改账号 {a.username} 密码", request.client.host if request.client else "")
    return _account_to_response(a)


@app.delete("/api/accounts/{account_id}")
def delete_account(account_id: int, request: Request, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    a = db.query(DeviceAccount).filter(DeviceAccount.id == account_id).first()
    if not a: raise HTTPException(status_code=404, detail="账号不存在")
    _check_account_device_access(a, db, current_user)
    db.delete(a); db.commit()
    write_audit(db, current_user.id, "delete", "account", account_id,
                f"删除账号 {a.username}", request.client.host if request.client else "")
    return {"ok": True}


# ---- Device Files ----
def _file_to_response(f: DeviceFile, db: Session) -> DeviceFileResponse:
    u = db.query(User).filter(User.id == f.upload_by).first()
    return DeviceFileResponse(
        id=f.id, device_id=f.device_id,
        original_filename=f.original_filename, file_size=f.file_size,
        file_type=f.file_type,
        upload_by_name=u.display_name or u.username if u else "",
        created_at=f.created_at,
    )


def _check_file_device_access(device_id: int, db: Session, current_user: User, write_required: bool = False):
    """Check device access; raise HTTPException if not allowed."""
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="设备不存在")
    if current_user.role in ("viewer", "editor") and dev.is_network_involved:
        raise HTTPException(status_code=404, detail="设备不存在")
    # Level-based access control
    check_level_access(dev.device_level, current_user, hidden=not write_required)
    if write_required:
        # Level-based write access is enforced by check_level_access above
        pass
    return dev


@app.get("/api/devices/{device_id}/files", response_model=List[DeviceFileResponse])
def list_device_files(device_id: int, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    _check_file_device_access(device_id, db, current_user)
    files = db.query(DeviceFile).filter(DeviceFile.device_id == device_id)\
              .order_by(DeviceFile.created_at.desc()).all()
    return [_file_to_response(f, db) for f in files]


@app.post("/api/devices/{device_id}/files", response_model=DeviceFileUploadResult)
async def upload_device_files(device_id: int, files: List[UploadFile] = File(...),
                               db: Session = Depends(get_db),
                               current_user: User = Depends(get_current_user)):
    _check_file_device_access(device_id, db, current_user, write_required=True)
    result = DeviceFileUploadResult(success=0, failed=0, errors=[])
    device_dir = os.path.join(UPLOAD_DIR, str(device_id))
    os.makedirs(device_dir, exist_ok=True)
    for file in files:
        try:
            # Validate extension
            ext = os.path.splitext(file.filename or "")[1].lower()
            if ext not in ALLOWED_EXTENSIONS:
                result.failed += 1
                result.errors.append(f"{file.filename}: 不支持的文件类型 {ext}")
                continue
            # Read and validate size
            contents = await file.read()
            if len(contents) > MAX_UPLOAD_SIZE:
                result.failed += 1
                result.errors.append(f"{file.filename}: 文件超过 100MB")
                continue
            # Sanitize filename and save
            safe_name = re.sub(r'[\\/:*?"<>|]', '_', file.filename or "unnamed")
            stored_name = f"{uuid.uuid4().hex}_{safe_name}"
            dest = os.path.join(device_dir, stored_name)
            with open(dest, "wb") as f:
                f.write(contents)
            # Create DB record
            df = DeviceFile(
                device_id=device_id,
                filename=stored_name,
                original_filename=safe_name,
                file_size=len(contents),
                file_type=ext.lstrip('.'),
                upload_by=current_user.id,
            )
            db.add(df)
            result.success += 1
        except Exception as e:
            result.failed += 1
            result.errors.append(f"{file.filename}: {str(e)}")
    db.commit()
    if result.success > 0:
        write_audit(db, current_user.id, "upload", "file", device_id,
                    f"上传 {result.success} 个文件")
    return result


@app.get("/api/files/{file_id}/download")
def download_file(file_id: int, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    f = db.query(DeviceFile).filter(DeviceFile.id == file_id).first()
    if not f: raise HTTPException(status_code=404, detail="文件不存在")
    _check_file_device_access(f.device_id, db, current_user)
    dest = os.path.join(UPLOAD_DIR, str(f.device_id), f.filename)
    if not os.path.exists(dest): raise HTTPException(status_code=404, detail="文件数据不存在")
    # Determine MIME type
    mime_map = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
        'gif': 'image/gif', 'bmp': 'image/bmp', 'webp': 'image/webp',
    }
    media_type = mime_map.get(f.file_type, 'application/octet-stream')
    return FileResponse(dest, filename=f.original_filename, media_type=media_type)


@app.delete("/api/files/{file_id}")
def delete_file(file_id: int, request: Request, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    f = db.query(DeviceFile).filter(DeviceFile.id == file_id).first()
    if not f: raise HTTPException(status_code=404, detail="文件不存在")
    _check_file_device_access(f.device_id, db, current_user, write_required=True)
    # Remove from disk
    dest = os.path.join(UPLOAD_DIR, str(f.device_id), f.filename)
    if os.path.exists(dest):
        os.remove(dest)
    # Remove from DB
    db.delete(f); db.commit()
    write_audit(db, current_user.id, "delete", "file", file_id,
                f"删除文件 {f.original_filename}")
    # Clean empty device directory
    device_dir = os.path.join(UPLOAD_DIR, str(f.device_id))
    try:
        if os.path.exists(device_dir) and not os.listdir(device_dir):
            os.rmdir(device_dir)
    except Exception:
        pass
    return {"ok": True}


# ---- Password History ----
def _pw_hist_to_response(h: PasswordHistory, db: Session) -> PasswordHistoryResponse:
    u = db.query(User).filter(User.id == h.changed_by).first()
    a = db.query(DeviceAccount).filter(DeviceAccount.id == h.account_id).first()
    dev = db.query(Device).filter(Device.id == a.device_id).first() if a else None
    return PasswordHistoryResponse(
        id=h.id, account_id=h.account_id, changed_by=h.changed_by,
        changed_by_name=u.display_name or u.username if u else "未知",
        changed_at=h.changed_at, reason=h.reason,
        old_password=h.old_password or "",
        account_name=a.username if a else "",
        device_name=dev.name if dev else "",
    )

@app.get("/api/accounts/{account_id}/history", response_model=List[PasswordHistoryResponse])
def get_password_history(account_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    acct = db.query(DeviceAccount).filter(DeviceAccount.id == account_id).first()
    if not acct: raise HTTPException(status_code=404, detail="账号不存在")
    dev = db.query(Device).filter(Device.id == acct.device_id).first()
    if dev and current_user.role in ("viewer", "editor") and dev.is_network_involved:
        raise HTTPException(status_code=404, detail="账号不存在")
    if dev:
        check_level_access(dev.device_level, current_user, hidden=True)
    history = db.query(PasswordHistory).filter(PasswordHistory.account_id == account_id)\
               .order_by(PasswordHistory.changed_at.desc()).all()
    return [_pw_hist_to_response(h, db) for h in history]

@app.get("/api/password-history", response_model=List[PasswordHistoryResponse])
def list_all_password_history(device_id: int = Query(None), start_date: str = Query(""),
                              end_date: str = Query(""), page: int = Query(1, ge=1),
                              page_size: int = Query(50, ge=1, le=200),
                              db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(PasswordHistory)
    # Filter by device visibility + level for viewer/editor
    if current_user.role in ("viewer", "editor"):
        vis_dev = select(Device.id).where(Device.is_network_involved == False)
        vis_acc = select(DeviceAccount.id).where(DeviceAccount.device_id.in_(vis_dev))
        q = q.filter(PasswordHistory.account_id.in_(vis_acc))
    # Level-based filtering: role can only see history of devices up to its max level
    lvl_dev = select(Device.id).where(Device.device_level.in_(allowed_levels(current_user.role)))
    lvl_acc = select(DeviceAccount.id).where(DeviceAccount.device_id.in_(lvl_dev))
    q = q.filter(PasswordHistory.account_id.in_(lvl_acc))
    if device_id:
        subq = select(DeviceAccount.id).where(DeviceAccount.device_id == device_id)
        q = q.filter(PasswordHistory.account_id.in_(subq))
    if start_date:
        try: q = q.filter(PasswordHistory.changed_at >= datetime.fromisoformat(start_date))
        except ValueError: pass
    if end_date:
        try: q = q.filter(PasswordHistory.changed_at <= datetime.fromisoformat(end_date))
        except ValueError: pass
    history = q.order_by(PasswordHistory.changed_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return [_pw_hist_to_response(h, db) for h in history]


# ---- Audit Logs ----
@app.get("/api/audit-logs", response_model=List[AuditLogResponse])
def list_audit_logs(action: str = Query(""), user_id: int = Query(None), username: str = Query(""),
                    start_date: str = Query(""), end_date: str = Query(""),
                    page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
                    response: Response = None,
                    db: Session = Depends(get_db), _: User = Depends(require_admin)):
    q = db.query(AuditLog)
    if action: q = q.filter(AuditLog.action == action)
    if user_id: q = q.filter(AuditLog.user_id == user_id)
    if username:
        sub = db.query(User.id).filter(User.username.contains(username)).scalar_subquery()
        q = q.filter(AuditLog.user_id.in_(sub))
    if start_date:
        try: q = q.filter(AuditLog.created_at >= datetime.fromisoformat(start_date))
        except ValueError: pass
    if end_date:
        try: q = q.filter(AuditLog.created_at <= datetime.fromisoformat(end_date))
        except ValueError: pass
    total = q.count()
    logs = q.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    if response is not None:
        response.headers["X-Total-Count"] = str(total)
    return [AuditLogResponse(id=l.id, username=l.user.username if l.user else "",
            action=l.action, target_type=l.target_type, target_id=l.target_id,
            detail=l.detail, ip_address=l.ip_address, created_at=l.created_at) for l in logs]


# ---- Export ----
@app.post("/api/export")
def export_devices(body: ExportRequest, request: Request, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    try: import openpyxl; from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    except ImportError: raise HTTPException(status_code=500, detail="openpyxl 未安装")
    try:
        q = _visible_devices_query(db, current_user)
        if body.device_ids: q = q.filter(Device.id.in_(body.device_ids))
        devices = q.order_by(Device.name).all()
        wb = openpyxl.Workbook(); ws = wb.active; ws.title = "密码列表"
        hf = Font(bold=True, color="FFFFFF", size=11)
        hfill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        ha = Alignment(horizontal="center", vertical="center")
        tb = Border(left=Side(style="thin"), right=Side(style="thin"), top=Side(style="thin"), bottom=Side(style="thin"))
        headers = ["名称", "类型", "IP", "MAC", "位置", "涉网", "分级", "账号", "密码", "备注", "更新时间"]
        for col, h in enumerate(headers, 1):
            c = ws.cell(row=1, column=col, value=h); c.font = hf; c.fill = hfill; c.alignment = ha; c.border = tb
        row = 2
        for dev in devices:
            accounts = db.query(DeviceAccount).filter(DeviceAccount.device_id == dev.id).all()
            dt = dev.device_type
            ts = dev.updated_at.strftime("%Y-%m-%d %H:%M") if dev.updated_at else ""
            ips_str = ", ".join(ip.address for ip in dev.ips)
            macs_str = ", ".join(m.address for m in dev.macs)
            if not accounts:
                for col, val in enumerate([dev.name, dt, ips_str, macs_str, dev.location, "是" if dev.is_network_involved else "否", dev.device_level, "", "", dev.notes, ts], 1):
                    ws.cell(row=row, column=col, value=val).border = tb
                row += 1
            else:
                for ac in accounts:
                    pwd = decrypt_password(ac.password_encrypted)
                    for col, val in enumerate([dev.name, dt, ips_str, macs_str, dev.location, "是" if dev.is_network_involved else "否", dev.device_level, ac.username, pwd, ac.notes or dev.notes, ts], 1):
                        ws.cell(row=row, column=col, value=val).border = tb
                    row += 1
        for i, w in enumerate([20, 12, 22, 22, 16, 6, 8, 14, 18, 30, 18], 1):
            ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w
        output = io.BytesIO(); wb.save(output); output.seek(0)
        write_audit(db, current_user.id, "export", "device", detail=f"导出 {len(devices)} 个设备")
        return StreamingResponse(output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=device_list_" + datetime.now().strftime('%Y%m%d_%H%M%S') + ".xlsx"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


@app.post("/api/export/all")
def export_all(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    try: import openpyxl; from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    except ImportError: raise HTTPException(status_code=500, detail="openpyxl 未安装")
    try:
        wb = openpyxl.Workbook()
        hf = Font(bold=True, color="FFFFFF", size=11)
        hfill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        ha = Alignment(horizontal="center", vertical="center")
        tb = Border(left=Side(style="thin"), right=Side(style="thin"), top=Side(style="thin"), bottom=Side(style="thin"))

        # Sheet 1: 密码列表
        ws1 = wb.active; ws1.title = "密码列表"
        headers1 = ["名称", "类型", "IP", "MAC", "位置", "涉网", "分级", "账号", "密码", "备注", "更新时间"]
        for col, h in enumerate(headers1, 1):
            c = ws1.cell(row=1, column=col, value=h); c.font = hf; c.fill = hfill; c.alignment = ha; c.border = tb
        row = 2
        devices = db.query(Device).order_by(Device.name).all()
        for dev in devices:
            accounts = db.query(DeviceAccount).filter(DeviceAccount.device_id == dev.id).all()
            ips_str = ", ".join(ip.address for ip in dev.ips)
            macs_str = ", ".join(m.address for m in dev.macs)
            ts = dev.updated_at.strftime("%Y-%m-%d %H:%M") if dev.updated_at else ""
            if not accounts:
                for col, val in enumerate([dev.name, dev.device_type, ips_str, macs_str, dev.location, "是" if dev.is_network_involved else "否", dev.device_level, "", "", dev.notes, ts], 1):
                    ws1.cell(row=row, column=col, value=val).border = tb
                row += 1
            else:
                for ac in accounts:
                    pwd = decrypt_password(ac.password_encrypted)
                    for col, val in enumerate([dev.name, dev.device_type, ips_str, macs_str, dev.location, "是" if dev.is_network_involved else "否", dev.device_level, ac.username, pwd, ac.notes or dev.notes, ts], 1):
                        ws1.cell(row=row, column=col, value=val).border = tb
                    row += 1
        for i, w in enumerate([20, 12, 22, 22, 16, 6, 8, 14, 18, 30, 18], 1):
            ws1.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w

        # Sheet 2: 用户列表
        ws2 = wb.create_sheet("用户列表")
        headers2 = ["用户名", "显示名", "角色", "状态", "下次改密", "创建时间"]
        for col, h in enumerate(headers2, 1):
            c = ws2.cell(row=1, column=col, value=h); c.font = hf; c.fill = hfill; c.alignment = ha; c.border = tb
        users = db.query(User).order_by(User.username).all()
        for r, u in enumerate(users, 2):
            vals = [u.username, u.display_name, u.role,
                    "正常" if u.is_active else "禁用",
                    "是" if u.must_change_password else "否",
                    u.created_at.strftime("%Y-%m-%d %H:%M") if u.created_at else ""]
            for col, val in enumerate(vals, 1):
                ws2.cell(row=r, column=col, value=val).border = tb
        for i, w in enumerate([16, 16, 12, 8, 10, 18], 1):
            ws2.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w

        output = io.BytesIO(); wb.save(output); output.seek(0)
        write_audit(db, current_user.id, "export", "all", detail="导出全部数据")
        return StreamingResponse(output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=export_all_" + beijing_now().strftime('%Y%m%d_%H%M%S') + ".xlsx"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


# ---- Import ----
@app.post("/api/import/xlsx", response_model=BatchImportResult)
async def import_devices_xlsx(request: Request, file: UploadFile = File(...),
                              db: Session = Depends(get_db), current_user: User = Depends(require_write)):
    try: import openpyxl
    except ImportError: raise HTTPException(status_code=500, detail="openpyxl 未安装")
    result = BatchImportResult(total=0, success=0, failed=0, errors=[])
    try:
        contents = await file.read(); wb = openpyxl.load_workbook(io.BytesIO(contents)); ws = wb.active
        rows = list(ws.iter_rows(min_row=2, values_only=True)); result.total = len(rows)
        for i, row in enumerate(rows, 2):
            try:
                vals = [str(c).strip() if c else "" for c in row]
                name = vals[0] if len(vals) > 0 else ""
                dtype = vals[1] if len(vals) > 1 else "其他"
                ips_raw = vals[2] if len(vals) > 2 else ""
                macs_raw = vals[3] if len(vals) > 3 else ""
                loc = vals[4] if len(vals) > 4 else ""
                is_net = vals[5] if len(vals) > 5 else "否"
                dev_lv = vals[6] if len(vals) > 6 else "一级设备"
                uname = vals[7] if len(vals) > 7 else ""
                pwd = vals[8] if len(vals) > 8 else ""
                notes = vals[9] if len(vals) > 9 else ""
                if not name: result.failed += 1; result.errors.append(f"第{i}行：名称为空"); continue
                # Level check: role cannot import devices above its max level
                if device_level_num(dev_lv or "一级设备") > role_max_level(current_user.role):
                    result.failed += 1; result.errors.append(f"第{i}行：超出角色可创建等级"); continue
                dev = db.query(Device).filter(Device.name == name).first()
                if not dev:
                    dev = Device(name=name, device_type=dtype or "其他", location=loc, notes=notes,
                                 is_network_involved=(is_net in ("是", "true", "True", "1", "yes")), device_level=dev_lv or "一级设备")
                    db.add(dev); db.flush()
                for ip_addr in [x.strip() for x in ips_raw.split(",") if x.strip()]:
                    if not db.query(DeviceIP).filter(DeviceIP.device_id == dev.id, DeviceIP.address == ip_addr).first():
                        db.add(DeviceIP(device_id=dev.id, address=ip_addr))
                for mac_addr in [x.strip() for x in macs_raw.split(",") if x.strip()]:
                    if not db.query(DeviceMAC).filter(DeviceMAC.device_id == dev.id, DeviceMAC.address == mac_addr).first():
                        db.add(DeviceMAC(device_id=dev.id, address=mac_addr))
                if uname and pwd:
                    a = DeviceAccount(device_id=dev.id, username=uname, password_encrypted=encrypt_password(pwd), notes=notes)
                    db.add(a); db.flush()
                    db.add(PasswordHistory(account_id=a.id, old_password_hash=a.password_encrypted, old_password=pwd,
                           changed_by=current_user.id, reason="批量导入"))
                result.success += 1
            except Exception as e: result.failed += 1; result.errors.append(f"第{i}行：{str(e)}")
        db.commit()
    except Exception as e: raise HTTPException(status_code=400, detail=f"解析失败: {str(e)}")
    write_audit(db, current_user.id, "import", "device",
                detail=f"导入: {result.total}条, 成功{result.success}, 失败{result.failed}",
                ip_address=request.client.host if request.client else "")
    return result

@app.get("/api/import/template")
def download_import_template(_: User = Depends(get_current_user)):
    try: import openpyxl
    except ImportError: raise HTTPException(status_code=500, detail="openpyxl 未安装")
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "导入模板"
    headers = ["名称*", "类型", "IP(逗号分隔)", "MAC(逗号分隔)", "位置", "涉网(是/否)", "分级", "账号", "密码", "备注"]
    for col, h in enumerate(headers, 1): ws.cell(row=1, column=col, value=h)
    example = ["核心交换机-01", "交换机", "192.168.1.1,10.0.0.1", "AA:BB:CC:DD:EE:FF", "机房A", "否", "一级设备", "admin", "password123", "核心设备"]
    for col, val in enumerate(example, 1): ws.cell(row=2, column=col, value=val)
    output = io.BytesIO(); wb.save(output); output.seek(0)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=import_template.xlsx"})


# ---- Backups ----
def perform_backup():
    db_path = os.path.join(BASE_DIR, "device_manager.db")
    if not os.path.exists(db_path): return
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    dest = os.path.join(BACKUP_DIR, f"backup_{ts}.db")
    # Use SQLite's online backup API for a consistent snapshot (safe under concurrent writes).
    try:
        import sqlite3
        src = sqlite3.connect(db_path)
        try:
            dst = sqlite3.connect(dest)
            try:
                src.backup(dst)
            finally:
                dst.close()
        finally:
            src.close()
    except Exception:
        shutil.copy2(db_path, dest)
    # Also backup uploads directory if it exists and has content
    if os.path.exists(UPLOAD_DIR) and os.listdir(UPLOAD_DIR):
        uploads_backup = os.path.join(BACKUP_DIR, f"uploads_{ts}.zip")
        shutil.make_archive(uploads_backup.replace('.zip', ''), 'zip', UPLOAD_DIR)
    # Clean old backups
    for prefix in ["backup_", "uploads_"]:
        ext = ".db" if prefix == "backup_" else ".zip"
        old_files = sorted([f for f in os.listdir(BACKUP_DIR) if f.startswith(prefix) and f.endswith(ext)], reverse=True)
        for old in old_files[30:]:
            os.remove(os.path.join(BACKUP_DIR, old))


def _is_sqlite_file(contents: bytes) -> bool:
    """Basic SQLite file validation via magic header."""
    return len(contents) >= 16 and contents[:16] == b"SQLite format 3\x00"


def _restore_uploads_from_backup(ts: str):
    """Restore uploads from a backup zip matching the given timestamp."""
    uploads_zip = os.path.join(BACKUP_DIR, f"uploads_{ts}.zip")
    if os.path.exists(uploads_zip):
        # Clear current uploads
        if os.path.exists(UPLOAD_DIR):
            shutil.rmtree(UPLOAD_DIR)
        # Extract backup
        shutil.unpack_archive(uploads_zip, UPLOAD_DIR)

@app.get("/api/backups", response_model=List[BackupInfo])
def list_backups(_: User = Depends(require_admin)):
    return [BackupInfo(filename=f, size_bytes=os.path.getsize(os.path.join(BACKUP_DIR, f)),
            created_at=f.replace("backup_", "").replace(".db", ""))
            for f in sorted(os.listdir(BACKUP_DIR), reverse=True) if f.endswith(".db")]

@app.post("/api/backups")
def create_backup(_: User = Depends(require_admin)): perform_backup(); return {"ok": True}

@app.get("/api/backups/download/{filename}")
def download_backup(filename: str, _: User = Depends(require_admin)):
    filename = os.path.basename(filename)
    bp = os.path.join(BACKUP_DIR, filename)
    if not filename.endswith(".db") or not os.path.exists(bp):
        raise HTTPException(status_code=404, detail="备份不存在")
    return FileResponse(bp, filename=filename, media_type="application/octet-stream")

@app.post("/api/backups/restore")
async def restore_upload(file: UploadFile = File(...), db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """Manual restore from uploaded .db file"""
    contents = await file.read()
    if not _is_sqlite_file(contents):
        raise HTTPException(status_code=400, detail="无效的备份文件：不是有效的 SQLite 数据库")
    perform_backup()  # auto-backup current state first
    engine.dispose()
    with open(os.path.join(BASE_DIR, "device_manager.db"), "wb") as f:
        f.write(contents)
    Base.metadata.create_all(bind=engine)
    return {"ok": True, "message": "备份已还原，请重启服务以生效"}

@app.post("/api/backups/{filename}/restore")
def restore_backup(filename: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    filename = os.path.basename(filename)
    bp = os.path.join(BACKUP_DIR, filename)
    if not filename.endswith(".db") or not os.path.exists(bp):
        raise HTTPException(status_code=404, detail="备份不存在")
    perform_backup(); engine.dispose()
    shutil.copy2(bp, os.path.join(BASE_DIR, "device_manager.db"))
    Base.metadata.create_all(bind=engine)
    # Restore uploads from matching backup
    ts = filename.replace("backup_", "").replace(".db", "")
    _restore_uploads_from_backup(ts)
    return {"ok": True}


# ---- Online Upgrade (v2.0) ----
def _read_version_json(path: str) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _upgrade_staged_info() -> Optional[dict]:
    """Return info about the staged (uploaded but not applied) upgrade package."""
    if os.path.exists(UPGRADE_NEW_EXE) and os.path.exists(UPGRADE_VERSION_FILE):
        info = _read_version_json(UPGRADE_VERSION_FILE)
        return {
            "version": str(info.get("version", "")),
            "changelog": str(info.get("changelog", "")),
            "size_bytes": os.path.getsize(UPGRADE_NEW_EXE),
            "uploaded_at": datetime.fromtimestamp(
                os.path.getmtime(UPGRADE_NEW_EXE)).strftime("%Y-%m-%d %H:%M:%S"),
        }
    return None


@app.get("/api/upgrade/info")
def upgrade_info(_: User = Depends(require_admin)):
    return {
        "current_version": APP_VERSION,
        "frozen": bool(getattr(sys, "frozen", False)),
        "base_dir": BASE_DIR,
        "applying": os.path.exists(UPGRADE_APPLYING_FLAG),
        "staged": _upgrade_staged_info(),
    }


@app.post("/api/upgrade/upload")
async def upload_upgrade(file: UploadFile = File(...), db: Session = Depends(get_db),
                         admin_user: User = Depends(require_admin)):
    """上传升级包（zip：包含 DeviceManager.exe + version.json）"""
    contents = await file.read()
    if len(contents) > MAX_UPGRADE_SIZE:
        raise HTTPException(status_code=400, detail="升级包超过 300MB")
    try:
        import zipfile
        zf = zipfile.ZipFile(io.BytesIO(contents))
        names = set(zf.namelist())
        if "DeviceManager.exe" not in names:
            raise HTTPException(status_code=400, detail="升级包中缺少 DeviceManager.exe")
        if "version.json" not in names:
            raise HTTPException(status_code=400, detail="升级包中缺少 version.json")
        ver = json.loads(zf.read("version.json").decode("utf-8"))
        if not str(ver.get("version", "")).strip():
            raise HTTPException(status_code=400, detail="version.json 中 version 不能为空")
        # 校验新程序文件是有效的 PE 可执行文件（MZ 头）
        exe_bytes = zf.read("DeviceManager.exe")
        if len(exe_bytes) < 2 or exe_bytes[:2] != b"MZ":
            raise HTTPException(status_code=400, detail="DeviceManager.exe 不是有效的可执行文件")
        os.makedirs(UPGRADE_DIR, exist_ok=True)
        with open(UPGRADE_NEW_EXE, "wb") as f:
            f.write(exe_bytes)
        with open(UPGRADE_VERSION_FILE, "w", encoding="utf-8") as f:
            json.dump({"version": str(ver.get("version")), "changelog": str(ver.get("changelog", ""))},
                      f, ensure_ascii=False, indent=2)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"无效的升级包: {str(e)}")
    write_audit(db, admin_user.id, "upgrade", "system",
                detail=f"上传升级包 v{ver.get('version', '')}")
    return {"ok": True, "version": str(ver.get("version", "")),
            "changelog": str(ver.get("changelog", ""))}


@app.post("/api/upgrade/apply")
def apply_upgrade(db: Session = Depends(get_db), admin_user: User = Depends(require_admin)):
    """应用升级：自动备份数据 → 替换程序文件 → 自动重启（保留数据库与附件）"""
    if not getattr(sys, "frozen", False):
        raise HTTPException(status_code=400,
                            detail="当前为开发模式，在线升级仅支持打包后的 DeviceManager.exe 运行环境")
    if os.path.exists(UPGRADE_APPLYING_FLAG):
        raise HTTPException(status_code=400, detail="升级正在进行中，请稍候")
    if not os.path.exists(UPGRADE_NEW_EXE):
        raise HTTPException(status_code=400, detail="请先上传升级包")
    # 1. 升级前自动备份当前数据（数据库 + 附件）
    perform_backup()
    # 2. 生成升级脚本：等待响应返回 → 结束当前进程 → 替换 exe → 重启
    #    使用 PowerShell：按 exe 路径精确结束进程（PyInstaller 有 bootloader+python
    #    两个同名进程，且不能误杀其它实例），Start-Process 可靠重启。
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    old_exe = os.path.join(BASE_DIR, f"DeviceManager_old_{ts}.exe")
    target_exe = os.path.join(BASE_DIR, "DeviceManager.exe")
    ps1_path = os.path.join(BASE_DIR, "upgrade_apply.ps1")
    port = os.environ.get("DM_PORT", "8000")
    ps1_content = f"""$ErrorActionPreference = 'SilentlyContinue'
Start-Sleep -Seconds 5
# 只结束从当前 exe 路径启动的进程（含 bootloader 与 python 子进程），不影响其它实例
Get-Process -Name DeviceManager -ErrorAction SilentlyContinue | Where-Object {{ $_.Path -eq '{target_exe}' }} | Stop-Process -Force
Start-Sleep -Seconds 2
if (Test-Path '{target_exe}') {{ Move-Item -Force '{target_exe}' '{old_exe}' }}
Move-Item -Force '{UPGRADE_NEW_EXE}' '{target_exe}'
$env:DM_PORT = '{port}'
Start-Process -FilePath '{target_exe}' -WorkingDirectory '{BASE_DIR}' -WindowStyle Hidden
Start-Sleep -Seconds 2
Remove-Item -Force '{UPGRADE_VERSION_FILE}' -ErrorAction SilentlyContinue
Remove-Item -Force '{UPGRADE_APPLYING_FLAG}' -ErrorAction SilentlyContinue
Remove-Item -Force '{ps1_path}' -ErrorAction SilentlyContinue
"""
    try:
        with open(ps1_path, "w", encoding="utf-8") as f:
            f.write(ps1_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"无法写入升级脚本: {str(e)}")
    # 3. 标记升级中
    try:
        with open(UPGRADE_APPLYING_FLAG, "w") as f:
            f.write(ts)
    except Exception:
        pass
    write_audit(db, admin_user.id, "upgrade", "system",
                detail=f"应用升级 v{_read_version_json(UPGRADE_VERSION_FILE).get('version', '')}，服务将自动重启")
    # 4. 分离启动升级脚本（不阻塞响应）。
    #    注意：不能加 DETACHED_PROCESS，实测该 flag 下 powershell 无法执行；
    #    CREATE_NO_WINDOW 足够隐藏窗口，父进程退出后脚本仍会继续运行。
    try:
        subprocess.Popen(
            ["powershell", "-NoProfile", "-WindowStyle", "Hidden",
             "-ExecutionPolicy", "Bypass", "-File", ps1_path],
            cwd=BASE_DIR,
            creationflags=subprocess.CREATE_NO_WINDOW,
            close_fds=True,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"无法启动升级脚本: {str(e)}")
    return {"ok": True, "message": "升级已开始，服务将自动重启，请稍后刷新页面"}


@app.post("/api/upgrade/cancel")
def cancel_upgrade(db: Session = Depends(get_db), admin_user: User = Depends(require_admin)):
    """取消已上传但未应用的升级包"""
    for p in (UPGRADE_NEW_EXE, UPGRADE_VERSION_FILE):
        try:
            if os.path.exists(p):
                os.remove(p)
        except Exception:
            pass
    write_audit(db, admin_user.id, "upgrade", "system", detail="取消待应用的升级包")
    return {"ok": True}


# ---- Dashboard ----
@app.get("/api/dashboard")
def get_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vis = _visible_devices_query(db, current_user).subquery()
    dc = db.query(func.count(vis.c.id)).scalar() or 0
    ac = db.query(func.count(DeviceAccount.id)).filter(DeviceAccount.device_id.in_(db.query(vis.c.id))).scalar() or 0
    uc = db.query(func.count(User.id)).scalar() or 0
    today = beijing_now().replace(hour=0, minute=0, second=0, microsecond=0)
    tl = db.query(func.count(AuditLog.id)).filter(AuditLog.created_at >= today).scalar() or 0
    ts = {}
    for t, c in db.query(Device.device_type, func.count(Device.id)).filter(Device.id.in_(db.query(vis.c.id))).group_by(Device.device_type).all():
        ts[str(t)] = c
    # Recent activity (audit details are admin-only)
    recent_logs = []
    if current_user.role == "admin":
        recent = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(8).all()
        recent_logs = [{
            "id": l.id, "username": l.user.username if l.user else "",
            "action": l.action, "target_type": l.target_type,
            "detail": l.detail, "created_at": l.created_at.isoformat() if l.created_at else "",
        } for l in recent]
    # 弱密码账户统计（对可见设备账户解密后评分）
    weak_count = 0
    acct_rows = db.query(DeviceAccount.password_encrypted).filter(
        DeviceAccount.device_id.in_(db.query(vis.c.id))
    ).all()
    for (enc,) in acct_rows:
        try:
            if check_password_strength(decrypt_password(enc)).level == "weak":
                weak_count += 1
        except Exception:
            continue
    return {"device_count": dc, "account_count": ac, "user_count": uc,
            "today_logs": tl, "type_stats": ts, "recent_logs": recent_logs,
            "weak_password_count": weak_count}


# ---- Static files ----

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    fp = os.path.join(FRONTEND_DIR, full_path if full_path else "index.html")
    if os.path.isfile(fp): return FileResponse(fp)
    ip = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.isfile(ip): return FileResponse(ip)
    return {"message": "前端未构建"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("DM_PORT", "8000")))
