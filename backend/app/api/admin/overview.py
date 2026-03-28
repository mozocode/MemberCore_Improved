"""Platform Admin: Overview Dashboard."""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from app.db.firebase import get_firestore
from app.core.security import require_platform_admin

router = APIRouter(dependencies=[Depends(require_platform_admin)])

OVERVIEW_CACHE_COLLECTION = "admin_metrics_cache"
OVERVIEW_CACHE_DOC_ID = "overview_v2"
OVERVIEW_CACHE_TTL_SECONDS = 300
ALL_TIME_CACHE_DOC_ID = "payments_all_time_v1"
ALL_TIME_CACHE_TTL_SECONDS = 60 * 60 * 24
PAYMENT_DAILY_ROLLUP_COLLECTION = "admin_payment_rollups_daily"
ROLLUP_WINDOW_DAYS = 30


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


def _to_datetime(value) -> Optional[datetime]:
    """Best-effort conversion for Firestore timestamp-like values."""
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None
    return None


def _date_key(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")


def _start_of_day(dt: datetime) -> datetime:
    return datetime(dt.year, dt.month, dt.day)


def _cache_get(db, doc_id: str):
    doc = db.collection(OVERVIEW_CACHE_COLLECTION).document(doc_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict() or {}
    expires_at = _to_datetime(data.get("expires_at"))
    if not expires_at or expires_at <= datetime.utcnow():
        return None
    return data.get("payload")


def _cache_set(db, doc_id: str, payload: dict, ttl_seconds: int):
    now = datetime.utcnow()
    db.collection(OVERVIEW_CACHE_COLLECTION).document(doc_id).set({
        "payload": payload,
        "updated_at": now,
        "expires_at": now + timedelta(seconds=ttl_seconds),
    }, merge=True)


def _daily_rollup_from_queries(db, day_start: datetime, day_end: datetime) -> dict:
    dues_ids = set()
    dues_amount = 0.0
    for field in ("created_at", "paid_at"):
        try:
            docs = db.collection("payments").where(field, ">=", day_start).where(field, "<", day_end).stream()
            for doc in docs:
                if doc.id in dues_ids:
                    continue
                pd = doc.to_dict() or {}
                amount = float(pd.get("amount", 0) or 0)
                if amount <= 0:
                    continue
                dues_ids.add(doc.id)
                dues_amount += amount
        except Exception:
            continue

    ticket_ids = set()
    tickets_amount = 0.0
    try:
        docs = db.collection("event_tickets").where("created_at", ">=", day_start).where("created_at", "<", day_end).stream()
        for doc in docs:
            if doc.id in ticket_ids:
                continue
            td = doc.to_dict() or {}
            amount = float(td.get("amount", 0) or 0)
            if amount <= 0:
                continue
            ticket_ids.add(doc.id)
            tickets_amount += amount
    except Exception:
        pass

    return {
        "dues_count": len(dues_ids),
        "dues_amount": round(dues_amount, 2),
        "tickets_count": len(ticket_ids),
        "tickets_amount": round(tickets_amount, 2),
    }


def _ensure_daily_payment_rollup(db, day_start: datetime) -> dict:
    key = _date_key(day_start)
    ref = db.collection(PAYMENT_DAILY_ROLLUP_COLLECTION).document(key)
    doc = ref.get()
    if doc.exists:
        data = doc.to_dict() or {}
        return {
            "date": key,
            "dues_count": int(data.get("dues_count", 0) or 0),
            "dues_amount": float(data.get("dues_amount", 0) or 0),
            "tickets_count": int(data.get("tickets_count", 0) or 0),
            "tickets_amount": float(data.get("tickets_amount", 0) or 0),
        }

    day_end = day_start + timedelta(days=1)
    rollup = _daily_rollup_from_queries(db, day_start, day_end)
    now = datetime.utcnow()
    ref.set({"date": key, **rollup, "created_at": now, "updated_at": now}, merge=True)
    return {"date": key, **rollup}


def _get_30d_rollup_totals(db, now: datetime) -> dict:
    start_today = _start_of_day(now)
    totals = {
        "dues_count": 0,
        "dues_amount": 0.0,
        "tickets_count": 0,
        "tickets_amount": 0.0,
    }
    for i in range(ROLLUP_WINDOW_DAYS):
        day_start = start_today - timedelta(days=i)
        rollup = _ensure_daily_payment_rollup(db, day_start)
        totals["dues_count"] += int(rollup.get("dues_count", 0) or 0)
        totals["dues_amount"] += float(rollup.get("dues_amount", 0) or 0)
        totals["tickets_count"] += int(rollup.get("tickets_count", 0) or 0)
        totals["tickets_amount"] += float(rollup.get("tickets_amount", 0) or 0)
    totals["dues_amount"] = round(totals["dues_amount"], 2)
    totals["tickets_amount"] = round(totals["tickets_amount"], 2)
    return totals


def _legacy_scan_all_time_totals(db) -> dict:
    dues_all_time_count = 0
    dues_all_time_amount = 0.0
    tickets_all_time_count = 0
    tickets_all_time_amount = 0.0
    try:
        for doc in db.collection("payments").stream():
            pd = doc.to_dict()
            amount = float(pd.get("amount", 0) or 0)
            if amount <= 0:
                continue
            dues_all_time_count += 1
            dues_all_time_amount += amount
    except Exception:
        pass
    try:
        for doc in db.collection("event_tickets").stream():
            td = doc.to_dict()
            amount = float(td.get("amount", 0) or 0)
            if amount <= 0:
                continue
            tickets_all_time_count += 1
            tickets_all_time_amount += amount
    except Exception:
        pass
    return {
        "dues_count": dues_all_time_count,
        "dues_amount": round(dues_all_time_amount, 2),
        "tickets_count": tickets_all_time_count,
        "tickets_amount": round(tickets_all_time_amount, 2),
    }


def _get_all_time_totals_cached(db) -> dict:
    cached = _cache_get(db, ALL_TIME_CACHE_DOC_ID)
    if isinstance(cached, dict):
        return {
            "dues_count": int(cached.get("dues_count", 0) or 0),
            "dues_amount": float(cached.get("dues_amount", 0) or 0),
            "tickets_count": int(cached.get("tickets_count", 0) or 0),
            "tickets_amount": float(cached.get("tickets_amount", 0) or 0),
        }
    totals = _legacy_scan_all_time_totals(db)
    _cache_set(db, ALL_TIME_CACHE_DOC_ID, totals, ALL_TIME_CACHE_TTL_SECONDS)
    return totals


@router.get("/overview")
def get_overview(admin: dict = Depends(require_platform_admin)):
    """Platform-wide metrics for admin dashboard (spec shape).

    Uses short-lived cache + daily payment rollups to keep response times stable.
    """
    db = get_firestore()
    cached_payload = _cache_get(db, OVERVIEW_CACHE_DOC_ID)
    if isinstance(cached_payload, dict):
        return cached_payload

    now = datetime.utcnow()
    cutoff_7 = now - timedelta(days=7)

    users = list(db.collection("users").stream())
    orgs = list(db.collection("organizations").stream())
    orgs_active = [o for o in orgs if not o.to_dict().get("is_deleted")]
    pro_orgs_list = [o for o in orgs_active if o.to_dict().get("is_pro")]

    users_7d = sum(1 for u in users if (u.to_dict().get("created_at") or datetime.min) >= cutoff_7)
    clubs_7d = sum(1 for o in orgs_active if (o.to_dict().get("created_at") or datetime.min) >= cutoff_7)
    events_total = len(list(db.collection("events").stream()))

    cutoff_14 = now - timedelta(days=14)
    activated_count = 0
    activated_new = 0
    for o in orgs_active:
        od = o.to_dict()
        members = list(db.collection("members").where("organization_id", "==", o.id).get())
        score = _activation_score(od, len(members))
        if score >= 1:
            activated_count += 1
            created = od.get("created_at") or datetime.min
            if created >= cutoff_14:
                activated_new += 1
    activated_orgs_percent = round(100.0 * activated_count / len(orgs_active), 1) if orgs_active else 0.0

    trial_to_pro_trials = 0
    trial_to_pro_converted = 0
    for o in orgs_active:
        od = o.to_dict()
        if od.get("trial_start_date"):
            trial_to_pro_trials += 1
        if od.get("is_pro"):
            trial_to_pro_converted += 1

    pro_mrr = 0.0
    arpa = 97.0 if pro_orgs_list else 0.0

    rollup_30d = _get_30d_rollup_totals(db, now)
    all_time = _get_all_time_totals_cached(db)

    dues_30d_count = rollup_30d["dues_count"]
    dues_30d_amount = rollup_30d["dues_amount"]
    tickets_30d_count = rollup_30d["tickets_count"]
    tickets_30d_amount = rollup_30d["tickets_amount"]
    dues_all_time_count = all_time["dues_count"]
    dues_all_time_amount = all_time["dues_amount"]
    tickets_all_time_count = all_time["tickets_count"]
    tickets_all_time_amount = all_time["tickets_amount"]

    platform_all_time_count = dues_all_time_count + tickets_all_time_count
    platform_all_time_amount = dues_all_time_amount + tickets_all_time_amount
    platform_30d_count = dues_30d_count + tickets_30d_count
    platform_30d_amount = dues_30d_amount + tickets_30d_amount

    payload = {
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
        "paid_payments_30d": {"count": dues_30d_count, "amount": round(dues_30d_amount, 2)},
        "platform_volume_30d": {
            "count": platform_30d_count,
            "amount": round(platform_30d_amount, 2),
            "dues_count": dues_30d_count,
            "dues_amount": round(dues_30d_amount, 2),
            "tickets_count": tickets_30d_count,
            "tickets_amount": round(tickets_30d_amount, 2),
        },
        "platform_volume_all_time": {
            "count": platform_all_time_count,
            "amount": round(platform_all_time_amount, 2),
            "dues_count": dues_all_time_count,
            "dues_amount": round(dues_all_time_amount, 2),
            "tickets_count": tickets_all_time_count,
            "tickets_amount": round(tickets_all_time_amount, 2),
        },
        "pro_churn_30d": None,
        "pro_churn_90d": None,
    }
    _cache_set(db, OVERVIEW_CACHE_DOC_ID, payload, OVERVIEW_CACHE_TTL_SECONDS)
    return payload


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
