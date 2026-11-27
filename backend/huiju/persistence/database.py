"""Transactional SQLite user store and owner-scoped private data access."""
from __future__ import annotations

import contextlib
import hmac
import json
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

class _ClosingConnection(sqlite3.Connection):
    """sqlite3 contexts commit/rollback but do not close; enforce both."""

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> bool:
        try:
            return bool(super().__exit__(exc_type, exc_value, traceback))
        finally:
            self.close()


class UserDatabase:
    """Transactional user persistence with owner-scoped queries.

    SQLite WAL gives every private query an explicit owner predicate and
    atomic updates.
    """

    def __init__(self, path: Path, private_media_dir: Path) -> None:
        self.path = path
        self.private_media_dir = private_media_dir
        self._lock = threading.RLock()
        self.path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.private_media_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        self._initialize()
        with contextlib.suppress(OSError):
            self.path.chmod(0o600)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(
            self.path, timeout=15, isolation_level=None, factory=_ClosingConnection,
        )
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA busy_timeout=15000")
        connection.execute("PRAGMA cache_size=-32768")
        connection.execute("PRAGMA temp_store=MEMORY")
        connection.execute("PRAGMA mmap_size=268435456")
        return connection

    def healthcheck(self) -> bool:
        """Return whether the database can answer a minimal read transaction."""
        try:
            with self._lock, self._connect() as connection:
                row = connection.execute("SELECT 1 AS healthy").fetchone()
            return bool(row and row["healthy"] == 1)
        except sqlite3.Error:
            return False

    def analytics_snapshot(self, start_ts: float, end_ts: float) -> dict[str, Any]:
        """Return admin-safe account aggregates without exposing user records."""
        now = time.time()
        with self._lock, self._connect() as connection:
            registered_users = int(connection.execute("SELECT COUNT(*) FROM users").fetchone()[0])
            wallet_owners = int(connection.execute("SELECT COUNT(*) FROM wallets").fetchone()[0])
            active_members = int(connection.execute(
                """SELECT COUNT(*) FROM wallets
                   WHERE membership_tier != 'free'
                     AND (membership_expires_at IS NULL OR membership_expires_at > ?)""",
                (now,),
            ).fetchone()[0])
            tier_rows = connection.execute(
                """SELECT membership_tier,COUNT(*) AS total FROM wallets
                   WHERE membership_tier != 'free'
                     AND (membership_expires_at IS NULL OR membership_expires_at > ?)
                   GROUP BY membership_tier ORDER BY total DESC""",
                (now,),
            ).fetchall()
            registration_rows = connection.execute(
                """SELECT date(created_at,'unixepoch','+8 hours') AS day,COUNT(*) AS total
                   FROM users WHERE created_at >= ? AND created_at <= ?
                   GROUP BY day ORDER BY day""",
                (start_ts, end_ts),
            ).fetchall()
            content_counts = {
                table: int(connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
                for table in ("histories", "assets", "workflows", "media_jobs")
            }
        return {
            "registered_users": registered_users,
            "wallet_owners": wallet_owners,
            "active_members": active_members,
            "member_rate": round(active_members / registered_users * 100, 2) if registered_users else 0.0,
            "membership_tiers": [
                {"tier": str(row["membership_tier"]), "members": int(row["total"])} for row in tier_rows
            ],
            "new_users_daily": [
                {"day": str(row["day"]), "users": int(row["total"])} for row in registration_rows
            ],
            "content": content_counts,
        }

    def _initialize(self) -> None:
        with self._lock, self._connect() as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute("PRAGMA synchronous=NORMAL")
            connection.execute("PRAGMA wal_autocheckpoint=1000")
            connection.executescript("""
                CREATE TABLE IF NOT EXISTS meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    contact TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    contact_type TEXT NOT NULL CHECK(contact_type IN ('phone','email')),
                    password_hash TEXT NOT NULL DEFAULT '',
                    display_name TEXT NOT NULL,
                    bio TEXT NOT NULL DEFAULT '',
                    avatar_path TEXT NOT NULL DEFAULT '',
                    created_at REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    device_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS email_verifications (
                    device_id TEXT NOT NULL,
                    email TEXT NOT NULL,
                    digest TEXT NOT NULL,
                    sent_at REAL NOT NULL,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY(device_id, email)
                );
                CREATE INDEX IF NOT EXISTS idx_email_verifications_sent ON email_verifications(sent_at);
                CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email, sent_at);
                CREATE TABLE IF NOT EXISTS wallets (
                    owner_id TEXT PRIMARY KEY,
                    daily INTEGER NOT NULL,
                    daily_date TEXT NOT NULL,
                    monthly INTEGER NOT NULL,
                    monthly_period TEXT NOT NULL,
                    topup INTEGER NOT NULL,
                    topup_expires_at REAL,
                    free_paid_images_day INTEGER NOT NULL DEFAULT 0,
                    membership_tier TEXT NOT NULL DEFAULT 'free',
                    membership_expires_at REAL
                );
                CREATE TABLE IF NOT EXISTS wallet_ledger (
                    id TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    label TEXT NOT NULL,
                    created_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_wallet_ledger_owner ON wallet_ledger(owner_id, created_at DESC);
                CREATE TABLE IF NOT EXISTS histories (
                    id TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL,
                    media_path TEXT NOT NULL,
                    prompt TEXT NOT NULL DEFAULT '',
                    kind TEXT NOT NULL DEFAULT 'generation',
                    created_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_histories_owner ON histories(owner_id, created_at DESC);
                CREATE TABLE IF NOT EXISTS asset_categories (
                    id TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    UNIQUE(owner_id, name COLLATE NOCASE)
                );
                CREATE INDEX IF NOT EXISTS idx_asset_categories_owner ON asset_categories(owner_id, created_at);
                CREATE TABLE IF NOT EXISTS assets (
                    id TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    category_id TEXT NOT NULL,
                    media_path TEXT NOT NULL,
                    prompt TEXT NOT NULL DEFAULT '',
                    kind TEXT NOT NULL DEFAULT 'text',
                    asset_type TEXT NOT NULL DEFAULT 'image',
                    media_type TEXT NOT NULL DEFAULT 'image/webp',
                    size_bytes INTEGER NOT NULL DEFAULT 0,
                    created_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_assets_owner ON assets(owner_id, created_at DESC);
                CREATE TABLE IF NOT EXISTS media_jobs (
                    id TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL,
                    kind TEXT NOT NULL CHECK(kind IN ('video','audio')),
                    operation TEXT NOT NULL,
                    model TEXT NOT NULL,
                    prompt TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL,
                    provider_task_id TEXT NOT NULL DEFAULT '',
                    provider_status TEXT NOT NULL DEFAULT '',
                    media_path TEXT NOT NULL DEFAULT '',
                    mime_type TEXT NOT NULL DEFAULT '',
                    parameters_json TEXT NOT NULL DEFAULT '{}',
                    charged_credits INTEGER NOT NULL DEFAULT 0,
                    unit_credits INTEGER NOT NULL DEFAULT 0,
                    billed_quantity INTEGER NOT NULL DEFAULT 0,
                    error TEXT NOT NULL DEFAULT '',
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_media_jobs_owner ON media_jobs(owner_id, created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_media_jobs_active ON media_jobs(owner_id, kind, status);
                CREATE TABLE IF NOT EXISTS storyboard_jobs (
                    id TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    status TEXT NOT NULL,
                    phase TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    quote_json TEXT NOT NULL,
                    shots_json TEXT NOT NULL,
                    output_job_id TEXT NOT NULL,
                    error TEXT NOT NULL DEFAULT '',
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_storyboard_owner ON storyboard_jobs(owner_id, created_at DESC);
                CREATE UNIQUE INDEX IF NOT EXISTS idx_storyboard_active_owner ON storyboard_jobs(owner_id)
                    WHERE status IN ('queued','running');
                CREATE TABLE IF NOT EXISTS short_drama_sessions (
                    id TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    provider_response_id TEXT NOT NULL DEFAULT '',
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS video_workflow_jobs (
                    id TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    status TEXT NOT NULL,
                    phase TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    source_path TEXT NOT NULL,
                    state_json TEXT NOT NULL,
                    tts_job_id TEXT NOT NULL DEFAULT '',
                    output_job_id TEXT NOT NULL,
                    error TEXT NOT NULL DEFAULT '',
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_video_workflow_owner ON video_workflow_jobs(owner_id, created_at DESC);
                CREATE UNIQUE INDEX IF NOT EXISTS idx_video_workflow_active_owner ON video_workflow_jobs(owner_id)
                    WHERE status IN ('queued','running');
                CREATE INDEX IF NOT EXISTS idx_short_drama_sessions_owner
                    ON short_drama_sessions(owner_id, updated_at DESC);
                CREATE TABLE IF NOT EXISTS short_drama_messages (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL REFERENCES short_drama_sessions(id) ON DELETE CASCADE,
                    owner_id TEXT NOT NULL,
                    role TEXT NOT NULL CHECK(role IN ('user','assistant','tool')),
                    content TEXT NOT NULL DEFAULT '',
                    tool_json TEXT NOT NULL DEFAULT '{}',
                    created_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_short_drama_messages_session
                    ON short_drama_messages(owner_id, session_id, created_at);
                CREATE TABLE IF NOT EXISTS feedback (
                    id TEXT PRIMARY KEY,
                    owner_id TEXT,
                    username TEXT NOT NULL,
                    category TEXT NOT NULL,
                    message TEXT NOT NULL,
                    screenshot_file TEXT,
                    created_at REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS workflows (
                    id TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL,
                    author TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    graph_json TEXT NOT NULL,
                    graph_summary_json TEXT,
                    tags_json TEXT NOT NULL DEFAULT '[]',
                    likes_count INTEGER NOT NULL DEFAULT 0,
                    comments_count INTEGER NOT NULL DEFAULT 0,
                    uses_count INTEGER NOT NULL DEFAULT 0,
                    is_shared INTEGER NOT NULL DEFAULT 1,
                    created_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_workflows_shared ON workflows(is_shared, created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_workflows_owner ON workflows(owner_id, created_at DESC);
                CREATE TABLE IF NOT EXISTS workflow_likes (
                    workflow_id TEXT NOT NULL,
                    owner_id TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    PRIMARY KEY(workflow_id, owner_id)
                );
                CREATE INDEX IF NOT EXISTS idx_workflow_likes_owner ON workflow_likes(owner_id, created_at DESC);
                CREATE TABLE IF NOT EXISTS workflow_comments (
                    id TEXT PRIMARY KEY,
                    workflow_id TEXT NOT NULL,
                    owner_id TEXT NOT NULL,
                    author TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_workflow_comments_workflow ON workflow_comments(workflow_id, created_at DESC);
                CREATE TABLE IF NOT EXISTS plaza_posts (
                    id TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL,
                    author TEXT NOT NULL,
                    title TEXT NOT NULL,
                    prompt TEXT NOT NULL DEFAULT '',
                    model TEXT NOT NULL DEFAULT '',
                    media_path TEXT NOT NULL,
                    media_type TEXT NOT NULL CHECK(media_type IN ('image','video')),
                    mime_type TEXT NOT NULL,
                    tags_json TEXT NOT NULL DEFAULT '[]',
                    likes_count INTEGER NOT NULL DEFAULT 0,
                    created_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_plaza_posts_created ON plaza_posts(created_at DESC);
                CREATE TABLE IF NOT EXISTS plaza_likes (
                    post_id TEXT NOT NULL,
                    owner_id TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    PRIMARY KEY(post_id, owner_id)
                );
            """)
            asset_columns = {row[1] for row in connection.execute("PRAGMA table_info(assets)").fetchall()}
            if "asset_type" not in asset_columns:
                connection.execute("ALTER TABLE assets ADD COLUMN asset_type TEXT NOT NULL DEFAULT 'image'")
            if "media_type" not in asset_columns:
                connection.execute("ALTER TABLE assets ADD COLUMN media_type TEXT NOT NULL DEFAULT 'image/webp'")
            if "size_bytes" not in asset_columns:
                connection.execute("ALTER TABLE assets ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0")
            media_columns = {row[1] for row in connection.execute("PRAGMA table_info(media_jobs)").fetchall()}
            if "charged_credits" not in media_columns:
                connection.execute("ALTER TABLE media_jobs ADD COLUMN charged_credits INTEGER NOT NULL DEFAULT 0")
            if "unit_credits" not in media_columns:
                connection.execute("ALTER TABLE media_jobs ADD COLUMN unit_credits INTEGER NOT NULL DEFAULT 0")
            if "billed_quantity" not in media_columns:
                connection.execute("ALTER TABLE media_jobs ADD COLUMN billed_quantity INTEGER NOT NULL DEFAULT 0")
            workflow_columns = {row[1] for row in connection.execute("PRAGMA table_info(workflows)").fetchall()}
            if "tags_json" not in workflow_columns:
                connection.execute("ALTER TABLE workflows ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'")
            if "likes_count" not in workflow_columns:
                connection.execute("ALTER TABLE workflows ADD COLUMN likes_count INTEGER NOT NULL DEFAULT 0")
            if "comments_count" not in workflow_columns:
                connection.execute("ALTER TABLE workflows ADD COLUMN comments_count INTEGER NOT NULL DEFAULT 0")
            if "uses_count" not in workflow_columns:
                connection.execute("ALTER TABLE workflows ADD COLUMN uses_count INTEGER NOT NULL DEFAULT 0")
            if "graph_summary_json" not in workflow_columns:
                connection.execute("ALTER TABLE workflows ADD COLUMN graph_summary_json TEXT")
            connection.execute("INSERT OR IGNORE INTO meta(key,value) VALUES('schema_version','5')")
            connection.execute("UPDATE meta SET value='5' WHERE key='schema_version'")

    @staticmethod
    def _china_day() -> str:
        return datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d")

    @staticmethod
    def _china_month() -> str:
        return datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m")

    def owner_for_device(self, device_id: str) -> str:
        with self._connect() as connection:
            row = connection.execute("SELECT user_id FROM sessions WHERE device_id=?", (device_id,)).fetchone()
        return str(row["user_id"]) if row else device_id

    def user_exists(self, user_id: str) -> bool:
        with self._connect() as connection:
            return bool(connection.execute("SELECT 1 FROM users WHERE id=?", (user_id,)).fetchone())

    def contact_exists(self, contact: str) -> bool:
        with self._connect() as connection:
            return bool(connection.execute("SELECT 1 FROM users WHERE contact=? COLLATE NOCASE", (contact,)).fetchone())

    def phone_exists(self, phone: str) -> bool:
        return self.contact_exists(phone)

    def reserve_email_code(self, device_id: str, email: str, digest: str, now: float) -> bool:
        with self._lock, self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute("DELETE FROM email_verifications WHERE sent_at<=?", (now - 300,))
            sent = connection.execute(
                "SELECT 1 FROM email_verifications WHERE email=? AND sent_at>? LIMIT 1", (email, now - 60),
            ).fetchone()
            if sent:
                return False
            connection.execute(
                "INSERT OR REPLACE INTO email_verifications(device_id,email,digest,sent_at,attempts) VALUES(?,?,?,?,0)",
                (device_id, email, digest, now),
            )
            return True

    def discard_email_code(self, device_id: str, email: str, digest: str) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                "DELETE FROM email_verifications WHERE device_id=? AND email=? AND digest=?", (device_id, email, digest),
            )

    def consume_email_code(self, device_id: str, email: str, digest: str, now: float) -> bool:
        with self._lock, self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            parameters = (device_id, email)
            row = connection.execute(
                "SELECT digest,sent_at,attempts FROM email_verifications WHERE device_id=? AND email=?", parameters,
            ).fetchone()
            if not row or row["sent_at"] <= now - 300 or row["attempts"] >= 5:
                return False
            if not hmac.compare_digest(row["digest"], digest):
                connection.execute(
                    "UPDATE email_verifications SET attempts=attempts+1 WHERE device_id=? AND email=?", parameters,
                )
                return False
            connection.execute("DELETE FROM email_verifications WHERE device_id=? AND email=?", parameters)
            return True

    def register_user(
        self, device_id: str, contact: str, password_hash: str, display_name: str, *, contact_type: str = "phone",
    ) -> str:
        user_id = uuid.uuid4().hex
        now = time.time()
        with self._lock, self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                existing_session = connection.execute("SELECT 1 FROM sessions WHERE device_id=?", (device_id,)).fetchone()
                default_name = f"绘友{contact[-4:]}" if contact_type == "phone" else f"Creator {user_id[:4]}"
                connection.execute(
                    """INSERT INTO users(id,contact,contact_type,password_hash,display_name,bio,avatar_path,created_at)
                       VALUES(?,?,?,?,?,'','',?)""",
                    (user_id, contact, contact_type, password_hash, display_name.strip() or default_name, now),
                )
                connection.execute(
                    "INSERT OR REPLACE INTO sessions(device_id,user_id,created_at,updated_at) VALUES(?,?,?,?)",
                    (device_id, user_id, now, now),
                )
                if not existing_session:
                    self._migrate_owner_rows(connection, device_id, user_id)
                connection.commit()
            except Exception:
                connection.rollback()
                raise
        return user_id

    def login_user(self, device_id: str, contact: str, *, contact_type: str = "phone") -> tuple[str, str] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT id,password_hash FROM users WHERE contact=? COLLATE NOCASE AND contact_type=?",
                (contact, contact_type),
            ).fetchone()
        if not row:
            return None
        return str(row["id"]), str(row["password_hash"])

    def bind_session(self, device_id: str, user_id: str) -> None:
        now = time.time()
        with self._lock, self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            existing_session = connection.execute("SELECT 1 FROM sessions WHERE device_id=?", (device_id,)).fetchone()
            connection.execute(
                "INSERT OR REPLACE INTO sessions(device_id,user_id,created_at,updated_at) VALUES(?,?,?,?)",
                (device_id, user_id, now, now),
            )
            if not existing_session:
                self._migrate_owner_rows(connection, device_id, user_id)
            connection.commit()

    def logout_user(self, device_id: str) -> None:
        with self._lock, self._connect() as connection:
            connection.execute("DELETE FROM sessions WHERE device_id=?", (device_id,))

    def public_user(self, user_id: str) -> dict[str, Any]:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT id,contact,contact_type,display_name,bio,avatar_path,created_at FROM users WHERE id=?", (user_id,),
            ).fetchone()
        if not row:
            return {}
        contact = str(row["contact"])
        is_email = row["contact_type"] == "email"
        local, _, domain = contact.partition("@")
        return {
            "user_id": str(row["id"]), "display_name": row["display_name"] or "绘域用户",
            "phone_masked": f"{contact[:3]}****{contact[-4:]}" if not is_email and len(contact) == 11 else "",
            "email_masked": f"{local[:1]}***@{domain}" if is_email else "",
            "bio": row["bio"] or "", "avatar_url": "/api/v1/users/avatar/content" if row["avatar_path"] else "",
            "created_at": row["created_at"],
        }

    def update_profile(self, user_id: str, display_name: str, bio: str) -> bool:
        with self._lock, self._connect() as connection:
            result = connection.execute(
                "UPDATE users SET display_name=?,bio=? WHERE id=?", (display_name, bio, user_id),
            )
        return result.rowcount == 1

    def set_avatar_path(self, user_id: str, media_path: str) -> None:
        with self._lock, self._connect() as connection:
            connection.execute("UPDATE users SET avatar_path=? WHERE id=?", (media_path, user_id))

    def avatar_media_path(self, user_id: str) -> str:
        with self._connect() as connection:
            row = connection.execute("SELECT avatar_path FROM users WHERE id=?", (user_id,)).fetchone()
        return str(row["avatar_path"]) if row else ""

    def _migrate_owner_rows(self, connection: sqlite3.Connection, old_owner: str, new_owner: str) -> None:
        if old_owner == new_owner:
            return
        old_wallet = connection.execute("SELECT * FROM wallets WHERE owner_id=?", (old_owner,)).fetchone()
        new_wallet = connection.execute("SELECT * FROM wallets WHERE owner_id=?", (new_owner,)).fetchone()
        if old_wallet and not new_wallet:
            connection.execute("UPDATE wallets SET owner_id=? WHERE owner_id=?", (new_owner, old_owner))
        elif old_wallet and new_wallet:
            connection.execute(
                "UPDATE wallets SET daily=max(daily,?),monthly=monthly+?,topup=topup+? WHERE owner_id=?",
                (int(old_wallet["daily"]), int(old_wallet["monthly"]), int(old_wallet["topup"]), new_owner),
            )
            connection.execute("DELETE FROM wallets WHERE owner_id=?", (old_owner,))
        connection.execute("UPDATE wallet_ledger SET owner_id=? WHERE owner_id=?", (new_owner, old_owner))
        for table in ("histories", "assets", "asset_categories", "workflows", "media_jobs", "short_drama_sessions", "short_drama_messages"):
            connection.execute(f"UPDATE {table} SET owner_id=? WHERE owner_id=?", (new_owner, old_owner))

    def wallet_for(self, owner: str, daily_grant: int) -> dict[str, Any]:
        today, month, now = self._china_day(), self._china_month(), time.time()
        # The common path is read-only.  Avoid BEGIN IMMEDIATE here so hundreds
        # of simultaneous workspace boots do not serialize behind a write lock.
        with self._connect() as connection:
            row = connection.execute("SELECT * FROM wallets WHERE owner_id=?", (owner,)).fetchone()
            if row and row["daily_date"] == today and row["monthly_period"] == month:
                ledger = connection.execute(
                    "SELECT id,type,amount,label,created_at FROM wallet_ledger WHERE owner_id=? ORDER BY created_at DESC LIMIT 100",
                    (owner,),
                ).fetchall()
                result = dict(row)
                result["ledger"] = [dict(item) for item in ledger]
                return result
        with self._lock, self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute("SELECT * FROM wallets WHERE owner_id=?", (owner,)).fetchone()
            if not row:
                connection.execute(
                    """INSERT INTO wallets(owner_id,daily,daily_date,monthly,monthly_period,topup,
                       topup_expires_at,free_paid_images_day,membership_tier,membership_expires_at)
                       VALUES(?,?,?,0,?,0,NULL,0,'free',NULL)""", (owner, daily_grant, today, month),
                )
                connection.execute(
                    "INSERT INTO wallet_ledger(id,owner_id,type,amount,label,created_at) VALUES(?,?,?,?,?,?)",
                    (uuid.uuid4().hex, owner, "daily_grant", daily_grant, "每日赠送", now),
                )
            else:
                if row["daily_date"] != today:
                    connection.execute(
                        "UPDATE wallets SET daily=?,daily_date=?,free_paid_images_day=0 WHERE owner_id=?",
                        (daily_grant, today, owner),
                    )
                    connection.execute(
                        "INSERT INTO wallet_ledger(id,owner_id,type,amount,label,created_at) VALUES(?,?,?,?,?,?)",
                        (uuid.uuid4().hex, owner, "daily_grant", daily_grant, "每日赠送", now),
                    )
                if row["monthly_period"] != month:
                    connection.execute("UPDATE wallets SET monthly=0,monthly_period=? WHERE owner_id=?", (month, owner))
            row = connection.execute("SELECT * FROM wallets WHERE owner_id=?", (owner,)).fetchone()
            ledger = connection.execute(
                "SELECT id,type,amount,label,created_at FROM wallet_ledger WHERE owner_id=? ORDER BY created_at DESC LIMIT 100",
                (owner,),
            ).fetchall()
            connection.commit()
        result = dict(row)
        result["ledger"] = [dict(item) for item in ledger]
        return result

    def membership_for(self, owner: str) -> dict[str, Any]:
        """Read membership without creating or locking a wallet row."""
        with self._connect() as connection:
            row = connection.execute(
                "SELECT membership_tier,membership_expires_at FROM wallets WHERE owner_id=?",
                (owner,),
            ).fetchone()
        if not row:
            return {"membership_tier": "free", "membership_expires_at": None}
        return dict(row)

    def charge_wallet(
        self, owner: str, total: int, allowed_buckets: list[str], label: str,
        *, mark_free_image: bool = False,
    ) -> None:
        if any(bucket not in {"daily", "monthly", "topup"} for bucket in allowed_buckets):
            raise ValueError("invalid_credit_bucket")
        with self._lock, self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute("SELECT daily,monthly,topup FROM wallets WHERE owner_id=?", (owner,)).fetchone()
            if not row or sum(int(row[bucket]) for bucket in allowed_buckets) < total:
                connection.rollback()
                raise ValueError("credits_insufficient")
            remainder = total
            values = {"daily": int(row["daily"]), "monthly": int(row["monthly"]), "topup": int(row["topup"])}
            for bucket in allowed_buckets:
                consumed = min(values[bucket], remainder)
                values[bucket] -= consumed
                remainder -= consumed
            connection.execute(
                """UPDATE wallets SET daily=?,monthly=?,topup=?,
                   free_paid_images_day=free_paid_images_day+? WHERE owner_id=?""",
                (values["daily"], values["monthly"], values["topup"], 1 if mark_free_image else 0, owner),
            )
            connection.execute(
                "INSERT INTO wallet_ledger(id,owner_id,type,amount,label,created_at) VALUES(?,?,?,?,?,?)",
                (uuid.uuid4().hex, owner, "consume", -total, label, time.time()),
            )
            connection.commit()

    def add_history(self, owner: str, history_id: str, media_path: str, prompt: str, kind: str, created_at: float) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                "INSERT INTO histories(id,owner_id,media_path,prompt,kind,created_at) VALUES(?,?,?,?,?,?)",
                (history_id, owner, media_path, prompt[:8000], kind[:64], created_at),
            )
            stale = connection.execute(
                "SELECT id FROM histories WHERE owner_id=? ORDER BY created_at DESC LIMIT -1 OFFSET 200", (owner,),
            ).fetchall()
            if stale:
                connection.executemany("DELETE FROM histories WHERE id=? AND owner_id=?", [(row["id"], owner) for row in stale])

    def histories_for(self, owner: str) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT id,prompt,kind,created_at FROM histories WHERE owner_id=? ORDER BY created_at DESC LIMIT 200", (owner,),
            ).fetchall()
        return [{**dict(row), "url": f"/api/v1/private-media/history/{row['id']}"} for row in rows]

    def delete_history(self, owner: str, history_id: str) -> bool:
        """Delete one owner-scoped history row without exposing its media path."""
        with self._lock, self._connect() as connection:
            cursor = connection.execute(
                "DELETE FROM histories WHERE id=? AND owner_id=?", (history_id, owner),
            )
        return cursor.rowcount == 1

    def custom_asset_categories(self, owner: str) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT id,name,created_at FROM asset_categories WHERE owner_id=? ORDER BY created_at", (owner,),
            ).fetchall()
        return [dict(row) for row in rows]

    def create_asset_category(self, owner: str, name: str) -> dict[str, Any]:
        category = {"id": f"custom-{uuid.uuid4().hex[:12]}", "name": name, "created_at": time.time()}
        with self._lock, self._connect() as connection:
            count = connection.execute("SELECT count(*) AS total FROM asset_categories WHERE owner_id=?", (owner,)).fetchone()["total"]
            if int(count) >= 24:
                raise ValueError("category_limit")
            try:
                connection.execute(
                    "INSERT INTO asset_categories(id,owner_id,name,created_at) VALUES(?,?,?,?)",
                    (category["id"], owner, name, category["created_at"]),
                )
            except sqlite3.IntegrityError as error:
                raise ValueError("category_exists") from error
        return category

    def assets_for(self, owner: str) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """SELECT id,name,category_id,prompt,kind,asset_type,media_type,size_bytes,created_at
                   FROM assets WHERE owner_id=? ORDER BY created_at DESC LIMIT 500""",
                (owner,),
            ).fetchall()
        return [{**dict(row), "url": f"/api/v1/private-media/asset/{row['id']}"} for row in rows]

    def create_asset(self, owner: str, record: dict[str, Any]) -> None:
        with self._lock, self._connect() as connection:
            count = connection.execute("SELECT count(*) AS total FROM assets WHERE owner_id=?", (owner,)).fetchone()["total"]
            if int(count) >= 500:
                raise ValueError("asset_limit")
            connection.execute(
                """INSERT INTO assets
                   (id,owner_id,name,category_id,media_path,prompt,kind,asset_type,media_type,size_bytes,created_at)
                   VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
                (record["id"], owner, record["name"], record["category_id"], record["media_path"],
                 record["prompt"], record["kind"], record.get("asset_type", "image"),
                 record.get("media_type", "application/octet-stream"), int(record.get("size_bytes", 0)),
                record["created_at"]),
            )

    def delete_asset(self, owner: str, asset_id: str) -> bool:
        """Delete one owner-scoped asset row."""
        with self._lock, self._connect() as connection:
            cursor = connection.execute(
                "DELETE FROM assets WHERE id=? AND owner_id=?", (asset_id, owner),
            )
        return cursor.rowcount == 1

    def create_video_workflow_job(self, owner: str, job_id: str, kind: str, payload: dict[str, Any],
                                  source_path: str, state: dict[str, Any], output_job_id: str) -> None:
        now = time.time()
        with self._lock, self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            if connection.execute("SELECT id FROM video_workflow_jobs WHERE owner_id=? AND status IN ('queued','running')", (owner,)).fetchone():
                raise ValueError("video_workflow_concurrency_limit")
            connection.execute(
                """INSERT INTO video_workflow_jobs
                   (id,owner_id,kind,status,phase,payload_json,source_path,state_json,output_job_id,created_at,updated_at)
                   VALUES(?,?,?,'queued','queued',?,?,?,?,?,?)""",
                (job_id, owner, kind, json.dumps(payload, ensure_ascii=False), source_path,
                 json.dumps(state, ensure_ascii=False), output_job_id, now, now),
            )
            connection.commit()

    @staticmethod
    def _video_workflow_record(row: sqlite3.Row) -> dict[str, Any]:
        record = dict(row)
        record["payload"] = json.loads(record.pop("payload_json"))
        record["state"] = json.loads(record.pop("state_json"))
        return record

    def video_workflow_job(self, owner: str, job_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute("SELECT * FROM video_workflow_jobs WHERE id=? AND owner_id=?", (job_id, owner)).fetchone()
        return self._video_workflow_record(row) if row else None

    def update_video_workflow_job(self, owner: str, job_id: str, *, status: str, phase: str,
                                  state: dict[str, Any], tts_job_id: str, error: str = "") -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                """UPDATE video_workflow_jobs SET status=?,phase=?,state_json=?,tts_job_id=?,error=?,updated_at=?
                   WHERE id=? AND owner_id=?""",
                (status, phase, json.dumps(state, ensure_ascii=False), tts_job_id, error, time.time(), job_id, owner),
            )

    def recoverable_video_workflow_jobs(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute("SELECT * FROM video_workflow_jobs WHERE status IN ('queued','running') ORDER BY created_at").fetchall()
        return [self._video_workflow_record(row) for row in rows]

    def create_storyboard_job(
        self, owner: str, job_id: str, title: str, payload: dict[str, Any],
        quote: dict[str, Any], shots: list[dict[str, Any]], output_job_id: str,
    ) -> None:
        now = time.time()
        with self._lock, self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            active = connection.execute(
                "SELECT id FROM storyboard_jobs WHERE owner_id=? AND status IN ('queued','running')",
                (owner,),
            ).fetchone()
            if active:
                raise ValueError("storyboard_concurrency_limit")
            connection.execute(
                """INSERT INTO storyboard_jobs
                   (id,owner_id,title,status,phase,payload_json,quote_json,shots_json,output_job_id,created_at,updated_at)
                   VALUES(?,?,?,'queued','queued',?,?,?,?,?,?)""",
                (job_id, owner, title, json.dumps(payload, ensure_ascii=False), json.dumps(quote, ensure_ascii=False),
                 json.dumps(shots, ensure_ascii=False), output_job_id, now, now),
            )
            connection.commit()

    @staticmethod
    def _storyboard_record(row: sqlite3.Row) -> dict[str, Any]:
        record = dict(row)
        for key in ("payload", "quote", "shots"):
            record[key] = json.loads(record.pop(key + "_json"))
        return record

    def storyboard_job(self, owner: str, job_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute("SELECT * FROM storyboard_jobs WHERE id=? AND owner_id=?", (job_id, owner)).fetchone()
        return self._storyboard_record(row) if row else None

    def update_storyboard_job(self, owner: str, job_id: str, *, status: str, phase: str,
                              shots: list[dict[str, Any]], error: str = "") -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                """UPDATE storyboard_jobs SET status=?,phase=?,shots_json=?,error=?,updated_at=?
                   WHERE id=? AND owner_id=?""",
                (status, phase, json.dumps(shots, ensure_ascii=False), error, time.time(), job_id, owner),
            )

    def recoverable_storyboard_jobs(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute("SELECT * FROM storyboard_jobs WHERE status IN ('queued','running') ORDER BY created_at").fetchall()
        return [self._storyboard_record(row) for row in rows]

    def create_media_job(
        self, owner: str, job_id: str, kind: str, operation: str, model: str,
        prompt: str, parameters: dict[str, Any], status: str = "queued",
    ) -> None:
        if kind not in {"video", "audio"}:
            raise ValueError("invalid_media_kind")
        now = time.time()
        with self._lock, self._connect() as connection:
            active = connection.execute(
                "SELECT count(*) AS total FROM media_jobs WHERE owner_id=? AND kind=? AND status IN ('queued','running')",
                (owner, kind),
            ).fetchone()
            limit = 1 if kind == "video" else 2
            if int(active["total"]) >= limit:
                raise ValueError("media_concurrency_limit")
            connection.execute(
                """INSERT INTO media_jobs
                   (id,owner_id,kind,operation,model,prompt,status,parameters_json,
                    charged_credits,unit_credits,billed_quantity,created_at,updated_at)
                   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (job_id, owner, kind, operation, model, prompt[:4000], status,
                 json.dumps(parameters, ensure_ascii=False, separators=(",", ":")),
                 int(parameters.get("charged_credits") or 0), int(parameters.get("unit_credits") or 0),
                 int(parameters.get("billed_quantity") or 0), now, now),
            )

    def update_media_job(self, job_id: str, owner: str, **changes: Any) -> None:
        allowed = {
            "status", "provider_task_id", "provider_status", "media_path", "mime_type", "error",
        }
        fields = [(key, value) for key, value in changes.items() if key in allowed]
        if not fields:
            return
        assignments = ",".join(f"{key}=?" for key, _ in fields)
        values = [str(value or "")[:4000] for _, value in fields]
        with self._lock, self._connect() as connection:
            connection.execute(
                f"UPDATE media_jobs SET {assignments},updated_at=? WHERE id=? AND owner_id=?",
                (*values, time.time(), job_id, owner),
            )

    def media_job(self, owner: str, job_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                """SELECT id,kind,operation,model,prompt,status,provider_status,mime_type,error,
                          charged_credits,unit_credits,billed_quantity,
                          created_at,updated_at
                   FROM media_jobs WHERE id=? AND owner_id=?""",
                (job_id, owner),
            ).fetchone()
        return dict(row) if row else None

    def media_jobs_for(self, owner: str, limit: int = 50) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """SELECT id,kind,operation,model,prompt,status,provider_status,mime_type,error,
                          charged_credits,unit_credits,billed_quantity,
                          created_at,updated_at
                   FROM media_jobs WHERE owner_id=? ORDER BY created_at DESC LIMIT ?""",
                (owner, min(max(limit, 1), 100)),
            ).fetchall()
        return [dict(row) for row in rows]

    def recoverable_media_jobs(self) -> list[dict[str, Any]]:
        """Return unfinished jobs without ever exposing them through a public query."""
        with self._connect() as connection:
            rows = connection.execute(
                """SELECT id,owner_id,kind,operation,model,provider_task_id,status,parameters_json
                   FROM media_jobs WHERE status IN ('queued','running') ORDER BY created_at LIMIT 100"""
            ).fetchall()
        records: list[dict[str, Any]] = []
        for row in rows:
            record = dict(row)
            with contextlib.suppress(json.JSONDecodeError, TypeError):
                record["parameters"] = json.loads(record.pop("parameters_json"))
            records.append(record)
        return records

    def media_path(self, owner: str, kind: str, record_id: str) -> Path | None:
        if kind == "history":
            query, params = "SELECT media_path FROM histories WHERE id=? AND owner_id=?", (record_id, owner)
        elif kind == "asset":
            query, params = "SELECT media_path FROM assets WHERE id=? AND owner_id=?", (record_id, owner)
        elif kind == "avatar":
            query, params = "SELECT avatar_path AS media_path FROM users WHERE id=?", (owner,)
        elif kind in {"video", "audio"}:
            query, params = (
                "SELECT media_path FROM media_jobs WHERE id=? AND owner_id=? AND kind=? AND status='completed'",
                (record_id, owner, kind),
            )
        else:
            return None
        with self._connect() as connection:
            row = connection.execute(query, params).fetchone()
        if not row or not row["media_path"]:
            return None
        try:
            path = (self.private_media_dir / str(row["media_path"])).resolve(strict=True)
            path.relative_to(self.private_media_dir.resolve())
            return path
        except (OSError, ValueError):
            return None

    def create_short_drama_session(self, owner: str, title: str) -> dict[str, Any]:
        session_id = uuid.uuid4().hex
        now = time.time()
        with self._lock, self._connect() as connection:
            connection.execute(
                "INSERT INTO short_drama_sessions(id,owner_id,title,created_at,updated_at) VALUES(?,?,?,?,?)",
                (session_id, owner, title[:60], now, now),
            )
        return {"id": session_id, "title": title[:60], "created_at": now, "updated_at": now}

    def short_drama_session(self, owner: str, session_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                """SELECT id,title,provider_response_id,created_at,updated_at
                   FROM short_drama_sessions WHERE id=? AND owner_id=?""",
                (session_id, owner),
            ).fetchone()
        return dict(row) if row else None

    def short_drama_sessions_for(self, owner: str, limit: int = 30) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """SELECT id,title,created_at,updated_at
                   FROM short_drama_sessions WHERE owner_id=? ORDER BY updated_at DESC LIMIT ?""",
                (owner, min(max(limit, 1), 100)),
            ).fetchall()
        return [dict(row) for row in rows]

    def add_short_drama_message(
        self, owner: str, session_id: str, role: str, content: str, tool_data: Any | None = None,
    ) -> dict[str, Any]:
        if role not in {"user", "assistant", "tool"}:
            raise ValueError("invalid_agent_role")
        message_id = uuid.uuid4().hex
        now = time.time()
        tool_json = json.dumps(tool_data or {}, ensure_ascii=False, separators=(",", ":"))[:20000]
        with self._lock, self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            exists = connection.execute(
                "SELECT 1 FROM short_drama_sessions WHERE id=? AND owner_id=?", (session_id, owner),
            ).fetchone()
            if not exists:
                connection.rollback()
                raise ValueError("agent_session_not_found")
            connection.execute(
                """INSERT INTO short_drama_messages
                   (id,session_id,owner_id,role,content,tool_json,created_at) VALUES(?,?,?,?,?,?,?)""",
                (message_id, session_id, owner, role, content[:12000], tool_json, now),
            )
            connection.execute(
                "UPDATE short_drama_sessions SET updated_at=? WHERE id=? AND owner_id=?",
                (now, session_id, owner),
            )
            connection.commit()
        return {"id": message_id, "role": role, "content": content[:12000], "tool": tool_data or {}, "created_at": now}

    def update_short_drama_response(self, owner: str, session_id: str, response_id: str) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                """UPDATE short_drama_sessions SET provider_response_id=?,updated_at=?
                   WHERE id=? AND owner_id=?""",
                (response_id[:200], time.time(), session_id, owner),
            )

    def complete_short_drama_image_job(self, owner: str, job_id: str, images: list[dict[str, str]]) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                """UPDATE short_drama_messages
                   SET tool_json=json_set(tool_json, '$.result.status', 'completed', '$.result.images', json(?))
                   WHERE owner_id=? AND role='tool'
                     AND json_extract(tool_json, '$.name') IN ('generate_image','edit_image')
                     AND json_extract(tool_json, '$.result.job_id')=?""",
                (json.dumps(images, ensure_ascii=False, separators=(",", ":")), owner, job_id),
            )

    def short_drama_messages(self, owner: str, session_id: str, limit: int = 100) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """SELECT id,role,content,tool_json,created_at FROM short_drama_messages
                   WHERE session_id=? AND owner_id=? ORDER BY created_at DESC LIMIT ?""",
                (session_id, owner, min(max(limit, 1), 200)),
            ).fetchall()
        result = []
        for row in reversed(rows):
            item = dict(row)
            with contextlib.suppress(ValueError, TypeError):
                item["tool"] = json.loads(item.pop("tool_json"))
            item.pop("tool_json", None)
            result.append(item)
        return result

    def add_feedback(self, record: dict[str, Any]) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                """INSERT INTO feedback(id,owner_id,username,category,message,screenshot_file,created_at)
                   VALUES(?,?,?,?,?,?,?)""",
                (record["id"], record.get("user_id"), record["username"], record["category"],
                 record["message"], record.get("screenshot_file"), record["created_at"]),
            )
            connection.execute(
                "DELETE FROM feedback WHERE id IN (SELECT id FROM feedback ORDER BY created_at DESC LIMIT -1 OFFSET 2000)"
            )

    def list_shared_workflows(
        self, limit: int, query: str = "", sort: str = "recommended", viewer: str = "",
    ) -> list[dict[str, Any]]:
        safe_query = f"%{query.strip()}%"
        order_by = {
            "latest": "w.created_at DESC",
            "liked": "w.likes_count DESC, w.created_at DESC",
            "used": "w.uses_count DESC, w.created_at DESC",
        }.get(sort, "(w.likes_count * 3 + w.comments_count * 2 + w.uses_count) DESC, w.created_at DESC")
        with self._connect() as connection:
            rows = connection.execute(
                f"""SELECT w.id,w.owner_id,w.author,w.name,w.description,w.tags_json,
                       w.likes_count,w.comments_count,w.uses_count,w.is_shared,w.created_at,
                       w.graph_summary_json,
                       CASE WHEN w.graph_summary_json IS NULL THEN w.graph_json END AS graph_json,
                       EXISTS(
                       SELECT 1 FROM workflow_likes l WHERE l.workflow_id=w.id AND l.owner_id=?
                     ) AS liked_by_viewer
                     FROM workflows w
                     WHERE w.is_shared=1 AND (
                       ?='' OR w.name LIKE ? OR w.description LIKE ? OR w.author LIKE ? OR w.tags_json LIKE ?
                     ) ORDER BY {order_by} LIMIT ?""",
                (viewer, query, safe_query, safe_query, safe_query, safe_query, limit),
            ).fetchall()
        return [self._workflow_record(row, include_graph=False) for row in rows]

    def get_workflow(self, workflow_id: str, owner: str | None = None) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                """SELECT w.*, EXISTS(
                     SELECT 1 FROM workflow_likes l WHERE l.workflow_id=w.id AND l.owner_id=?
                   ) AS liked_by_viewer
                   FROM workflows w WHERE w.id=? AND (w.is_shared=1 OR w.owner_id=?)""",
                (owner or "", workflow_id, owner or ""),
            ).fetchone()
        return self._workflow_record(row) if row else None

    @staticmethod
    def workflow_graph_summary(graph: dict[str, Any]) -> dict[str, Any]:
        nodes = graph.get("nodes", [])
        return {"node_count": len(nodes), "node_types": sorted({str(node.get("type", "")) for node in nodes})}

    @classmethod
    def _workflow_record(cls, row: sqlite3.Row, include_graph: bool = True) -> dict[str, Any]:
        keys = set(row.keys())
        graph = json.loads(row["graph_json"]) if row["graph_json"] else {}
        summary = json.loads(row["graph_summary_json"]) if row["graph_summary_json"] else cls.workflow_graph_summary(graph)
        record = {
            "id": row["id"], "owner": row["owner_id"], "author": row["author"], "name": row["name"],
            "description": row["description"], "graph_summary": summary,
            "tags": json.loads(row["tags_json"]) if "tags_json" in keys else [],
            "likes_count": int(row["likes_count"]) if "likes_count" in keys else 0,
            "comments_count": int(row["comments_count"]) if "comments_count" in keys else 0,
            "uses_count": int(row["uses_count"]) if "uses_count" in keys else 0,
            "liked_by_viewer": bool(row["liked_by_viewer"]) if "liked_by_viewer" in keys else False,
            "is_shared": bool(row["is_shared"]), "created_at": row["created_at"],
        }
        if include_graph:
            record["graph"] = graph
        return record

    def create_workflow(self, record: dict[str, Any]) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                """INSERT INTO workflows(
                     id,owner_id,author,name,description,graph_json,graph_summary_json,tags_json,is_shared,created_at
                   ) VALUES(?,?,?,?,?,?,?,?,?,?)""",
                (record["id"], record["owner"], record["author"], record["name"], record["description"],
                 json.dumps(record["graph"], ensure_ascii=False, separators=(",", ":")),
                 json.dumps(record.get("graph_summary") or self.workflow_graph_summary(record["graph"])),
                 json.dumps(record.get("tags", []), ensure_ascii=False, separators=(",", ":")),
                 1 if record.get("is_shared", True) else 0, record["created_at"]),
            )
            connection.execute(
                "DELETE FROM workflows WHERE id IN (SELECT id FROM workflows ORDER BY created_at DESC LIMIT -1 OFFSET 2000)"
            )

    def toggle_workflow_like(self, workflow_id: str, owner: str) -> tuple[bool, int] | None:
        with self._lock, self._connect() as connection:
            workflow = connection.execute(
                "SELECT likes_count FROM workflows WHERE id=? AND is_shared=1", (workflow_id,),
            ).fetchone()
            if not workflow:
                return None
            existing = connection.execute(
                "SELECT 1 FROM workflow_likes WHERE workflow_id=? AND owner_id=?", (workflow_id, owner),
            ).fetchone()
            if existing:
                connection.execute("DELETE FROM workflow_likes WHERE workflow_id=? AND owner_id=?", (workflow_id, owner))
                connection.execute("UPDATE workflows SET likes_count=MAX(0,likes_count-1) WHERE id=?", (workflow_id,))
                liked = False
            else:
                connection.execute(
                    "INSERT INTO workflow_likes(workflow_id,owner_id,created_at) VALUES(?,?,?)",
                    (workflow_id, owner, time.time()),
                )
                connection.execute("UPDATE workflows SET likes_count=likes_count+1 WHERE id=?", (workflow_id,))
                liked = True
            count = int(connection.execute("SELECT likes_count FROM workflows WHERE id=?", (workflow_id,)).fetchone()[0])
        return liked, count

    def list_workflow_comments(self, workflow_id: str, limit: int = 50) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT id,author,content,created_at FROM workflow_comments WHERE workflow_id=? ORDER BY created_at DESC LIMIT ?",
                (workflow_id, limit),
            ).fetchall()
        return [dict(row) for row in reversed(rows)]

    def add_workflow_comment(self, record: dict[str, Any]) -> bool:
        with self._lock, self._connect() as connection:
            exists = connection.execute("SELECT 1 FROM workflows WHERE id=? AND is_shared=1", (record["workflow_id"],)).fetchone()
            if not exists:
                return False
            connection.execute(
                """INSERT INTO workflow_comments(id,workflow_id,owner_id,author,content,created_at)
                   VALUES(?,?,?,?,?,?)""",
                (record["id"], record["workflow_id"], record["owner"], record["author"], record["content"], record["created_at"]),
            )
            connection.execute("UPDATE workflows SET comments_count=comments_count+1 WHERE id=?", (record["workflow_id"],))
        return True

    def mark_workflow_used(self, workflow_id: str) -> dict[str, Any] | None:
        with self._lock, self._connect() as connection:
            connection.execute("UPDATE workflows SET uses_count=uses_count+1 WHERE id=? AND is_shared=1", (workflow_id,))
            row = connection.execute("SELECT * FROM workflows WHERE id=? AND is_shared=1", (workflow_id,)).fetchone()
        return self._workflow_record(row) if row else None

    def create_plaza_post(self, record: dict[str, Any]) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                """INSERT INTO plaza_posts(
                     id,owner_id,author,title,prompt,model,media_path,media_type,mime_type,tags_json,created_at
                   ) VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
                (record["id"], record["owner"], record["author"], record["title"], record["prompt"],
                 record["model"], record["media_path"], record["media_type"], record["mime_type"],
                 json.dumps(record["tags"], ensure_ascii=False, separators=(",", ":")), record["created_at"]),
            )

    @staticmethod
    def _plaza_post_record(row: sqlite3.Row) -> dict[str, Any]:
        record = dict(row)
        try:
            record["tags"] = json.loads(record.pop("tags_json", "[]"))
        except json.JSONDecodeError:
            record["tags"] = []
        record["liked_by_viewer"] = bool(record.pop("liked_by_viewer", False))
        return record

    def list_plaza_posts(self, limit: int, owner: str) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """SELECT p.*, EXISTS(
                     SELECT 1 FROM plaza_likes l WHERE l.post_id=p.id AND l.owner_id=?
                   ) AS liked_by_viewer
                   FROM plaza_posts p ORDER BY p.created_at DESC LIMIT ?""",
                (owner, limit),
            ).fetchall()
        return [self._plaza_post_record(row) for row in rows]

    def plaza_post(self, post_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute("SELECT * FROM plaza_posts WHERE id=?", (post_id,)).fetchone()
        return self._plaza_post_record(row) if row else None

    def plaza_media_path(self, post_id: str) -> Path | None:
        record = self.plaza_post(post_id)
        if not record:
            return None
        try:
            path = (self.private_media_dir / str(record["media_path"])).resolve(strict=True)
            path.relative_to(self.private_media_dir.resolve())
            return path
        except (OSError, ValueError):
            return None

    def toggle_plaza_like(self, post_id: str, owner: str) -> tuple[bool, int] | None:
        with self._lock, self._connect() as connection:
            post = connection.execute("SELECT likes_count FROM plaza_posts WHERE id=?", (post_id,)).fetchone()
            if not post:
                return None
            liked = connection.execute(
                "SELECT 1 FROM plaza_likes WHERE post_id=? AND owner_id=?", (post_id, owner),
            ).fetchone()
            if liked:
                connection.execute("DELETE FROM plaza_likes WHERE post_id=? AND owner_id=?", (post_id, owner))
                connection.execute("UPDATE plaza_posts SET likes_count=MAX(0,likes_count-1) WHERE id=?", (post_id,))
                is_liked = False
            else:
                connection.execute(
                    "INSERT INTO plaza_likes(post_id,owner_id,created_at) VALUES(?,?,?)", (post_id, owner, time.time()),
                )
                connection.execute("UPDATE plaza_posts SET likes_count=likes_count+1 WHERE id=?", (post_id,))
                is_liked = True
            likes_count = int(connection.execute("SELECT likes_count FROM plaza_posts WHERE id=?", (post_id,)).fetchone()[0])
        return is_liked, likes_count
