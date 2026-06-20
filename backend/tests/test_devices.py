"""Tests for device and account CRUD."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

DEVICE_PAYLOAD = {
    "name": "Core-SW-01", "device_type": "交换机",
    "location": "Room A", "notes": "Core switch",
    "ips": [{"address": "192.168.1.1", "label": "mgmt"},
            {"address": "10.0.0.1", "label": "data"}],
    "macs": [{"address": "AA:BB:CC:DD:EE:FF", "label": "port1"}],
    "accounts": [
        {"username": "admin", "password": "StrongP@ss1", "notes": "Admin"},
        {"username": "monitor", "password": "MonP@ss2", "notes": "Monitor"},
    ],
}


class TestDeviceCRUD:
    def test_create_device(self, client, admin_token):
        resp = client.post("/api/devices", json=DEVICE_PAYLOAD, headers=admin_token)
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Core-SW-01"
        assert data["device_type"] == "交换机"
        assert len(data["ips"]) == 2
        assert len(data["macs"]) == 1
        assert len(data["accounts"]) == 2

    def test_create_device_minimal(self, client, admin_token):
        resp = client.post("/api/devices", json={
            "name": "Minimal", "device_type": "其他", "ips": [], "macs": [], "accounts": []
        }, headers=admin_token)
        assert resp.status_code == 200
        assert resp.json()["name"] == "Minimal"

    def test_get_device(self, client, admin_token):
        created = client.post("/api/devices", json=DEVICE_PAYLOAD, headers=admin_token).json()
        resp = client.get(f"/api/devices/{created['id']}", headers=admin_token)
        assert resp.status_code == 200
        assert resp.json()["ips"][0]["address"] == "192.168.1.1"

    def test_get_nonexistent_device(self, client, admin_token):
        resp = client.get("/api/devices/999", headers=admin_token)
        assert resp.status_code == 404

    def test_list_devices(self, client, admin_token):
        client.post("/api/devices", json=DEVICE_PAYLOAD, headers=admin_token)
        client.post("/api/devices", json={
            "name": "Router-01", "device_type": "路由器",
            "ips": [{"address": "10.0.0.1", "label": ""}],
            "macs": [], "accounts": []
        }, headers=admin_token)
        resp = client.get("/api/devices", headers=admin_token)
        assert len(resp.json()) == 2

    def test_list_devices_search(self, client, admin_token):
        client.post("/api/devices", json=DEVICE_PAYLOAD, headers=admin_token)
        client.post("/api/devices", json={"name": "XYZ", "device_type": "其他", "ips": [], "macs": [], "accounts": []}, headers=admin_token)
        resp = client.get("/api/devices?keyword=Core", headers=admin_token)
        assert len(resp.json()) == 1

    def test_list_devices_type_filter(self, client, admin_token):
        client.post("/api/devices", json=DEVICE_PAYLOAD, headers=admin_token)
        client.post("/api/devices", json={"name": "Srv", "device_type": "服务器", "ips": [], "macs": [], "accounts": []}, headers=admin_token)
        resp = client.get("/api/devices?device_type=交换机", headers=admin_token)
        assert len(resp.json()) == 1

    def test_update_device(self, client, admin_token):
        created = client.post("/api/devices", json=DEVICE_PAYLOAD, headers=admin_token).json()
        resp = client.put(f"/api/devices/{created['id']}", json={
            "name": "Updated-SW", "location": "Room B"
        }, headers=admin_token)
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Updated-SW"
        assert data["location"] == "Room B"

    def test_delete_device(self, client, admin_token):
        created = client.post("/api/devices", json=DEVICE_PAYLOAD, headers=admin_token).json()
        resp = client.delete(f"/api/devices/{created['id']}", headers=admin_token)
        assert resp.status_code == 200
        resp2 = client.get(f"/api/devices/{created['id']}", headers=admin_token)
        assert resp2.status_code == 404


class TestAccountManagement:
    def test_add_account(self, client, admin_token):
        dev = client.post("/api/devices", json={
            "name": "SW", "device_type": "交换机", "ips": [], "macs": [], "accounts": []
        }, headers=admin_token).json()
        resp = client.post(f"/api/devices/{dev['id']}/accounts", json={
            "username": "newadmin", "password": "NewP@ss1", "notes": "New"
        }, headers=admin_token)
        assert resp.status_code == 200

    def test_update_account_password(self, client, admin_token):
        dev = client.post("/api/devices", json={
            "name": "SW", "device_type": "交换机",
            "ips": [], "macs": [],
            "accounts": [{"username": "root", "password": "OldP@ss1", "notes": ""}]
        }, headers=admin_token).json()
        account_id = dev["accounts"][0]["id"]
        resp = client.put(f"/api/accounts/{account_id}", json={
            "username": "root", "password": "NewP@ss2", "notes": "Changed"
        }, headers=admin_token)
        assert resp.status_code == 200
        hist = client.get(f"/api/accounts/{account_id}/history", headers=admin_token)
        assert len(hist.json()) >= 2

    def test_delete_account(self, client, admin_token):
        dev = client.post("/api/devices", json={
            "name": "SW", "device_type": "交换机",
            "ips": [], "macs": [],
            "accounts": [
                {"username": "admin", "password": "P@ss1", "notes": ""},
                {"username": "guest", "password": "P@ss2", "notes": ""},
            ]
        }, headers=admin_token).json()
        assert len(dev["accounts"]) == 2
        client.delete(f"/api/accounts/{dev['accounts'][0]['id']}", headers=admin_token)
        dev_resp = client.get(f"/api/devices/{dev['id']}", headers=admin_token)
        assert len(dev_resp.json()["accounts"]) == 1
