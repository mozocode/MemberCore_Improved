"""Dues API - status, plans."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.db.firebase import get_firestore
from app.core.security import get_current_user, get_current_user_id, generate_uuid

router = APIRouter()


class CreatePlanRequest(BaseModel):
    name: str
    amount: float  # minimum/installment amount (e.g. $100/month)
    total_amount: Optional[float] = None  # full amount for paid-in-full (e.g. $1200). If omitted, amount is used.
    due_date: Optional[str] = None
    frequency: str = "one_time"  # one_time, monthly, annual
    payment_option: str = "full_only"  # "full_only" | "custom_only" – one button on member dues page


class UpdatePlanRequest(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    total_amount: Optional[float] = None
    due_date: Optional[str] = None
    frequency: Optional[str] = None
    payment_option: Optional[str] = None  # "full_only" | "custom_only"


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
    return members[0].to_dict()


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


@router.get("/{org_id}/my-status")
def get_my_dues_status(
    org_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Get member's dues status and plans."""
    db = get_firestore()
    member = _require_org_member(db, org_id, user_id)
    member_id = member.get("id")
    # Resolve member doc id if needed
    member_docs = list(
        db.collection("members")
        .where("user_id", "==", user_id)
        .where("organization_id", "==", org_id)
        .get()
    )
    member_id = member_docs[0].id if member_docs else None

    # Get member doc for dues_paid_in_full (manual override by org owner)
    dues_paid_in_full = False
    if member_id:
        member_doc = db.collection("members").document(member_id).get()
        if member_doc.exists:
            dues_paid_in_full = member_doc.to_dict().get("dues_paid_in_full", False)

    # Get dues plans
    plan_docs = list(
        db.collection("dues_plans")
        .where("organization_id", "==", org_id)
        .where("is_active", "==", True)
        .stream()
    )
    plans = []
    for doc in plan_docs:
        pd = doc.to_dict()
        pd["id"] = doc.id
        plans.append(pd)

    # Get member's payments
    payment_docs = list(
        db.collection("payments")
        .where("organization_id", "==", org_id)
        .where("member_id", "==", member_id)
        .stream()
    )
    total_paid = sum(p.to_dict().get("amount", 0) for p in payment_docs)
    payments = [{"id": p.id, **p.to_dict()} for p in payment_docs]

    # total_required = sum of total_amount (or amount if no total_amount) per plan
    def plan_total(p):
        return p.get("total_amount") if p.get("total_amount") is not None else p.get("amount", 0)

    total_required = sum(plan_total(p) for p in plans)

    # Status: paid_in_full only if owner manually marked OR total_paid >= total_required
    status = "none"
    if total_paid > 0:
        status = "paid"
    if plans and total_required > 0:
        if dues_paid_in_full or total_paid >= total_required:
            status = "paid_in_full"
        elif total_paid > 0 and total_paid < total_required:
            status = "partial"
        else:
            status = "pending"

    return {
        "status": status,
        "total_paid": total_paid,
        "plans": plans,
        "payment_history": payments,
        "member_id": member_id,
    }


