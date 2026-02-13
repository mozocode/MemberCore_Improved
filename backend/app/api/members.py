"""Organization members API - list, update role, approve, reject, export."""
import csv
import io
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.db.firebase import get_firestore
from app.core.security import get_current_user_id, get_current_user, generate_uuid

router = APIRouter()


def _require_org_member(db, org_id: str, user_id: str) -> str:
    """Verify user is member, return role."""
    members = (
        db.collection("members")
        .where("user_id", "==", user_id)
        .where("organization_id", "==", org_id)
        .limit(1)
        .get()
    )
    if not members:
        raise HTTPException(status_code=404, detail="Organization not found")
    return members[0].to_dict().get("role", "member")


def _require_admin_or_owner(role: str):
    if role not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or owner access required",
        )


@router.get("/{org_id}/members")
def list_members(
    org_id: str,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,  # "approved" | "pending" | null for all
    user_id: str = Depends(get_current_user_id),
):
    """List organization members. Admin/owner see all; members see approved only."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user_id)

    members_ref = db.collection("members").where("organization_id", "==", org_id)

    # Non-admins only see approved
    if role not in ("owner", "admin"):
        members_ref = members_ref.where("status", "==", "approved")
    elif status_filter:
        members_ref = members_ref.where("status", "==", status_filter)

    docs = list(members_ref.stream())
    # Return as list; for admin without filter, frontend can split by status
    members = []
    for doc in docs:
        md = doc.to_dict()
        md["id"] = doc.id
        user_doc = db.collection("users").document(md["user_id"]).get()
        if user_doc.exists:
            ud = user_doc.to_dict()
            md["name"] = ud.get("name") or ud.get("email", "")
            md["email"] = ud.get("email", "")
            md["avatar"] = ud.get("avatar")
            md["initial"] = (md.get("name") or "?")[0].upper()
        else:
            md["name"] = "Unknown"
            md["email"] = ""
            md["initial"] = "?"

        if search:
            s = search.lower()
            if s not in (md.get("name") or "").lower() and s not in (md.get("email") or "").lower():
                continue
        members.append(md)

    return members


@router.get("/{org_id}/members/roles")
def get_available_roles(
    org_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Get roles current user can assign (admin, member, restricted)."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user_id)
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return [{"value": "admin", "label": "Admin"}, {"value": "member", "label": "Member"}, {"value": "restricted", "label": "Restricted"}]


class UpdateRoleRequest(BaseModel):
    role: str


@router.put("/{org_id}/members/{member_id}")
def update_member_role(
    org_id: str,
    member_id: str,
    req: UpdateRoleRequest,
    user: dict = Depends(get_current_user),
):
    """Update member role. Cannot change owner, cannot change own role."""
    db = get_firestore()
    my_role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(my_role)

    role = req.role
    if role not in ("admin", "member", "restricted"):
        raise HTTPException(status_code=400, detail="Invalid role")
    if role == "admin" and my_role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can assign Admin role")

    member_ref = db.collection("members").document(member_id)
    member_doc = member_ref.get()
    if not member_doc.exists:
        raise HTTPException(status_code=404, detail="Member not found")
    md = member_doc.to_dict()
    if md.get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Member not found")
    if md.get("role") == "owner":
        raise HTTPException(status_code=400, detail="Cannot change owner role")
    if md.get("user_id") == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    if md.get("role") == "admin" and my_role == "admin":
        raise HTTPException(status_code=403, detail="Cannot modify another admin")

    member_ref.update({"role": role, "updated_at": datetime.now(timezone.utc)})
    return {"ok": True, "role": role}


@router.post("/{org_id}/members/{member_id}/approve")
def approve_member(
    org_id: str,
    member_id: str,
    user: dict = Depends(get_current_user),
):
    """Approve pending member."""
    db = get_firestore()
    my_role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(my_role)

    member_ref = db.collection("members").document(member_id)
    member_doc = member_ref.get()
    if not member_doc.exists:
        raise HTTPException(status_code=404, detail="Member not found")
    md = member_doc.to_dict()
    if md.get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Member not found")
    if md.get("status") == "approved":
        return {"ok": True, "status": "approved"}

    now = datetime.now(timezone.utc)
    member_ref.update({"status": "approved", "approved_at": now, "approved_by": user["id"]})
    return {"ok": True, "status": "approved"}


@router.post("/{org_id}/members/{member_id}/reject")
def reject_member(
    org_id: str,
    member_id: str,
    user: dict = Depends(get_current_user),
):
    """Reject and remove pending member."""
    db = get_firestore()
    my_role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(my_role)

    member_ref = db.collection("members").document(member_id)
    member_doc = member_ref.get()
    if not member_doc.exists:
        raise HTTPException(status_code=404, detail="Member not found")
    md = member_doc.to_dict()
    if md.get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Member not found")

    member_ref.delete()
    return {"ok": True}


@router.delete("/{org_id}/members/{member_id}")
def remove_member(
    org_id: str,
    member_id: str,
    user: dict = Depends(get_current_user),
):
    """Remove a member from the organization. Owner can remove anyone except self; admin can remove member/restricted only."""
    db = get_firestore()
    my_role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(my_role)

    member_ref = db.collection("members").document(member_id)
    member_doc = member_ref.get()
    if not member_doc.exists:
        raise HTTPException(status_code=404, detail="Member not found")
    md = member_doc.to_dict()
    if md.get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Member not found")
    if md.get("user_id") == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot remove yourself; use Leave organization in Personal Settings")
    if md.get("role") == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove the owner")
    if my_role == "admin" and md.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Only owner can remove an admin")

    member_ref.delete()
    return {"ok": True}


@router.get("/{org_id}/members/export/csv")
def export_members_csv(
    org_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Export members list as CSV. Admin/owner only."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user_id)
    _require_admin_or_owner(role)

    docs = list(
        db.collection("members")
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .stream()
    )

    rows = [["Name", "Email", "Nickname", "Title", "Role", "Joined Date", "Status"]]
    for doc in docs:
        md = doc.to_dict()
        user_doc = db.collection("users").document(md["user_id"]).get()
        name, email = "Unknown", ""
        if user_doc.exists:
            ud = user_doc.to_dict()
            name = ud.get("name") or ud.get("email") or "Unknown"
            email = ud.get("email") or ""
        joined = md.get("joined_at") or md.get("approved_at")
        if joined is None:
            joined_str = ""
        elif hasattr(joined, "strftime"):
            joined_str = joined.strftime("%Y-%m-%d")
        elif hasattr(joined, "timestamp"):
            joined_str = datetime.fromtimestamp(joined.timestamp(), tz=timezone.utc).strftime("%Y-%m-%d")
        elif isinstance(joined, str):
            joined_str = joined[:10] if len(joined) >= 10 else joined
        else:
            joined_str = ""
        rows.append([
            name,
            email,
            md.get("nickname") or "",
            md.get("title") or "",
            md.get("role", ""),
            joined_str,
            md.get("status", "approved"),
        ])

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerows(rows)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=members.csv"},
    )
