"""Tests for authentication and authorization."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import User
from database import SessionLocal


class TestLogin:
    def test_login_success(self, client):
        resp = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["username"] == "admin"

    def test_login_wrong_password(self, client):
        resp = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client):
        resp = client.post("/api/auth/login", json={"username": "ghost", "password": "123"})
        assert resp.status_code == 401

    def test_login_disabled_user(self, client, db):
        from main import init_admin
        init_admin(db)
        user = db.query(User).filter(User.username == "admin").first()
        user.is_active = False
        db.commit()
        resp = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
        assert resp.status_code == 403

    def test_get_me(self, client, admin_token):
        resp = client.get("/api/auth/me", headers=admin_token)
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "admin"
        assert data["role"] == "admin"

    def test_get_me_no_token(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401


class TestPasswordHashing:
    def test_hash_and_verify(self):
        from auth import hash_password, verify_password
        pw = "MySecurePass123!"
        hashed = hash_password(pw)
        assert hashed != pw
        assert verify_password(pw, hashed)
        assert not verify_password("different", hashed)

    def test_hash_is_unique(self):
        from auth import hash_password
        h1 = hash_password("same_password")
        h2 = hash_password("same_password")
        assert h1 != h2  # different salts


class TestTokenCreation:
    def test_create_and_decode_token(self):
        from auth import create_access_token, SECRET_KEY, ALGORITHM
        from jose import jwt
        token = create_access_token({"sub": "42"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "42"
        assert "exp" in payload

    def test_sub_converted_to_string(self):
        """Ensure integer sub is converted to string for JWT compliance."""
        from auth import create_access_token, SECRET_KEY, ALGORITHM
        from jose import jwt
        token = create_access_token({"sub": 1})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert isinstance(payload["sub"], str)
        assert payload["sub"] == "1"


class TestPermissionLevels:
    def test_admin_can_list_users(self, client, admin_token):
        resp = client.get("/api/users", headers=admin_token)
        assert resp.status_code == 200

    def test_editor_cannot_list_users(self, client, editor_token):
        resp = client.get("/api/users", headers=editor_token)
        assert resp.status_code == 403

    def test_viewer_can_create_level1_device(self, client, viewer_token):
        """Viewer can create level-1 devices (new permission)."""
        resp = client.post("/api/devices", json={
            "name": "test", "device_type": "server", "accounts": []
        }, headers=viewer_token)
        assert resp.status_code == 200

    def test_viewer_cannot_create_level2_device(self, client, viewer_token):
        """Viewer cannot create devices above level 1."""
        resp = client.post("/api/devices", json={
            "name": "test", "device_type": "server", "device_level": "二级设备", "accounts": []
        }, headers=viewer_token)
        assert resp.status_code == 403

    def test_editor_can_create_level2_device(self, client, editor_token):
        """Editor can create level-2 devices."""
        resp = client.post("/api/devices", json={
            "name": "SW-L2", "device_type": "交换机", "device_level": "二级设备", "accounts": []
        }, headers=editor_token)
        assert resp.status_code == 200

    def test_editor_cannot_create_level3_device(self, client, editor_token):
        """Editor cannot create devices above level 2."""
        resp = client.post("/api/devices", json={
            "name": "SW-L3", "device_type": "交换机", "device_level": "三级设备", "accounts": []
        }, headers=editor_token)
        assert resp.status_code == 403

    def test_operator_can_create_level3_device(self, client, operator_token):
        """Operator can create level-3 devices."""
        resp = client.post("/api/devices", json={
            "name": "OP-L3", "device_type": "路由器", "device_level": "三级设备", "accounts": []
        }, headers=operator_token)
        assert resp.status_code == 200

    def test_operator_cannot_create_level4_device(self, client, operator_token):
        """Operator cannot create level-4 devices."""
        resp = client.post("/api/devices", json={
            "name": "OP-L4", "device_type": "路由器", "device_level": "四级设备", "accounts": []
        }, headers=operator_token)
        assert resp.status_code == 403

    def test_editor_can_create_device(self, client, editor_token):
        resp = client.post("/api/devices", json={
            "name": "SW-Test", "device_type": "交换机",
            "ip_address": "10.0.0.1", "accounts": []
        }, headers=editor_token)
        assert resp.status_code == 200

    def test_viewer_can_read_devices(self, client, admin_token, viewer_token):
        # Create device as admin
        resp = client.post("/api/devices", json={
            "name": "SW-01", "device_type": "交换机",
            "ip_address": "10.0.0.1", "accounts": []
        }, headers=admin_token)
        did = resp.json()["id"]
        # Admin assigns device to viewer
        from models import DeviceVisibility
        db = SessionLocal()
        db.add(DeviceVisibility(user_id=2, device_id=did))  # viewer is user #2
        db.commit(); db.close()
        # Read as viewer
        resp = client.get("/api/devices", headers=viewer_token)
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 1


class TestUserManagement:
    def test_create_user(self, client, admin_token):
        resp = client.post("/api/users", json={
            "username": "newuser", "password": "pass123",
            "display_name": "New User", "role": "viewer"
        }, headers=admin_token)
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "newuser"
        assert data["role"] == "viewer"

    def test_create_duplicate_user(self, client, admin_token):
        client.post("/api/users", json={
            "username": "dup", "password": "pass123", "role": "viewer"
        }, headers=admin_token)
        resp = client.post("/api/users", json={
            "username": "dup", "password": "pass456", "role": "editor"
        }, headers=admin_token)
        assert resp.status_code == 400

    def test_delete_user(self, client, admin_token):
        client.post("/api/users", json={
            "username": "todelete", "password": "pass123", "role": "viewer"
        }, headers=admin_token)
        resp = client.delete("/api/users/2", headers=admin_token)  # admin=1, todelete=2
        assert resp.status_code == 200

    def test_cannot_delete_admin(self, client, admin_token):
        resp = client.delete("/api/users/1", headers=admin_token)
        assert resp.status_code == 400
