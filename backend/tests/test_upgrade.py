"""在线升级（v2.0）端点测试"""
import io, zipfile, json
import pytest


def _make_upgrade_zip(with_exe=True, with_version=True, version="2.1.0"):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        if with_exe:
            zf.writestr("DeviceManager.exe", b"MZ" + b"\x00" * 100)
        if with_version:
            zf.writestr("version.json", json.dumps({"version": version, "changelog": "测试升级"}))
    buf.seek(0)
    return buf


def test_upgrade_info_requires_admin(client, viewer_token):
    r = client.get("/api/upgrade/info", headers=viewer_token)
    assert r.status_code == 403


def test_upgrade_info_admin(client, admin_token):
    r = client.get("/api/upgrade/info", headers=admin_token)
    assert r.status_code == 200
    data = r.json()
    assert "current_version" in data
    assert data["staged"] is None
    assert data["applying"] is False


def test_upgrade_upload_and_info(client, admin_token, monkeypatch, tmp_path):
    from main import UPGRADE_DIR, UPGRADE_NEW_EXE, UPGRADE_VERSION_FILE
    monkeypatch.setattr("main.UPGRADE_DIR", str(tmp_path))
    monkeypatch.setattr("main.UPGRADE_NEW_EXE", str(tmp_path / "DeviceManager_new.exe"))
    monkeypatch.setattr("main.UPGRADE_VERSION_FILE", str(tmp_path / "version.json"))

    r = client.post("/api/upgrade/upload", headers=admin_token,
                    files={"file": ("upgrade.zip", _make_upgrade_zip().getvalue(), "application/zip")})
    assert r.status_code == 200
    assert r.json()["version"] == "2.1.0"

    info = client.get("/api/upgrade/info", headers=admin_token).json()
    assert info["staged"] is not None
    assert info["staged"]["version"] == "2.1.0"


def test_upgrade_upload_rejects_missing_exe(client, admin_token, monkeypatch, tmp_path):
    monkeypatch.setattr("main.UPGRADE_DIR", str(tmp_path))
    r = client.post("/api/upgrade/upload", headers=admin_token,
                    files={"file": ("bad.zip", _make_upgrade_zip(with_exe=False).getvalue(), "application/zip")})
    assert r.status_code == 400
    assert "DeviceManager.exe" in r.json()["detail"]


def test_upgrade_upload_rejects_missing_version(client, admin_token, monkeypatch, tmp_path):
    monkeypatch.setattr("main.UPGRADE_DIR", str(tmp_path))
    r = client.post("/api/upgrade/upload", headers=admin_token,
                    files={"file": ("bad.zip", _make_upgrade_zip(with_version=False).getvalue(), "application/zip")})
    assert r.status_code == 400
    assert "version.json" in r.json()["detail"]


def test_upgrade_upload_rejects_invalid_exe(client, admin_token, monkeypatch, tmp_path):
    monkeypatch.setattr("main.UPGRADE_DIR", str(tmp_path))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("DeviceManager.exe", b"not an exe")
        zf.writestr("version.json", json.dumps({"version": "2.1.0"}))
    buf.seek(0)
    r = client.post("/api/upgrade/upload", headers=admin_token,
                    files={"file": ("bad.zip", buf.getvalue(), "application/zip")})
    assert r.status_code == 400
    assert "可执行文件" in r.json()["detail"]


def test_upgrade_apply_requires_frozen(client, admin_token, monkeypatch, tmp_path):
    """开发模式（非 frozen）下应用升级应被拒绝"""
    from main import UPGRADE_DIR, UPGRADE_NEW_EXE, UPGRADE_VERSION_FILE
    monkeypatch.setattr("main.UPGRADE_DIR", str(tmp_path))
    monkeypatch.setattr("main.UPGRADE_NEW_EXE", str(tmp_path / "DeviceManager_new.exe"))
    monkeypatch.setattr("main.UPGRADE_VERSION_FILE", str(tmp_path / "version.json"))
    monkeypatch.setattr("main.sys", type("S", (), {"frozen": False})())
    monkeypatch.setattr("main.UPGRADE_APPLYING_FLAG", str(tmp_path / "flag"))

    # 非 frozen 模式：无论是否有升级包，一律拒绝（frozen 检查在最前）
    r = client.post("/api/upgrade/apply", headers=admin_token)
    assert r.status_code == 400
    assert "开发模式" in r.json()["detail"]

    # 有升级包但非 frozen：同样拒绝
    client.post("/api/upgrade/upload", headers=admin_token,
                files={"file": ("upgrade.zip", _make_upgrade_zip().getvalue(), "application/zip")})
    r = client.post("/api/upgrade/apply", headers=admin_token)
    assert r.status_code == 400
    assert "开发模式" in r.json()["detail"]


def test_upgrade_cancel(client, admin_token, monkeypatch, tmp_path):
    from main import UPGRADE_DIR, UPGRADE_NEW_EXE, UPGRADE_VERSION_FILE
    monkeypatch.setattr("main.UPGRADE_DIR", str(tmp_path))
    monkeypatch.setattr("main.UPGRADE_NEW_EXE", str(tmp_path / "DeviceManager_new.exe"))
    monkeypatch.setattr("main.UPGRADE_VERSION_FILE", str(tmp_path / "version.json"))

    client.post("/api/upgrade/upload", headers=admin_token,
                files={"file": ("upgrade.zip", _make_upgrade_zip().getvalue(), "application/zip")})
    r = client.post("/api/upgrade/cancel", headers=admin_token)
    assert r.status_code == 200
    info = client.get("/api/upgrade/info", headers=admin_token).json()
    assert info["staged"] is None
