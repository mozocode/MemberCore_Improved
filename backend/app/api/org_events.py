"""Organization events API - CRUD, RSVP. Requires auth."""
import csv
import io
import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any

import jwt
from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks, Query, Request
from fastapi.responses import Response, RedirectResponse
from pydantic import BaseModel

from app.db.firebase import get_firestore
from app.core.security import get_current_user_id, get_current_user, generate_uuid
from app.core.images import normalize_image_value
from app.api.chat import post_to_general_chat, broadcast_new_message

router = APIRouter()


def _get_display_name_for_org_user(db, org_id: str, user_id: Optional[str]) -> tuple[str, str]:
    """Return (display_name, initial) for a user in this org: nickname if set, else first name."""
    if not user_id:
        return ("Unknown", "?")
    user_doc = db.collection("users").document(user_id).get()
    ud = user_doc.to_dict() if user_doc.exists else {}
    full_name = (ud.get("name") or ud.get("email") or "").strip()
    first_name = full_name.split()[0] if full_name else "Unknown"
    members = list(
        db.collection("members")
        .where("user_id", "==", user_id)
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .limit(1)
        .get()
    )
    nickname = (members[0].to_dict().get("nickname") or "").strip() if members else ""
    display = nickname if nickname else first_name
    initial = (display or "?")[0].upper()
    return (display, initial)


def _get_host_for_event(db, org_id: str, created_by: Optional[str]) -> dict:
    """Return host dict: name, avatar, initial (nickname or first name)."""
    if not created_by:
        return {"name": "Host", "avatar": None, "initial": "H"}
    user_doc = db.collection("users").document(created_by).get()
    if not user_doc.exists:
        return {"name": "Host", "avatar": None, "initial": "H"}
    ud = user_doc.to_dict()
    display_name, initial = _get_display_name_for_org_user(db, org_id, created_by)
    return {
        "name": display_name,
        "avatar": ud.get("avatar"),
        "initial": initial,
    }


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
    created_by = event.get("created_by") or user_id
    host_name, host_initial = _get_display_name_for_org_user(db, org_id, created_by)
    user_doc = db.collection("users").document(created_by).get()
    creator = user_doc.to_dict() if user_doc.exists else {}
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
            "name": host_name,
            "avatar": creator.get("avatar"),
            "initial": host_initial,
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


def _delete_event_messages_from_chat(db, org_id: str, event_id: str) -> int:
    """Delete auto-posted event messages in org chat for a deleted event."""
    by_event_id = list(
        db.collection("messages")
        .where("event_id", "==", event_id)
        .stream()
    )
    # Backward compatibility: some event cards may only have nested event_data.id.
    by_event_data_id = list(
        db.collection("messages")
        .where("event_data.id", "==", event_id)
        .stream()
    )
    docs_by_id = {doc.id: doc for doc in by_event_id}
    for doc in by_event_data_id:
        docs_by_id[doc.id] = doc

    deleted = 0
    for doc in docs_by_id.values():
        data = doc.to_dict() or {}
        if data.get("organization_id") != org_id:
            continue
        try:
            doc.reference.delete()
            deleted += 1
        except Exception:
            # Best effort cleanup; event deletion should still proceed.
            pass
    return deleted


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


class GoogleCalendarImportRequest(BaseModel):
    access_token: str
    calendar_id: Optional[str] = "primary"
    time_min: Optional[str] = None  # ISO datetime
    time_max: Optional[str] = None  # ISO datetime
    max_results: Optional[int] = 250
    merge_existing: bool = True


class GoogleAutoSyncStartRequest(BaseModel):
    calendar_id: Optional[str] = "primary"


def _google_iso_to_utc_iso(v: Optional[str]) -> Optional[str]:
    if not v:
        return None
    try:
        dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def _google_all_day_to_iso(v: Optional[str], end_of_day: bool) -> Optional[str]:
    if not v:
        return None
    try:
        d = datetime.fromisoformat(v)
    except ValueError:
        return None
    if end_of_day:
        d = d.replace(hour=23, minute=59, second=0, microsecond=0)
    else:
        d = d.replace(hour=0, minute=0, second=0, microsecond=0)
    return d.replace(tzinfo=timezone.utc).isoformat()


