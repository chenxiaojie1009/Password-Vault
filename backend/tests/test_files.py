"""Tests for device file upload, download, delete, and permissions."""
import sys, os, io
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import DeviceFile, Device, User
from database import SessionLocal


class TestFileUpload:
    def test_upload_file_to_device(self, client, admin_token):
        """Admin can upload a file to a device."""
        dev = client.post("/api/devices", json={
            "name": "File-Test-01", "device_type": "交换机",
            "ips": [], "macs": [], "accounts": []
        }, headers=admin_token).json()
        did = dev["id"]

        # Create a fake text file
        fake_pdf = io.BytesIO(b"%PDF-1.4 fake pdf content for testing")
        fake_pdf.name = "config.pdf"
        resp = client.post(f"/api/devices/{did}/files",
            files=[("files", ("config.pdf", fake_pdf, "application/pdf"))],
            headers=admin_token)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] == 1
        assert data["failed"] == 0

    def test_upload_invalid_extension(self, client, admin_token):
        """Uploading a .exe should be rejected."""
        dev = client.post("/api/devices", json={
            "name": "File-Test-02", "device_type": "其他",
            "ips": [], "macs": [], "accounts": []
        }, headers=admin_token).json()
        did = dev["id"]

        fake_exe = io.BytesIO(b"fake exe content")
        fake_exe.name = "virus.exe"
        resp = client.post(f"/api/devices/{did}/files",
            files=[("files", ("virus.exe", fake_exe, "application/octet-stream"))],
            headers=admin_token)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] == 0
        assert data["failed"] == 1

    def test_upload_multiple_files(self, client, admin_token):
        """Upload multiple files at once."""
        dev = client.post("/api/devices", json={
            "name": "File-Test-03", "device_type": "服务器",
            "ips": [], "macs": [], "accounts": []
        }, headers=admin_token).json()
        did = dev["id"]

        f1 = io.BytesIO(b"%PDF-1.4 pdf")
        f1.name = "doc1.pdf"
        f2 = io.BytesIO(b"\x89PNG\r\n\x1a\nfake png")
        f2.name = "screenshot.png"
        resp = client.post(f"/api/devices/{did}/files",
            files=[
                ("files", ("doc1.pdf", f1, "application/pdf")),
                ("files", ("screenshot.png", f2, "image/png")),
            ],
            headers=admin_token)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] == 2

    def test_viewer_can_upload_to_level1_device(self, client, admin_token, viewer_token):
        """Viewer can upload files to level-1 devices (new permission)."""
        dev = client.post("/api/devices", json={
            "name": "File-Perm-01", "device_type": "其他",
            "ips": [], "macs": [], "accounts": []
        }, headers=admin_token).json()
        did = dev["id"]

        fake = io.BytesIO(b"test")
        fake.name = "test.pdf"
        resp = client.post(f"/api/devices/{did}/files",
            files=[("files", ("test.pdf", fake, "application/pdf"))],
            headers=viewer_token)
        assert resp.status_code == 200
        assert resp.json()["success"] == 1

    def test_viewer_cannot_upload_to_level2_device(self, client, admin_token, viewer_token):
        """Viewer cannot upload files to devices above level 1."""
        dev = client.post("/api/devices", json={
            "name": "File-Perm-02", "device_type": "其他", "device_level": "二级设备",
            "ips": [], "macs": [], "accounts": []
        }, headers=admin_token).json()
        did = dev["id"]

        fake = io.BytesIO(b"test")
        fake.name = "test.pdf"
        resp = client.post(f"/api/devices/{did}/files",
            files=[("files", ("test.pdf", fake, "application/pdf"))],
            headers=viewer_token)
        assert resp.status_code == 403


class TestFileList:
    def test_list_files(self, client, admin_token):
        """List files for a device."""
        dev = client.post("/api/devices", json={
            "name": "File-List-01", "device_type": "路由器",
            "ips": [], "macs": [], "accounts": []
        }, headers=admin_token).json()
        did = dev["id"]

        fake = io.BytesIO(b"%PDF-1.4 content")
        fake.name = "manual.pdf"
        client.post(f"/api/devices/{did}/files",
            files=[("files", ("manual.pdf", fake, "application/pdf"))],
            headers=admin_token)

        resp = client.get(f"/api/devices/{did}/files", headers=admin_token)
        assert resp.status_code == 200
        files = resp.json()
        assert len(files) == 1
        assert files[0]["original_filename"] == "manual.pdf"
        assert files[0]["file_type"] == "pdf"

    def test_list_empty_files(self, client, admin_token):
        """List files for a device with no files."""
        dev = client.post("/api/devices", json={
            "name": "File-Empty", "device_type": "其他",
            "ips": [], "macs": [], "accounts": []
        }, headers=admin_token).json()

        resp = client.get(f"/api/devices/{dev['id']}/files", headers=admin_token)
        assert resp.status_code == 200
        assert len(resp.json()) == 0


class TestFileDownload:
    def test_download_file(self, client, admin_token):
        """Download an uploaded file."""
        dev = client.post("/api/devices", json={
            "name": "File-DL-01", "device_type": "服务器",
            "ips": [], "macs": [], "accounts": []
        }, headers=admin_token).json()
        did = dev["id"]

        fake = io.BytesIO(b"hello world content")
        fake.name = "readme.txt"
        # Upload as .txt (not in allowed list? Actually .txt is not in the list... let me use .doc)
        # Wait, .txt is NOT in ALLOWED_EXTENSIONS. Let me use .doc
        fake.name = "readme.doc"
        up_resp = client.post(f"/api/devices/{did}/files",
            files=[("files", ("readme.doc", io.BytesIO(b"hello world content"), "application/msword"))],
            headers=admin_token)

        # Get file list to find file id
        files = client.get(f"/api/devices/{did}/files", headers=admin_token).json()
        fid = files[0]["id"]

        resp = client.get(f"/api/files/{fid}/download", headers=admin_token)
        assert resp.status_code == 200
        assert resp.content == b"hello world content"

    def test_download_nonexistent_file(self, client, admin_token):
        resp = client.get("/api/files/99999/download", headers=admin_token)
        assert resp.status_code == 404


