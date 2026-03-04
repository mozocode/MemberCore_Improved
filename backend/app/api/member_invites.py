"""Member invite flow: resolve token (no auth), accept invite (auth required)."""
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.email import build_invite_url, send_member_invite_email
from app.core.security import get_current_user
from app.db.firebase import get_firestore

router = APIRouter()

INVITE_EXPIRY_DAYS = 14


def _generate_invite_token() -> str:
    return secrets.token_urlsafe(32)


def _get_org_name(db, org_id: str) -> str:
    doc = db.collection("organizations").document(org_id).get()
    if not doc.exists:
        return "Organization"
    return (doc.to_dict() or {}).get("name") or "Organization"


def create_invite_and_send(
    db,
    org_id: str,
    org_name: str,
    admin_name: str,
    email: str,
    first_name: Optional[str],
    last_name: Optional[str],
    role: str,
    member_id: str,
) -> Optional[str]:
    """
    Create a member_invite doc and send the email. Returns invite_id or None on failure.
    Only call when the member was just created (pending); one invite per email per org.
    """
    # Avoid duplicate invite for same org+email (do not send another email)
    existing = list(
        db.collection("member_invites")
        .where("org_id", "==", org_id)
        .where("email", "==", email.lower())
        .where("status", "==", "pending")
        .limit(1)
        .get()
    )
    if existing:
        return None

    token = _generate_invite_token()
    invite_id = secrets.token_hex(12)
    now = datetime.now(timezone.utc)
    db.collection("member_invites").document(invite_id).set({
        "org_id": org_id,
        "email": email.lower(),
        "first_name": (first_name or "").strip() or None,
        "last_name": (last_name or "").strip() or None,
        "role": role,
        "token": token,
        "status": "pending",
        "member_id": member_id,
        "created_at": now,
    })
    invite_url = build_invite_url(token)
    sent = send_member_invite_email(org_name, admin_name, email, first_name, invite_url)
    if not sent:
        return None
    return invite_id


@router.get("/member-invites/resolve")
def resolve_invite(
    token: str = Query(..., description="Invite token from email link"),
):
    """
    Validate token and return invite context for the acceptance page. No auth required.
    """
    db = get_firestore()
    invites = list(
        db.collection("member_invites").where("token", "==", token).limit(1).get()
    )
    if not invites:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This invite link is no longer valid. Please contact your organization to request a new invite.",
        )
    doc = invites[0]
    data = doc.to_dict()
    if data.get("status") != "pending":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invite has already been used.",
        )
    org_id = data.get("org_id")
    if not org_id:
        raise HTTPException(status_code=500, detail="Invalid invite data")
    org_name = _get_org_name(db, org_id)
    email = (data.get("email") or "").lower()
    # Check if user exists with this email
    users = list(db.collection("users").where("email", "==", email).limit(1).get())
    existing_user = bool(users)
    return {
        "orgId": org_id,
        "orgName": org_name,
        "email": email,
        "firstName": data.get("first_name") or "",
        "existingUser": existing_user,
    }


class AcceptInviteRequest(BaseModel):
    token: str


@router.post("/member-invites/accept")
def accept_invite(
    body: AcceptInviteRequest,
    user: dict = Depends(get_current_user),
):
    """Accept the invite: mark invite accepted and set member status to approved. Auth required; user email must match invite."""
    db = get_firestore()
    invites = list(
        db.collection("member_invites").where("token", "==", body.token).limit(1).get()
    )
    if not invites:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This invite link is no longer valid.",
        )
    doc = invites[0]
    data = doc.to_dict()
    if data.get("status") != "pending":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invite has already been used.",
        )
    invite_email = (data.get("email") or "").lower()
    user_email = (user.get("email") or "").lower()
    if user_email != invite_email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invite was sent to a different email address. Please sign in with that email.",
        )
    org_id = data.get("org_id")
    member_id = data.get("member_id")
    if not org_id:
        raise HTTPException(status_code=500, detail="Invalid invite data")
    now = datetime.now(timezone.utc)
    doc.reference.update({"status": "accepted", "accepted_at": now})
    if member_id:
        member_ref = db.collection("members").document(member_id)
        if member_ref.get().exists:
            member_ref.update({"status": "approved", "updated_at": now})
    return {
        "ok": True,
        "orgId": org_id,
        "message": "You have joined the organization.",
    }