def _google_event_to_membercore_times(item: dict) -> tuple[Optional[str], Optional[str], bool]:
    start = item.get("start") or {}
    end = item.get("end") or {}
    start_dt = _google_iso_to_utc_iso(start.get("dateTime"))
    end_dt = _google_iso_to_utc_iso(end.get("dateTime"))
    if start_dt:
        return start_dt, end_dt, False
    # All-day event (`date` only). Google end.date is exclusive; adjust to end-of-day prior date.
    start_day = start.get("date")
    end_day_exclusive = end.get("date")
    start_iso = _google_all_day_to_iso(start_day, end_of_day=False)
    end_iso = None
    if end_day_exclusive:
        try:
            end_dt = datetime.fromisoformat(end_day_exclusive)
            end_prev = end_dt.replace(tzinfo=timezone.utc) - timedelta(minutes=1)
            end_iso = end_prev.isoformat()
        except ValueError:
            end_iso = _google_all_day_to_iso(end_day_exclusive, end_of_day=True)
    return start_iso, end_iso, True


def _fetch_google_calendar_events(
    access_token: str,
    calendar_id: str,
    time_min: Optional[str],
    time_max: Optional[str],
    max_results: int,
) -> list[dict]:
    q = {
        "singleEvents": "true",
        "orderBy": "startTime",
        "maxResults": str(max(1, min(max_results, 2500))),
    }
    if time_min:
        q["timeMin"] = time_min
    if time_max:
        q["timeMax"] = time_max
    url = (
        "https://www.googleapis.com/calendar/v3/calendars/"
        f"{urllib.parse.quote(calendar_id, safe='')}/events?"
        + urllib.parse.urlencode(q)
    )
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {access_token}")
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return payload.get("items") or []


