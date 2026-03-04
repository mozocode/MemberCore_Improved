"""Platform Admin: Overview Dashboard."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query

from app.db.firebase import get_firestore
from app.core.security import require_platform_admin

router = APIRouter(dependencies=[Depends(require_platform_admin)])


@router.get("/verify")
def verify_admin_access(admin: dict = Depends(require_platform_admin)):
    """Verify current user has platform admin access."""
    return {"is_admin": True}


def _activation_score(org_dict: dict, member_count: int) -> int:
    """Score 0-5: members >= 1 (+1), >= 5 (+1), >= 10 (+1), has description (+1), has logo (+1)."""
    score = 0
    if member_count >= 1:
        score += 1
    if member_count >= 5:
        score += 1
    if member_count >= 10:
        score += 1
    if org_dict.get("description"):
        score += 1
    if org_dict.get("logo"):
        score += 1
    return min(score, 5)


@router.get("/overview")
def get_overview(admin: dict = Depends(require_platform_admin)):
    """Platform-wide metrics for admin dashboard (spec shape)."""
    db = get_firestore()
    now = datetime.utcnow()
    cutoff_7 = now - timedelta(days=7)
    cutoff_30 = now - timedelta(days=30)

    users = list(db.collection("users").stream())
    orgs = list(db.collection("organizations").stream())
    orgs_active = [o for o in orgs if not o.to_dict().get("is_deleted")]
    pro_orgs_list = [o for o in orgs_active if o.to_dict().get("is_pro")]

    # Users
    users_7d = sum(1 for u in users if (u.to_dict().get("created_at") or datetime.min) >= cutoff_7)
    # Clubs (orgs)
    clubs_7d = sum(1 for o in orgs_active if (o.to_dict().get("created_at") or datetime.min) >= cutoff_7)
    # Events
    events_docs = list(db.collection("events").stream())
    events_total = len(events_docs)

    # Activation: orgs with score >= 1 in last 14 days as "activated"
    cutoff_14 = now - timedelta(days=14)
    activated_count = 0
    activated_new = 0
    for o in orgs_active:
        od = o.to_dict()
        members = list(db.collection("members").where("organization_id", "==", o.id).get())
        mc = len(members)
        score = _activation_score(od, mc)
        if score >= 1:
            activated_count += 1
            created = od.get("created_at") or datetime.min
            if created >= cutoff_14:
                activated_new += 1
    activated_orgs_percent = round(100.0 * activated_count / len(orgs_active), 1) if orgs_active else 0.0

    # Trial → Pro (simplified: orgs that have is_pro and had trial_start_date in last 14d - we don't track conversions separately)
    trial_to_pro_trials = 0
    trial_to_pro_converted = 0
    for o in orgs_active:
        od = o.to_dict()
        if od.get("trial_start_date"):
            trial_to_pro_trials += 1
        if od.get("is_pro"):
            trial_to_pro_converted += 1
    # MRR / ARPA: placeholder without Stripe
    pro_mrr = 0.0
    arpa = 97.0 if pro_orgs_list else 0.0
    paid_payments_30d_count = 0
    paid_payments_30d_amount = 0.0
    try:
        payments_ref = db.collection("payments")
        for doc in payments_ref.stream():
            pd = doc.to_dict()
            created = pd.get("created_at") or pd.get("paid_at") or datetime.min
            if created >= cutoff_30 and pd.get("status") == "paid":
                paid_payments_30d_count += 1
                paid_payments_30d_amount += float(pd.get("amount", 0) or 0)
    except Exception:
        pass

    return {
        "pro_mrr": pro_mrr,
        "pro_orgs_count": len(pro_orgs_list),
        "trial_to_pro_converted": trial_to_pro_converted,
        "trial_to_pro_trials": trial_to_pro_trials,
        "activated_orgs_percent": activated_orgs_percent,
        "activated_orgs_new": activated_new,
        "arpa": arpa,
        "users": {"total": len(users), "last_7_days": users_7d},
        "clubs": {"total": len(orgs_active), "last_7_days": clubs_7d},
        "events": {"total": events_total},
        "paid_payments_30d": {"count": paid_payments_30d_count, "amount": round(paid_payments_30d_amount, 2)},
        "pro_churn_30d": None,
        "pro_churn_90d": None,
    }


def _verification_queue(db):
    docs = list(db.collection("organizations").where("is_deleted", "==", False).where("is_verified", "==", False).stream())
    results = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        owner_id = d.get("owner_id")
        if owner_id:
            u = db.collection("users").document(owner_id).get()
            d["owner_email"] = u.to_dict().get("email", "") if u.exists else ""
        else:
            d["owner_email"] = ""
        results.append(d)
    return results


@router.get("/verification")
def get_verification(admin: dict = Depends(require_platform_admin)):
    """Organizations pending verification (unverified orgs)."""
    return _verification_queue(get_firestore())


@router.get("/verification-queue")
def get_verification_queue(admin: dict = Depends(require_platform_admin)):
    """Alias for /verification."""
    return _verification_queue(get_firestore())


@router.get("/org-type-requests")
def get_org_type_requests(
    admin: dict = Depends(require_platform_admin),
    status_filter: str = Query("pending", description="pending | approved | rejected"),
):
    """Organization type requests for approval."""
    db = get_firestore()
    query = db.collection("org_type_requests")
    if status_filter and status_filter != "All":
        query = query.where("status", "==", status_filter)
    docs = list(query.stream())
    results = [{"id": d.id, **d.to_dict()} for d in docs]
    return results


@router.put("/org-type-requests/{request_id}/approve")
def approve_org_type_request(request_id: str, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    ref = db.collection("org_type_requests").document(request_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "Request not found")
    data = doc.to_dict()
    org_id = data.get("organization_id")
    requested_type = data.get("requested_type", "")
    ref.update({"status": "approved", "reviewed_at": datetime.utcnow(), "reviewed_by": admin["id"]})
    if org_id and requested_type:
        db.collection("organizations").document(org_id).update({"type": requested_type, "updated_at": datetime.utcnow()})
    return {"ok": True, "status": "approved"}


@router.put("/org-type-requests/{request_id}/reject")
def reject_org_type_request(request_id: str, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    ref = db.collection("org_type_requests").document(request_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "Request not found")
    ref.update({"status": "rejected", "reviewed_at": datetime.utcnow(), "reviewed_by": admin["id"]})
    return {"ok": True, "status": "rejected"}


@router.get("/reports/summary")
def get_reports_summary(admin: dict = Depends(require_platform_admin)):
    """Exportable reports summary."""
    db = get_firestore()
    users_count = len(list(db.collection("users").limit(10000).stream()))
    orgs = list(db.collection("organizations").where("is_deleted", "==", False).stream())
    return {
        "users_total": users_count,
        "organizations_total": len(orgs),
        "report_generated_at": datetime.utcnow().isoformat(),
    }


@router.get("/growth")
def get_growth(
    admin: dict = Depends(require_platform_admin),
    window: str = Query("6months", description="e.g. 6months"),
):
    """Growth & revenue metrics."""
    db = get_firestore()
    now = datetime.utcnow()
    days = 180 if "6" in window or "month" in window.lower() else 30
    cutoff = now - timedelta(days=days)
    cutoff_7 = now - timedelta(days=7)
    cutoff_30 = now - timedelta(days=30)

    orgs = list(db.collection("organizations").stream())
    orgs_active = [o for o in orgs if not o.to_dict().get("is_deleted")]
    pro_orgs = [o for o in orgs_active if o.to_dict().get("is_pro")]
    free_orgs = [o for o in orgs_active if not o.to_dict().get("is_pro")]
    new_pro_7d = sum(1 for o in pro_orgs if (o.to_dict().get("updated_at") or o.to_dict().get("created_at") or datetime.min) >= cutoff_7)

    pro_mrr = 0.0
    new_mrr_30d = 0.0
    return {
        "pro_mrr": pro_mrr,
        "free_orgs": len(free_orgs),
        "new_pro_orgs_7d": new_pro_7d,
        "new_mrr_30d": new_mrr_30d,
        "pro_orgs": [{"id": o.id, "name": o.to_dict().get("name"), "is_pro": True} for o in pro_orgs[:50]],
    }


@router.get("/activation")
def get_activation(
    admin: dict = Depends(require_platform_admin),
    window: str = Query("14days", description="e.g. 14days"),
):
    """Activation score distribution and orgs."""
    db = get_firestore()
    orgs = list(db.collection("organizations").stream())
    orgs_active = [o for o in orgs if not o.to_dict().get("is_deleted")]
    score_distribution = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    orgs_with_score = []
    for o in orgs_active:
        od = o.to_dict()
        members = list(db.collection("members").where("organization_id", "==", o.id).get())
        score = _activation_score(od, len(members))
        score_distribution[score] = score_distribution.get(score, 0) + 1
        orgs_with_score.append({"id": o.id, "name": od.get("name"), "activation_score": score, "member_count": len(members)})
    return {"score_distribution": score_distribution, "orgs": orgs_with_score[:100]}


@router.get("/acquisition")
def get_acquisition(admin: dict = Depends(require_platform_admin)):
    """User acquisition metrics."""
    db = get_firestore()
    now = datetime.utcnow()
    cutoff_30 = now - timedelta(days=30)
    users = list(db.collection("users").stream())
    orgs = list(db.collection("organizations").stream())
    orgs_active = [o for o in orgs if not o.to_dict().get("is_deleted")]
    new_users_30d = sum(1 for u in users if (u.to_dict().get("created_at") or datetime.min) >= cutoff_30)
    new_orgs_30d = sum(1 for o in orgs_active if (o.to_dict().get("created_at") or datetime.min) >= cutoff_30)
    return {
        "new_users_30d": new_users_30d,
        "new_orgs_30d": new_orgs_30d,
        "cac": None,
        "acquisition_sources": [],
    }


@router.get("/billing")
def get_billing(
    admin: dict = Depends(require_platform_admin),
    search: str = Query(None),
    plan_filter: str = Query("All", description="All | Free | Pro"),
):
    """Billing overview: orgs with plan, trial_end, period_end, stripe status."""
    db = get_firestore()
    query = db.collection("organizations").where("is_deleted", "==", False)
    docs = list(query.stream())
    results = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        plan = "Pro" if d.get("is_pro") else "Free"
        if plan_filter != "All" and plan != plan_filter:
            continue
        d["plan"] = plan
        # Prefer Stripe-synced trial_end_date; fallback to trial_start_date for legacy/display
        d["trial_end"] = d.get("trial_end_date") or d.get("trial_start_date")
        d["period_end"] = d.get("period_end")
        d["has_stripe"] = bool(d.get("stripe_customer_id"))
        # Billing status synced by billing API (active, trial, past_due, exempt, etc.)
        if d.get("platform_admin_owned") or d.get("billing_exempt"):
            d["billing_status"] = "exempt"
        else:
            d["billing_status"] = d.get("billing_status") or "inactive"
        if search:
            s = search.lower()
            if s not in (d.get("name") or "").lower():
                owner_id = d.get("owner_id")
                if owner_id:
                    u = db.collection("users").document(owner_id).get()
                    if u.exists and s in (u.to_dict().get("email") or "").lower():
                        pass
                    else:
                        continue
                else:
                    continue
        results.append(d)
    return results


@router.get("/reports/available")
def get_reports_available(admin: dict = Depends(require_platform_admin)):
    """List available report types for export."""
    return {
        "reports": [
            {"id": "users", "name": "Users export", "description": "All users with org counts"},
            {"id": "organizations", "name": "Organizations export", "description": "All organizations with metrics"},
        ]
    }