@router.post("/{org_id}/plans")
def create_dues_plan(
    org_id: str,
    req: CreatePlanRequest,
    user: dict = Depends(get_current_user),
):
    """Create dues plan. Admin/owner only."""
    db = get_firestore()
    member = list(
        db.collection("members")
        .where("user_id", "==", user["id"])
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .limit(1)
        .get()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Organization not found")
    role = member[0].to_dict().get("role", "member")
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin or owner access required")

    plan_id = generate_uuid()
    now = datetime.now(timezone.utc)
    payment_option = (req.payment_option or "full_only").strip().lower()
    if payment_option not in ("full_only", "custom_only"):
        payment_option = "full_only"
    plan_data = {
        "id": plan_id,
        "organization_id": org_id,
        "name": req.name.strip(),
        "amount": float(req.amount),
        "due_date": req.due_date,
        "frequency": req.frequency,
        "payment_option": payment_option,
        "is_active": True,
        "created_at": now,
    }
    if req.total_amount is not None:
        plan_data["total_amount"] = float(req.total_amount)
    db.collection("dues_plans").document(plan_id).set(plan_data)
    return {"id": plan_id, "ok": True}


@router.put("/{org_id}/plans/{plan_id}")
def update_dues_plan(
    org_id: str,
    plan_id: str,
    req: UpdatePlanRequest,
    user: dict = Depends(get_current_user),
):
    """Update dues plan. Admin/owner only."""
    db = get_firestore()
    _require_admin_or_owner(db, org_id, user["id"])

    plan_ref = db.collection("dues_plans").document(plan_id)
    plan_doc = plan_ref.get()
    if not plan_doc.exists or plan_doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Plan not found")

    updates = {}
    if req.name is not None:
        updates["name"] = req.name.strip()
    if req.amount is not None:
        updates["amount"] = float(req.amount)
    if req.total_amount is not None:
        updates["total_amount"] = float(req.total_amount)
    if req.due_date is not None:
        updates["due_date"] = req.due_date or None
    if req.frequency is not None:
        updates["frequency"] = req.frequency
    if req.payment_option is not None:
        po = req.payment_option.strip().lower()
        updates["payment_option"] = po if po in ("full_only", "custom_only") else "full_only"
    if not updates:
        return {"ok": True}

    updates["updated_at"] = datetime.now(timezone.utc)
    plan_ref.update(updates)
    return {"ok": True}


@router.get("/{org_id}/plans")
def list_dues_plans(
    org_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """List available dues plans."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    docs = list(
        db.collection("dues_plans")
        .where("organization_id", "==", org_id)
        .where("is_active", "==", True)
        .stream()
    )
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


# --- Treasury (admin/owner) ---

@router.get("/{org_id}/treasury")
def get_treasury_stats(
    org_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Treasury stats for dashboard. Admin/owner only."""
    db = get_firestore()
    _require_admin_or_owner(db, org_id, user_id)

    payment_docs = list(
        db.collection("payments")
        .where("organization_id", "==", org_id)
        .stream()
    )
    total_collected = sum(p.to_dict().get("amount", 0) for p in payment_docs)

    plan_docs = list(
        db.collection("dues_plans")
        .where("organization_id", "==", org_id)
        .where("is_active", "==", True)
        .stream()
    )

    def plan_total(p):
        d = p.to_dict()
        return d.get("total_amount") if d.get("total_amount") is not None else d.get("amount", 0)

    total_required = sum(plan_total(p) for p in plan_docs)

    member_docs = list(
        db.collection("members")
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .stream()
    )
    paid_count = 0
    paid_in_full_count = 0
    pending_count = 0
    past_due_count = 0
    for m in member_docs:
        mid = m.id
        md = m.to_dict()
        member_payments = [p for p in payment_docs if p.to_dict().get("member_id") == mid]
        total_paid = sum(p.to_dict().get("amount", 0) for p in member_payments)
        marked_full = md.get("dues_paid_in_full", False)
        if total_paid > 0:
            paid_count += 1
        if marked_full or (total_required > 0 and total_paid >= total_required):
            paid_in_full_count += 1
        elif total_required > 0 and total_paid < total_required and total_paid > 0:
            pending_count += 1
        elif total_required > 0 and total_paid == 0:
            past_due_count += 1

    return {
        "total_collected": round(total_collected, 2),
        "paid_count": paid_count,
        "paid_in_full_count": paid_in_full_count,
        "pending_count": pending_count,
        "past_due_count": past_due_count,
    }


@router.get("/{org_id}/member-status")
def get_member_status(
    org_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """All members' payment status for treasury list. Admin/owner only."""
    db = get_firestore()
    _require_admin_or_owner(db, org_id, user_id)

    plan_docs = list(
        db.collection("dues_plans")
        .where("organization_id", "==", org_id)
        .where("is_active", "==", True)
        .stream()
    )

    def plan_total(p):
        d = p.to_dict()
        return d.get("total_amount") if d.get("total_amount") is not None else d.get("amount", 0)

    total_required = sum(plan_total(p) for p in plan_docs)

    payment_docs = list(
        db.collection("payments")
        .where("organization_id", "==", org_id)
        .stream()
    )

    member_docs = list(
        db.collection("members")
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .stream()
    )
    out = []
    for m in member_docs:
        mid = m.id
        md = m.to_dict()
        uid = md.get("user_id")
        member_payments = [p for p in payment_docs if p.to_dict().get("member_id") == mid]
        total_paid = sum(p.to_dict().get("amount", 0) for p in member_payments)
        marked_full = md.get("dues_paid_in_full", False)
        if marked_full or (total_required > 0 and total_paid >= total_required):
            status = "paid_in_full"
        elif total_paid > 0:
            status = "paid"
        elif total_required > 0:
            status = "pending"
        else:
            status = "none"
        user_name = user_email = "Unknown"
        if uid:
            ud = db.collection("users").document(uid).get().to_dict() or {}
            user_name = ud.get("name") or ud.get("email") or "Unknown"
            user_email = ud.get("email") or ""
        out.append({
            "member_id": mid,
            "user_id": uid,
            "user_name": user_name,
            "user_email": user_email,
            "nickname": md.get("nickname"),
            "title": md.get("title"),
            "total_paid": round(total_paid, 2),
            "paid_in_full": marked_full or (total_required > 0 and total_paid >= total_required),
            "status": status,
        })
    return out


class ManualPaymentRequest(BaseModel):
    member_id: str
    plan_id: Optional[str] = None
    amount: float
    paid_date: Optional[str] = None  # ISO date
    payment_method: str = "other"  # cash, check, venmo, zelle, other
    notes: Optional[str] = None
    mark_paid_in_full: bool = False


@router.post("/{org_id}/manual-payment")
def record_manual_payment(
    org_id: str,
    req: ManualPaymentRequest,
    user: dict = Depends(get_current_user),
):
    """Record an off-platform payment. Admin/owner only."""
    db = get_firestore()
    _require_admin_or_owner(db, org_id, user["id"])

    member_ref = db.collection("members").document(req.member_id)
    member_doc = member_ref.get()
    if not member_doc.exists or member_doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Member not found")

    now = datetime.now(timezone.utc)
    paid_date = req.paid_date or now.strftime("%Y-%m-%d")
    payment_id = generate_uuid()
    db.collection("payments").document(payment_id).set({
        "id": payment_id,
        "organization_id": org_id,
        "member_id": req.member_id,
        "plan_id": req.plan_id,
        "amount": float(req.amount),
        "payment_method": (req.payment_method or "other").lower(),
        "notes": req.notes,
        "paid_date": paid_date,
        "recorded_by": user["id"],
        "created_at": now,
    })
    if req.mark_paid_in_full:
        member_ref.update({"dues_paid_in_full": True, "updated_at": now})
    return {"id": payment_id, "ok": True}


class MarkPaidInFullRequest(BaseModel):
    member_id: str
    paid_in_full: bool


@router.post("/{org_id}/mark-paid-in-full")
def mark_paid_in_full(
    org_id: str,
    req: MarkPaidInFullRequest,
    user: dict = Depends(get_current_user),
):
    """Set member's paid-in-full flag. Admin/owner only."""
    db = get_firestore()
    _require_admin_or_owner(db, org_id, user["id"])

    member_ref = db.collection("members").document(req.member_id)
    member_doc = member_ref.get()
    if not member_doc.exists or member_doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Member not found")

    member_ref.update({
        "dues_paid_in_full": req.paid_in_full,
        "dues_paid_in_full_updated_by": user["id"],
        "updated_at": datetime.now(timezone.utc),
    })
    return {"ok": True}


@router.post("/{org_id}/remind")
def send_reminders(
    org_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Send payment reminders. Admin/owner only. Stub for now."""
    db = get_firestore()
    _require_admin_or_owner(db, org_id, user_id)
    return {"ok": True, "message": "Reminders sent"}
