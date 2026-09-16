import json
import importlib.util
import sys
import threading
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODULE_SPEC = importlib.util.spec_from_file_location(
    "huiju_ops_dashboard", ROOT / "ops-dashboard" / "server.py",
)
assert MODULE_SPEC and MODULE_SPEC.loader
MODULE = importlib.util.module_from_spec(MODULE_SPEC)
sys.modules[MODULE_SPEC.name] = MODULE
MODULE_SPEC.loader.exec_module(MODULE)
DashboardHTTPServer = MODULE.DashboardHTTPServer
DirectTransport = MODULE.DirectTransport


class _UpstreamHandler(BaseHTTPRequestHandler):
    authorization = ""

    def log_message(self, format: str, *args: object) -> None:
        return None

    def do_GET(self) -> None:
        type(self).authorization = self.headers.get("Authorization", "")
        if self.path.startswith("/api/v1/admin/analytics/export"):
            body = b"day,visitors\n2026-08-27,3\n"
            self.send_response(200)
            self.send_header("Content-Type", "text/csv")
            self.send_header("Content-Disposition", 'attachment; filename="analytics.csv"')
        elif self.path.startswith("/api/v1/admin/analytics"):
            body = json.dumps({"release": "test-release"}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
        else:
            body = b'{"detail":"not_found"}'
            self.send_response(404)
            self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        type(self).authorization = self.headers.get("Authorization", "")
        body = b'{"created":true}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def _start(server):
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return thread


def test_local_dashboard_serves_assets_and_proxies_only_admin_routes():
    upstream = ThreadingHTTPServer(("127.0.0.1", 0), _UpstreamHandler)
    _start(upstream)
    transport = DirectTransport(f"http://127.0.0.1:{upstream.server_port}")
    dashboard = DashboardHTTPServer(("127.0.0.1", 0), transport)
    _start(dashboard)
    base = f"http://127.0.0.1:{dashboard.server_port}"
    try:
        with urllib.request.urlopen(base + "/", timeout=5) as response:
            html = response.read().decode()
            assert response.status == 200
            assert "连接服务器数据" in html
            assert "default-src 'self'" in response.headers["Content-Security-Policy"]

        request = urllib.request.Request(
            base + "/api/v1/admin/analytics?days=30",
            headers={"Authorization": "Bearer correct-token"},
        )
        with urllib.request.urlopen(request, timeout=5) as response:
            assert json.load(response) == {"release": "test-release"}
        assert _UpstreamHandler.authorization == "Bearer correct-token"

        export = urllib.request.Request(
            base + "/api/v1/admin/analytics/export?days=7&format=csv",
            headers={"Authorization": "Bearer correct-token"},
        )
        with urllib.request.urlopen(export, timeout=5) as response:
            assert response.headers["Content-Disposition"] == 'attachment; filename="analytics.csv"'

        snapshot = urllib.request.Request(
            base + "/api/v1/admin/analytics/snapshot",
            method="POST",
            headers={"Authorization": "Bearer correct-token"},
        )
        with urllib.request.urlopen(snapshot, timeout=5) as response:
            assert json.load(response) == {"created": True}

        try:
            urllib.request.urlopen(base + "/api/v1/users/me", timeout=5)
        except urllib.error.HTTPError as error:
            assert error.code == 404
            assert json.load(error) == {"detail": "dashboard_route_not_found"}
        else:
            raise AssertionError("local dashboard must not act as an open API proxy")
    finally:
        dashboard.shutdown()
        dashboard.server_close()
        transport.close()
        upstream.shutdown()
        upstream.server_close()
