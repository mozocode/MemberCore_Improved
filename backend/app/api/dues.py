"""Dues API - status, plans."""
from datetime import datetime, timezone, date
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.db.firebase import get_firestore
from app.core.security import get_current_user, get_current_user_id, generate_uuid

router = APIRouter()


def _plans_marked_paid_in_full(md: dict) -> dict:
    """Firestore map: plan_id -> True when treasury marked that plan satisfied (promo / early-pay)."""
    raw = md.get("dues_plans_paid_in_full") or {}
    if not isinstance(raw, dict):
        return {}
    return {str(k): bool(v) for k, v in raw.items() if v}


def _plan_balance_row(
    pid: str,
    pd: dict,
    member_payments: list,
    plans_marked: dict,
):
    """One plan row for member-status / my-status."""
    cap_raw = pd.get("total_amount") if pd.get("total_amount") is not None else pd.get("amount", 0)
    try:
        cap = float(cap_raw) if cap_raw is not None else 0.0
    except (TypeError, ValueError):
        cap = 0.0
    paid_to_plan = sum(
        float((x.to_dict() or {}).get("amount", 0) or 0)
        for x in member_payments
        if (x.to_dict() or {}).get("plan_id") == pid
    )
    plan_marked = bool(plans_marked.get(pid))
    math_full = cap > 0 and paid_to_plan >= cap
    paid_full = math_full or plan_marked
    return {
        "plan_id": pid,
        "plan_name": (pd.get("name") or "Plan").strip(),
        "total": round(cap, 2),
        "paid": round(paid_to_plan, 2),
        "paid_in_full": paid_full,
        "plan_marked_paid_in_full": plan_marked,
    }


class CreatePlanRequest(BaseModel):
    name: str
    amount: float  # minimum/installment amount (e.g. $100/month)
    total_amount: Optional[float] = None  # full amount for paid-in-full (e.g. $1200). If omitted, amount is used.
    due_date: Optional[str] = None
    frequency: str = "one_time"  # one_time, monthly, annual
    payment_option: str = "full_only"  # "full_only" | "custom_only" | "installment_only"
    installment_months: Optional[int] = None  # e.g. 10 months or 12 months


