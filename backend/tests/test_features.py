"""Tests for password strength, export, backup, history, audit."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestPasswordStrength:
    def test_check_via_api(self, client, admin_token):
        resp = client.post("/api/password/check", json={"password": "abc"}, headers=admin_token)
        data = resp.json()
        assert data["level"] == "weak"

        resp2 = client.post("/api/password/check", json={"password": "Str0ng!Pass"}, headers=admin_token)
        data2 = resp2.json()
        assert data2["level"] == "strong"

    def test_direct_function(self):
        from main import check_password_strength
        r1 = check_password_strength("abc")
        assert r1.level == "weak"
        r5 = check_password_strength("Abcdefg1!")
        assert r5.level == "strong"

class TestExport:
    def test_export_empty(self, client, admin_token):
        resp = client.post("/api/export", json={"format": "xlsx"}, headers=admin_token)
        assert resp.status_code == 200
        assert len(resp.content) > 500

    def test_export_with_data(self, client, admin_token):
        client.post("/api/devices", json={
            "name": "SW-01", "device_type": "交换机",
            "ips": [{"address": "10.0.0.1", "label": ""}],
            "macs": [], "accounts": [{"username": "root", "password": "Test@123", "notes": ""}]
        }, headers=admin_token)
        resp = client.post("/api/export", json={"format": "xlsx"}, headers=admin_token)
        assert resp.status_code == 200
        assert len(resp.content) > 1000

class TestImportTemplate:
    def test_download_template(self, client, admin_token):
        resp = client.get("/api/import/template", headers=admin_token)
        assert resp.status_code == 200

class TestBackup:
    def test_list_backups(self, client, admin_token):
        resp = client.get("/api/backups", headers=admin_token)
        assert resp.status_code == 200

    def test_create_backup(self, client, admin_token):
        resp = client.post("/api/backups", headers=admin_token)
        assert resp.status_code == 200

    def test_editor_cannot_access_backups(self, client, editor_token):
        resp = client.get("/api/backups", headers=editor_token)
        assert resp.status_code == 403

    def test_backup_and_restore(self, client, admin_token):
        client.post("/api/devices", json={
            "name": "SW-Backup", "device_type": "交换机",
            "ips": [], "macs": [],
            "accounts": [{"username": "root", "password": "BeforeBackup1", "notes": ""}]
        }, headers=admin_token)
        client.post("/api/backups", headers=admin_token)
        resp = client.get("/api/backups", headers=admin_token)
        assert len(resp.json()) >= 1
        devs = client.get("/api/devices", headers=admin_token).json()
        client.delete(f"/api/devices/{devs[0]['id']}", headers=admin_token)
        client.post("/api/backups", headers=admin_token)
        resp2 = client.get("/api/backups", headers=admin_token)
        assert len(resp2.json()) >= 2

class TestPasswordHistory:
    def test_history_created_on_device_add(self, client, admin_token):
        dev = client.post("/api/devices", json={
            "name": "SW-Hist", "device_type": "交换机",
            "ips": [], "macs": [],
            "accounts": [{"username": "root", "password": "InitP@ss1", "notes": ""}]
        }, headers=admin_token).json()
        account_id = dev["accounts"][0]["id"]
        resp = client.get(f"/api/accounts/{account_id}/history", headers=admin_token)
        assert len(resp.json()) >= 1

    def test_global_password_history(self, client, admin_token):
        client.post("/api/devices", json={
            "name": "SW-Global", "device_type": "交换机",
            "ips": [], "macs": [],
            "accounts": [{"username": "root", "password": "InitP@ss1", "notes": ""}]
        }, headers=admin_token)
        resp = client.get("/api/password-history", headers=admin_token)
        assert len(resp.json()) >= 1

    def test_password_history_filter_by_device(self, client, admin_token):
        d1 = client.post("/api/devices", json={
            "name": "SW-Filter1", "device_type": "交换机",
            "ips": [], "macs": [],
            "accounts": [{"username": "root", "password": "P@ss1", "notes": ""}]
        }, headers=admin_token).json()
        client.post("/api/devices", json={
            "name": "SW-Filter2", "device_type": "交换机",
            "ips": [], "macs": [],
            "accounts": [{"username": "root", "password": "P@ss2", "notes": ""}]
        }, headers=admin_token)
        resp = client.get(f"/api/password-history?device_id={d1['id']}", headers=admin_token)
        assert len(resp.json()) == 1

class TestAuditLog:
    def test_login_creates_audit(self, client, admin_token):
        resp = client.get("/api/audit-logs", headers=admin_token)
        logins = [l for l in resp.json() if l["action"] == "login"]
        assert len(logins) >= 1

    def test_create_device_creates_audit(self, client, admin_token):
        client.post("/api/devices", json={
            "name": "AuditDevice", "device_type": "其他", "ips": [], "macs": [], "accounts": []
        }, headers=admin_token)
        resp = client.get("/api/audit-logs?action=create", headers=admin_token)
        creates = [l for l in resp.json() if l["target_type"] == "device"]
        assert len(creates) >= 1
