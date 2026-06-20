"""
Device Manager Backend - FastAPI
"""
import os, sys, re, io, shutil
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from apscheduler.schedulers.background import BackgroundScheduler

# Base directory: works both in dev and PyInstaller bundle
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
    FRONTEND_DIR = os.path.join(sys._MEIPASS, "frontend", "dist")
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

from database import engine, get_db, Base
from models import (
    User, UserRole, Device, DeviceIP, DeviceMAC, DeviceAccount,
    PasswordHistory, AuditLog, DeviceType
)
from schemas import (
    LoginRequest, TokenResponse, UserCreate, UserResponse,
    DeviceCreate, DeviceUpdate, DeviceResponse, DeviceListItem,
    DeviceAccountCreate, DeviceAccountResponse,
    IPCreate, IPResponse, MACCreate, MACResponse,
    PasswordHistoryResponse, AuditLogResponse,
    PasswordStrengthResult, BatchImportResult, BackupInfo, ExportRequest,
)
from auth import (
    hash_password, verify_password, encrypt_password, decrypt_password,
    create_access_token, get_current_user, require_admin, require_editor,
)

app = FastAPI(title="Device Manager", version="1.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
Base.metadata.create_all(bind=engine)

scheduler = BackgroundScheduler()
BACKUP_DIR = os.path.join(BASE_DIR, "backups")
os.makedirs(BACKUP_DIR, exist_ok=True)


def init_admin(db: Session):
    if not db.query(User).filter(User.username == "admin").first():
        db.add(User(username="admin", password_hash=hash_password("admin123"),
                    display_name="Administrator", role=UserRole.ADMIN))
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
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if not user.is_active: raise HTTPException(status_code=403, detail="账户已禁用")
    token = create_access_token(data={"sub": user.id})
    write_audit(db, user.id, "login", "system", detail=f"用户 {user.username} 登录")
    return TokenResponse(access_token=token, username=user.username,
                         display_name=user.display_name or user.username, role=user.role.value)

@app.get("/api/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)): return current_user


# ---- Users ----
@app.get("/api/users", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(User).order_by(User.created_at.desc()).all()

@app.post("/api/users", response_model=UserResponse)
def create_user(body: UserCreate, db: Session = Depends(get_db), admin_user: User = Depends(require_admin)):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="用户名已存在")
    try: role = UserRole(body.role)
    except ValueError: raise HTTPException(status_code=400, detail="无效角色")
    u = User(username=body.username, password_hash=hash_password(body.password),
             display_name=body.display_name or body.username, role=role)
    db.add(u); db.commit(); db.refresh(u)
    write_audit(db, admin_user.id, "create_user", "user", u.id, f"创建用户 {u.username}")
    return u

@app.put("/api/users/{user_id}", response_model=UserResponse)
def update_user(user_id: int, body: UserCreate, db: Session = Depends(get_db),
                admin_user: User = Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u: raise HTTPException(status_code=404, detail="用户不存在")
    u.display_name = body.display_name or u.display_name
    if body.password: u.password_hash = hash_password(body.password)
    try: u.role = UserRole(body.role)
    except ValueError: raise HTTPException(status_code=400, detail="无效角色")
    db.commit(); db.refresh(u)
    write_audit(db, admin_user.id, "update_user", "user", u.id, f"更新用户 {u.username}")
    return u

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), admin_user: User = Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u: raise HTTPException(status_code=404, detail="用户不存在")
    if u.role == UserRole.ADMIN: raise HTTPException(status_code=400, detail="不可删除管理员")
    db.delete(u); db.commit()
    write_audit(db, admin_user.id, "delete_user", "user", user_id, f"删除用户 {u.username}")
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


# ---- Devices ----
@app.get("/api/devices", response_model=List[DeviceListItem])
def list_devices(keyword: str = Query(""), device_type: str = Query(""),
                 page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
                 db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    q = db.query(Device)
    if keyword:
        kw = f"%{keyword}%"
        q = q.filter(Device.name.contains(kw) | Device.notes.contains(kw) | Device.location.contains(kw))
    if device_type: q = q.filter(Device.device_type == device_type)
    devices = q.order_by(Device.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return [DeviceListItem(
        id=d.id, name=d.name,
        device_type=d.device_type.value if isinstance(d.device_type, DeviceType) else str(d.device_type),
        ip_address=_first_ip(d), mac_address=_first_mac(d),
        account_count=db.query(func.count(DeviceAccount.id)).filter(DeviceAccount.device_id == d.id).scalar() or 0,
        updated_at=d.updated_at,
    ) for d in devices]


@app.get("/api/devices/{device_id}", response_model=DeviceResponse)
def get_device(device_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    d = db.query(Device).filter(Device.id == device_id).first()
    if not d: raise HTTPException(status_code=404, detail="设备不存在")
    return DeviceResponse(
        id=d.id, name=d.name,
        device_type=d.device_type.value if isinstance(d.device_type, DeviceType) else str(d.device_type),
        location=d.location, notes=d.notes, created_at=d.created_at, updated_at=d.updated_at,
        ips=[IPResponse(id=ip.id, address=ip.address, label=ip.label) for ip in d.ips],
        macs=[MACResponse(id=m.id, address=m.address, label=m.label) for m in d.macs],
        accounts=[_account_to_response(a) for a in d.accounts],
    )


@app.post("/api/devices", response_model=DeviceResponse)
def create_device(body: DeviceCreate, request: Request, db: Session = Depends(get_db),
                  current_user: User = Depends(require_editor)):
    try: dtype = DeviceType(body.device_type)
    except ValueError: dtype = DeviceType.OTHER
    d = Device(name=body.name, device_type=dtype, location=body.location, notes=body.notes)
    db.add(d); db.flush()
    for ip in (body.ips or []): db.add(DeviceIP(device_id=d.id, address=ip.address, label=ip.label))
    for mac in (body.macs or []): db.add(DeviceMAC(device_id=d.id, address=mac.address, label=mac.label))
    for ac in body.accounts:
        enc = encrypt_password(ac.password)
        a = DeviceAccount(device_id=d.id, username=ac.username, password_encrypted=enc, notes=ac.notes)
        db.add(a); db.flush()
        db.add(PasswordHistory(account_id=a.id, old_password_hash=enc, changed_by=current_user.id, reason="初始创建"))
    db.commit(); db.refresh(d)
    ip = request.client.host if request.client else ""
    write_audit(db, current_user.id, "create", "device", d.id, f"创建设备 {d.name}", ip)
    return get_device(d.id, db)


@app.put("/api/devices/{device_id}", response_model=DeviceResponse)
def update_device(device_id: int, body: DeviceUpdate, request: Request,
                  db: Session = Depends(get_db), current_user: User = Depends(require_editor)):
    d = db.query(Device).filter(Device.id == device_id).first()
    if not d: raise HTTPException(status_code=404, detail="设备不存在")
    if body.name is not None: d.name = body.name
    if body.device_type is not None:
        try: d.device_type = DeviceType(body.device_type)
        except ValueError: pass
    if body.location is not None: d.location = body.location
    if body.notes is not None: d.notes = body.notes
    _sync_ips_macs(d, body.ips, body.macs, db)
    d.updated_at = datetime.utcnow()
    db.commit(); db.refresh(d)
    ip = request.client.host if request.client else ""
    write_audit(db, current_user.id, "update", "device", d.id, f"更新设备 {d.name}", ip)
    return get_device(d.id, db)


@app.delete("/api/devices/{device_id}")
def delete_device(device_id: int, request: Request, db: Session = Depends(get_db),
                  current_user: User = Depends(require_editor)):
    d = db.query(Device).filter(Device.id == device_id).first()
    if not d: raise HTTPException(status_code=404, detail="设备不存在")
    name = d.name; db.delete(d); db.commit()
    ip = request.client.host if request.client else ""
    write_audit(db, current_user.id, "delete", "device", device_id, f"删除设备 {name}", ip)
    return {"ok": True}


# ---- Accounts ----
@app.post("/api/devices/{device_id}/accounts", response_model=DeviceAccountResponse)
def add_account(device_id: int, body: DeviceAccountCreate, request: Request,
                db: Session = Depends(get_db), current_user: User = Depends(require_editor)):
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev: raise HTTPException(status_code=404, detail="设备不存在")
    enc = encrypt_password(body.password)
    a = DeviceAccount(device_id=device_id, username=body.username, password_encrypted=enc, notes=body.notes)
    db.add(a); db.flush()
    db.add(PasswordHistory(account_id=a.id, old_password_hash=enc, changed_by=current_user.id, reason="新增账号"))
    db.commit(); db.refresh(a)
    write_audit(db, current_user.id, "create", "account", a.id,
                f"为设备 {dev.name} 添加账号 {body.username}",
                request.client.host if request.client else "")
    return _account_to_response(a)


@app.put("/api/accounts/{account_id}", response_model=DeviceAccountResponse)
def update_account_password(account_id: int, body: DeviceAccountCreate, request: Request,
                            db: Session = Depends(get_db), current_user: User = Depends(require_editor)):
    a = db.query(DeviceAccount).filter(DeviceAccount.id == account_id).first()
    if not a: raise HTTPException(status_code=404, detail="账号不存在")
    old_enc = a.password_encrypted
    a.password_encrypted = encrypt_password(body.password)
    a.notes = body.notes if body.notes else a.notes
    a.updated_at = datetime.utcnow()
    db.add(PasswordHistory(account_id=a.id, old_password_hash=old_enc, changed_by=current_user.id,
           reason=body.notes or "密码变更"))
    db.commit(); db.refresh(a)
    write_audit(db, current_user.id, "update", "account", a.id,
                f"修改账号 {a.username} 密码", request.client.host if request.client else "")
    return _account_to_response(a)


@app.delete("/api/accounts/{account_id}")
def delete_account(account_id: int, request: Request, db: Session = Depends(get_db),
                   current_user: User = Depends(require_editor)):
    a = db.query(DeviceAccount).filter(DeviceAccount.id == account_id).first()
    if not a: raise HTTPException(status_code=404, detail="账号不存在")
    db.delete(a); db.commit()
    write_audit(db, current_user.id, "delete", "account", account_id,
                f"删除账号 {a.username}", request.client.host if request.client else "")
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
        account_name=a.username if a else "",
        device_name=dev.name if dev else "",
    )

@app.get("/api/accounts/{account_id}/history", response_model=List[PasswordHistoryResponse])
def get_password_history(account_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if not db.query(DeviceAccount).filter(DeviceAccount.id == account_id).first():
        raise HTTPException(status_code=404, detail="账号不存在")
    history = db.query(PasswordHistory).filter(PasswordHistory.account_id == account_id)\
               .order_by(PasswordHistory.changed_at.desc()).all()
    return [_pw_hist_to_response(h, db) for h in history]

@app.get("/api/password-history", response_model=List[PasswordHistoryResponse])
def list_all_password_history(device_id: int = Query(None), start_date: str = Query(""),
                              end_date: str = Query(""), page: int = Query(1, ge=1),
                              page_size: int = Query(50, ge=1, le=200),
                              db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    q = db.query(PasswordHistory)
    if device_id:
        subq = db.query(DeviceAccount.id).filter(DeviceAccount.device_id == device_id).subquery()
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
def list_audit_logs(action: str = Query(""), user_id: int = Query(None),
                    start_date: str = Query(""), end_date: str = Query(""),
                    page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
                    db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    q = db.query(AuditLog)
    if action: q = q.filter(AuditLog.action == action)
    if user_id: q = q.filter(AuditLog.user_id == user_id)
    if start_date:
        try: q = q.filter(AuditLog.created_at >= datetime.fromisoformat(start_date))
        except ValueError: pass
    if end_date:
        try: q = q.filter(AuditLog.created_at <= datetime.fromisoformat(end_date))
        except ValueError: pass
    logs = q.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
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
        q = db.query(Device)
        if body.device_ids: q = q.filter(Device.id.in_(body.device_ids))
        devices = q.order_by(Device.name).all()
        wb = openpyxl.Workbook(); ws = wb.active; ws.title = "设备列表"
        hf = Font(bold=True, color="FFFFFF", size=11)
        hfill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        ha = Alignment(horizontal="center", vertical="center")
        tb = Border(left=Side(style="thin"), right=Side(style="thin"), top=Side(style="thin"), bottom=Side(style="thin"))
        headers = ["名称", "类型", "IP", "MAC", "位置", "账号", "密码", "备注", "更新时间"]
        for col, h in enumerate(headers, 1):
            c = ws.cell(row=1, column=col, value=h); c.font = hf; c.fill = hfill; c.alignment = ha; c.border = tb
        row = 2
        for dev in devices:
            accounts = db.query(DeviceAccount).filter(DeviceAccount.device_id == dev.id).all()
            dt = dev.device_type.value if isinstance(dev.device_type, DeviceType) else str(dev.device_type)
            ts = dev.updated_at.strftime("%Y-%m-%d %H:%M") if dev.updated_at else ""
            ips_str = ", ".join(ip.address for ip in dev.ips)
            macs_str = ", ".join(m.address for m in dev.macs)
            if not accounts:
                for col, val in enumerate([dev.name, dt, ips_str, macs_str, dev.location, "", "", dev.notes, ts], 1):
                    ws.cell(row=row, column=col, value=val).border = tb
                row += 1
            else:
                for ac in accounts:
                    pwd = decrypt_password(ac.password_encrypted)
                    for col, val in enumerate([dev.name, dt, ips_str, macs_str, dev.location, ac.username, pwd, ac.notes or dev.notes, ts], 1):
                        ws.cell(row=row, column=col, value=val).border = tb
                    row += 1
        for i, w in enumerate([20, 12, 22, 22, 16, 14, 18, 30, 18], 1):
            ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w
        output = io.BytesIO(); wb.save(output); output.seek(0)
        write_audit(db, current_user.id, "export", "device", detail=f"导出 {len(devices)} 个设备")
        return StreamingResponse(output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=device_list_" + datetime.now().strftime('%Y%m%d_%H%M%S') + ".xlsx"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


# ---- Import ----
@app.post("/api/import/xlsx", response_model=BatchImportResult)
async def import_devices_xlsx(request: Request, file: UploadFile = File(...),
                              db: Session = Depends(get_db), current_user: User = Depends(require_editor)):
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
                uname = vals[5] if len(vals) > 5 else ""
                pwd = vals[6] if len(vals) > 6 else ""
                notes = vals[7] if len(vals) > 7 else ""
                if not name: result.failed += 1; result.errors.append(f"第{i}行：名称为空"); continue
                dev = db.query(Device).filter(Device.name == name).first()
                if not dev:
                    try: dt = DeviceType(dtype)
                    except ValueError: dt = DeviceType.OTHER
                    dev = Device(name=name, device_type=dt, location=loc, notes=notes)
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
                    db.add(PasswordHistory(account_id=a.id, old_password_hash=a.password_encrypted,
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
def download_import_template():
    try: import openpyxl
    except ImportError: raise HTTPException(status_code=500, detail="openpyxl 未安装")
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "导入模板"
    headers = ["名称*", "类型", "IP(逗号分隔)", "MAC(逗号分隔)", "位置", "账号", "密码", "备注"]
    for col, h in enumerate(headers, 1): ws.cell(row=1, column=col, value=h)
    example = ["核心交换机-01", "交换机", "192.168.1.1,10.0.0.1", "AA:BB:CC:DD:EE:FF", "机房A", "admin", "password123", "核心设备"]
    for col, val in enumerate(example, 1): ws.cell(row=2, column=col, value=val)
    output = io.BytesIO(); wb.save(output); output.seek(0)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=import_template.xlsx"})


# ---- Backups ----
def perform_backup():
    db_path = os.path.join(BASE_DIR, "device_manager.db")
    if not os.path.exists(db_path): return
    shutil.copy2(db_path, os.path.join(BACKUP_DIR, f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"))
    backups = sorted([f for f in os.listdir(BACKUP_DIR) if f.endswith(".db")], reverse=True)
    for old in backups[30:]: os.remove(os.path.join(BACKUP_DIR, old))

@app.get("/api/backups", response_model=List[BackupInfo])
def list_backups(_: User = Depends(require_admin)):
    return [BackupInfo(filename=f, size_bytes=os.path.getsize(os.path.join(BACKUP_DIR, f)),
            created_at=f.replace("backup_", "").replace(".db", ""))
            for f in sorted(os.listdir(BACKUP_DIR), reverse=True) if f.endswith(".db")]

@app.post("/api/backups")
def create_backup(_: User = Depends(require_admin)): perform_backup(); return {"ok": True}

@app.post("/api/backups/{filename}/restore")
def restore_backup(filename: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    bp = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(bp): raise HTTPException(status_code=404, detail="备份不存在")
    perform_backup(); engine.dispose()
    shutil.copy2(bp, os.path.join(BASE_DIR, "device_manager.db"))
    Base.metadata.create_all(bind=engine)
    return {"ok": True}


# ---- Dashboard ----
@app.get("/api/dashboard")
def get_dashboard(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    dc = db.query(func.count(Device.id)).scalar() or 0
    ac = db.query(func.count(DeviceAccount.id)).scalar() or 0
    uc = db.query(func.count(User.id)).scalar() or 0
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    tl = db.query(func.count(AuditLog.id)).filter(AuditLog.created_at >= today).scalar() or 0
    ts = {}
    for t, c in db.query(Device.device_type, func.count(Device.id)).group_by(Device.device_type).all():
        ts[t.value if isinstance(t, DeviceType) else str(t)] = c
    return {"device_count": dc, "account_count": ac, "user_count": uc, "today_logs": tl, "type_stats": ts}


# ---- Lifecycle ----
@app.on_event("startup")
def startup():
    db = next(get_db())
    try: init_admin(db)
    finally: db.close()
    scheduler.add_job(perform_backup, "cron", hour=2, minute=0, id="daily_backup")
    scheduler.start()

@app.on_event("shutdown")
def shutdown(): scheduler.shutdown()


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
    uvicorn.run(app, host="0.0.0.0", port=8000)
