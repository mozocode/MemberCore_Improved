"""Member invite email. Stub implementation; wire to SendGrid/Resend/SES via env (e.g. SENDGRID_API_KEY)."""
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# Base URL for invite links (e.g. https://membercore.io or http://localhost:3000)
INVITE_BASE_URL = os.getenv("FRONTEND_URL", os.getenv("INVITE_BASE_URL", "https://membercore.io")).rstrip("/")


def build_invite_url(token: str) -> str:
    """Return the full URL for accepting an invite (web)."""
    return f"{INVITE_BASE_URL}/invite/accept?token={token}"


def _render_invite_body_plain(
    org_name: str,
    admin_name: str,
    first_name: str,
    email: str,
    invite_url: str,
) -> str:
    first = (first_name or "there").strip() or "there"
    return f"""Hi {first},

{org_name} is now using **MemberCore** as its private hub for members – communication, events, and important updates in one place.

You've been invited to join their space.

**What this means for you:**
• See all upcoming events in one calendar
• Get important announcements in a single place
• Access member-only information your organization shares

To join, use this email address: **{email}**

Join {org_name} on MemberCore: {invite_url}

If the button doesn't work, paste this link into your browser:
{invite_url}

This invite was sent to you by {admin_name} at {org_name}.
If you weren't expecting this, you can ignore this email.

Thanks,
The MemberCore Team
(On behalf of {org_name})
"""


def send_member_invite_email(
    org_name: str,
    admin_name: str,
    to_email: str,
    first_name: Optional[str],
    invite_url: str,
) -> bool:
    """
    Send the member invite email. Returns True if sent (or queued), False otherwise.
    Stub: logs and returns True. Replace with real provider (SendGrid, Resend, SES) via env.
    When implementing: use From name "[Organization Name] via MemberCore" (or just org name if from-address is recognizable).
    """
    subject = f"You've been invited to join {org_name} on MemberCore"
    body = _render_invite_body_plain(org_name, admin_name, first_name or "", to_email, invite_url)
    # TODO: Wire to SendGrid/Resend/SES using API key from env. Example:
    #   import sendgrid; sg.send(mail)  or  resend.Emails.send(...)
    logger.info(
        "Member invite email (stub): to=%s subject=%s url=%s",
        to_email,
        subject[:50],
        invite_url[:60] + "..." if len(invite_url) > 60 else invite_url,
    )
    return True
