from collections import defaultdict, deque
from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image

from backend.huiju.api.app import app
from backend.huiju.api.routes import users
from backend.huiju.core import config
from backend.huiju.persistence.database import UserDatabase
from backend.huiju.providers import account_email


def test_email_accounts_verify_device_and_keep_registered_assets_separate(tmp_path, monkeypatch):
    database = UserDatabase(tmp_path / "users.sqlite3", tmp_path / "private")
    monkeypatch.setattr(users.relay, "database", database)
    monkeypatch.setattr(users.relay, "rate_windows", defaultdict(deque))
    monkeypatch.setattr(users.relay, "owner_cache", {})
    monkeypatch.setattr(users.relay, "membership_cache", {})
    monkeypatch.setattr(users, "PRIVATE_MEDIA_DIR", tmp_path / "private")
    monkeypatch.setattr(config, "SMTP_HOST", "smtp.example.test")
    monkeypatch.setattr(config, "SMTP_FROM", "studio@example.test")
    monkeypatch.setattr(config, "EMAIL_CODE_SECRET", "test-secret-for-an-isolated-database")
    deliveries = {}
    monkeypatch.setattr(users, "send_verification_email", lambda address, code: deliveries.update({address: code}))

    first, other = TestClient(app), TestClient(app)
    image = BytesIO()
    Image.new("RGB", (4, 4)).save(image, "PNG")
    upload = first.post("/api/v1/assets/uploads", data={"name": "Guest image", "category_id": "references"},
                        files={"media": ("reference.png", image.getvalue(), "image/png")})
    assert upload.status_code == 200
    private_path = upload.json()["asset"]["url"]
    assert first.get("/api/v1/users/email/status").json() == {"configured": True}

    path = "/api/v1/users/email"
    address = "alex@example.test"
    sent = first.post(f"{path}/send", json={"email": "Alex@Example.test"})
    assert sent.json() == {"ok": True, "cooldown": 60, "expires_in": 300}
    assert first.post(f"{path}/send", json={"email": address}).status_code == 429
    code = deliveries[address]
    data = {"email": address, "password": "Strong test password", "code": code}
    assert other.post(f"{path}/register", json=data).status_code == 422
    bad_code = "000000" if code != "000000" else "000001"
    assert first.post(f"{path}/register", json={**data, "code": bad_code}).status_code == 422
    verified = first.post(f"{path}/register", json=data)
    assert verified.status_code == 200, verified.text
    profile = verified.json()["profile"]
    assert profile["email_masked"] == "a***@example.test"
    assert private_path == first.get("/api/v1/assets").json()["items"][0]["url"]
    assert first.post(f"{path}/register", json=data).status_code == 422

    second = "second@example.test"
    assert first.post(f"{path}/send", json={"email": second}).status_code == 200
    assert first.post(f"{path}/register", json={**data, "email": second, "code": deliveries[second]}).status_code == 200
    assert first.get("/api/v1/assets").json()["items"] == []
    assert first.get(private_path).status_code == 404

    monkeypatch.setattr(config, "SMTP_HOST", "")
    assert other.get(f"{path}/status").json() == {"configured": False}
    assert other.post(f"{path}/send", json={"email": "new@example.test"}).status_code == 503
    assert other.post(f"{path}/login", json={"email": address, "password": "incorrect password"}).status_code == 401
    login = other.post(f"{path}/login", json={"email": address.upper(), "password": data["password"]})
    assert login.json()["profile"]["user_id"] == profile["user_id"]
    assert other.get(private_path).status_code == 200
    assert other.post("/api/v1/users/logout").status_code == 200
    assert other.get(private_path).status_code == 404


def test_email_verification_expires_and_stops_after_five_guesses(tmp_path):
    database = UserDatabase(tmp_path / "users.sqlite3", tmp_path / "private")
    assert database.reserve_email_code("device", "a@example.test", "digest", 1000)
    for _ in range(5):
        assert not database.consume_email_code("device", "a@example.test", "wrong", 1001)
    assert not database.consume_email_code("device", "a@example.test", "digest", 1002)
    assert database.reserve_email_code("device", "a@example.test", "second", 1060)
    assert not database.consume_email_code("device", "a@example.test", "second", 1360)


def test_smtp_starttls_precedes_authentication_and_message(monkeypatch):
    calls = []

    class FixtureSmtp:
        def __init__(self, host, port, *, timeout):
            calls.append((host, port, timeout))

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def starttls(self, *, context):
            assert context.check_hostname
            calls.append("tls")

        def login(self, username, password):
            calls.append("login")

        def send_message(self, message):
            assert message["To"] == "a@example.test"
            assert "004321" in message.get_content()
            calls.append("send")

    monkeypatch.setattr(config, "SMTP_HOST", "smtp.example.test")
    monkeypatch.setattr(config, "SMTP_PORT", 587)
    monkeypatch.setattr(config, "SMTP_SECURITY", "starttls")
    monkeypatch.setattr(config, "SMTP_FROM", "studio@example.test")
    monkeypatch.setattr(config, "SMTP_USER", "mock-user")
    monkeypatch.setattr(config, "SMTP_PASSWORD", "mock-password")
    monkeypatch.setattr(account_email.smtplib, "SMTP", FixtureSmtp)
    account_email.send_verification_email("a@example.test", "004321")
    assert calls == [("smtp.example.test", 587, 12), "tls", "login", "send"]
