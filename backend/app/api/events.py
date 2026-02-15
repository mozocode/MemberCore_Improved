"""Public events directory API - no auth required for listing; auth for RSVP."""
import math
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Query, HTTPException, Depends
from pydantic import BaseModel

from app.db.firebase import get_firestore
from app.core.security import get_current_user_id, generate_uuid

router = APIRouter()


class PublicRsvpRequest(BaseModel):
    status: str  # "yes" | "maybe" | "no"


def _haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in miles."""
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    return 3956 * c  # Earth radius in miles


@router.get("/public/directory")
def get_public_directory(
    org_type: Optional[str] = Query(None),
    cultural_identity: Optional[str] = Query(None),
    sport_type: Optional[str] = Query(None),
    date_range: Optional[str] = Query(None),
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    radius: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
):
    """
    Get public directory events with filters.
    Events must have is_public_directory=True.
    """
    db = get_firestore()
    now = datetime.now(timezone.utc)

    # Treat empty string or literal "null" as not provided
    def _present(s: Optional[str]) -> bool:
        return s is not None and s != "" and s.strip().lower() != "null"

    org_type = org_type if _present(org_type) else None
    cultural_identity = cultural_identity if _present(cultural_identity) else None
    sport_type = sport_type if _present(sport_type) else None

    # Get matching organization IDs if org filters applied
    org_ids = None
    if org_type or cultural_identity or sport_type:
        org_docs = list(db.collection("organizations").stream())
        matching_orgs = []
        for doc in org_docs:
            d = doc.to_dict()
            if d.get("is_deleted") or d.get("is_suspended"):
                continue
            if org_type and d.get("type") != org_type:
                continue
            if cultural_identity and d.get("cultural_identity") != cultural_identity:
                continue
            if sport_type and d.get("sport_type") != sport_type:
                continue
            matching_orgs.append(doc.id)
        org_ids = matching_orgs
        if not org_ids:
            return []

    # Query events - only public directory events
    events_ref = db.collection("events")
    events_query = events_ref.where("is_public_directory", "==", True)

    if org_ids is not None:
        # Firestore 'in' supports up to 30 values
        if len(org_ids) > 30:
            org_ids = org_ids[:30]
        if org_ids:
            events_query = events_query.where("organization_id", "in", org_ids)
        else:
            return []

    events_docs = list(events_query.stream())
    events = []
    for doc in events_docs:
        ed = doc.to_dict()
        ed["id"] = doc.id

        # Date range filter
        event_date_str = ed.get("event_date")
        if event_date_str:
            try:
                if isinstance(event_date_str, datetime):
                    event_dt = event_date_str
                else:
                    event_dt = datetime.fromisoformat(
                        event_date_str.replace("Z", "+00:00")
                    )
            except (ValueError, TypeError):
                event_dt = now
        else:
            event_dt = now

        if date_range:
            if date_range == "today":
                start = now.replace(hour=0, minute=0, second=0, microsecond=0)
                end = start + timedelta(days=1)
            elif date_range == "tomorrow":
                start = (now + timedelta(days=1)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                end = start + timedelta(days=1)
            elif date_range == "this_week":
                start = now
                end = now + timedelta(days=7)
            elif date_range == "this_weekend":
                days_until_sat = (5 - now.weekday()) % 7
                start = (now + timedelta(days=days_until_sat)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                end = start + timedelta(days=2)
            elif date_range in ("this_month", "next_month"):
                days = 30 if date_range == "this_month" else 60
                start = now
                end = now + timedelta(days=days)
            else:
                start, end = now, now + timedelta(days=365)
            if event_dt < start or event_dt >= end:
                continue
        else:
            if event_dt < now:
                continue

        # Search filter
        if search:
            s = search.lower()
            title = (ed.get("title") or "").lower()
            desc = (ed.get("description") or "").lower()
            loc = (ed.get("location") or "").lower()
            if s not in title and s not in desc and s not in loc:
                continue

        # Radius filter (after we have the event)
        if latitude is not None and longitude is not None and radius is not None:
            elat = ed.get("latitude")
            elon = ed.get("longitude")
            if elat is None or elon is None:
                continue
            if _haversine_miles(latitude, longitude, float(elat), float(elon)) > radius:
                continue

        events.append(ed)

    # Sort by event_date
    events.sort(key=lambda e: e.get("event_date") or "")

    # Skip/limit
    events = events[skip : skip + limit]

    # Enrich with organization data and RSVP counts
    for event in events:
        org_id = event.get("organization_id")
        if org_id:
            org_doc = db.collection("organizations").document(org_id).get()
            if org_doc.exists:
                od = org_doc.to_dict()
                event["organization"] = {
                    "id": org_id,
                    "name": od.get("name"),
                    "logo": od.get("logo"),
                    "type": od.get("type"),
                    "cultural_identity": od.get("cultural_identity"),
                    "sport_type": od.get("sport_type"),
                    "icon_color": od.get("icon_color"),
                }

        rsvps = list(
            db.collection("event_rsvps").where("event_id", "==", event["id"]).stream()
        )
        event["going_count"] = sum(
            1 for r in rsvps if r.to_dict().get("status") == "yes"
        )
        event["maybe_count"] = sum(
            1 for r in rsvps if r.to_dict().get("status") == "maybe"
        )

    return events


@router.get("/public/directory/{event_id}")
def get_public_event(event_id: str):
    """Get a single public directory event by ID. No auth. Returns 404 if not public."""
    db = get_firestore()
    doc = db.collection("events").document(event_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Event not found")
    ed = doc.to_dict()
    if not ed.get("is_public_directory"):
        raise HTTPException(status_code=404, detail="Event not found")
    ed["id"] = doc.id
    org_id = ed.get("organization_id")
    if org_id:
        org_doc = db.collection("organizations").document(org_id).get()
        if org_doc.exists:
            od = org_doc.to_dict()
            ed["organization"] = {
                "id": org_id,
                "name": od.get("name"),
                "logo": od.get("logo"),
                "type": od.get("type"),
                "cultural_identity": od.get("cultural_identity"),
                "sport_type": od.get("sport_type"),
                "icon_color": od.get("icon_color"),
            }
    rsvps = list(
        db.collection("event_rsvps").where("event_id", "==", event_id).stream()
    )
    ed["going_count"] = sum(1 for r in rsvps if r.to_dict().get("status") == "yes")
    ed["maybe_count"] = sum(1 for r in rsvps if r.to_dict().get("status") == "maybe")
    return ed


@router.post("/public/{event_id}/rsvp")
def public_event_rsvp(
    event_id: str,
    req: PublicRsvpRequest,
    user_id: str = Depends(get_current_user_id),
):
    """RSVP to a public directory event. Auth required. No org membership required."""
    if req.status not in ("yes", "maybe", "no"):
        raise HTTPException(status_code=400, detail="Invalid status")
    db = get_firestore()
    doc = db.collection("events").document(event_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Event not found")
    ed = doc.to_dict()
    if not ed.get("is_public_directory"):
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


@router.get("/public/{event_id}/my-rsvp")
def get_public_event_my_rsvp(
    event_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Get current user's RSVP for a public event. Auth required."""
    db = get_firestore()
    doc = db.collection("events").document(event_id).get()
    if not doc.exists or not doc.to_dict().get("is_public_directory"):
        raise HTTPException(status_code=404, detail="Event not found")
    rsvps = list(
        db.collection("event_rsvps")
        .where("event_id", "==", event_id)
        .where("user_id", "==", user_id)
        .limit(1)
        .get()
    )
    if not rsvps:
        return {"status": None}
    return {"status": rsvps[0].to_dict().get("status")}


@router.delete("/public/{event_id}/rsvp")
def public_event_cancel_rsvp(
    event_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Cancel RSVP for a public directory event."""
    db = get_firestore()
    doc = db.collection("events").document(event_id).get()
    if not doc.exists or not doc.to_dict().get("is_public_directory"):
        raise HTTPException(status_code=404, detail="Event not found")
    existing = list(
        db.collection("event_rsvps")
        .where("event_id", "==", event_id)
        .where("user_id", "==", user_id)
        .limit(1)
        .get()
    )
    for r in existing:
        r.reference.delete()
    return {"ok": True}
