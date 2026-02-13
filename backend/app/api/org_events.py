"""Organization events API - CRUD, RSVP. Requires auth."""
from datetime import datetime, timezone
from typing import Optional, List, Any

from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from pydantic import BaseModel

from app.db.firebase import get_firestore
from app.core.security import get_current_user_id, get_current_user, generate_uuid
from app.api.chat import post_to_general_chat, broadcast_new_message

router = APIRouter()


def _serialize_dt(v: Any) -> Any:
    if hasattr(v, "isoformat"):
        return v.isoformat()
    if hasattr(v, "timestamp"):
        return datetime.fromtimestamp(v.timestamp(), tz=timezone.utc).isoformat()
    return v


def _post_event_to_chat(db, org_id: str, user_id: str, event: dict, is_update: bool):
    """Post event to general chat. Returns (channel_id, message_doc) or (None, None)."""
    if is_update:
        content = f"📝 {event.get('title', 'Event')} was updated."
        channel_id, msg_doc = post_to_general_chat(
            db, org_id, user_id, "text", content
        )
        return channel_id, msg_doc
    user_doc = db.collection("users").document(event.get("created_by") or user_id).get()
    creator = user_doc.to_dict() if user_doc.exists else {}
    name = (creator.get("name") or "Host").strip()
    first_name = name.split()[0] if name else "Host"
    initial = (name or "H")[0].upper()
    event_data = {
        "id": event.get("id"),
        "title": event.get("title"),
        "description": event.get("description"),
        "location": event.get("location"),
        "start_time": _serialize_dt(event.get("start_time")),
        "end_time": _serialize_dt(event.get("end_time")) if event.get("end_time") else None,
        "cover_image": event.get("cover_image"),
        "is_paid": event.get("is_paid", False),
        "price": event.get("price"),
        "event_type": event.get("event_type"),
        "host": {
            "name": first_name,
            "avatar": creator.get("avatar"),
            "initial": initial,
        },
    }
    content = f"📅 New Event: {event.get('title', '')}"
    channel_id, msg_doc = post_to_general_chat(
        db,
        org_id,
        user_id,
        "event",
        content,
        event_data=event_data,
        event_id=event.get("id"),
    )
    return channel_id, msg_doc


def _require_org_member(db, org_id: str, user_id: str) -> str:
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


