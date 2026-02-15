"""Payments API - Stripe checkout for dues and event tickets; webhook; event ticket check-in and refunds."""
import os
import random
import string
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Request, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.db.firebase import get_firestore
from app.core.security import get_current_user_id, get_current_user, generate_uuid

router = APIRouter()

# Stripe has a 2048-char limit per URL. Data URIs (base64) must not be passed to product_data.images.
MAX_STRIPE_IMAGE_URL_LENGTH = 2048


SHORT_CODE_CHARS = string.ascii_uppercase + string.digits
SHORT_CODE_LENGTH = 6


def _generate_short_code(db, org_id: str) -> str:
    """Generate a unique 6-char ticket code for this org."""
    for _ in range(10):
        code = "".join(random.choices(SHORT_CODE_CHARS, k=SHORT_CODE_LENGTH))
        existing = list(
            db.collection("event_tickets")
            .where("organization_id", "==", org_id)
            .where("short_code", "==", code)
            .limit(1)
            .stream()
        )
        if not existing:
            return code
    return "".join(random.choices(SHORT_CODE_CHARS, k=SHORT_CODE_LENGTH))


def _ensure_ticket_short_code(db, ticket_ref, org_id: str, td: dict) -> str:
    """Return short_code for ticket; backfill and update doc if missing."""
    code = td.get("short_code")
    if code:
        return code
    code = _generate_short_code(db, org_id)
    ticket_ref.update({"short_code": code, "updated_at": datetime.now(timezone.utc)})
    return code


def _stripe_safe_image_url(url: Optional[str]) -> list:
    """Return [url] only if url is http(s) and within Stripe's length limit; else []."""
    if not url or not isinstance(url, str):
        return []
    s = url.strip()
    if not s.startswith(("http://", "https://")) or len(s) > MAX_STRIPE_IMAGE_URL_LENGTH:
        return []
    return [s]


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
    return members[0]


class CheckoutRequest(BaseModel):
    plan_id: str
    origin_url: str


class CreateEventCheckoutRequest(BaseModel):
    event_id: str
    quantity: int = 1


class PublicEventCheckoutRequest(BaseModel):
    event_id: str
    quantity: int = 1


