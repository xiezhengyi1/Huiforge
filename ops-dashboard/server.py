"""Serve the local operations dashboard and proxy its admin API over SSH."""
from __future__ import annotations

import argparse
import getpass
import hashlib
import http.client
import json
import mimetypes
import ssl
import sys
import threading
import webbrowser
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Protocol
from urllib.parse import SplitResult, urlsplit


BASE_DIR = Path(__file__).resolve().parent
STATIC_FILES = {
    "/": "index.html",
    "/index.html": "index.html",
    "/app.css": "app.css",
    "/app.js": "app.js",
}
API_ROUTES = {
    ("GET", "/api/v1/admin/analytics"),
    ("GET", "/api/v1/admin/analytics/export"),
    ("POST", "/api/v1/admin/analytics/snapshot"),
}
FORWARDED_RESPONSE_HEADERS = {
    "cache-control",
    "content-disposition",
    "content-language",
    "content-type",
    "etag",
    "last-modified",
}


@dataclass(frozen=True)
class ProxyResponse:
    status: int
    headers: tuple[tuple[str, str], ...]
    body: bytes


class ProxyTransport(Protocol):
    def request(self, method: str, target: str, headers: dict[str, str], body: bytes) -> ProxyResponse: ...

    def close(self) -> None: ...


class DirectTransport:
    """Direct HTTP(S) upstream, useful when a private VPN or HTTPS domain exists."""

    def __init__(self, upstream_url: str) -> None:
        parsed = urlsplit(upstream_url.rstrip("/"))
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise ValueError("upstream_url_must_be_http_or_https")
        self.upstream = parsed

    def request(self, method: str, target: str, headers: dict[str, str], body: bytes) -> ProxyResponse:
        if self.upstream.scheme == "https":
            connection: http.client.HTTPConnection = http.client.HTTPSConnection(
                self.upstream.hostname,
                self.upstream.port,
                timeout=20,
                context=ssl.create_default_context(),
            )
        else:
            connection = http.client.HTTPConnection(
                self.upstream.hostname, self.upstream.port, timeout=20,
            )
        base = self.upstream.path.rstrip("/")
        try:
            connection.request(method, base + target, body=body or None, headers=headers)
            response = connection.getresponse()
            return ProxyResponse(response.status, tuple(response.getheaders()), response.read())
        finally:
            connection.close()

    def close(self) -> None:
        return None


class SSHTransport:
    """Run a fixed localhost curl over SSH; secrets travel only through stdin."""

    def __init__(self, client, remote_host: str, remote_port: int) -> None:
        self.client = client
        self.remote_host = remote_host
        self.remote_port = remote_port
        self._lock = threading.Lock()

    @staticmethod
    def _curl_value(value: str) -> str:
        if "\r" in value or "\n" in value:
            raise ValueError("invalid_proxy_header")
        return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'

    def request(self, method: str, target: str, headers: dict[str, str], body: bytes) -> ProxyResponse:
        with self._lock:
            url = f"http://{self.remote_host}:{self.remote_port}{target}"
            config = [
                "silent",
                "show-error",
                "dump-header = -",
                "output = -",
                "connect-timeout = 5",
                "max-time = 20",
                "request = " + self._curl_value(method),
                "url = " + self._curl_value(url),
            ]
            for key in ("Accept", "Accept-Encoding", "Authorization", "Content-Type"):
                if headers.get(key):
                    config.append("header = " + self._curl_value(f"{key}: {headers[key]}"))
            if body:
                config.append("data-binary = " + self._curl_value(body.decode("utf-8")))
            stdin, stdout, stderr = self.client.exec_command(
                "curl --config -", timeout=25,
            )
            stdin.write("\n".join(config) + "\n")
            stdin.channel.shutdown_write()
            raw = stdout.read()
            error = stderr.read()
            exit_code = stdout.channel.recv_exit_status()
            if exit_code != 0:
                raise ConnectionError(
                    "dashboard_ssh_request_failed:" + error.decode("utf-8", "replace")[:120],
                )
            separator = b"\r\n\r\n"
            if separator not in raw:
                raise ConnectionError("dashboard_invalid_upstream_response")
            raw_headers, response_body = raw.split(separator, 1)
            lines = raw_headers.decode("iso-8859-1").split("\r\n")
            status = int(lines[0].split(" ", 2)[1])
            response_headers = tuple(
                tuple(line.split(":", 1)) for line in lines[1:] if ":" in line
            )
            return ProxyResponse(status, response_headers, response_body)

    def close(self) -> None:
        self.client.close()


class DashboardHTTPServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address: tuple[str, int], transport: ProxyTransport) -> None:
        super().__init__(address, DashboardHandler)
        self.transport = transport


