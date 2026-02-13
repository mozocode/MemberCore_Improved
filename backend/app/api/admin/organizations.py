"""Platform Admin: Organizations Dashboard & Management."""
from datetime import datetime
from typing import Optional, List, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.db.firebase import get_firestore
from app.core.security import require_platform_admin, generate_uuid

router = APIRouter(dependencies=[Depends(require_platform_admin)])


# --- Pydantic models ---
class AdminNoteCreate(BaseModel):
    content: str


class TransferOwnershipRequest(BaseModel):
    new_owner_user_id: str


class FeatureOverridesUpdate(BaseModel):
    chat_enabled: Optional[bool] = None
    directory_publishing_enabled: Optional[bool] = None
    payments_enabled: Optional[bool] = None
    documents_enabled: Optional[bool] = None
    member_approvals_enabled: Optional[bool] = None


class EnforcementUpdate(BaseModel):
    suspend: Optional[bool] = None
    restrict_public_visibility: Optional[bool] = None
    disable_event_creation: Optional[bool] = None
    enforcement_note: Optional[str] = None


class IdentityUpdate(BaseModel):
    type: Optional[str] = None
    cultural_identity: Optional[str] = None
    organization_family: Optional[str] = None
    lock_identifiers: Optional[bool] = None


def _org_with_admin_fields(db, org_doc) -> dict:
    """Enrich org doc with owner email, metrics, billing, etc."""
    d = org_doc.to_dict()
    d["id"] = org_doc.id
    owner_id = d.get("owner_id")
    if owner_id:
        user_doc = db.collection("users").document(owner_id).get()
        if user_doc.exists:
            ud = user_doc.to_dict()
            d["owner_email"] = ud.get("email", "")
            d["owner_user_id"] = owner_id
        else:
            d["owner_email"] = ""
            d["owner_user_id"] = owner_id
    else:
        d["owner_email"] = ""
        d["owner_user_id"] = ""
    # Metrics
    members = list(db.collection("members").where("organization_id", "==", org_doc.id).get())
    d["member_count"] = len(members)
    d["admin_count"] = sum(1 for m in members if m.to_dict().get("role") in ("owner", "admin"))
    events = list(db.collection("events").where("organization_id", "==", org_doc.id).get())
    d["event_count"] = len(events)
    last_activity = d.get("updated_at") or d.get("created_at")
    for m in members:
        t = m.to_dict().get("joined_at") or m.to_dict().get("approved_at")
        if t and (not last_activity or (t > last_activity)):
            last_activity = t
    d["last_activity_at"] = last_activity
    # Billing (from org or admin_billing subcollection)
    d.setdefault("subscription_status", "Free" if not d.get("is_pro") else "Pro")
    d.setdefault("billing_exempt", d.get("platform_admin_owned", False))
    d.setdefault("billing_state", "Active")
    d.setdefault("trial_end_date", d.get("trial_start_date"))
    d.setdefault("next_billing_date", None)
    d.setdefault("last_payment_date", None)
    d.setdefault("payment_provider_id", None)
    d.setdefault("feature_overrides", {})
    return d


@router.get("/organizations")
def list_organizations_admin(
    admin: dict = Depends(require_platform_admin),
    search: Optional[str] = Query(None),
    verified: Optional[bool] = Query(None),
    suspended: Optional[bool] = Query(None),
    subscription: Optional[str] = Query(None),  # Free, Pro, Inactive
):
    """Organizations dashboard - all orgs with admin fields."""
    db = get_firestore()
    orgs_ref = db.collection("organizations")
    query = orgs_ref.where("is_deleted", "==", False)
    if suspended is not None:
        query = query.where("is_suspended", "==", suspended)
    if verified is not None:
        query = query.where("is_verified", "==", verified)
    docs = list(query.stream())
    results = []
    for doc in docs:
        d = _org_with_admin_fields(db, doc)
        if subscription:
            want_pro = subscription.lower() == "pro"
            if want_pro != d.get("is_pro", False):
                continue
        if search:
            s = search.lower()
            if s not in (d.get("name") or "").lower() and s not in (d.get("owner_email") or "").lower():
                continue
        results.append(d)
    return results


@router.get("/organizations/{org_id}")
def get_organization_admin(org_id: str, admin: dict = Depends(require_platform_admin)):
    """View full organization profile (admin)."""
    db = get_firestore()
    doc = db.collection("organizations").document(org_id).get()
    if not doc.exists:
        raise HTTPException(404, "Organization not found")
    d = _org_with_admin_fields(db, doc)
    # Load admin notes (no order_by to avoid index requirement)
    notes = list(db.collection("organizations").document(org_id).collection("admin_notes").limit(50).stream())
    d["admin_notes"] = [{"id": n.id, **n.to_dict()} for n in notes]
    # Load verification history
    vh = list(db.collection("organizations").document(org_id).collection("verification_history").limit(50).stream())
    d["verification_history"] = [{"id": v.id, **v.to_dict()} for v in vh]
    return d


