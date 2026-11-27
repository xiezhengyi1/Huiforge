"""Deliver short-lived account verification codes via the configured SMTP relay."""
from __future__ import annotations

import hmac
import smtplib
import ssl
from email.message import EmailMessage

from ..core import config


def email_registration_configured() -> bool:
    return bool(
        config.SMTP_HOST and config.SMTP_FROM and len(config.EMAIL_CODE_SECRET) >= 32
        and config.SMTP_SECURITY in {"starttls", "ssl"}
        and bool(config.SMTP_USER) == bool(config.SMTP_PASSWORD)
    )


def email_code_digest(device: str, address: str, code: str) -> str:
    return hmac.digest(config.EMAIL_CODE_SECRET.encode(), f"{device}\n{address}\n{code}".encode(), "sha256").hex()


def send_verification_email(address: str, code: str) -> None:
    message = EmailMessage()
    message["From"] = config.SMTP_FROM
    message["To"] = address
    message["Subject"] = "Your Huiforge verification code"
    message.set_content(f"Your Huiforge verification code is {code}. It expires in 5 minutes.\n\n绘域验证码：{code}。5 分钟内有效。")
    context = ssl.create_default_context()
    host, port = config.SMTP_HOST, config.SMTP_PORT
    connection = (
        smtplib.SMTP_SSL(host, port, timeout=12, context=context)
        if config.SMTP_SECURITY == "ssl" else smtplib.SMTP(host, port, timeout=12)
    )
    with connection as smtp:
        if config.SMTP_SECURITY == "starttls":
            smtp.starttls(context=context)
        if config.SMTP_USER:
            smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
        smtp.send_message(message)
