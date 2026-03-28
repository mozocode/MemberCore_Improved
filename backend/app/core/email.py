"""Transactional email helpers via Resend."""
import logging
import os
from typing import Optional

import resend

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "MemberCore <noreply@membercore.io>")
INVITE_BASE_URL = os.getenv(
    "FRONTEND_URL",
    os.getenv("INVITE_BASE_URL", "https://membercore.io"),
).rstrip("/")


def build_invite_url(token: str) -> str:
    return f"{INVITE_BASE_URL}/invite/accept?token={token}"


def build_reset_password_url(token: str) -> str:
    return f"{INVITE_BASE_URL}/reset-password?token={token}"


def _render_invite_html(
    org_name: str,
    admin_name: str,
    first_name: str,
    email: str,
    invite_url: str,
) -> str:
    first = (first_name or "there").strip() or "there"
    return f"""\
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
  <h2 style="margin:0 0 20px;font-size:22px;font-weight:700">You're invited to {org_name}</h2>
  <p style="font-size:15px;line-height:1.6;margin:0 0 16px">
    Hi {first},
  </p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 16px">
    <strong>{org_name}</strong> is using <strong>MemberCore</strong> as its private hub
    for members &ndash; communication, events, and important updates in one place.
    You&rsquo;ve been invited to join.
  </p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 8px"><strong>What this means for you:</strong></p>
  <ul style="font-size:15px;line-height:1.8;margin:0 0 24px;padding-left:20px">
    <li>See all upcoming events in one calendar</li>
    <li>Get important announcements in a single place</li>
    <li>Access member-only information your organization shares</li>
  </ul>
  <p style="font-size:14px;line-height:1.6;margin:0 0 24px;color:#555">
    Sign in or create an account using <strong>{email}</strong>
  </p>
  <a href="{invite_url}"
     style="display:inline-block;background:#3b82f6;color:#ffffff;font-size:16px;font-weight:600;
            padding:14px 32px;border-radius:8px;text-decoration:none">
    Join {org_name}
  </a>
  <p style="font-size:13px;line-height:1.5;margin:24px 0 0;color:#888">
    If the button doesn&rsquo;t work, paste this link into your browser:<br>
    <a href="{invite_url}" style="color:#3b82f6;word-break:break-all">{invite_url}</a>
  </p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0 16px">
  <p style="font-size:12px;color:#999;margin:0">
    This invite was sent by {admin_name} at {org_name}.
    If you weren&rsquo;t expecting this, you can ignore this email.
  </p>
</div>"""


def _render_invite_plain(
    org_name: str,
    admin_name: str,
    first_name: str,
    email: str,
    invite_url: str,
) -> str:
    first = (first_name or "there").strip() or "there"
    return f"""Hi {first},

{org_name} is using MemberCore as its private hub for members – communication, events, and important updates in one place. You've been invited to join.

What this means for you:
- See all upcoming events in one calendar
- Get important announcements in a single place
- Access member-only information your organization shares

Sign in or create an account using: {email}

Join {org_name} on MemberCore: {invite_url}

If the button doesn't work, paste this link into your browser:
{invite_url}

This invite was sent by {admin_name} at {org_name}.
If you weren't expecting this, you can ignore this email.

– The MemberCore Team (on behalf of {org_name})
"""


def send_member_invite_email(
    org_name: str,
    admin_name: str,
    to_email: str,
    first_name: Optional[str],
    invite_url: str,
) -> bool:
    """Send the member invite email via Resend. Returns True if sent."""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set – invite email NOT sent to %s", to_email)
        return False

    resend.api_key = RESEND_API_KEY
    subject = f"You've been invited to join {org_name} on MemberCore"
    html = _render_invite_html(org_name, admin_name, first_name or "", to_email, invite_url)
    text = _render_invite_plain(org_name, admin_name, first_name or "", to_email, invite_url)

    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html,
            "text": text,
        })
        logger.info("Invite email sent to %s for org %s", to_email, org_name)
        return True
    except Exception:
        logger.exception("Failed to send invite email to %s", to_email)
        return False