@router.post("/organizations/{org_id}/verify")
def verify_organization(org_id: str, admin: dict = Depends(require_platform_admin), note: Optional[str] = Query(None)):
    db = get_firestore()
    ref = db.collection("organizations").document(org_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "Organization not found")
    ref.update({"is_verified": True, "updated_at": datetime.utcnow()})
    ref.collection("verification_history").add({
        "action": "verified",
        "admin_id": admin["id"],
        "admin_email": admin.get("email", ""),
        "note": note,
        "created_at": datetime.utcnow(),
    })
    return {"ok": True, "is_verified": True}


@router.post("/organizations/{org_id}/unverify")
def unverify_organization(org_id: str, admin: dict = Depends(require_platform_admin), note: Optional[str] = Query(None)):
    db = get_firestore()
    ref = db.collection("organizations").document(org_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "Organization not found")
    ref.update({"is_verified": False, "updated_at": datetime.utcnow()})
    ref.collection("verification_history").add({
        "action": "unverified",
        "admin_id": admin["id"],
        "admin_email": admin.get("email", ""),
        "note": note,
        "created_at": datetime.utcnow(),
    })
    return {"ok": True, "is_verified": False}


@router.post("/organizations/{org_id}/admin-notes")
def add_admin_note(org_id: str, body: AdminNoteCreate, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    ref = db.collection("organizations").document(org_id)
    if not ref.get().exists:
        raise HTTPException(404, "Organization not found")
    ref.collection("admin_notes").add({
        "content": body.content,
        "admin_id": admin["id"],
        "admin_email": admin.get("email", ""),
        "created_at": datetime.utcnow(),
    })
    return {"ok": True}


@router.post("/organizations/{org_id}/suspend")
def suspend_organization(org_id: str, admin: dict = Depends(require_platform_admin), note: Optional[str] = Query(None)):
    db = get_firestore()
    ref = db.collection("organizations").document(org_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "Organization not found")
    ref.update({"is_suspended": True, "updated_at": datetime.utcnow()})
    if note:
        ref.collection("admin_notes").add({
            "content": f"[SUSPENSION] {note}",
            "admin_id": admin["id"],
            "created_at": datetime.utcnow(),
        })
    return {"ok": True, "is_suspended": True}


@router.post("/organizations/{org_id}/unsuspend")
def unsuspend_organization(org_id: str, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    ref = db.collection("organizations").document(org_id)
    if not ref.get().exists:
        raise HTTPException(404, "Organization not found")
    ref.update({"is_suspended": False, "updated_at": datetime.utcnow()})
    return {"ok": True, "is_suspended": False}


@router.delete("/organizations/{org_id}")
def delete_organization(
    org_id: str,
    admin: dict = Depends(require_platform_admin),
    hard: bool = Query(False, description="Hard delete (permanent) vs soft delete"),
):
    db = get_firestore()
    ref = db.collection("organizations").document(org_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "Organization not found")
    if hard:
        ref.delete()
        return {"ok": True, "deleted": "hard"}
    ref.update({"is_deleted": True, "deleted_at": datetime.utcnow(), "updated_at": datetime.utcnow()})
    return {"ok": True, "deleted": "soft"}


@router.post("/organizations/{org_id}/billing/downgrade")
def force_downgrade(org_id: str, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    ref = db.collection("organizations").document(org_id)
    if not ref.get().exists:
        raise HTTPException(404, "Organization not found")
    ref.update({
        "is_pro": False,
        "platform_admin_owned": False,
        "billing_state": "Canceled",
        "updated_at": datetime.utcnow(),
    })
    return {"ok": True, "plan": "Free"}


@router.post("/organizations/{org_id}/billing/restore-pro")
def restore_pro(org_id: str, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    ref = db.collection("organizations").document(org_id)
    if not ref.get().exists:
        raise HTTPException(404, "Organization not found")
    ref.update({
        "is_pro": True,
        "updated_at": datetime.utcnow(),
    })
    return {"ok": True, "plan": "Pro"}


@router.post("/organizations/{org_id}/billing/billing-exempt")
def mark_billing_exempt(org_id: str, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    ref = db.collection("organizations").document(org_id)
    if not ref.get().exists:
        raise HTTPException(404, "Organization not found")
    ref.update({
        "platform_admin_owned": True,
        "is_pro": True,
        "billing_state": "Exempt",
        "updated_at": datetime.utcnow(),
    })
    return {"ok": True, "billing_exempt": True}


@router.post("/organizations/{org_id}/transfer-ownership")
def transfer_ownership(org_id: str, body: TransferOwnershipRequest, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    org_ref = db.collection("organizations").document(org_id)
    org_doc = org_ref.get()
    if not org_doc.exists:
        raise HTTPException(404, "Organization not found")
    new_owner_id = body.new_owner_user_id
    # Verify new owner is a member
    members = list(db.collection("members").where("organization_id", "==", org_id).where("user_id", "==", new_owner_id).get())
    if not members:
        raise HTTPException(400, "New owner must be an existing member")
    old_owner_id = org_doc.to_dict().get("owner_id")
    # Update org owner
    org_ref.update({"owner_id": new_owner_id, "updated_at": datetime.utcnow()})
    # Update member roles: old owner -> admin, new owner -> owner
    for m in db.collection("members").where("organization_id", "==", org_id).stream():
        md = m.to_dict()
        if md.get("user_id") == old_owner_id:
            db.collection("members").document(m.id).update({"role": "admin"})
        elif md.get("user_id") == new_owner_id:
            db.collection("members").document(m.id).update({"role": "owner"})
    return {"ok": True, "owner_id": new_owner_id}


@router.patch("/organizations/{org_id}/feature-overrides")
def update_feature_overrides(org_id: str, body: FeatureOverridesUpdate, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    ref = db.collection("organizations").document(org_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "Organization not found")
    overrides = doc.to_dict().get("feature_overrides") or {}
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    for k, v in updates.items():
        overrides[k] = v
    ref.update({"feature_overrides": overrides, "updated_at": datetime.utcnow()})
    return {"ok": True, "feature_overrides": overrides}


@router.patch("/organizations/{org_id}/enforcement")
def update_enforcement(org_id: str, body: EnforcementUpdate, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    ref = db.collection("organizations").document(org_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "Organization not found")
    up = {"updated_at": datetime.utcnow()}
    if body.suspend is not None:
        up["is_suspended"] = body.suspend
    if body.restrict_public_visibility is not None:
        up["restrict_public_visibility"] = body.restrict_public_visibility
    if body.disable_event_creation is not None:
        up["disable_event_creation"] = body.disable_event_creation
    ref.update(up)
    if body.enforcement_note:
        ref.collection("admin_notes").add({
            "content": f"[ENFORCEMENT] {body.enforcement_note}",
            "admin_id": admin["id"],
            "created_at": datetime.utcnow(),
        })
    return {"ok": True}


@router.patch("/organizations/{org_id}/identity")
def update_identity(org_id: str, body: IdentityUpdate, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    ref = db.collection("organizations").document(org_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "Organization not found")
    up = {"updated_at": datetime.utcnow()}
    if body.type is not None:
        up["type"] = body.type
    if body.cultural_identity is not None:
        up["cultural_identity"] = body.cultural_identity
    if body.organization_family is not None:
        up["organization_family"] = body.organization_family
    if body.lock_identifiers is not None:
        up["identity_locked"] = body.lock_identifiers
    ref.update(up)
    return {"ok": True}


@router.get("/organizations/{org_id}/events")
def list_org_events_admin(org_id: str, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    docs = list(db.collection("events").where("organization_id", "==", org_id).stream())
    events = []
    for d in docs:
        ed = d.to_dict()
        ed["id"] = d.id
        events.append(ed)
    return events


@router.post("/organizations/{org_id}/events/{event_id}/remove-from-directory")
def remove_event_from_directory(org_id: str, event_id: str, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    ref = db.collection("events").document(event_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "Event not found")
    if doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(400, "Event does not belong to this organization")
    ref.update({"is_public_directory": False, "updated_at": datetime.utcnow()})
    return {"ok": True}


@router.post("/organizations/{org_id}/events/{event_id}/flag")
def flag_event(org_id: str, event_id: str, admin: dict = Depends(require_platform_admin), note: Optional[str] = Query(None)):
    db = get_firestore()
    ref = db.collection("events").document(event_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "Event not found")
    ref.collection("flags").add({
        "admin_id": admin["id"],
        "note": note,
        "created_at": datetime.utcnow(),
    })
    return {"ok": True}


@router.get("/organizations/{org_id}/members")
def list_org_members_admin(org_id: str, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    members = list(db.collection("members").where("organization_id", "==", org_id).get())
    result = []
    for m in members:
        md = m.to_dict()
        md["id"] = m.id
        user_id = md.get("user_id")
        if user_id:
            u = db.collection("users").document(user_id).get()
            if u.exists:
                md["user_email"] = u.to_dict().get("email", "")
                md["user_name"] = u.to_dict().get("name", "")
        result.append(md)
    return result
