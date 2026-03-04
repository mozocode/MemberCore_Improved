"""Organization members API - list, update role, approve, reject, export, import CSV."""
import csv
import io
import re
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile, status, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.db.firebase import get_firestore
from app.core.security import get_current_user_id, get_current_user, generate_uuid, hash_password

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
            full_name = ud.get("name") or ud.get("email", "") or ""
            nickname = (md.get("nickname") or "").strip()
            display_name = nickname if nickname else (full_name.split()[0] if full_name else "Unknown")
            md["name"] = display_name
            md["email"] = ud.get("email", "")
            md["avatar"] = ud.get("avatar")
            md["initial"] = (display_name or "?")[0].upper()
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


# Simple email validation for CSV import
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _normalize_csv_headers(row: list) -> dict:
    """Map first row to lowercase keys for case-insensitive column lookup."""
    return { (cell or "").strip().lower(): i for i, cell in enumerate(row) }


def _parse_csv_row(row: list, headers: dict) -> Optional[dict]:
    """Extract first_name, last_name, email, role from a data row. Returns None if email missing/invalid."""
    def get(col: str) -> str:
        idx = headers.get(col)
        if idx is None or idx >= len(row):
            return ""
        return (row[idx] or "").strip()

    email = get("email")
    if not email or not _EMAIL_RE.match(email):
        return None
    first = get("first_name") or get("first name")
    last = get("last_name") or get("last name")
    role_raw = (get("role") or "member").lower()
    role = role_raw if role_raw in ("admin", "member", "restricted") else "member"
    return {
        "first_name": first,
        "last_name": last,
        "email": email.lower(),
        "role": role,
    }


@router.post("/{org_id}/members/import-csv")
async def import_members_csv(
    org_id: str,
    file: UploadFile = File(..., alias="file"),
    user: dict = Depends(get_current_user),
):
    """Import members from CSV. Creates users if needed and adds them as pending members. Admin/owner only."""
    db = get_firestore()
    my_role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(my_role)

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file")

    content = await file.read()
    try:
        text = content.decode("utf-8").replace("\r\n", "\n").replace("\r", "\n")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded")

    reader = csv.reader(io.StringIO(text))
    rows_list = list(reader)
    if not rows_list:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    headers = _normalize_csv_headers(rows_list[0])
    if "email" not in headers:
        raise HTTPException(status_code=400, detail="CSV must have an 'email' column")

    result_rows: list[dict] = []
    imported_count = 0
    skipped_count = 0

    for row_index, row in enumerate(rows_list[1:], start=2):  # 1-based, skip header
        if not row or all(not (c or "").strip() for c in row):
            continue
        parsed = _parse_csv_row(row, headers)
        if not parsed:
            email_idx = headers.get("email", 0)
            display_email = (row[email_idx] if email_idx < len(row) else "") or ""
            result_rows.append({
                "row_index": row_index,
                "email": display_email,
                "status": "invalid",
                "error_message": "Missing or invalid email",
            })
            skipped_count += 1
            continue

        email = parsed["email"]
        users_ref = db.collection("users")
        existing_users = list(users_ref.where("email", "==", email).limit(1).get())

        if existing_users:
            user_doc = existing_users[0]
            user_id = user_doc.id
            # Optionally update name if we have first/last and user exists
            ud = user_doc.to_dict() or {}
            if (parsed["first_name"] or parsed["last_name"]) and not (ud.get("name") or "").strip():
                name = f"{parsed['first_name']} {parsed['last_name']}".strip()
                if name:
                    users_ref.document(user_id).update({
                        "name": name,
                        "updated_at": datetime.now(timezone.utc),
                    })
        else:
            user_id = generate_uuid()
            name = f"{parsed['first_name']} {parsed['last_name']}".strip() or email
            temp_password = secrets.token_urlsafe(16)
            now = datetime.now(timezone.utc)
            user_data = {
                "id": user_id,
                "email": email,
                "name": name,
                "hashed_password": hash_password(temp_password),
                "avatar": None,
                "phone_number": None,
                "is_active": True,
                "is_platform_admin": False,
                "created_at": now,
                "updated_at": now,
            }
            users_ref.document(user_id).set(user_data)

        # Check if already a member of this org
        existing_members = list(
            db.collection("members")
            .where("user_id", "==", user_id)
            .where("organization_id", "==", org_id)
            .limit(1)
            .get()
        )
        if existing_members:
            result_rows.append({
                "row_index": row_index,
                "email": email,
                "status": "duplicate",
                "error_message": "Already a member",
            })
            skipped_count += 1
            continue

        member_id = generate_uuid()
        now = datetime.now(timezone.utc)
        member_data = {
            "id": member_id,
            "user_id": user_id,
            "organization_id": org_id,
            "role": parsed["role"],
            "status": "pending",
            "title": None,
            "nickname": None,
            "role_label": None,
            "allowed_channels": [],
            "joined_at": now,
        }
        db.collection("members").document(member_id).set(member_data)
        result_rows.append({"row_index": row_index, "email": email, "status": "imported"})
        imported_count += 1

    return {
        "imported_count": imported_count,
        "skipped_count": skipped_count,
        "rows": result_rows,
    }
