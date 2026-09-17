"""认证与权限模块"""
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
from models import User, beijing_now
import base64, hashlib, secrets, threading

# Base directory: same convention as main.py (frozen bundle -> next to the exe)
if getattr(sys, "frozen", False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

SECRET_KEY_FILE = os.path.join(BASE_DIR, "secret.key")


def _announce_new_key() -> None:
    """Tell the operator where the freshly generated key lives."""
    message = (
        f"已首次生成加密密钥文件：\n{SECRET_KEY_FILE}\n\n"
        "请妥善备份该文件；丢失后已加密的设备密码将无法解密。\n"
        "如需改用自定义密钥，请设置环境变量 DM_SECRET_KEY（优先级最高）。"
    )
    try:
        print(f"[DeviceManager] {message}", flush=True)
    except Exception:
        pass
    # The exe runs without a console, so a dialog is the only way to be noticed.
    # Show it on a daemon thread to keep server start-up non-blocking.
    if getattr(sys, "frozen", False) and os.name == "nt":
        def _show() -> None:
            try:
                import ctypes
                ctypes.windll.user32.MessageBoxW(None, message, "设备管理器", 0x40)
            except Exception:
                pass
        threading.Thread(target=_show, daemon=True).start()


def _load_or_create_secret_key() -> str:
    """Resolve the instance secret: env var -> secret.key -> generate a new one.

    A hard-coded default would make the stored passwords effectively unencrypted
    for every installation, so a unique key is generated on first run instead.
    """
    env_key = os.environ.get("DM_SECRET_KEY")
    if env_key:
        return env_key
    if "pytest" in sys.modules:
        return "test-only-device-manager-secret"
    if os.path.exists(SECRET_KEY_FILE):
        with open(SECRET_KEY_FILE, "r", encoding="utf-8") as f:
            key = f.read().strip()
        if key:
            return key
        raise RuntimeError(
            f"密钥文件为空：{SECRET_KEY_FILE}\n"
            "请删除该文件后重启以重新生成，或用环境变量 DM_SECRET_KEY 指定密钥。"
        )
    key = secrets.token_urlsafe(48)
    try:
        with open(SECRET_KEY_FILE, "w", encoding="utf-8") as f:
            f.write(key + "\n")
        try:
            os.chmod(SECRET_KEY_FILE, 0o600)
        except OSError:
            pass
    except OSError as exc:
        raise RuntimeError(
            f"无法写入密钥文件 {SECRET_KEY_FILE}：{exc}\n"
            "请确认程序目录可写，或改用环境变量 DM_SECRET_KEY 提供密钥。"
        )
    _announce_new_key()
    return key


SECRET_KEY = _load_or_create_secret_key()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480

# Derive Fernet key from SECRET_KEY (Fernet needs 32 url-safe base64 bytes)
_fernet_key = base64.urlsafe_b64encode(hashlib.sha256(SECRET_KEY.encode()).digest())
_fernet = Fernet(_fernet_key)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    """One-way hash for user login passwords (bcrypt)."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def encrypt_password(password: str) -> str:
    """Reversible encryption for device account passwords (Fernet)."""
    return _fernet.encrypt(password.encode()).decode()


def decrypt_password(encrypted: str) -> str:
    """Decrypt device account password back to plain text."""
    return _fernet.decrypt(encrypted.encode()).decode()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])  # JWT spec requires string sub
    expire = beijing_now() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """从 JWT 中解析当前用户"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=403, detail="账户已被禁用")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return current_user


def require_write(current_user: User = Depends(get_current_user)) -> User:
    """Admin and editor can write devices (but editor cannot write network-involved)."""
    if current_user.role not in ("admin", "editor"):
        raise HTTPException(status_code=403, detail="需要编辑权限")
    return current_user


def require_operator(current_user: User = Depends(get_current_user)) -> User:
    """Admin and operator can view network-involved devices."""
    if current_user.role not in ("admin", "operator"):
        raise HTTPException(status_code=403, detail="需要运维权限")
    return current_user


def require_secret_access(current_user: User = Depends(get_current_user)) -> User:
    """Only operational roles may reveal device secrets or export them."""
    if current_user.role not in ("admin", "operator"):
        raise HTTPException(status_code=403, detail="需要设备密码查看权限")
    return current_user