def send_password_reset_email(to_email: str, reset_url: str) -> bool:
    """Send a password reset email via Resend. Returns True if sent."""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set – password reset email NOT sent to %s", to_email)
        return False

    resend.api_key = RESEND_API_KEY
    subject = "Reset your MemberCore password"
    html = f"""\
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
  <h2 style="margin:0 0 20px;font-size:22px;font-weight:700">Reset your password</h2>
  <p style="font-size:15px;line-height:1.6;margin:0 0 16px">
    We received a request to reset the password for your MemberCore account.
  </p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 24px">
    If this was you, click the button below to create a new password.
  </p>
  <a href="{reset_url}"
     style="display:inline-block;background:#f59e0b;color:#111827;font-size:16px;font-weight:700;
            padding:14px 32px;border-radius:8px;text-decoration:none">
    Reset Password
  </a>
  <p style="font-size:13px;line-height:1.5;margin:24px 0 0;color:#666">
    This link expires in 30 minutes. If you did not request this, you can ignore this email.
  </p>
  <p style="font-size:13px;line-height:1.5;margin:16px 0 0;color:#888">
    If the button does not work, paste this link in your browser:<br>
    <a href="{reset_url}" style="color:#3b82f6;word-break:break-all">{reset_url}</a>
  </p>
</div>"""
    text = f"""Reset your MemberCore password

We received a request to reset your MemberCore password.

Use this link to set a new password (expires in 30 minutes):
{reset_url}

If you did not request this, you can ignore this email.
"""
    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html,
            "text": text,
        })
        logger.info("Password reset email sent to %s", to_email)
        return True
    except Exception:
        logger.exception("Failed to send password reset email to %s", to_email)
        return False


def send_dues_reminder_email(
    *,
    to_email: str,
    first_name: Optional[str],
    org_name: str,
    dues_label: str,
    remaining: float,
    dues_page_url: str,
) -> bool:
    """Remind a member about outstanding org dues. Returns True if Resend accepted the send."""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set – dues reminder NOT sent to %s", to_email)
        return False

    resend.api_key = RESEND_API_KEY
    label = (dues_label or "Dues").strip() or "Dues"
    first = (first_name or "there").strip() or "there"
    rem = max(0.0, float(remaining))
    subject = f"Reminder: {label} for {org_name}"
    html = f"""\
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
  <h2 style="margin:0 0 20px;font-size:22px;font-weight:700">{label} reminder</h2>
  <p style="font-size:15px;line-height:1.6;margin:0 0 16px">Hi {first},</p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 16px">
    This is a friendly reminder from <strong>{org_name}</strong> that you have an outstanding
    <strong>{label.lower()}</strong> balance of <strong>${rem:.2f}</strong>.
  </p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 24px">
    Please sign in to MemberCore to review your balance and submit a payment when you can.
  </p>
  <a href="{dues_page_url}"
     style="display:inline-block;background:#22c55e;color:#ffffff;font-size:16px;font-weight:600;
            padding:14px 32px;border-radius:8px;text-decoration:none">
    View {label}
  </a>
  <p style="font-size:13px;line-height:1.5;margin:24px 0 0;color:#888">
    If the button doesn&rsquo;t work, open:<br>
    <a href="{dues_page_url}" style="color:#3b82f6;word-break:break-all">{dues_page_url}</a>
  </p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0 16px">
  <p style="font-size:12px;color:#999;margin:0">
    Sent by {org_name} via MemberCore. If you&rsquo;ve already paid in full, you can ignore this message.
  </p>
</div>"""
    text = f"""{label} reminder — {org_name}

Hi {first},

This is a reminder that you have an outstanding {label.lower()} balance of ${rem:.2f}.

View or pay here: {dues_page_url}

Sent by {org_name} via MemberCore.
"""
    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html,
            "text": text,
        })
        logger.info("Dues reminder email sent to %s for org %s", to_email, org_name)
        return True
    except Exception:
        logger.exception("Failed to send dues reminder to %s", to_email)
        return False
