"""Platform Admin: Users Management."""
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query

from app.db.firebase import get_firestore
from app.core.security import require_platform_admin

router = APIRouter(dependencies=[Depends(require_platform_admin)])


@router.get("/users")
def list_users_admin(
    admin: dict = Depends(require_platform_admin),
    search: Optional[str] = Query(None),
    suspended: Optional[bool] = Query(None),
    limit: int = Query(100, le=500),
):
    """List all users (platform admin)."""
    db = get_firestore()
    query = db.collection("users").limit(limit)
    docs = list(query.stream())
    results = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        d.pop("hashed_password", None)
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


@router.post("/users/{user_id}/suspend")
def suspend_user(user_id: str, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    ref = db.collection("users").document(user_id)
    if not ref.get().exists:
        raise HTTPException(404, "User not found")
    from datetime import datetime
    ref.update({"is_active": False, "updated_at": datetime.utcnow()})
    return {"ok": True, "is_active": False}


@router.post("/users/{user_id}/activate")
def activate_user(user_id: str, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    ref = db.collection("users").document(user_id)
    if not ref.get().exists:
        raise HTTPException(404, "User not found")
    from datetime import datetime
    ref.update({"is_active": True, "updated_at": datetime.utcnow()})
    return {"ok": True, "is_active": True}


@router.post("/users/{user_id}/make-admin")
def make_platform_admin(user_id: str, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    ref = db.collection("users").document(user_id)
    if not ref.get().exists:
        raise HTTPException(404, "User not found")
    from datetime import datetime
    ref.update({"is_platform_admin": True, "updated_at": datetime.utcnow()})
    return {"ok": True, "is_platform_admin": True}


@router.delete("/users/{user_id}")
def delete_user(user_id: str, admin: dict = Depends(require_platform_admin)):
    db = get_firestore()
    ref = db.collection("users").document(user_id)
    if not ref.get().exists:
        raise HTTPException(404, "User not found")
    ref.delete()
    return {"ok": True, "deleted": True}
