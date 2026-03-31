"""Platform Admin: List signup and trial-exit feedback from all orgs."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends

from app.db.firebase import get_firestore
from app.core.security import require_platform_admin

router = APIRouter(dependencies=[Depends(require_platform_admin)])


def _timestamp_to_iso(t) -> Optional[str]:
    if t is None:
        return None
    if hasattr(t, "isoformat"):
        return t.isoformat() if hasattr(t, "tzinfo") and t.tzinfo else f"{t.isoformat()}Z"
    if hasattr(t, "seconds"):
        dt = datetime.utcfromtimestamp(t.seconds)
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return str(t)


@router.get("/feedback")
def list_feedback(admin: dict = Depends(require_platform_admin)):
    """List all signup and trial-exit feedback (platform admin only). Uses Firestore collection group query."""
    db = get_firestore()
    # All docs in any "feedback" subcollection (under organizations)
    feedback_docs = list(db.collection_group("feedback").limit(500).stream())
    org_ids = set()
    rows = []
    for doc in feedback_docs:
        d = doc.to_dict() or {}
        org_id = d.get("org_id")
        if org_id:
            org_ids.add(org_id)
        created = d.get("created_at")
        rows.append({
            "id": doc.id,
            "org_id": org_id,
            "user_id": d.get("user_id"),
            "type": d.get("type"),
            "answer_text": d.get("answer_text", ""),
            "choice_key": d.get("choice_key"),
            "created_at": _timestamp_to_iso(created),
        })
    # Resolve org names
    org_names = {}
    for oid in org_ids:
        odoc = db.collection("organizations").document(oid).get()
        if odoc.exists:
            org_names[oid] = (odoc.to_dict() or {}).get("name") or oid
        else:
            org_names[oid] = oid
    for r in rows:
        r["org_name"] = org_names.get(r["org_id"]) or r["org_id"]
    # Sort by created_at descending (newest first); None last
    rows.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return {"items": rows}