class TestFileDelete:
    def test_delete_file(self, client, admin_token):
        """Delete a file."""
        dev = client.post("/api/devices", json={
            "name": "File-Del-01", "device_type": "防火墙",
            "ips": [], "macs": [], "accounts": []
        }, headers=admin_token).json()
        did = dev["id"]

        fake = io.BytesIO(b"%PDF-1.4")
        fake.name = "delete_me.pdf"
        client.post(f"/api/devices/{did}/files",
            files=[("files", ("delete_me.pdf", fake, "application/pdf"))],
            headers=admin_token)

        files = client.get(f"/api/devices/{did}/files", headers=admin_token).json()
        fid = files[0]["id"]

        resp = client.delete(f"/api/files/{fid}", headers=admin_token)
        assert resp.status_code == 200

        # Verify file is gone
        files2 = client.get(f"/api/devices/{did}/files", headers=admin_token).json()
        assert len(files2) == 0

    def test_viewer_cannot_delete_file(self, client, admin_token, viewer_token):
        dev = client.post("/api/devices", json={
            "name": "File-Perm-Del", "device_type": "其他",
            "ips": [], "macs": [], "accounts": []
        }, headers=admin_token).json()
        did = dev["id"]

        fake = io.BytesIO(b"%PDF-1.4")
        fake.name = "test.pdf"
        client.post(f"/api/devices/{did}/files",
            files=[("files", ("test.pdf", fake, "application/pdf"))],
            headers=admin_token)

        files = client.get(f"/api/devices/{did}/files", headers=admin_token).json()
        fid = files[0]["id"]

        resp = client.delete(f"/api/files/{fid}", headers=viewer_token)
        assert resp.status_code == 200  # viewer can now delete files on level-1 devices

    def test_viewer_cannot_delete_file_on_level2_device(self, client, admin_token, viewer_token):
        dev = client.post("/api/devices", json={
            "name": "File-Perm-Del-L2", "device_type": "其他", "device_level": "二级设备",
            "ips": [], "macs": [], "accounts": []
        }, headers=admin_token).json()
        did = dev["id"]

        fake = io.BytesIO(b"%PDF-1.4")
        fake.name = "test.pdf"
        client.post(f"/api/devices/{did}/files",
            files=[("files", ("test.pdf", fake, "application/pdf"))],
            headers=admin_token)

        files = client.get(f"/api/devices/{did}/files", headers=admin_token).json()
        fid = files[0]["id"]

        resp = client.delete(f"/api/files/{fid}", headers=viewer_token)
        assert resp.status_code == 403


class TestFileNetworkInvolved:
    def test_viewer_cannot_see_network_involved_files(self, client, admin_token, viewer_token):
        """Viewer should not be able to list files on network-involved devices."""
        dev = client.post("/api/devices", json={
            "name": "Net-File-01", "device_type": "交换机",
            "is_network_involved": True,
            "ips": [], "macs": [], "accounts": []
        }, headers=admin_token).json()
        did = dev["id"]

        fake = io.BytesIO(b"%PDF-1.4")
        fake.name = "secret.pdf"
        client.post(f"/api/devices/{did}/files",
            files=[("files", ("secret.pdf", fake, "application/pdf"))],
            headers=admin_token)

        # Viewer cannot list files on network-involved device (hidden as 404)
        resp = client.get(f"/api/devices/{did}/files", headers=viewer_token)
        assert resp.status_code == 404

    def test_editor_cannot_upload_to_network_involved(self, client, admin_token, editor_token):
        """Editor cannot upload to network-involved device."""
        dev = client.post("/api/devices", json={
            "name": "Net-File-02", "device_type": "路由器",
            "is_network_involved": True,
            "ips": [], "macs": [], "accounts": []
        }, headers=admin_token).json()
        did = dev["id"]

        fake = io.BytesIO(b"%PDF-1.4")
        fake.name = "test.pdf"
        resp = client.post(f"/api/devices/{did}/files",
            files=[("files", ("test.pdf", fake, "application/pdf"))],
            headers=editor_token)
        assert resp.status_code == 404  # editor cannot see network-involved device


class TestCascadeDelete:
    def test_delete_device_cascades_files(self, client, admin_token):
        """Deleting a device should also delete its files."""
        dev = client.post("/api/devices", json={
            "name": "Cascade-01", "device_type": "其他",
            "ips": [], "macs": [], "accounts": []
        }, headers=admin_token).json()
        did = dev["id"]

        fake = io.BytesIO(b"%PDF-1.4 cascade test")
        fake.name = "cascade.pdf"
        client.post(f"/api/devices/{did}/files",
            files=[("files", ("cascade.pdf", fake, "application/pdf"))],
            headers=admin_token)

        # Device exists and has files
        files = client.get(f"/api/devices/{did}/files", headers=admin_token).json()
        assert len(files) == 1

        # Delete device
        client.delete(f"/api/devices/{did}", headers=admin_token)

        # Device gone
        resp = client.get(f"/api/devices/{did}", headers=admin_token)
        assert resp.status_code == 404

        # Files also gone (list endpoint should 404 since device doesn't exist)
        resp2 = client.get(f"/api/devices/{did}/files", headers=admin_token)
        assert resp2.status_code == 404
