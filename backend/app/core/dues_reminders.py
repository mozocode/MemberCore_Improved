"""Orchestrate dues reminder emails, optional push, and inbox records."""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from google.cloud.firestore import SERVER_TIMESTAMP

from app.core.email import send_dues_reminder_email
from app.core.push import send_push_to_user

logger = logging.getLogger(__name__)

INVITE_BASE_URL = os.getenv(
    "FRONTEND_URL",
    os.getenv("INVITE_BASE_URL", "https://membercore.io"),
).rstrip("/")

COOLDOWN_HOURS = float(os.getenv("DUES_REMINDER_COOLDOWN_HOURS", "24"))


def _parse_firestore_datetime(val: Any) -> Optional[datetime]:
    if val is None:
        return None
    if hasattr(val, "timestamp"):
        try:
            return datetime.fromtimestamp(val.timestamp(), tz=timezone.utc)
        except Exception:
            return None
    if isinstance(val, dict) and "_seconds" in val:
        try:
            return datetime.fromtimestamp(float(val["_seconds"]), tz=timezone.utc)
        except Exception:
            return None
    if isinstance(val, str):
        try:
            return datetime.fromisoformat(val.replace("Z", "+00:00"))
        except Exception:
            return None
    return None


def _plan_total(p) -> float:
    d = p.to_dict()
    v = d.get("total_amount")
    if v is not None:
        return float(v)
    return float(d.get("amount", 0) or 0)


def member_needs_reminder(
    *,
    total_required: float,
    total_paid: float,
    dues_paid_in_full: bool,
) -> bool:
    if total_required <= 0:
        return False
    if dues_paid_in_full:
        return False
    if total_paid >= total_required:
        return False
    return True


def run_dues_reminders(db, org_id: str) -> Dict[str, Any]:
    """
    Email + optional push + inbox row for members with an outstanding balance.
    Respects per-member mute_notifications (skips push + inbox; email still sent).
    Per-member cooldown via last_dues_reminder_at (default 24h).
    """
    org_ref = db.collection("organizations").document(org_id).get()
    if not org_ref.exists:
        raise ValueError("Organization not found")

    org = org_ref.to_dict() or {}
    org_name = (org.get("name") or "Your organization").strip() or "Your organization"
    dues_label = (org.get("dues_label") or "Dues").strip() or "Dues"
    dues_page_url = f"{INVITE_BASE_URL}/org/{org_id}/dues"

    plan_docs = list(
        db.collection("dues_plans")
        .where("organization_id", "==", org_id)
        .where("is_active", "==", True)
        .stream()
    )
    total_required = sum(_plan_total(p) for p in plan_docs)

    if total_required <= 0:
        return {
            "ok": True,
            "message": "No active payment plans — nothing to remind.",
            "total_required": 0.0,
            "emails_sent": 0,
            "emails_failed": 0,
            "push_notifications_sent": 0,
            "in_app_notifications_created": 0,
            "skipped_already_paid": 0,
            "skipped_cooldown": 0,
            "skipped_no_email": 0,
            "skipped_muted_push_only": 0,
            "targets_considered": 0,
        }

    payment_docs = list(
        db.collection("payments").where("organization_id", "==", org_id).stream()
    )
    member_docs = list(
        db.collection("members")
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .stream()
    )

    now = datetime.now(timezone.utc)
    stats = {
        "ok": True,
        "total_required": round(total_required, 2),
        "emails_sent": 0,
        "emails_failed": 0,
        "push_notifications_sent": 0,
        "in_app_notifications_created": 0,
        "skipped_already_paid": 0,
        "skipped_cooldown": 0,
        "skipped_no_email": 0,
        "skipped_muted_push_only": 0,
        "targets_considered": 0,
    }

    for m in member_docs:
        mid = m.id
        md = m.to_dict() or {}
        uid = md.get("user_id")
        if not uid:
            continue

        member_payments = [p for p in payment_docs if p.to_dict().get("member_id") == mid]
        total_paid = sum(float(p.to_dict().get("amount", 0) or 0) for p in member_payments)
        marked_full = bool(md.get("dues_paid_in_full", False))

        if not member_needs_reminder(
            total_required=total_required,
            total_paid=total_paid,
            dues_paid_in_full=marked_full,
        ):
            stats["skipped_already_paid"] += 1
            continue

        remaining = max(0.0, total_required - total_paid)
        stats["targets_considered"] += 1

        last_rem = _parse_firestore_datetime(md.get("last_dues_reminder_at"))
        if last_rem and COOLDOWN_HOURS > 0:
            if now - last_rem < timedelta(hours=COOLDOWN_HOURS):
                stats["skipped_cooldown"] += 1
                continue

        ud = db.collection("users").document(uid).get().to_dict() or {}
        email = (ud.get("email") or "").strip()
        first_name = (ud.get("name") or "").strip().split(" ", 1)[0] if ud.get("name") else None

        muted = bool(md.get("mute_notifications", False))

        email_ok = False
        if email:
            email_ok = send_dues_reminder_email(
                to_email=email,
                first_name=first_name,
                org_name=org_name,
                dues_label=dues_label,
                remaining=remaining,
                dues_page_url=dues_page_url,
            )
            if email_ok:
                stats["emails_sent"] += 1
            else:
                stats["emails_failed"] += 1
        else:
            stats["skipped_no_email"] += 1

        notified = email_ok
        if muted:
            stats["skipped_muted_push_only"] += 1
        else:
            title = f"{dues_label} reminder — {org_name}"
            body = f"Outstanding balance: ${remaining:.2f}. Tap to open {dues_label}."
            push_count = send_push_to_user(
                db=db,
                user_id=uid,
                title=title,
                body=body,
                data={
                    "type": "dues",
                    "org_id": org_id,
                },
            )
            stats["push_notifications_sent"] += push_count
            if push_count > 0:
                notified = True

            try:
                db.collection("users").document(uid).collection("notifications").add({
                    "type": "dues_reminder",
                    "organization_id": org_id,
                    "organization_name": org_name,
                    "dues_label": dues_label,
                    "remaining": round(remaining, 2),
                    "title": title,
                    "body": body,
                    "read": False,
                    "created_at": SERVER_TIMESTAMP,
                })
                stats["in_app_notifications_created"] += 1
                notified = True
            except Exception:
                logger.exception("Failed to write in-app notification for user %s", uid)

        if notified:
            try:
                db.collection("members").document(mid).update({
                    "last_dues_reminder_at": now,
                })
            except Exception:
                logger.exception("Failed to set last_dues_reminder_at for member %s", mid)

    stats["message"] = (
        f"Processed {stats['targets_considered']} member(s): "
        f"{stats['emails_sent']} email(s) sent, "
        f"{stats['in_app_notifications_created']} in-app notification(s) created."
    )
    if stats.get("emails_failed", 0) > 0:
        stats["message"] += (
            f" {stats['emails_failed']} email(s) could not be sent "
            "(same Resend setup as password reset — check server logs or Resend dashboard)."
        )
    return stats