class UpdatePlanRequest(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    total_amount: Optional[float] = None
    due_date: Optional[str] = None
    frequency: Optional[str] = None
    payment_option: Optional[str] = None  # "full_only" | "custom_only" | "installment_only"
    installment_months: Optional[int] = None


def _months_until_due_date(due_date_raw: Optional[str]) -> Optional[int]:
    """Inclusive month count from current month to due date month."""
    if not due_date_raw:
        return None
    try:
        due_date = date.fromisoformat(str(due_date_raw)[:10])
    except Exception:
        return None
    today = datetime.now(timezone.utc).date()
    if due_date < today:
        return None
    return ((due_date.year - today.year) * 12) + (due_date.month - today.month) + 1


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

    dues_paid_in_full = False
    member_dict = {}
    if member_id:
        member_doc = db.collection("members").document(member_id).get()
        if member_doc.exists:
            member_dict = member_doc.to_dict() or {}
            dues_paid_in_full = member_dict.get("dues_paid_in_full", False)

    plans_marked = _plans_marked_paid_in_full(member_dict)

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

    plan_balances = [_plan_balance_row(p["id"], p, payment_docs, plans_marked) for p in plans]

    # Status: paid_in_full if member marked, totals met, or every active plan is satisfied (incl. per-plan marks)
    status = "none"
    if total_paid > 0:
        status = "paid"
    if plans and total_required > 0:
        every_plan_ok = plan_balances and all(row["paid_in_full"] for row in plan_balances)
        if dues_paid_in_full or total_paid >= total_required or every_plan_ok:
            status = "paid_in_full"
        elif total_paid > 0 and total_paid < total_required:
            status = "partial"
        else:
            status = "pending"

    return {
        "status": status,
        "dues_paid_in_full": dues_paid_in_full,
        "total_paid": total_paid,
        "plans": plans,
        "plan_balances": plan_balances,
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
    if payment_option not in ("full_only", "custom_only", "installment_only"):
        payment_option = "full_only"

    total_amount = float(req.total_amount) if req.total_amount is not None else None
    installment_months = int(req.installment_months) if req.installment_months is not None else None
    amount = float(req.amount)
    frequency = req.frequency

    if payment_option == "installment_only" or installment_months is not None:
        if total_amount is None or total_amount <= 0:
            raise HTTPException(
                status_code=400,
                detail="Total amount is required for installment plans",
            )
        if installment_months is None:
            installment_months = _months_until_due_date(req.due_date)
        if installment_months is None or installment_months <= 0:
            raise HTTPException(
                status_code=400,
                detail="Set installment months, or set a valid future due date to auto-calculate months",
            )
        # Organization chooses total + months (e.g. 1000 / 10, 1000 / 12).
        amount = round(total_amount / installment_months, 2)
        frequency = "monthly"
        payment_option = "installment_only"

    plan_data = {
        "id": plan_id,
        "organization_id": org_id,
        "name": req.name.strip(),
        "amount": amount,
        "due_date": req.due_date,
        "frequency": frequency,
        "payment_option": payment_option,
        "is_active": True,
        "created_at": now,
    }
    if total_amount is not None:
        plan_data["total_amount"] = total_amount
    if installment_months is not None:
        plan_data["installment_months"] = installment_months
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
        updates["payment_option"] = po if po in ("full_only", "custom_only", "installment_only") else "full_only"
    existing = plan_doc.to_dict() or {}
    target_payment_option = updates.get("payment_option", existing.get("payment_option", "full_only"))
    target_months = None
    if req.installment_months is not None:
        target_months = int(req.installment_months)
        if target_months <= 0:
            raise HTTPException(status_code=400, detail="installment_months must be greater than 0")
    elif target_payment_option == "installment_only":
        target_months = existing.get("installment_months")
        if not target_months and req.due_date is not None:
            target_months = _months_until_due_date(req.due_date or existing.get("due_date"))

    if target_payment_option == "installment_only":
        effective_total = req.total_amount
        if effective_total is None:
            existing_total = existing.get("total_amount")
            if existing_total is not None:
                effective_total = float(existing_total)
        if effective_total is None or float(effective_total) <= 0:
            raise HTTPException(
                status_code=400,
                detail="Total amount is required for installment plans",
            )
        if not target_months:
            target_months = _months_until_due_date(req.due_date or existing.get("due_date"))
        if not target_months or int(target_months) <= 0:
            raise HTTPException(
                status_code=400,
                detail="Set installment months, or set a valid future due date to auto-calculate months",
            )
        target_months = int(target_months)
        updates["installment_months"] = target_months
        updates["total_amount"] = float(effective_total)
        updates["amount"] = round(float(effective_total) / target_months, 2)
        updates["frequency"] = "monthly"
        updates["payment_option"] = "installment_only"
    if not updates:
        return {"ok": True}

    updates["updated_at"] = datetime.now(timezone.utc)
    plan_ref.update(updates)
    return {"ok": True}


@router.delete("/{org_id}/plans/{plan_id}")
def delete_dues_plan(
    org_id: str,
    plan_id: str,
    user: dict = Depends(get_current_user),
):
    """Soft-delete a dues plan. Admin/owner only."""
    db = get_firestore()
    _require_admin_or_owner(db, org_id, user["id"])

    plan_ref = db.collection("dues_plans").document(plan_id)
    plan_doc = plan_ref.get()
    if not plan_doc.exists or plan_doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Plan not found")

    now = datetime.now(timezone.utc)
    plan_ref.update({
        "is_active": False,
        "updated_at": now,
        "deleted_at": now,
    })
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
        plans_marked = _plans_marked_paid_in_full(md)
        per_plan = []
        for pdoc in plan_docs:
            pd = pdoc.to_dict()
            pid = pdoc.id
            per_plan.append(_plan_balance_row(pid, pd, member_payments, plans_marked))
        if total_paid > 0:
            paid_count += 1
        if not plan_docs:
            fully_satisfied = bool(marked_full)
        else:
            every_plan_ok = all(p["paid_in_full"] for p in per_plan)
            fully_satisfied = marked_full or (total_required > 0 and total_paid >= total_required) or every_plan_ok
        if fully_satisfied:
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
        plans_marked = _plans_marked_paid_in_full(md)
        per_plan = []
        for pdoc in plan_docs:
            pd = pdoc.to_dict()
            pid = pdoc.id
            per_plan.append(_plan_balance_row(pid, pd, member_payments, plans_marked))
        if not plan_docs:
            paid_in_full_member = bool(marked_full)
        else:
            every_plan_ok = all(p["paid_in_full"] for p in per_plan)
            paid_in_full_member = marked_full or (total_required > 0 and total_paid >= total_required) or every_plan_ok
        if paid_in_full_member:
            status = "paid_in_full"
        elif total_paid > 0:
            status = "paid"
        elif total_required > 0:
            status = "pending"
        else:
            status = "none"
        user_name = user_email = "Unknown"
        user_avatar = None
        if uid:
            ud = db.collection("users").document(uid).get().to_dict() or {}
            user_name = ud.get("name") or ud.get("email") or "Unknown"
            user_email = ud.get("email") or ""
            user_avatar = ud.get("avatar")
        out.append({
            "member_id": mid,
            "user_id": uid,
            "user_name": user_name,
            "user_email": user_email,
            "user_avatar": user_avatar,
            "nickname": md.get("nickname"),
            "title": md.get("title"),
            "total_paid": round(total_paid, 2),
            "paid_in_full": paid_in_full_member,
            "dues_waived": bool(marked_full),
            "status": status,
            "plan_balances": per_plan,
        })
    return out


@router.get("/{org_id}/members/{member_id}/payments")
def get_member_payment_history(
    org_id: str,
    member_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Detailed payment history for one member in treasury. Admin/owner only."""
    db = get_firestore()
    _require_admin_or_owner(db, org_id, user_id)

    member_doc = db.collection("members").document(member_id).get()
    if not member_doc.exists or member_doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Member not found")

    payment_docs = list(
        db.collection("payments")
        .where("organization_id", "==", org_id)
        .where("member_id", "==", member_id)
        .stream()
    )

    plan_ids = {p.to_dict().get("plan_id") for p in payment_docs if p.to_dict().get("plan_id")}
    plan_names = {}
    for pid in plan_ids:
        pd = db.collection("dues_plans").document(pid).get()
        if pd.exists:
            plan_names[pid] = (pd.to_dict() or {}).get("name")

    out = []
    for p in payment_docs:
        d = p.to_dict() or {}
        out.append({
            "id": p.id,
            "amount": float(d.get("amount", 0)),
            "payment_method": d.get("payment_method", "other"),
            "paid_date": d.get("paid_date"),
            "created_at": d.get("created_at"),
            "notes": d.get("notes"),
            "plan_id": d.get("plan_id"),
            "plan_name": plan_names.get(d.get("plan_id")) if d.get("plan_id") else None,
            "plan_marked_paid_in_full": bool(d.get("plan_marked_paid_in_full")),
        })

    def _sort_key(row):
        created = row.get("created_at")
        if hasattr(created, "timestamp"):
            return (2, created.timestamp())
        paid = row.get("paid_date")
        if isinstance(paid, str):
            return (1, paid)
        return (0, "")

    out.sort(key=_sort_key, reverse=True)
    return out


@router.delete("/{org_id}/payments/{payment_id}")
def delete_payment_record(
    org_id: str,
    payment_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a payment record. Admin/owner only."""
    db = get_firestore()
    _require_admin_or_owner(db, org_id, user["id"])

    pay_ref = db.collection("payments").document(payment_id)
    pay_doc = pay_ref.get()
    if not pay_doc.exists:
        raise HTTPException(status_code=404, detail="Payment not found")
    pd = pay_doc.to_dict() or {}
    if pd.get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Payment not found")

    member_id = pd.get("member_id")
    plan_id = pd.get("plan_id")
    was_plan_marked = bool(pd.get("plan_marked_paid_in_full"))
    pay_ref.delete()

    # If this payment carried the per-plan mark, clear member map only when no other
    # marked payment remains for that same member+plan.
    if was_plan_marked and member_id and plan_id:
        member_ref = db.collection("members").document(member_id)
        member_doc = member_ref.get()
        if member_doc.exists:
            remaining_marked = list(
                db.collection("payments")
                .where("organization_id", "==", org_id)
                .where("member_id", "==", member_id)
                .where("plan_id", "==", plan_id)
                .where("plan_marked_paid_in_full", "==", True)
                .limit(1)
                .stream()
            )
            if not remaining_marked:
                md = member_doc.to_dict() or {}
                marks = _plans_marked_paid_in_full(md)
                if plan_id in marks:
                    marks.pop(plan_id, None)
                    member_ref.update({
                        "dues_plans_paid_in_full": marks,
                        "updated_at": datetime.now(timezone.utc),
                    })
    return {"ok": True, "id": payment_id}


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
    pay_payload = {
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
    }
    if req.mark_paid_in_full and req.plan_id:
        pay_payload["plan_marked_paid_in_full"] = True
    db.collection("payments").document(payment_id).set(pay_payload)

    if req.mark_paid_in_full and req.plan_id:
        member_ref.update({
            f"dues_plans_paid_in_full.{req.plan_id}": True,
            "updated_at": now,
        })
    elif req.mark_paid_in_full:
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
    """Send payment reminders (email + optional push + in-app inbox). Admin/owner only."""
    from app.core.dues_reminders import run_dues_reminders

    db = get_firestore()
    _require_admin_or_owner(db, org_id, user_id)
    try:
        return run_dues_reminders(db, org_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
