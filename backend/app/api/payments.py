"""Payments API - Stripe checkout for dues; event ticket check-in and refunds."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.db.firebase import get_firestore
from app.core.security import get_current_user_id, get_current_user, generate_uuid

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
    return members[0]


class CheckoutRequest(BaseModel):
    plan_id: str
    origin_url: str


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
        eid = td.get("event_id")
        ev = events_map.get(eid) or {}
        start_time = ev.get("start_time") or ev.get("event_date") or ""
        out.append({
            "ticket_id": td.get("ticket_id") or t.id,
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
    for t in tickets:
        td = t.to_dict()
        tid = td.get("ticket_id") or t.id
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