class CreateEventRequest(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    start_time: str  # ISO datetime
    end_time: Optional[str] = None
    all_day: bool = False
    cover_image: Optional[str] = None
    is_public_directory: bool = False
    event_type: Optional[str] = None
    is_paid: bool = False
    price: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_privacy: Optional[str] = None  # "immediate" | "after_rsvp" | "city_only"
    max_attendees: Optional[int] = None


class UpdateEventRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    all_day: Optional[bool] = None
    cover_image: Optional[str] = None
    is_public_directory: Optional[bool] = None
    event_type: Optional[str] = None
    is_paid: Optional[bool] = None
    price: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_privacy: Optional[str] = None
    max_attendees: Optional[int] = None


class RSVPRequest(BaseModel):
    status: str  # "yes" | "maybe" | "no"


@router.get("/{org_id}")
def list_org_events(
    org_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """List organization events. Upcoming first."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    docs = list(
        db.collection("events")
        .where("organization_id", "==", org_id)
        .stream()
    )
    events = []
    now = datetime.now(timezone.utc)
    for doc in docs:
        ed = doc.to_dict()
        ed["id"] = doc.id
        event_dt = ed.get("start_time") or ed.get("event_date")
        if isinstance(event_dt, str):
            try:
                event_dt = datetime.fromisoformat(event_dt.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                event_dt = now
        ed["_sort_date"] = event_dt
        events.append(ed)

    events.sort(key=lambda e: (e.get("_sort_date") or now))
    for e in events:
        del e["_sort_date"]

    # Enrich with RSVP counts and user's RSVP
    for event in events:
        rsvps = list(
            db.collection("event_rsvps").where("event_id", "==", event["id"]).stream()
        )
        event["rsvp_counts"] = {
            "yes": sum(1 for r in rsvps if r.to_dict().get("status") == "yes"),
            "maybe": sum(1 for r in rsvps if r.to_dict().get("status") == "maybe"),
            "no": sum(1 for r in rsvps if r.to_dict().get("status") == "no"),
        }
        my_rsvp = next(
            (r for r in rsvps if r.to_dict().get("user_id") == user_id),
            None,
        )
        event["my_rsvp"] = my_rsvp.to_dict().get("status") if my_rsvp else None

    return events


@router.post("/{org_id}")
def create_event(
    org_id: str,
    req: CreateEventRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """Create event. Admin/owner only. Posts to general chat."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(role)

    event_id = generate_uuid()
    now = datetime.now(timezone.utc)

    event_data = {
        "id": event_id,
        "organization_id": org_id,
        "title": req.title.strip(),
        "description": (req.description or "").strip() or None,
        "location": (req.location or "").strip() or None,
        "start_time": req.start_time,
        "end_time": req.end_time,
        "all_day": req.all_day,
        "cover_image": req.cover_image,
        "is_public_directory": req.is_public_directory,
        "event_type": req.event_type,
        "is_paid": req.is_paid,
        "price": req.price,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "location_privacy": req.location_privacy or "immediate",
        "max_attendees": req.max_attendees,
        "event_date": req.start_time,  # For public directory compatibility
        "created_by": user["id"],
        "created_at": now,
    }

    db.collection("events").document(event_id).set(event_data)

    try:
        channel_id, msg_doc = _post_event_to_chat(db, org_id, user["id"], event_data, is_update=False)
        if channel_id and msg_doc:
            background_tasks.add_task(broadcast_new_message, org_id, channel_id, msg_doc)
    except Exception:
        pass

    return {**event_data, "id": event_id}


@router.get("/{org_id}/{event_id}")
def get_event(
    org_id: str,
    event_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Get event detail with attendees."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    doc = db.collection("events").document(event_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Event not found")
    ed = doc.to_dict()
    if ed.get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Event not found")
    ed["id"] = doc.id

    # RSVP counts and user's RSVP
    rsvps = list(db.collection("event_rsvps").where("event_id", "==", event_id).stream())
    ed["rsvp_counts"] = {
        "yes": sum(1 for r in rsvps if r.to_dict().get("status") == "yes"),
        "maybe": sum(1 for r in rsvps if r.to_dict().get("status") == "maybe"),
        "no": sum(1 for r in rsvps if r.to_dict().get("status") == "no"),
    }
    my_rsvp = next((r for r in rsvps if r.to_dict().get("user_id") == user_id), None)
    ed["my_rsvp"] = my_rsvp.to_dict().get("status") if my_rsvp else None

    # Attendees
    attendees = {"yes": [], "maybe": [], "no": []}
    for r in rsvps:
        rd = r.to_dict()
        uid = rd.get("user_id")
        st = rd.get("status")
        if uid and st in attendees:
            user_doc = db.collection("users").document(uid).get()
            if user_doc.exists:
                ud = user_doc.to_dict()
                attendees[st].append({
                    "user_id": uid,
                    "name": ud.get("name") or ud.get("email") or "Unknown",
                    "initial": (ud.get("name") or "?")[0].upper(),
                    "avatar": ud.get("avatar"),
                })
    ed["attendees"] = attendees

    return ed


def _can_edit_or_delete_event(role: str, event: dict, user_id: str) -> bool:
    """True if user may edit/delete: admin/owner, or the event creator."""
    if role in ("owner", "admin"):
        return True
    return event.get("created_by") == user_id


@router.put("/{org_id}/{event_id}")
def update_event(
    org_id: str,
    event_id: str,
    req: UpdateEventRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """Update event. Allowed by org admin/owner or the event creator. Posts update to general chat."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user["id"])

    ref = db.collection("events").document(event_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Event not found")
    event_data = doc.to_dict()

    if not _can_edit_or_delete_event(role, event_data, user["id"]):
        raise HTTPException(
            status_code=403,
            detail="Only admins or the event creator can edit this event",
        )

    up = {k: v for k, v in req.dict().items() if v is not None}
    if up:
        ref.update(up)

    updated = ref.get().to_dict()
    updated["id"] = event_id
    try:
        channel_id, msg_doc = _post_event_to_chat(db, org_id, user["id"], updated, is_update=True)
        if channel_id and msg_doc:
            background_tasks.add_task(broadcast_new_message, org_id, channel_id, msg_doc)
    except Exception:
        pass

    return updated


@router.delete("/{org_id}/{event_id}")
def delete_event(
    org_id: str,
    event_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete event. Allowed by org admin/owner or the event creator."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user["id"])

    ref = db.collection("events").document(event_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Event not found")
    event_data = doc.to_dict()

    if not _can_edit_or_delete_event(role, event_data, user["id"]):
        raise HTTPException(
            status_code=403,
            detail="Only admins or the event creator can delete this event",
        )

    ref.delete()
    return {"ok": True}


@router.post("/{org_id}/{event_id}/rsvp")
def create_or_update_rsvp(
    org_id: str,
    event_id: str,
    req: RSVPRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Create or update RSVP."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    if req.status not in ("yes", "maybe", "no"):
        raise HTTPException(status_code=400, detail="Invalid status")

    ref = db.collection("events").document(event_id)
    if not ref.get().exists or ref.get().to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Event not found")

    existing = list(
        db.collection("event_rsvps")
        .where("event_id", "==", event_id)
        .where("user_id", "==", user_id)
        .limit(1)
        .get()
    )

    now = datetime.now(timezone.utc)
    if existing:
        db.collection("event_rsvps").document(existing[0].id).update({
            "status": req.status,
            "updated_at": now,
        })
    else:
        rsvp_id = generate_uuid()
        db.collection("event_rsvps").document(rsvp_id).set({
            "id": rsvp_id,
            "event_id": event_id,
            "user_id": user_id,
            "status": req.status,
            "created_at": now,
        })

    return {"ok": True, "status": req.status}


@router.delete("/{org_id}/{event_id}/rsvp")
def cancel_rsvp(
    org_id: str,
    event_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Cancel RSVP."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    existing = list(
        db.collection("event_rsvps")
        .where("event_id", "==", event_id)
        .where("user_id", "==", user_id)
        .get()
    )
    for r in existing:
        db.collection("event_rsvps").document(r.id).delete()

    return {"ok": True}