@router.post("/public/checkout/event")
def create_public_event_ticket_checkout(
    req: PublicEventCheckoutRequest,
    user: dict = Depends(get_current_user),
):
    """Create Stripe Checkout for a public directory event. No org membership required."""
    db = get_firestore()
    event_ref = db.collection("events").document(req.event_id)
    event_doc = event_ref.get()
    if not event_doc.exists:
        raise HTTPException(status_code=404, detail="Event not found")
    ev = event_doc.to_dict()
    if not ev.get("is_public_directory"):
        raise HTTPException(status_code=404, detail="Event not found")
    org_id = ev.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Event has no organization")

    if not ev.get("is_paid"):
        raise HTTPException(status_code=400, detail="This is a free event")
    price = ev.get("price")
    if price is None or float(price) <= 0:
        raise HTTPException(status_code=400, detail="Invalid ticket price")

    max_attendees = ev.get("max_attendees")
    tickets_sold = ev.get("tickets_sold") or 0
    if max_attendees is not None and tickets_sold + req.quantity > max_attendees:
        raise HTTPException(status_code=400, detail="Not enough tickets available")

    org_doc = db.collection("organizations").document(org_id).get()
    org_name = org_doc.to_dict().get("name", "Organization") if org_doc.exists else "Organization"

    stripe_key = os.getenv("STRIPE_SECRET_KEY")
    if not stripe_key:
        raise HTTPException(status_code=503, detail="Payments are not configured")

    import stripe
    stripe.api_key = stripe_key
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    price_cents = int(round(float(price) * 100))
    start_time = ev.get("start_time") or ev.get("event_date") or ""

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="payment",
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "unit_amount": price_cents,
                    "product_data": {
                        "name": f"Ticket: {ev.get('title', 'Event')}",
                        "description": f"Event by {org_name}",
                        "images": _stripe_safe_image_url(ev.get("cover_image")),
                    },
                },
                "quantity": req.quantity,
            }],
            metadata={
                "type": "event_ticket",
                "event_id": req.event_id,
                "organization_id": org_id,
                "user_id": user["id"],
                "user_email": user.get("email", ""),
                "user_name": (user.get("name") or user.get("email") or "").strip(),
                "quantity": str(req.quantity),
                "event_title": ev.get("title", ""),
                "event_start_time": start_time.isoformat() if hasattr(start_time, "isoformat") else str(start_time),
                "event_location": ev.get("location", ""),
                "organization_name": org_name,
            },
            customer_email=user.get("email"),
            success_url=f"{frontend_url}/directory?payment=success&session_id={{CHECKOUT_SESSION_ID}}&event_id={req.event_id}",
            cancel_url=f"{frontend_url}/directory?payment=cancelled",
        )
        return {"checkout_url": session.url, "session_id": session.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{org_id}/checkout/event")
def create_event_ticket_checkout(
    org_id: str,
    req: CreateEventCheckoutRequest,
    user: dict = Depends(get_current_user),
):
    """Create Stripe Checkout Session for an event ticket. Returns checkout URL."""
    db = get_firestore()
    _require_org_member(db, org_id, user["id"])

    event_ref = db.collection("events").document(req.event_id)
    event_doc = event_ref.get()
    if not event_doc.exists:
        raise HTTPException(status_code=404, detail="Event not found")
    ev = event_doc.to_dict()
    if ev.get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Event not found")

    if not ev.get("is_paid"):
        raise HTTPException(status_code=400, detail="This is a free event")
    price = ev.get("price")
    if price is None or float(price) <= 0:
        raise HTTPException(status_code=400, detail="Invalid ticket price")

    max_attendees = ev.get("max_attendees")
    tickets_sold = ev.get("tickets_sold") or 0
    if max_attendees is not None and tickets_sold + req.quantity > max_attendees:
        raise HTTPException(status_code=400, detail="Not enough tickets available")

    org_doc = db.collection("organizations").document(org_id).get()
    org_name = org_doc.to_dict().get("name", "Organization") if org_doc.exists else "Organization"

    stripe_key = os.getenv("STRIPE_SECRET_KEY")
    if not stripe_key:
        raise HTTPException(status_code=503, detail="Payments are not configured")

    import stripe
    stripe.api_key = stripe_key
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    price_cents = int(round(float(price) * 100))
    start_time = ev.get("start_time") or ev.get("event_date") or ""

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="payment",
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "unit_amount": price_cents,
                    "product_data": {
                        "name": f"Ticket: {ev.get('title', 'Event')}",
                        "description": f"Event by {org_name}",
                        "images": _stripe_safe_image_url(ev.get("cover_image")),
                    },
                },
                "quantity": req.quantity,
            }],
            metadata={
                "type": "event_ticket",
                "event_id": req.event_id,
                "organization_id": org_id,
                "user_id": user["id"],
                "user_email": user.get("email", ""),
                "user_name": (user.get("name") or user.get("email") or "").strip(),
                "quantity": str(req.quantity),
                "event_title": ev.get("title", ""),
                "event_start_time": start_time.isoformat() if hasattr(start_time, "isoformat") else str(start_time),
                "event_location": ev.get("location", ""),
                "organization_name": org_name,
            },
            customer_email=user.get("email"),
            success_url=f"{frontend_url}/org/{org_id}/calendar/{req.event_id}?payment=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{frontend_url}/org/{org_id}/calendar/{req.event_id}?payment=cancelled",
        )
        return {"checkout_url": session.url, "session_id": session.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{org_id}/checkout")
def create_dues_checkout(
    org_id: str,
    req: CheckoutRequest,
    user: dict = Depends(get_current_user),
):
    """Create Stripe checkout session for dues. Returns checkout URL."""
    db = get_firestore()
    member_docs = list(
        db.collection("members")
        .where("user_id", "==", user["id"])
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .get()
    )
    if not member_docs:
        raise HTTPException(status_code=404, detail="Organization not found")
    member_id = member_docs[0].id

    plan_doc = db.collection("dues_plans").document(req.plan_id).get()
    if not plan_doc.exists:
        raise HTTPException(status_code=404, detail="Plan not found")
    pd = plan_doc.to_dict()
    if pd.get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Plan not found")

    import os
    stripe_key = os.getenv("STRIPE_SECRET_KEY")
    if stripe_key:
        try:
            import stripe
            stripe.api_key = stripe_key
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[{
                    "price_data": {
                        "currency": "usd",
                        "product_data": {"name": pd.get("name", "Dues")},
                        "unit_amount": int(float(pd.get("amount", 0)) * 100),
                    },
                    "quantity": 1,
                }],
                mode="payment",
                success_url=f"{req.origin_url}?session_id={{CHECKOUT_SESSION_ID}}&success=1",
                cancel_url=req.origin_url,
                metadata={
                    "org_id": org_id,
                    "member_id": member_id,
                    "plan_id": req.plan_id,
                    "user_id": user["id"],
                },
            )
            return {"checkout_url": session.url, "session_id": session.id}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # No Stripe configured - create mock pending payment for demo
    session_id = f"mock_{generate_uuid()}"
    db.collection("payment_sessions").document(session_id).set({
        "org_id": org_id,
        "member_id": member_id,
        "plan_id": req.plan_id,
        "amount": pd.get("amount", 0),
        "user_id": user["id"],
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
    })
    return {
        "checkout_url": f"{req.origin_url}?session_id={session_id}&success=1",
        "session_id": session_id,
    }


