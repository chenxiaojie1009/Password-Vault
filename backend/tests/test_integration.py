"""Integration test: full workflow."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient
from main import app


class TestFullWorkflow:
    def test_full_admin_workflow(self, client):
        resp = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
        assert resp.status_code == 200
        token = resp.json()["access_token"]
        auth = {"Authorization": f"Bearer {token}"}

        # Create users
        client.post("/api/users", json={"username": "operator1", "password": "op123456", "display_name": "Op1", "role": "editor"}, headers=auth)
        client.post("/api/users", json={"username": "auditor1", "password": "au123456", "display_name": "Aud1", "role": "viewer"}, headers=auth)

        # Create devices with multiple IPs/MACs
        for d in [
            {"name": "Core-Router-01", "device_type": "路由器", "location": "IDC-A", "notes": "Core",
             "ips": [{"address": "10.0.0.1", "label": "loopback"}, {"address": "192.168.1.1", "label": "mgmt"}],
             "macs": [{"address": "AA:BB:CC:DD:EE:01", "label": "port1"}],
             "accounts": [{"username": "root", "password": "R0uter@Pass1", "notes": "SSH"}]},
            {"name": "Core-SW-01", "device_type": "交换机", "location": "IDC-A",
             "ips": [{"address": "10.0.0.2", "label": "mgmt"}],
             "macs": [{"address": "AA:BB:CC:DD:EE:02", "label": "port1"}, {"address": "AA:BB:CC:DD:EE:03", "label": "port2"}],
             "accounts": [{"username": "admin", "password": "Sw1tch@Pass1", "notes": "Console"},
                          {"username": "monitor", "password": "M0nit0r@Pass", "notes": "SNMP"}]},
            {"name": "Firewall-01", "device_type": "防火墙", "location": "IDC-A",
             "ips": [{"address": "10.0.0.254", "label": "wan"}],
             "macs": [], "accounts": []},
        ]:
            resp = client.post("/api/devices", json=d, headers=auth)
            assert resp.status_code == 200

        # Verify IPs/MACs count
        dev2 = client.get("/api/devices/2", headers=auth).json()
        assert len(dev2["ips"]) == 1
        assert len(dev2["macs"]) == 2
        assert len(dev2["accounts"]) == 2

        # Export
        resp = client.post("/api/export", json={"format": "xlsx"}, headers=auth)
        assert resp.status_code == 200
        assert len(resp.content) > 2000

        # Password history with names
        hist = client.get("/api/password-history", headers=auth).json()
        assert len(hist) >= 3
        # Check account_name and device_name are populated
        assert hist[0]["account_name"] != "" or hist[0]["device_name"] != ""

        # Audit logs
        logs = client.get("/api/audit-logs", headers=auth).json()
        actions = [l["action"] for l in logs]
        assert "create" in actions

        # Permission enforcement
        ed_resp = client.post("/api/auth/login", json={"username": "operator1", "password": "op123456"})
        ed_auth = {"Authorization": f"Bearer {ed_resp.json()['access_token']}"}
        resp = client.post("/api/devices", json={"name": "EditorDevice", "device_type": "其他", "ips": [], "macs": [], "accounts": []}, headers=ed_auth)
        assert resp.status_code == 200
        assert client.get("/api/users", headers=ed_auth).status_code == 403

        viewer_resp = client.post("/api/auth/login", json={"username": "auditor1", "password": "au123456"})
        v_auth = {"Authorization": f"Bearer {viewer_resp.json()['access_token']}"}
        assert client.post("/api/devices", json={"name": "Fail", "device_type": "其他", "ips": [], "macs": [], "accounts": []}, headers=v_auth).status_code == 403
        assert client.get("/api/devices", headers=v_auth).status_code == 200