def _google_token_exchange(code: str, redirect_uri: str) -> dict:
    client_id = (os.getenv("GOOGLE_OAUTH_CLIENT_ID") or "").strip()
    client_secret = (os.getenv("GOOGLE_OAUTH_CLIENT_SECRET") or "").strip()
    if not client_id or not client_secret:
        raise HTTPException(
            status_code=503,
            detail="Google auto-sync is not configured (missing GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET).",
        )
    body = urllib.parse.urlencode(
        {
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=body,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _google_refresh_access_token(refresh_token: str) -> dict:
    client_id = (os.getenv("GOOGLE_OAUTH_CLIENT_ID") or "").strip()
    client_secret = (os.getenv("GOOGLE_OAUTH_CLIENT_SECRET") or "").strip()
    if not client_id or not client_secret:
        raise HTTPException(
            status_code=503,
            detail="Google auto-sync is not configured (missing GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET).",
        )
    body = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=body,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _auto_sync_redirect_uri(request: Optional[Request] = None) -> str:
    configured = (os.getenv("GOOGLE_CALENDAR_OAUTH_REDIRECT_URI") or "").strip()
    if configured:
        return configured
    if request is not None:
        return str(request.base_url).rstrip("/") + "/api/events/google/auto-sync/oauth/callback"
    raise HTTPException(status_code=503, detail="Google auto-sync redirect URI is not configured")


def _encode_auto_sync_state(org_id: str, user_id: str, calendar_id: str) -> str:
    secret = os.getenv("JWT_SECRET", "change-me-in-production")
    payload = {
        "org_id": org_id,
        "user_id": user_id,
        "calendar_id": calendar_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def _decode_auto_sync_state(state_token: str) -> dict:
    secret = os.getenv("JWT_SECRET", "change-me-in-production")
    try:
        return jwt.decode(state_token, secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")


def _import_google_calendar_events_for_org(
    db,
    org_id: str,
    actor_user_id: str,
    access_token: str,
    calendar_id: str,
    time_min: Optional[str],
    time_max: Optional[str],
    max_results: int,
    merge_existing: bool,
) -> dict:
    google_events = _fetch_google_calendar_events(
        access_token=access_token,
        calendar_id=calendar_id,
        time_min=time_min,
        time_max=time_max,
        max_results=max_results,
    )

    existing_docs = list(db.collection("events").where("organization_id", "==", org_id).stream())
    existing_keys = set()
    for doc in existing_docs:
        d = doc.to_dict() or {}
        key = d.get("google_calendar_external_key")
        if key:
            existing_keys.add(str(key))

    imported = 0
    skipped = 0
    errors = 0
    now = datetime.now(timezone.utc)
    for item in google_events:
        status_value = (item.get("status") or "").lower()
        if status_value == "cancelled":
            skipped += 1
            continue
        google_event_id = item.get("id")
        summary = (item.get("summary") or "").strip()
        if not google_event_id or not summary:
            skipped += 1
            continue
        external_key = f"{calendar_id}:{google_event_id}"
        if external_key in existing_keys and not merge_existing:
            skipped += 1
            continue

        start_time, end_time, all_day = _google_event_to_membercore_times(item)
        if not start_time:
            skipped += 1
            continue

        event_id = generate_uuid()
        location = (item.get("location") or "").strip() or None
        description = (item.get("description") or "").strip() or None
        event_data = {
            "organization_id": org_id,
            "title": summary,
            "description": description,
            "location": location,
            "start_time": start_time,
            "end_time": end_time,
            "all_day": all_day,
            "cover_image": None,
            "is_public_directory": False,
            "event_type": "Imported",
            "is_paid": False,
            "price": None,
            "latitude": None,
            "longitude": None,
            "location_privacy": "immediate",
            "max_attendees": None,
            "event_date": start_time,
            "created_by": actor_user_id,
            "google_calendar_id": calendar_id,
            "google_calendar_event_id": google_event_id,
            "google_calendar_external_key": external_key,
            "import_source": "google_calendar",
            "imported_at": now,
            "updated_at": now,
        }
        try:
            existing_doc = None
            if external_key in existing_keys:
                existing_doc = next(
                    (
                        doc for doc in existing_docs
                        if (doc.to_dict() or {}).get("google_calendar_external_key") == external_key
                    ),
                    None,
                )
            if existing_doc:
                db.collection("events").document(existing_doc.id).update(event_data)
                imported += 1
            else:
                db.collection("events").document(event_id).set(
                    {"id": event_id, "created_at": now, **event_data}
                )
                existing_keys.add(external_key)
                imported += 1
        except Exception:
            errors += 1

    return {
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
        "total_fetched": len(google_events),
        "calendar_id": calendar_id,
    }


def _fetch_google_calendar_list(access_token: str) -> list[dict]:
    url = "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {access_token}")
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return payload.get("items") or []


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

    # Enrich with host, RSVP counts and user's RSVP
    for event in events:
        event["host"] = _get_host_for_event(db, org_id, event.get("created_by"))
        rsvps = list(
            db.collection("event_rsvps").where("event_id", "==", event["id"]).stream()
        )
        event["rsvp_counts"] = {
            "yes": sum(1 for r in rsvps if r.to_dict().get("status") == "yes"),
            "maybe": sum(1 for r in rsvps if r.to_dict().get("status") == "maybe"),
            "no": sum(1 for r in rsvps if r.to_dict().get("status") == "no"),
        }
        event["attending_count"] = (
            event["rsvp_counts"]["yes"] + event["rsvp_counts"]["maybe"]
        )
        my_rsvp = next(
            (r for r in rsvps if r.to_dict().get("user_id") == user_id),
            None,
        )
        event["my_rsvp"] = my_rsvp.to_dict().get("status") if my_rsvp else None

    return events


@router.get("/{org_id}/import/google/calendars")
def list_google_calendars(
    org_id: str,
    access_token: str = Query(..., description="Google OAuth access token"),
    user: dict = Depends(get_current_user),
):
    """List Google calendars available to the authenticated user."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(role)
    token = (access_token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Google access token is required")
    try:
        calendars = _fetch_google_calendar_list(token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch Google calendars: {str(e)}")
    out = []
    for c in calendars:
        out.append({
            "id": c.get("id"),
            "summary": c.get("summary") or c.get("id"),
            "primary": bool(c.get("primary")),
            "access_role": c.get("accessRole"),
        })
    out.sort(key=lambda c: (not c.get("primary"), (c.get("summary") or "").lower()))
    return out


@router.get("/{org_id}/import/google/auto-sync/status")
def get_google_auto_sync_status(
    org_id: str,
    user: dict = Depends(get_current_user),
):
    db = get_firestore()
    role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(role)
    org_doc = db.collection("organizations").document(org_id).get()
    if not org_doc.exists:
        raise HTTPException(status_code=404, detail="Organization not found")
    d = org_doc.to_dict() or {}
    return {
        "enabled": bool(d.get("google_calendar_sync_enabled")),
        "calendar_id": d.get("google_calendar_sync_calendar_id"),
        "last_synced_at": d.get("google_calendar_sync_last_synced_at"),
        "last_error": d.get("google_calendar_sync_last_error"),
    }


@router.post("/{org_id}/import/google/auto-sync/start")
def start_google_auto_sync_oauth(
    org_id: str,
    req: GoogleAutoSyncStartRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Return OAuth URL to enable daily Google Calendar auto-sync."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(role)
    client_id = (os.getenv("GOOGLE_OAUTH_CLIENT_ID") or "").strip()
    if not client_id:
        raise HTTPException(
            status_code=503,
            detail="Google auto-sync is not configured (missing GOOGLE_OAUTH_CLIENT_ID).",
        )
    calendar_id = (req.calendar_id or "primary").strip() or "primary"
    redirect_uri = _auto_sync_redirect_uri(request)
    state = _encode_auto_sync_state(org_id, user["id"], calendar_id)
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/calendar.readonly",
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return {"auth_url": url}


@router.get("/google/auto-sync/oauth/callback")
def google_auto_sync_oauth_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
):
    """OAuth callback: exchange code, store refresh token, enable daily auto-sync."""
    frontend_url = (os.getenv("FRONTEND_URL") or "https://membercore.io").rstrip("/")
    if error:
        return RedirectResponse(url=f"{frontend_url}/?google_sync=error&reason={urllib.parse.quote(error)}")
    if not code or not state:
        return RedirectResponse(url=f"{frontend_url}/?google_sync=error&reason=missing_code_or_state")

    payload = _decode_auto_sync_state(state)
    org_id = payload.get("org_id")
    user_id = payload.get("user_id")
    calendar_id = payload.get("calendar_id") or "primary"
    if not org_id or not user_id:
        return RedirectResponse(url=f"{frontend_url}/?google_sync=error&reason=invalid_state")

    redirect_uri = _auto_sync_redirect_uri(request)
    token_data = _google_token_exchange(code, redirect_uri)
    refresh_token = token_data.get("refresh_token")
    if not refresh_token:
        # Google can omit refresh_token if consent was previously granted.
        # Keep existing token if present; otherwise require reconnection with consent.
        db = get_firestore()
        org_doc = db.collection("organizations").document(org_id).get()
        existing_refresh = (org_doc.to_dict() or {}).get("google_calendar_sync_refresh_token") if org_doc.exists else None
        if not existing_refresh:
            return RedirectResponse(url=f"{frontend_url}/?google_sync=error&reason=missing_refresh_token")
        refresh_token = existing_refresh

    db = get_firestore()
    now = datetime.now(timezone.utc)
    db.collection("organizations").document(org_id).set(
        {
            "google_calendar_sync_enabled": True,
            "google_calendar_sync_calendar_id": calendar_id,
            "google_calendar_sync_refresh_token": refresh_token,
            "google_calendar_sync_connected_by": user_id,
            "google_calendar_sync_connected_at": now,
            "google_calendar_sync_last_error": None,
        },
        merge=True,
    )
    return RedirectResponse(url=f"{frontend_url}/org/{org_id}/calendar?google_sync=connected")


@router.post("/{org_id}/import/google/auto-sync/disable")
def disable_google_auto_sync(
    org_id: str,
    user: dict = Depends(get_current_user),
):
    db = get_firestore()
    role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(role)
    db.collection("organizations").document(org_id).set(
        {
            "google_calendar_sync_enabled": False,
            "google_calendar_sync_last_error": None,
        },
        merge=True,
    )
    return {"ok": True}


@router.post("/import/google/auto-sync/run-all")
def run_google_auto_sync_for_all_orgs(request: Request):
    """Cloud Scheduler endpoint: run daily sync for all orgs with Google sync enabled."""
    secret = (os.getenv("GOOGLE_CALENDAR_SYNC_SECRET") or "").strip()
    header_secret = (request.headers.get("x-google-calendar-sync-secret") or "").strip()
    query_secret = (request.query_params.get("secret") or "").strip()
    if not secret or (header_secret != secret and query_secret != secret):
        raise HTTPException(status_code=401, detail="Unauthorized")

    db = get_firestore()
    docs = list(
        db.collection("organizations")
        .where("google_calendar_sync_enabled", "==", True)
        .stream()
    )
    now = datetime.now(timezone.utc)
    time_min = (now - timedelta(days=7)).isoformat()
    time_max = (now + timedelta(days=365)).isoformat()
    processed = 0
    imported = 0
    skipped = 0
    errors = 0
    for doc in docs:
        processed += 1
        d = doc.to_dict() or {}
        refresh_token = (d.get("google_calendar_sync_refresh_token") or "").strip()
        calendar_id = (d.get("google_calendar_sync_calendar_id") or "primary").strip() or "primary"
        actor_user_id = (d.get("google_calendar_sync_connected_by") or d.get("owner_id") or "").strip()
        if not refresh_token or not actor_user_id:
            errors += 1
            db.collection("organizations").document(doc.id).set(
                {"google_calendar_sync_last_error": "Missing refresh token or user context"},
                merge=True,
            )
            continue
        try:
            token = _google_refresh_access_token(refresh_token)
            access_token = (token.get("access_token") or "").strip()
            if not access_token:
                raise Exception("Missing access_token from Google refresh flow")
            stats = _import_google_calendar_events_for_org(
                db=db,
                org_id=doc.id,
                actor_user_id=actor_user_id,
                access_token=access_token,
                calendar_id=calendar_id,
                time_min=time_min,
                time_max=time_max,
                max_results=1000,
                merge_existing=True,
            )
            imported += int(stats.get("imported") or 0)
            skipped += int(stats.get("skipped") or 0)
            db.collection("organizations").document(doc.id).set(
                {
                    "google_calendar_sync_last_synced_at": now,
                    "google_calendar_sync_last_error": None,
                },
                merge=True,
            )
        except Exception as e:
            errors += 1
            db.collection("organizations").document(doc.id).set(
                {"google_calendar_sync_last_error": str(e)[:500]},
                merge=True,
            )

    return {
        "processed_orgs": processed,
        "imported_events": imported,
        "skipped_events": skipped,
        "org_errors": errors,
        "time_min": time_min,
        "time_max": time_max,
    }


@router.post("/{org_id}/import/google")
def import_google_calendar_events(
    org_id: str,
    req: GoogleCalendarImportRequest,
    user: dict = Depends(get_current_user),
):
    """Import events from a Google Calendar into org events (owner/admin only)."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(role)

    access_token = (req.access_token or "").strip()
    if not access_token:
        raise HTTPException(status_code=400, detail="Google access token is required")

    calendar_id = (req.calendar_id or "primary").strip() or "primary"
    time_min = req.time_min or datetime.now(timezone.utc).isoformat()
    time_max = req.time_max
    max_results = req.max_results or 250

    try:
        return _import_google_calendar_events_for_org(
            db=db,
            org_id=org_id,
            actor_user_id=user["id"],
            access_token=access_token,
            calendar_id=calendar_id,
            time_min=time_min,
            time_max=time_max,
            max_results=max_results,
            merge_existing=req.merge_existing,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch Google Calendar events: {str(e)}")


@router.post("/{org_id}")
def create_event(
    org_id: str,
    req: CreateEventRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """Create event. Admin/owner only. Prospects (restricted) cannot create events."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user["id"])
    if role == "restricted":
        raise HTTPException(status_code=403, detail="Prospects cannot create events")
    _require_admin_or_owner(role)

    event_id = generate_uuid()
    now = datetime.now(timezone.utc)
    cover_image = normalize_image_value(
        req.cover_image,
        field_label="Event cover image",
        strict_data_url=False,
        max_data_url_length=520_000,
        max_dimension=1400,
        jpeg_quality=74,
    )

    event_data = {
        "id": event_id,
        "organization_id": org_id,
        "title": req.title.strip(),
        "description": (req.description or "").strip() or None,
        "location": (req.location or "").strip() or None,
        "start_time": req.start_time,
        "end_time": req.end_time,
        "all_day": req.all_day,
        "cover_image": cover_image,
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

    # Host (creator)
    ed["host"] = _get_host_for_event(db, org_id, ed.get("created_by"))

    # Attendees (display name = nickname or first name)
    attendees = {"yes": [], "maybe": [], "no": []}
    for r in rsvps:
        rd = r.to_dict()
        uid = rd.get("user_id")
        st = rd.get("status")
        if uid and st in attendees:
            display_name, initial = _get_display_name_for_org_user(db, org_id, uid)
            user_doc = db.collection("users").document(uid).get()
            ud = user_doc.to_dict() if user_doc.exists else {}
            attendees[st].append({
                "user_id": uid,
                "name": display_name,
                "initial": initial,
                "avatar": ud.get("avatar"),
            })
    ed["attendees"] = attendees
    ed["attending_count"] = ed["rsvp_counts"]["yes"] + ed["rsvp_counts"]["maybe"]

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

    up = {k: v for k, v in req.model_dump().items() if v is not None}
    if "cover_image" in up:
        up["cover_image"] = normalize_image_value(
            up.get("cover_image"),
            field_label="Event cover image",
            strict_data_url=False,
            max_data_url_length=520_000,
            max_dimension=1400,
            jpeg_quality=74,
        )
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

    # Remove event document and related auto-posted chat message cards.
    ref.delete()
    try:
        _delete_event_messages_from_chat(db, org_id, event_id)
    except Exception:
        # Best effort cleanup; primary delete already succeeded.
        pass
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


@router.get("/{org_id}/{event_id}/export/csv")
def export_event_attendees_csv(
    org_id: str,
    event_id: str,
    user: dict = Depends(get_current_user),
):
    """Export attendees as CSV. Admin or owner only."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(role)

    doc = db.collection("events").document(event_id).get()
    if not doc.exists or doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Event not found")
    event_title = doc.to_dict().get("title", "Event")

    rsvps = list(db.collection("event_rsvps").where("event_id", "==", event_id).stream())
    rows = []
    for r in rsvps:
        rd = r.to_dict()
        uid = rd.get("user_id")
        status = rd.get("status", "")
        if not uid:
            continue
        user_doc = db.collection("users").document(uid).get()
        email = ""
        name = "Unknown"
        if user_doc.exists:
            ud = user_doc.to_dict()
            email = ud.get("email") or ""
            name = ud.get("name") or ud.get("email") or "Unknown"
        rows.append({"name": name, "email": email, "status": status})

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=["name", "email", "status"])
    writer.writeheader()
    writer.writerows(rows)
    csv_content = buf.getvalue()

    filename = f"attendees-{event_id[:8]}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