@router.get("/{org_id}/checkout/status/{session_id}")
def get_checkout_status(
    org_id: str,
    session_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Verify Stripe checkout session and record payment."""
    db = get_firestore()
    if session_id.startswith("mock_"):
        # Mock session - mark as completed for demo
        sess_ref = db.collection("payment_sessions").document(session_id)
        sess_doc = sess_ref.get()
        if sess_doc.exists:
            sd = sess_doc.to_dict()
            if sd.get("user_id") == user_id and sd.get("org_id") == org_id:
                # Record payment
                payment_id = generate_uuid()
                now = datetime.now(timezone.utc)
                db.collection("payments").document(payment_id).set({
                    "id": payment_id,
                    "organization_id": org_id,
                    "member_id": sd.get("member_id"),
                    "plan_id": sd.get("plan_id"),
                    "amount": sd.get("amount", 0),
                    "payment_method": "stripe",
                    "stripe_session_id": session_id,
                    "recorded_by": user_id,
                    "created_at": now,
                })
                sess_ref.update({"status": "completed"})
                return {"status": "completed", "payment_id": payment_id}
        return {"status": "pending"}

    import os
    stripe_key = os.getenv("STRIPE_SECRET_KEY")
    if stripe_key:
        try:
            import stripe
            stripe.api_key = stripe_key
            session = stripe.checkout.Session.retrieve(session_id)
            if session.payment_status == "paid" and session.metadata:
                meta = session.metadata
                if meta.get("org_id") == org_id and meta.get("user_id") == user_id:
                    payment_id = generate_uuid()
                    now = datetime.now(timezone.utc)
                    db.collection("payments").document(payment_id).set({
                        "id": payment_id,
                        "organization_id": org_id,
                        "member_id": meta.get("member_id"),
                        "plan_id": meta.get("plan_id"),
                        "amount": float(session.amount_total or 0) / 100,
                        "payment_method": "stripe",
                        "stripe_payment_id": session.payment_intent,
                        "recorded_by": user_id,
                        "created_at": now,
                    })
                    return {"status": "completed", "payment_id": payment_id}
        except Exception:
            pass
    return {"status": "pending"}


# --- Confirm event ticket (create from session if webhook missed) ---


@router.post("/{org_id}/confirm-event-ticket")
def confirm_event_ticket(
    org_id: str,
    session_id: str = Query(..., description="Stripe Checkout session ID from redirect"),
    user_id: str = Depends(get_current_user_id),
):
    """After Stripe redirect: ensure ticket exists for this session (idempotent). Use when webhook may not have run yet."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    stripe_key = os.getenv("STRIPE_SECRET_KEY")
    if not stripe_key:
        return {"ok": True, "created": False}

    import stripe
    stripe.api_key = stripe_key
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except Exception:
        return {"ok": True, "created": False}

    if session.payment_status != "paid":
        return {"ok": True, "created": False}
    meta = session.get("metadata") or {}
    if meta.get("type") != "event_ticket" or meta.get("organization_id") != org_id or meta.get("user_id") != user_id:
        return {"ok": True, "created": False}

    _handle_event_ticket_purchase(session, db)
    return {"ok": True, "created": True}


# --- My Tickets (member's own tickets) ---


@router.get("/{org_id}/my-tickets")
def list_my_tickets(
    org_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """List current user's event tickets for this organization. Any approved member."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    tickets = list(
        db.collection("event_tickets")
        .where("organization_id", "==", org_id)
        .where("user_id", "==", user_id)
        .stream()
    )
    event_ids = list({t.to_dict().get("event_id") for t in tickets if t.to_dict().get("event_id") is not None})
    events_map = {}
    for eid in event_ids:
        ed = db.collection("events").document(eid).get()
        if ed.exists:
            events_map[eid] = ed.to_dict()
    org_doc = db.collection("organizations").document(org_id).get()
    org_name = org_doc.to_dict().get("name", "Organization") if org_doc.exists else "Organization"

    out = []
    for t in tickets:
        td = t.to_dict()
        short_code = _ensure_ticket_short_code(db, t.reference, org_id, td)
        eid = td.get("event_id")
        ev = events_map.get(eid) or {}
        start_time = ev.get("start_time") or ev.get("event_date") or ""
        out.append({
            "ticket_id": td.get("ticket_id") or t.id,
            "short_code": short_code,
            "event_id": eid,
            "event_title": ev.get("title", "Event"),
            "event_start_time": start_time,
            "event_end_time": ev.get("end_time"),
            "event_location": ev.get("location"),
            "event_cover_image": ev.get("cover_image"),
            "organization_id": org_id,
            "organization_name": org_name,
            "status": td.get("status", "valid"),
            "checked_in": td.get("checked_in", False),
            "checked_in_at": td.get("checked_in_at"),
            "amount": td.get("amount", 0),
            "qr_code": td.get("qr_code"),
            "purchased_at": td.get("created_at"),
        })
    out.sort(key=lambda x: (x.get("event_start_time") or ""))
    return out


# --- Single ticket (for detail/QR page) ---


@router.get("/{org_id}/tickets/{ticket_id}")
def get_ticket(
    org_id: str,
    ticket_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Get a single ticket by ID. User must own the ticket or be org admin."""
    db = get_firestore()
    member = _require_org_member(db, org_id, user_id)
    role = member.to_dict().get("role", "member")

    doc = db.collection("event_tickets").document(ticket_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Ticket not found")
    td = doc.to_dict()
    if td.get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if td.get("user_id") != user_id and role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized to view this ticket")

    short_code = _ensure_ticket_short_code(db, doc.reference, org_id, td)
    ev = db.collection("events").document(td.get("event_id", "")).get()
    ev_data = ev.to_dict() if ev.exists else {}
    return {
        "ticket_id": td.get("ticket_id") or doc.id,
        "short_code": short_code,
        "event_id": td.get("event_id"),
        "event_title": ev_data.get("title", "Event"),
        "event_start_time": ev_data.get("start_time") or ev_data.get("event_date"),
        "event_end_time": ev_data.get("end_time"),
        "event_location": ev_data.get("location"),
        "event_cover_image": ev_data.get("cover_image"),
        "organization_id": org_id,
        "organization_name": (db.collection("organizations").document(org_id).get().to_dict() or {}).get("name", "Organization"),
        "status": td.get("status", "valid"),
        "checked_in": td.get("checked_in", False),
        "checked_in_at": td.get("checked_in_at"),
        "amount": td.get("amount", 0),
        "amount_cents": td.get("amount_cents"),
        "quantity": td.get("quantity", 1),
        "purchased_at": td.get("created_at"),
        "qr_code": td.get("qr_code"),
    }


# --- Event ticket check-in & refunds (Event Options page) ---

def _require_admin_or_owner(db, org_id: str, user_id: str):
    members = list(
        db.collection("members")
        .where("user_id", "==", user_id)
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .limit(1)
        .get()
    )
    if not members:
        raise HTTPException(status_code=404, detail="Organization not found")
    role = members[0].to_dict().get("role", "member")
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin or owner access required")
    return role


@router.get("/{org_id}/events/{event_id}/attendees")
def list_event_attendees(
    org_id: str,
    event_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """List paid ticket holders for an event. Admin/owner only."""
    db = get_firestore()
    _require_admin_or_owner(db, org_id, user_id)

    event_doc = db.collection("events").document(event_id).get()
    if not event_doc.exists or event_doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Event not found")

    tickets = list(
        db.collection("event_tickets")
        .where("event_id", "==", event_id)
        .where("organization_id", "==", org_id)
        .stream()
    )
    out = []
    for t in tickets:
        td = t.to_dict()
        short_code = _ensure_ticket_short_code(db, t.reference, org_id, td)
        uid = td.get("user_id")
        user_name = user_email = nickname = "Unknown"
        if uid:
            user_doc = db.collection("users").document(uid).get()
            if user_doc.exists:
                ud = user_doc.to_dict()
                user_name = ud.get("name") or ud.get("email") or "Unknown"
                user_email = ud.get("email") or ""
            member_docs = list(
                db.collection("members")
                .where("user_id", "==", uid)
                .where("organization_id", "==", org_id)
                .limit(1)
                .get()
            )
            if member_docs:
                nickname = (member_docs[0].to_dict().get("nickname") or "").strip() or user_name
        out.append({
            "ticket_id": td.get("ticket_id") or t.id,
            "short_code": short_code,
            "user_id": uid,
            "user_name": user_name,
            "user_email": user_email,
            "nickname": nickname,
            "amount": td.get("amount", 0),
            "status": td.get("status", "valid"),
            "checked_in": td.get("checked_in", False),
            "checked_in_at": td.get("checked_in_at"),
            "refunded_at": td.get("refunded_at"),
            "purchased_at": td.get("created_at"),
        })
    out.sort(key=lambda x: (x.get("purchased_at") or ""))
    return out


class CheckInRequest(BaseModel):
    ticket_id: str
    event_id: str


@router.post("/{org_id}/tickets/check-in")
def check_in_ticket(
    org_id: str,
    req: CheckInRequest,
    user: dict = Depends(get_current_user),
):
    """Check in a ticket by ID. Admin/owner only."""
    db = get_firestore()
    _require_admin_or_owner(db, org_id, user["id"])

    ticket_id_raw = (req.ticket_id or "").strip()
    if not ticket_id_raw:
        raise HTTPException(status_code=400, detail="Ticket ID required")

    tickets = list(db.collection("event_tickets").where("organization_id", "==", org_id).stream())
    ticket_doc = None
    # Accept short code (e.g. A3K9X2) or full ticket ID
    is_likely_short_code = (
        len(ticket_id_raw) <= 8
        and "-" not in ticket_id_raw
        and ticket_id_raw.isalnum()
    )
    for t in tickets:
        td = t.to_dict()
        tid = td.get("ticket_id") or t.id
        short_code = (td.get("short_code") or "").upper()
        raw_upper = ticket_id_raw.upper()
        if is_likely_short_code and short_code and raw_upper == short_code:
            ticket_doc = (t, td)
            break
        if tid == ticket_id_raw or (len(ticket_id_raw) >= 8 and (ticket_id_raw in tid or tid.startswith(ticket_id_raw[:8]))):
            ticket_doc = (t, td)
            break
    if not ticket_doc:
        raise HTTPException(status_code=404, detail="Ticket not found")

    t, td = ticket_doc
    if td.get("event_id") != req.event_id:
        raise HTTPException(status_code=400, detail="Ticket is for a different event")
    if td.get("status") == "refunded":
        raise HTTPException(status_code=400, detail="Ticket has been refunded")
    if td.get("checked_in"):
        raise HTTPException(
            status_code=400,
            detail="Ticket already checked in",
        )

    now = datetime.now(timezone.utc)
    db.collection("event_tickets").document(t.id).update({
        "checked_in": True,
        "checked_in_at": now,
        "checked_in_by": user["id"],
        "status": "checked_in",
        "updated_at": now,
    })

    uid = td.get("user_id")
    user_name = "Attendee"
    if uid:
        user_doc = db.collection("users").document(uid).get()
        if user_doc.exists:
            user_name = (user_doc.to_dict().get("name") or user_doc.to_dict().get("email") or "Attendee")
    return {"success": True, "message": "Ticket checked in successfully", "attendee_name": user_name}


class RefundRequest(BaseModel):
    reason: Optional[str] = None


@router.post("/{org_id}/tickets/{ticket_id}/refund")
def refund_ticket(
    org_id: str,
    ticket_id: str,
    req: RefundRequest,
    user: dict = Depends(get_current_user),
):
    """Process refund for a ticket. Admin/owner only."""
    db = get_firestore()
    _require_admin_or_owner(db, org_id, user["id"])

    tickets = list(
        db.collection("event_tickets")
        .where("organization_id", "==", org_id)
        .stream()
    )
    ticket_doc = None
    for t in tickets:
        if (t.to_dict().get("ticket_id") or t.id) == ticket_id or t.id == ticket_id:
            ticket_doc = t
            break
    if not ticket_doc:
        raise HTTPException(status_code=404, detail="Ticket not found")

    td = ticket_doc.to_dict()
    if td.get("status") == "refunded":
        raise HTTPException(status_code=400, detail="Ticket was already refunded")

    now = datetime.now(timezone.utc)
    updates = {
        "status": "refunded",
        "refunded_at": now,
        "refunded_by": user["id"],
        "refund_reason": (req.reason or "").strip() or None,
        "updated_at": now,
    }
    stripe_id = td.get("stripe_payment_intent_id") or td.get("stripe_checkout_session_id")
    if stripe_id:
        import os
        stripe_key = os.getenv("STRIPE_SECRET_KEY")
        if stripe_key:
            try:
                import stripe
                stripe.api_key = stripe_key
                stripe.Refund.create(payment_intent=stripe_id, reason="requested_by_customer")
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Refund failed: {str(e)}")
    db.collection("event_tickets").document(ticket_doc.id).update(updates)
    return {"success": True, "message": "Refund processed successfully"}


# --- Stripe webhook (event ticket purchase) ---


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook for checkout.session.completed (event tickets). Raw body required for signature verification."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not webhook_secret:
        return JSONResponse(content={"detail": "Webhook not configured"}, status_code=503)

    import stripe
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError:
        return JSONResponse(content={"detail": "Invalid payload"}, status_code=400)
    except stripe.SignatureVerificationError:
        return JSONResponse(content={"detail": "Invalid signature"}, status_code=400)

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata") or {}
        if metadata.get("type") != "event_ticket":
            return {"status": "ok"}
        _handle_event_ticket_purchase(session, get_firestore())

    return {"status": "ok"}


def _handle_event_ticket_purchase(session: dict, db):
    """Create event_ticket doc and increment event tickets_sold. Idempotent on session id."""
    session_id = session.get("id")
    if session_id:
        existing = list(
            db.collection("event_tickets")
            .where("stripe_checkout_session_id", "==", session_id)
            .limit(1)
            .stream()
        )
        if existing:
            return

    metadata = session.get("metadata") or {}
    event_id = metadata.get("event_id")
    org_id = metadata.get("organization_id")
    user_id = metadata.get("user_id")
    quantity = int(metadata.get("quantity") or 1)

    if not event_id or not org_id or not user_id:
        return

    event_ref = db.collection("events").document(event_id)
    event_doc = event_ref.get()
    if not event_doc.exists or event_doc.to_dict().get("organization_id") != org_id:
        return

    ticket_id = generate_uuid()
    short_code = _generate_short_code(db, org_id)
    amount_total = session.get("amount_total") or 0
    now = datetime.now(timezone.utc)

    db.collection("event_tickets").document(ticket_id).set({
        "ticket_id": ticket_id,
        "short_code": short_code,
        "event_id": event_id,
        "organization_id": org_id,
        "user_id": user_id,
        "status": "valid",
        "checked_in": False,
        "amount": amount_total / 100.0,
        "amount_cents": amount_total,
        "quantity": quantity,
        "stripe_checkout_session_id": session.get("id"),
        "stripe_payment_intent_id": session.get("payment_intent"),
        "created_at": now,
        "updated_at": now,
    })

    ev = event_doc.to_dict()
    tickets_sold = (ev.get("tickets_sold") or 0) + quantity
    event_ref.update({"tickets_sold": tickets_sold})
