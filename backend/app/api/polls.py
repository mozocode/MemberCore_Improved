"""Polls API - create, list, vote."""
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel

from app.db.firebase import get_firestore
from app.core.security import get_current_user_id, get_current_user, generate_uuid
from app.api.chat import post_to_general_chat, broadcast_new_message

router = APIRouter()


def _require_org_member(db, org_id: str, user_id: str):
    members = (
        db.collection("members")
        .where("user_id", "==", user_id)
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .limit(1)
        .get()
    )
    if not members:
        raise HTTPException(status_code=404, detail="Organization not found")
    return members[0].to_dict().get("role", "member")


def _require_admin_or_owner(role: str):
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin or owner access required")


class PollOption(BaseModel):
    text: str


class CreatePollRequest(BaseModel):
    question: str
    description: Optional[str] = None
    options: List[PollOption]
    allow_multiple_votes: bool = False
    is_anonymous: bool = False
    ends_at: Optional[str] = None


class VoteRequest(BaseModel):
    option_ids: List[str]


@router.get("/{org_id}")
def list_polls(
    org_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """List all polls for organization."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    docs = list(db.collection("polls").where("organization_id", "==", org_id).stream())
    polls = []
    now = datetime.now(timezone.utc)
    for doc in docs:
        pd = doc.to_dict()
        pd["id"] = doc.id
        ends_at = pd.get("ends_at")
        if isinstance(ends_at, str):
            try:
                ends_at = datetime.fromisoformat(ends_at.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                ends_at = None
        pd["is_open"] = ends_at is None or ends_at > now
        # Build options with vote counts and my_votes
        opts = pd.get("options") or []
        vote_docs = list(
            db.collection("poll_votes").where("poll_id", "==", doc.id).stream()
        )
        my_votes = [
            v.to_dict().get("option_id")
            for v in vote_docs
            if v.to_dict().get("user_id") == user_id
        ]
        pd["my_votes"] = my_votes
        option_counts = {}
        for v in vote_docs:
            oid = v.to_dict().get("option_id")
            if oid:
                option_counts[oid] = option_counts.get(oid, 0) + 1
        pd["options"] = [
            {
                "id": o.get("id"),
                "text": o.get("text", ""),
                "vote_count": option_counts.get(o.get("id"), 0),
            }
            for o in opts
        ]
        pd["total_votes"] = sum(option_counts.values())
        polls.append(pd)

    polls.sort(key=lambda p: p.get("created_at") or "", reverse=True)
    return polls


@router.post("/{org_id}")
def create_poll(
    org_id: str,
    req: CreatePollRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """Create poll. Admin/owner only. Posts to general chat."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(role)

    if len(req.options) < 2 or len(req.options) > 10:
        raise HTTPException(status_code=400, detail="Need 2-10 options")

    poll_id = generate_uuid()
    now = datetime.now(timezone.utc)
    options = [
        {"id": generate_uuid(), "text": o.text.strip()}
        for o in req.options
    ]

    poll_data = {
        "id": poll_id,
        "organization_id": org_id,
        "question": req.question.strip(),
        "description": (req.description or "").strip() or None,
        "options": options,
        "allow_multiple_votes": req.allow_multiple_votes,
        "is_anonymous": req.is_anonymous,
        "ends_at": req.ends_at,
        "created_by": user["id"],
        "created_at": now,
    }
    db.collection("polls").document(poll_id).set(poll_data)

    try:
        poll_options_text = [o["text"] for o in options]
        chat_poll_data = {
            "id": poll_id,
            "question": poll_data["question"],
            "options": [{"id": o["id"], "text": o["text"]} for o in options],
        }
        content = f"📊 {poll_data['question']}"
        channel_id, msg_doc = post_to_general_chat(
            db,
            org_id,
            user["id"],
            "poll",
            content,
            poll_data=chat_poll_data,
            poll_id=poll_id,
            poll_options=poll_options_text,
        )
        if channel_id and msg_doc:
            background_tasks.add_task(broadcast_new_message, org_id, channel_id, msg_doc)
    except Exception:
        pass

    return {**poll_data, "id": poll_id}


@router.post("/{org_id}/{poll_id}/vote")
def vote_poll(
    org_id: str,
    poll_id: str,
    req: VoteRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Cast vote. Replaces previous votes."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    poll_doc = db.collection("polls").document(poll_id).get()
    if not poll_doc.exists:
        raise HTTPException(status_code=404, detail="Poll not found")
    pd = poll_doc.to_dict()
    if pd.get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Poll not found")

    now = datetime.now(timezone.utc)
    ends_at = pd.get("ends_at")
    if ends_at:
        if isinstance(ends_at, str):
            try:
                ends_at = datetime.fromisoformat(ends_at.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                ends_at = None
        if ends_at and ends_at < now:
            raise HTTPException(status_code=400, detail="Poll is closed")

    option_ids = {o["id"] for o in pd.get("options") or []}
    for oid in req.option_ids:
        if oid not in option_ids:
            raise HTTPException(status_code=400, detail="Invalid option")
    if not pd.get("allow_multiple_votes") and len(req.option_ids) > 1:
        raise HTTPException(status_code=400, detail="Single choice only")
    if len(req.option_ids) == 0:
        raise HTTPException(status_code=400, detail="Select at least one option")

    # Remove existing votes from this user
    existing = list(
        db.collection("poll_votes")
        .where("poll_id", "==", poll_id)
        .where("user_id", "==", user_id)
        .get()
    )
    for v in existing:
        db.collection("poll_votes").document(v.id).delete()

    # Add new votes
    for oid in req.option_ids:
        vote_id = generate_uuid()
        db.collection("poll_votes").document(vote_id).set({
            "id": vote_id,
            "poll_id": poll_id,
            "option_id": oid,
            "user_id": user_id,
            "created_at": now,
        })

    return {"ok": True, "option_ids": req.option_ids}
