"""Feedback API — one-time signup and trial-exit questions for org owners."""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field

from app.db.firebase import get_firestore
from app.core.security import get_current_user, generate_uuid

router = APIRouter()

# Trial-exit choice keys allowed in request
TRIAL_EXIT_CHOICES = {
    "missing_feature",
    "too_expensive",
    "too_complex",
    "staying_with_current",
    "other",
    "skipped",
}


def _require_owner(db, org_id: str, user_id: str) -> None:
    """Ensure the user is the organization owner. Raises 403 otherwise."""
    _require_role(db, org_id, user_id, ["owner"])


def _require_owner_or_admin(db, org_id: str, user_id: str) -> None:
    """Ensure the user is the organization owner or admin. Raises 403 otherwise."""
    _require_role(db, org_id, user_id, ["owner", "admin"])


def _require_role(db, org_id: str, user_id: str, allowed_roles: list) -> None:
    members = list(
        db.collection("members")
        .where("user_id", "==", user_id)
        .where("organization_id", "==", org_id)
        .limit(1)
        .get()
    )
    if not members:
        raise HTTPException(status_code=404, detail="Organization not found")
    role = members[0].to_dict().get("role", "member")
    if role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization owners and admins can submit this feedback",
        )


def _get_org_ref(db, org_id: str):
    """Return org doc ref and dict; raise 404 if missing or deleted."""
    ref = db.collection("organizations").document(org_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Organization not found")
    d = doc.to_dict()
    if d.get("is_deleted"):
        raise HTTPException(status_code=404, detail="Organization not found")
    return ref, d


class SignupReasonRequest(BaseModel):
    org_id: str = Field(..., alias="orgId")
    user_id: str = Field(..., alias="userId")
    answer_text: str = Field("", alias="answerText")

    class Config:
        populate_by_name = True


class TrialExitReasonRequest(BaseModel):
    org_id: str = Field(..., alias="orgId")
    user_id: str = Field(..., alias="userId")
    choice_key: str = Field(..., alias="choiceKey")
    answer_text: str = Field("", alias="answerText")

    class Config:
        populate_by_name = True


@router.post("/signup-reason")
def submit_signup_reason(
    body: SignupReasonRequest,
    user: dict = Depends(get_current_user),
):
    """Record why the org owner/admin tried MemberCore (one-time per org)."""
    if body.user_id != user["id"]:
        raise HTTPException(status_code=403, detail="User mismatch")
    db = get_firestore()
    _require_owner_or_admin(db, body.org_id, body.user_id)
    ref, org = _get_org_ref(db, body.org_id)

    flags = org.get("feedback_flags") or {}
    if flags.get("signup_captured"):
        raise HTTPException(status_code=409, detail="Signup feedback already captured")

    now = datetime.now(timezone.utc)
    answer_text = (body.answer_text or "").strip() or "Skipped"
    doc_id = generate_uuid()
    feedback_data = {
        "org_id": body.org_id,
        "user_id": body.user_id,
        "type": "signup",
        "answer_text": answer_text,
        "created_at": now,
    }
    ref.collection("feedback").document(doc_id).set(feedback_data)

    ref.update({
        "feedback_flags": {
            **flags,
            "signup_captured": True,
        },
        "updated_at": now,
    })

    return {"ok": True}


@router.post("/trial-exit-reason")
def submit_trial_exit_reason(
    body: TrialExitReasonRequest,
    user: dict = Depends(get_current_user),
):
    """Record why the org owner/admin didn't continue after trial (one-time per org, only if trial ended without Pro)."""
    if body.user_id != user["id"]:
        raise HTTPException(status_code=403, detail="User mismatch")
    db = get_firestore()
    _require_owner_or_admin(db, body.org_id, body.user_id)
    ref, org = _get_org_ref(db, body.org_id)

    # Only allow if trial has effectively ended and org is not Pro
    is_pro = org.get("is_pro", False)
    if is_pro or org.get("platform_admin_owned") or org.get("billing_exempt"):
        raise HTTPException(
            status_code=400,
            detail="Trial exit feedback is only for organizations that did not upgrade after trial",
        )

    # Optional: if org has trial_end_date, it should be in the past (trial ended)
    trial_end = org.get("trial_end_date")
    if trial_end:
        now_utc = datetime.now(timezone.utc)
        if hasattr(trial_end, "timestamp"):
            end_dt = datetime.fromtimestamp(trial_end.timestamp(), tz=timezone.utc) if trial_end.tzinfo is None else trial_end
        elif hasattr(trial_end, "seconds"):
            end_dt = datetime.fromtimestamp(trial_end.seconds, tz=timezone.utc)
        else:
            end_dt = None
        if end_dt is not None and end_dt > now_utc:
            raise HTTPException(status_code=400, detail="Trial has not ended yet")

    flags = org.get("feedback_flags") or {}
    if flags.get("trial_exit_captured"):
        raise HTTPException(status_code=409, detail="Trial exit feedback already captured")

    choice_key = (body.choice_key or "").strip().lower()
    if choice_key and choice_key not in TRIAL_EXIT_CHOICES:
        raise HTTPException(
            status_code=400,
            detail=f"choiceKey must be one of: {', '.join(sorted(TRIAL_EXIT_CHOICES))}",
        )
    if not choice_key:
        choice_key = "skipped"

    now = datetime.now(timezone.utc)
    answer_text = (body.answer_text or "").strip() or ""
    doc_id = generate_uuid()
    feedback_data = {
        "org_id": body.org_id,
        "user_id": body.user_id,
        "type": "trial_exit",
        "choice_key": choice_key,
        "answer_text": answer_text,
        "created_at": now,
    }
    ref.collection("feedback").document(doc_id).set(feedback_data)

    ref.update({
        "feedback_flags": {
            **flags,
            "trial_exit_captured": True,
        },
        "updated_at": now,
    })

    return {"ok": True}
