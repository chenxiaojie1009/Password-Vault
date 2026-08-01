"""Tests for device-level-based permissions (create/view/edit/delete)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import User
from database import SessionLocal
from main import init_admin


def _create_device(client, token, name, level="一级设备", network=False):
    return client.post("/api/devices", json={
        "name": name, "device_type": "交换机",
        "device_level": level, "is_network_involved": network,
        "ips": [], "macs": [], "accounts": [],
    }, headers=token)


class TestLevelView:
    def test_viewer_sees_only_level1(self, client, admin_token, viewer_token):
        _create_device(client, admin_token, "L1", "一级设备")
        _create_device(client, admin_token, "L2", "二级设备")
        _create_device(client, admin_token, "L3", "三级设备")
        resp = client.get("/api/devices", headers=viewer_token)
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items) == 1
        assert items[0]["name"] == "L1"

    def test_editor_sees_level1_and_2(self, client, admin_token, editor_token):
        _create_device(client, admin_token, "L1", "一级设备")
        _create_device(client, admin_token, "L2", "二级设备")
        _create_device(client, admin_token, "L3", "三级设备")
        resp = client.get("/api/devices", headers=editor_token)
        names = [d["name"] for d in resp.json()["items"]]
        assert set(names) == {"L1", "L2"}

    def test_operator_sees_level1_to_3(self, client, admin_token, operator_token):
        _create_device(client, admin_token, "L1", "一级设备")
        _create_device(client, admin_token, "L3", "三级设备")
        _create_device(client, admin_token, "L4", "四级设备")
        resp = client.get("/api/devices", headers=operator_token)
        names = [d["name"] for d in resp.json()["items"]]
        assert set(names) == {"L1", "L3"}

    def test_viewer_cannot_get_level2_device(self, client, admin_token, viewer_token):
        d = _create_device(client, admin_token, "L2", "二级设备").json()
        resp = client.get(f"/api/devices/{d['id']}", headers=viewer_token)
        assert resp.status_code == 404  # hidden as not found

    def test_operator_cannot_get_level4_device(self, client, admin_token, operator_token):
        d = _create_device(client, admin_token, "L4", "四级设备").json()
        resp = client.get(f"/api/devices/{d['id']}", headers=operator_token)
        assert resp.status_code == 404


class TestLevelEdit:
    def test_viewer_can_edit_level1_device(self, client, admin_token, viewer_token):
        d = _create_device(client, admin_token, "Edit-L1", "一级设备").json()
        resp = client.put(f"/api/devices/{d['id']}", json={"notes": "viewer edited"},
                          headers=viewer_token)
        assert resp.status_code == 200

    def test_viewer_cannot_edit_level2_device(self, client, admin_token, viewer_token):
        d = _create_device(client, admin_token, "Edit-L2", "二级设备").json()
        resp = client.put(f"/api/devices/{d['id']}", json={"notes": "no"},
                          headers=viewer_token)
        assert resp.status_code == 403

    def test_editor_cannot_edit_level3_device(self, client, admin_token, editor_token):
        d = _create_device(client, admin_token, "Edit-L3", "三级设备").json()
        resp = client.put(f"/api/devices/{d['id']}", json={"notes": "no"},
                          headers=editor_token)
        assert resp.status_code == 403

    def test_viewer_cannot_upgrade_device_level(self, client, admin_token, viewer_token):
        """Viewer cannot change a level-1 device into level-2 (outside their range)."""
        d = _create_device(client, admin_token, "Upgrade", "一级设备").json()
        resp = client.put(f"/api/devices/{d['id']}", json={"device_level": "二级设备"},
                          headers=viewer_token)
        assert resp.status_code == 403

    def test_operator_can_edit_level3_device(self, client, admin_token, operator_token):
        d = _create_device(client, admin_token, "Edit-OP", "三级设备").json()
        resp = client.put(f"/api/devices/{d['id']}", json={"notes": "operator edit"},
                          headers=operator_token)
        assert resp.status_code == 200


class TestLevelDelete:
    def test_viewer_can_delete_level1_device(self, client, admin_token, viewer_token):
        d = _create_device(client, admin_token, "Del-L1", "一级设备").json()
        resp = client.delete(f"/api/devices/{d['id']}", headers=viewer_token)
        assert resp.status_code == 200

    def test_viewer_cannot_delete_level2_device(self, client, admin_token, viewer_token):
        d = _create_device(client, admin_token, "Del-L2", "二级设备").json()
        resp = client.delete(f"/api/devices/{d['id']}", headers=viewer_token)
        assert resp.status_code == 403


class TestLevelNetwork:
    def test_operator_can_create_network_level3(self, client, operator_token):
        """Network flag is orthogonal to level: operator can create network-involved level-3."""
        resp = _create_device(client, operator_token, "Net-OP", "三级设备", network=True)
        assert resp.status_code == 200

    def test_viewer_can_create_network_level1_but_not_see_it(self, client, viewer_token):
        """Viewer can create network-involved level-1 device, but cannot see it (existing rule)."""
        resp = _create_device(client, viewer_token, "Net-Viewer", "一级设备", network=True)
        assert resp.status_code == 200
        items = client.get("/api/devices", headers=viewer_token).json()["items"]
        assert len(items) == 0

    def test_editor_cannot_edit_network_level1(self, client, admin_token, editor_token):
        d = _create_device(client, admin_token, "Net-Edit", "一级设备", network=True).json()
        resp = client.put(f"/api/devices/{d['id']}", json={"notes": "no"},
                          headers=editor_token)
        assert resp.status_code == 404  # editor cannot see network-involved devices
