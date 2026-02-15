"""Platform Admin: Users Management."""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, EmailStr

from app.db.firebase import get_firestore
from app.core.security import require_platform_admin, hash_password, generate_uuid
from app.config import settings

router = APIRouter(dependencies=[Depends(require_platform_admin)])


def _is_super_admin_email(user_doc) -> bool:
    email = (user_doc.to_dict().get("email") or "").strip().lower()
    super_email = (settings.super_admin_email or "").strip().lower()
    return bool(super_email and email == super_email)


class CreateUserRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    is_platform_admin: bool = False
    unlimited_pro_orgs: bool = False
    skip_trial: bool = False


class UpdatePermissionsRequest(BaseModel):
    is_platform_admin: Optional[bool] = None
    unlimited_pro_orgs: Optional[bool] = None
    skip_trial: Optional[bool] = None


class BulkDeleteUsersRequest(BaseModel):
    user_ids: List[str]


@router.get("/users")
def list_users_admin(
    admin: dict = Depends(require_platform_admin),
    search: Optional[str] = Query(None),
    suspended: Optional[bool] = Query(None),
    limit: int = Query(100, le=500),
):
    """List all users with org count."""
    db = get_firestore()
    query = db.collection("users").limit(limit)
    docs = list(query.stream())
    results = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        d.pop("hashed_password", None)
        members = list(db.collection("members").where("user_id", "==", doc.id).get())
        d["org_count"] = len(members)
        d["status"] = "Active" if d.get("is_active", True) else "Suspended"
        if suspended is not None:
            if d.get("is_active", True) == suspended:
                continue
        if search:
            s = search.lower()
            if s not in (d.get("email") or "").lower() and s not in (d.get("name") or "").lower():
                continue
        results.append(d)
    return results


@router.get("/users/{user_id}")
def get_user_admin(user_id: str, admin: dict = Depends(require_platform_admin)):
    """Get user profile (admin)."""
    db = get_firestore()
    doc = db.collection("users").document(user_id).get()
    if not doc.exists:
        raise HTTPException(404, "User not found")
    d = doc.to_dict()
    d["id"] = doc.id
    d.pop("hashed_password", None)
    # Count orgs
    members = list(db.collection("members").where("user_id", "==", user_id).get())
    d["organization_count"] = len(members)
    return d


def _suspend_user_impl(user_id: str, db):
    ref = db.collection("users").document(user_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "User not found")
    ref.update({"is_active": False, "updated_at": datetime.utcnow()})
    return {"ok": True, "is_active": False}


def _activate_user_impl(user_id: str, db):
    ref = db.collection("users").document(user_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "User not found")
    ref.update({"is_active": True, "updated_at": datetime.utcnow()})
    return {"ok": True, "is_active": True}


@router.post("/users/{user_id}/suspend")
def suspend_user_post(user_id: str, admin: dict = Depends(require_platform_admin)):
    return _suspend_user_impl(user_id, get_firestore())


@router.put("/users/{user_id}/suspend")
def suspend_user_put(user_id: str, admin: dict = Depends(require_platform_admin)):
    return _suspend_user_impl(user_id, get_firestore())


@router.post("/users/{user_id}/activate")
def activate_user_post(user_id: str, admin: dict = Depends(require_platform_admin)):
    return _activate_user_impl(user_id, get_firestore())


@router.put("/users/{user_id}/activate")
def activate_user_put(user_id: str, admin: dict = Depends(require_platform_admin)):
    return _activate_user_impl(user_id, get_firestore())


@router.post("/users/{user_id}/make-admin")
def make_platform_admin(user_id: str, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    ref = db.collection("users").document(user_id)
    if not ref.get().exists:
        raise HTTPException(404, "User not found")
    ref.update({"is_platform_admin": True, "updated_at": datetime.utcnow()})
    return {"ok": True, "is_platform_admin": True}


@router.post("/users/create")
def create_user(body: CreateUserRequest, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    email_lower = body.email.lower().strip()
    existing = list(db.collection("users").where("email", "==", email_lower).limit(1).get())
    if existing:
        raise HTTPException(400, "Email already registered")
    user_id = generate_uuid()
    perms = body.model_dump(include={"is_platform_admin", "unlimited_pro_orgs", "skip_trial"})
    user_data = {
        "id": user_id,
        "email": email_lower,
        "name": body.name.strip(),
        "hashed_password": hash_password(body.password),
        "avatar": None,
        "phone_number": None,
        "is_active": True,
        "is_platform_admin": perms.get("is_platform_admin", False),
        "permissions": {
            "unlimited_pro_orgs": perms.get("unlimited_pro_orgs", False),
            "skip_trial": perms.get("skip_trial", False),
        },
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    db.collection("users").document(user_id).set(user_data)
    return {"ok": True, "id": user_id, "email": email_lower}


@router.put("/users/{user_id}/permissions")
def update_user_permissions(user_id: str, body: UpdatePermissionsRequest, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    ref = db.collection("users").document(user_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "User not found")
    data = doc.to_dict()
    updates = {"updated_at": datetime.utcnow()}
    if body.is_platform_admin is not None:
        updates["is_platform_admin"] = body.is_platform_admin
    perms = data.get("permissions") or {}
    if body.unlimited_pro_orgs is not None:
        perms["unlimited_pro_orgs"] = body.unlimited_pro_orgs
    if body.skip_trial is not None:
        perms["skip_trial"] = body.skip_trial
    updates["permissions"] = perms
    ref.update(updates)
    return {"ok": True, "permissions": perms}


@router.delete("/users/{user_id}")
def delete_user(user_id: str, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    ref = db.collection("users").document(user_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "User not found")
    if _is_super_admin_email(doc):
        raise HTTPException(403, "Cannot delete super admin account")
    ref.delete()
    return {"ok": True, "deleted": True}


@router.post("/users/bulk-delete")
def bulk_delete_users(body: BulkDeleteUsersRequest, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    super_email = (settings.super_admin_email or "").strip().lower()
    deleted = 0
    for user_id in body.user_ids:
        ref = db.collection("users").document(user_id)
        doc = ref.get()
        if not doc.exists:
            continue
        if super_email and (doc.to_dict().get("email") or "").strip().lower() == super_email:
            continue
        if doc.to_dict().get("is_platform_admin"):
            continue
        ref.delete()
        deleted += 1
    return {"ok": True, "deleted": deleted}
