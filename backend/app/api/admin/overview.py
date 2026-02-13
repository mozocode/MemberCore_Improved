"""Platform Admin: Overview Dashboard."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query

from app.db.firebase import get_firestore
from app.core.security import require_platform_admin

router = APIRouter(dependencies=[Depends(require_platform_admin)])


@router.get("/verify")
def verify_admin_access(admin: dict = Depends(require_platform_admin)):
    """Verify current user has platform admin access."""
    return {"ok": True, "is_platform_admin": True, "admin_id": admin["id"], "email": admin.get("email")}


@router.get("/overview")
def get_overview(
    admin: dict = Depends(require_platform_admin),
    period_days: int = Query(30, ge=1, le=365),
):
    """Platform-wide metrics for admin dashboard."""
    db = get_firestore()
    cutoff = datetime.utcnow() - timedelta(days=period_days)

    users = list(db.collection("users").stream())
    orgs = list(db.collection("organizations").stream())
    orgs_active = [o for o in orgs if not o.to_dict().get("is_deleted")]

    new_users = sum(1 for u in users if (u.to_dict().get("created_at") or datetime.min) >= cutoff)
    new_orgs = sum(1 for o in orgs_active if (o.to_dict().get("created_at") or datetime.min) >= cutoff)
    verified_orgs = sum(1 for o in orgs_active if o.to_dict().get("is_verified"))
    pro_orgs = sum(1 for o in orgs_active if o.to_dict().get("is_pro"))
    suspended_orgs = sum(1 for o in orgs_active if o.to_dict().get("is_suspended"))

    return {
        "total_users": len(users),
        "total_organizations": len(orgs_active),
        "new_users_period": new_users,
        "new_organizations_period": new_orgs,
        "verified_organizations": verified_orgs,
        "pro_organizations": pro_orgs,
        "suspended_organizations": suspended_orgs,
        "period_days": period_days,
    }


@router.get("/verification-queue")
def get_verification_queue(admin: dict = Depends(require_platform_admin)):
    """Organizations pending verification (e.g. requested but not yet verified)."""
    db = get_firestore()
    # Orgs that requested verification - we use verification_requested or similar
    # For now return unverified orgs that have been active
    docs = list(db.collection("organizations").where("is_deleted", "==", False).where("is_verified", "==", False).stream())
    results = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        results.append(d)
    return results


@router.get("/org-type-requests")
def get_org_type_requests(admin: dict = Depends(require_platform_admin)):
    """Organization type 'Other' requests for approval."""
    db = get_firestore()
    docs = list(db.collection("org_type_requests").stream())
    results = [{"id": d.id, **d.to_dict()} for d in docs]
    return results


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
