"""Shared test fixtures."""
import os, sys, pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from main import app
from database import engine, Base, SessionLocal


@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db():
    db = SessionLocal()
    try: yield db
    finally: db.close()


@pytest.fixture
def admin_token(client):
    from main import init_admin
    db = SessionLocal()
    init_admin(db)
    db.close()
    resp = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture
def viewer_token(client):
    from models import User, UserRole
    from auth import hash_password
    db = SessionLocal()
    from main import init_admin; init_admin(db)
    viewer = User(username="viewer", password_hash=hash_password("viewer123"),
                  display_name="Viewer", role=UserRole.VIEWER)
    db.add(viewer); db.commit(); db.close()
    resp = client.post("/api/auth/login", json={"username": "viewer", "password": "viewer123"})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture
def editor_token(client):
    from models import User, UserRole
    from auth import hash_password
    db = SessionLocal()
    from main import init_admin; init_admin(db)
    editor = User(username="editor", password_hash=hash_password("editor123"),
                  display_name="Editor", role=UserRole.EDITOR)
    db.add(editor); db.commit(); db.close()
    resp = client.post("/api/auth/login", json={"username": "editor", "password": "editor123"})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}