class DashboardHandler(BaseHTTPRequestHandler):
    server: DashboardHTTPServer
    protocol_version = "HTTP/1.1"

    def log_message(self, format: str, *args: object) -> None:
        # The standard log line includes only method/path/status. Request headers,
        # including the admin token, are never logged.
        sys.stdout.write("[dashboard] " + (format % args) + "\n")

    def _security_headers(self, content_type: str) -> None:
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; base-uri 'none'; object-src 'none'; "
            "script-src 'self'; style-src 'self'; img-src 'self' data:; "
            "connect-src 'self'; form-action 'self'; frame-ancestors 'none'",
        )

    def _write(self, status: int, content_type: str, body: bytes, extra_headers=()) -> None:
        self.send_response(status)
        self._security_headers(content_type)
        for key, value in extra_headers:
            if key.lower() in FORWARDED_RESPONSE_HEADERS and key.lower() not in {"content-type", "cache-control"}:
                self.send_header(key, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json_error(self, status: int, detail: str) -> None:
        self._write(
            status,
            "application/json; charset=utf-8",
            json.dumps({"detail": detail}, ensure_ascii=False).encode("utf-8"),
        )

    def _serve_static(self, path: str) -> bool:
        name = STATIC_FILES.get(path)
        if not name:
            return False
        file_path = BASE_DIR / name
        body = file_path.read_bytes()
        media_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
        etag = f'"{hashlib.sha256(body).hexdigest()[:24]}"'
        if self.headers.get("If-None-Match") == etag:
            self.send_response(304)
            self._security_headers(media_type)
            self.send_header("ETag", etag)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return True
        self._write(200, media_type, body, (("ETag", etag),))
        return True

    def _proxy_api(self) -> None:
        parsed = urlsplit(self.path)
        if (self.command, parsed.path) not in API_ROUTES:
            self._json_error(404, "dashboard_route_not_found")
            return
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length > 1024:
            self._json_error(413, "dashboard_request_too_large")
            return
        body = self.rfile.read(length) if length else b""
        headers = {
            "Accept": self.headers.get("Accept", "application/json"),
            "Accept-Encoding": "identity",
            "Authorization": self.headers.get("Authorization", ""),
            "Connection": "close",
            "Host": "127.0.0.1:8081",
        }
        if body:
            headers["Content-Type"] = self.headers.get("Content-Type", "application/json")
        try:
            response = self.server.transport.request(self.command, self.path, headers, body)
        except Exception as error:
            print(f"[dashboard] upstream error: {type(error).__name__}", file=sys.stderr)
            self._json_error(502, "dashboard_server_connection_failed")
            return
        content_type = next(
            (value for key, value in response.headers if key.lower() == "content-type"),
            "application/octet-stream",
        )
        self._write(response.status, content_type, response.body, response.headers)

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path == "/local-health":
            self._write(200, "application/json; charset=utf-8", b'{"status":"ready"}')
        elif not self._serve_static(path):
            self._proxy_api()

    def do_HEAD(self) -> None:
        path = urlsplit(self.path).path
        if not self._serve_static(path):
            self._json_error(405, "method_not_allowed")

    def do_POST(self) -> None:
        self._proxy_api()


def connect_ssh(args: argparse.Namespace) -> SSHTransport:
    try:
        import paramiko
    except ImportError as error:  # pragma: no cover - startup guidance
        raise RuntimeError("请先安装 paramiko：python -m pip install paramiko") from error

    known_hosts = Path(args.known_hosts).expanduser().resolve()
    if not known_hosts.is_file():
        raise FileNotFoundError(f"SSH 主机指纹文件不存在：{known_hosts}")
    client = paramiko.SSHClient()
    client.load_host_keys(str(known_hosts))
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    common = dict(
        hostname=args.ssh_host,
        port=args.ssh_port,
        username=args.ssh_user,
        timeout=12,
        banner_timeout=12,
        auth_timeout=12,
    )
    try:
        client.connect(**common, allow_agent=True, look_for_keys=True)
    except paramiko.AuthenticationException:
        password = getpass.getpass("服务器 SSH 密码（不会保存）：")
        client.connect(**common, password=password, allow_agent=False, look_for_keys=False)
    transport = client.get_transport()
    if not transport or not transport.is_active():
        client.close()
        raise ConnectionError("SSH 连接未建立")
    transport.set_keepalive(30)
    return SSHTransport(client, args.remote_host, args.remote_port)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="绘域本地运营数据台")
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8091)
    parser.add_argument("--upstream-url", help="直接连接的 HTTPS/HTTP 服务地址；设置后不启用 SSH")
    parser.add_argument("--ssh-host", default="cpod-1u7d9hnvxh8y-s1.podtcp.compshare.cn")
    parser.add_argument("--ssh-port", type=int, default=25063)
    parser.add_argument("--ssh-user", default="root")
    parser.add_argument("--remote-host", default="127.0.0.1")
    parser.add_argument("--remote-port", type=int, default=8081)
    parser.add_argument("--known-hosts", default=str(BASE_DIR / "known_hosts"))
    parser.add_argument("--no-browser", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.bind not in {"127.0.0.1", "::1", "localhost"}:
        raise SystemExit("为保护管理 Token，本地面板只允许监听回环地址。")
    transport: ProxyTransport = DirectTransport(args.upstream_url) if args.upstream_url else connect_ssh(args)
    try:
        readiness = transport.request(
            "GET",
            "/api/v1/health/ready",
            {"Accept": "application/json", "Accept-Encoding": "identity"},
            b"",
        )
        if readiness.status != 200:
            raise ConnectionError(f"服务器健康检查返回 HTTP {readiness.status}")
    except Exception as error:
        transport.close()
        raise SystemExit(f"无法连接绘域服务器：{error}") from None
    server = DashboardHTTPServer((args.bind, args.port), transport)
    url = f"http://127.0.0.1:{server.server_address[1]}/"
    print(f"绘域本地运营数据台：{url}")
    print("线上服务器状态：已连接")
    print("关闭此窗口或按 Ctrl+C 即可停止；SSH 密码和管理员 Token 均不会保存。")
    if not args.no_browser:
        threading.Timer(0.35, webbrowser.open, args=(url,)).start()
    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        print("\n本地数据台已停止。")
    finally:
        server.server_close()
        transport.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
