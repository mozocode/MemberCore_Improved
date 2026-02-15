from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field

from app.db.firebase import get_firestore
from app.core.security import get_current_user_id, get_current_user, generate_uuid, generate_invite_code
import re

router = APIRouter()


class CreateOrgRequest(BaseModel):
    name: str
    type: str = "Other (Admin approval required)"
    organization_category: Optional[str] = None
    sport_type: Optional[str] = None
    cultural_identity: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None


def _slugify(name: str) -> str:
    s = re.sub(r"[^\w\s-]", "", name.lower())
    s = re.sub(r"[-\s]+", "-", s).strip("-")
    return s or "org"


def _ensure_unique_slug(db, base_slug: str, exclude_id: Optional[str] = None) -> str:
    slugs_ref = db.collection("organizations")
    slug = base_slug
    n = 0
    while True:
        existing = list(slugs_ref.where("public_slug", "==", slug).limit(1).get())
        if not existing or (exclude_id and existing[0].id == exclude_id):
            return slug
        n += 1
        slug = f"{base_slug}-{n}"


@router.get("")
def list_organizations(user_id: str = Depends(get_current_user_id)):
    """List organizations the user belongs to (approved) or has pending membership."""
    db = get_firestore()
    members = list(db.collection("members").where("user_id", "==", user_id).get())

    orgs = []
    seen_oids = set()
    for m in members:
        md = m.to_dict()
        oid = md.get("organization_id")
        if not oid or oid in seen_oids:
            continue
        seen_oids.add(oid)
        doc = db.collection("organizations").document(oid).get()
        if not doc.exists:
            continue
        d = doc.to_dict()
        if d.get("is_deleted"):
            continue
        d["id"] = doc.id
        d["membership_status"] = md.get("status", "approved")
        orgs.append(d)
    return orgs


@router.post("")
def create_organization(req: CreateOrgRequest, user: dict = Depends(get_current_user)):
    db = get_firestore()
    org_id = generate_uuid()
    base_slug = _slugify(req.name)
    public_slug = _ensure_unique_slug(db, base_slug or "org")

    from datetime import datetime
    now = datetime.utcnow()

    org_data = {
        "id": org_id,
        "name": req.name.strip(),
        "type": req.type.strip() or "Other (Admin approval required)",
        "organization_category": (req.organization_category or "").strip() or None,
        "sport_type": (req.sport_type or "").strip() or None,
        "cultural_identity": (req.cultural_identity or "").strip() or None,
        "description": (req.description or "").strip() or None,
        "location": (req.location or "").strip() or None,
        "logo": None,
        "public_slug": public_slug,
        "invite_code": generate_invite_code(),
        "dues_label": "Dues",
        "icon_color": "#3f3f46",
        "menu_hidden_pages": [],
        "is_pro": user.get("is_platform_admin", False),
        "trial_start_date": now,
        "is_verified": False,
        "is_suspended": False,
        "is_deleted": False,
        "owner_id": user["id"],
        "created_at": now,
        "platform_admin_owned": user.get("is_platform_admin", False),
    }

    db.collection("organizations").document(org_id).set(org_data)

    # Create owner member
    member_id = generate_uuid()
    member_data = {
        "id": member_id,
        "user_id": user["id"],
        "organization_id": org_id,
        "role": "owner",
        "status": "approved",
        "title": None,
        "nickname": None,
        "role_label": None,
        "allowed_channels": [],
        "joined_at": now,
        "approved_at": now,
        "approved_by": user["id"],
    }
    db.collection("members").document(member_id).set(member_data)

    return {**org_data, "id": org_id}


def _public_org_payload(doc) -> dict:
    """Limited public info for join pages."""
    d = doc.to_dict()
    return {
        "id": doc.id,
        "name": d.get("name", ""),
        "description": d.get("description"),
        "logo": d.get("logo"),
        "icon_color": d.get("icon_color", "#FFFFFF"),
        "invite_code": d.get("invite_code", ""),
    }


@router.get("/by-slug/{slug}")
def get_organization_by_slug(slug: str):
    """Get organization by public slug (public endpoint for join pages)."""
    db = get_firestore()
    slug_clean = (slug or "").strip().lower()
    if not slug_clean:
        raise HTTPException(status_code=404, detail="Organization not found")
    refs = list(db.collection("organizations").where("public_slug", "==", slug_clean).limit(1).get())
    if not refs or refs[0].to_dict().get("is_deleted"):
        raise HTTPException(status_code=404, detail="Organization not found")
    return _public_org_payload(refs[0])


@router.get("/by-invite/{invite_code}")
def get_organization_by_invite_code(invite_code: str):
    """Get organization by invite code (public endpoint for join pages)."""
    db = get_firestore()
    code = (invite_code or "").strip().upper()
    if not code:
        raise HTTPException(status_code=404, detail="Organization not found")
    refs = list(db.collection("organizations").where("invite_code", "==", code).limit(1).get())
    if not refs or refs[0].to_dict().get("is_deleted"):
        raise HTTPException(status_code=404, detail="Organization not found")
    return _public_org_payload(refs[0])


def _join_organization(db, org_id: str, user_id: str):
    """Create or reactivate membership with pending status. Returns (status, detail for error)."""
    from datetime import datetime
    org_ref = db.collection("organizations").document(org_id)
    org_doc = org_ref.get()
    if not org_doc.exists or org_doc.to_dict().get("is_deleted"):
        return None, "Organization not found"
    members = list(
        db.collection("members")
        .where("user_id", "==", user_id)
        .where("organization_id", "==", org_id)
        .limit(1)
        .get()
    )
    if members:
        md = members[0].to_dict()
        status_val = md.get("status", "approved")
        if status_val == "pending":
            return "pending", "already_pending"
        if status_val == "approved" and md.get("approved_at"):
            return "approved", "already_member"
        # e.g. rejected or inactive – reactivate as pending
        member_id = members[0].id
        db.collection("members").document(member_id).update({
            "status": "pending",
            "joined_at": datetime.utcnow(),
        })
        return "pending", None
    # New membership
    member_id = generate_uuid()
    now = datetime.utcnow()
    member_data = {
        "id": member_id,
        "user_id": user_id,
        "organization_id": org_id,
        "role": "member",
        "status": "pending",
        "title": None,
        "nickname": None,
        "role_label": None,
        "allowed_channels": [],
        "joined_at": now,
    }
    db.collection("members").document(member_id).set(member_data)
    return "pending", None


@router.post("/join/{invite_code}")
def join_organization_by_code(invite_code: str, user_id: str = Depends(get_current_user_id)):
    """Join an organization using an invite code. New members require approval."""
    db = get_firestore()
    code = (invite_code or "").strip().upper()
    if not code:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    refs = list(db.collection("organizations").where("invite_code", "==", code).limit(1).get())
    if not refs:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    org_id = refs[0].id
    status_val, err = _join_organization(db, org_id, user_id)
    if err == "already_member":
        raise HTTPException(status_code=400, detail="Already a member of this organization")
    if err == "already_pending":
        raise HTTPException(status_code=400, detail="Your membership is pending approval")
    return {"status": status_val, "organization_id": org_id}


@router.post("/{org_id}/join")
def join_organization_direct(org_id: str, user_id: str = Depends(get_current_user_id)):
    """Join an organization by ID (for slug-based join pages)."""
    db = get_firestore()
    status_val, err = _join_organization(db, org_id, user_id)
    if err == "Organization not found":
        raise HTTPException(status_code=404, detail="Organization not found")
    if err == "already_member":
        raise HTTPException(status_code=400, detail="Already a member of this organization")
    if err == "already_pending":
        raise HTTPException(status_code=400, detail="Your membership is pending approval")
    return {"status": status_val, "organization_id": org_id}


class UpdateMemberSettingsRequest(BaseModel):
    nickname: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, max_length=50)
    mute_notifications: Optional[bool] = None


@router.get("/{org_id}/members/me")
def get_my_membership(org_id: str, user_id: str = Depends(get_current_user_id)):
    """Get current user's membership (role) for an organization."""
    db = get_firestore()
    members = (
        db.collection("members")
        .where("user_id", "==", user_id)
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .limit(1)
        .get()
    )
    if not members:
        raise HTTPException(status_code=404, detail="Not a member of this organization")
    d = members[0].to_dict()
    d["id"] = members[0].id
    return {"role": d.get("role", "member"), **d}


@router.put("/{org_id}/members/me/settings")
def update_my_member_settings(org_id: str, req: UpdateMemberSettingsRequest, user_id: str = Depends(get_current_user_id)):
    """Update current user's org-specific settings (nickname, title)."""
    db = get_firestore()
    members = (
        db.collection("members")
        .where("user_id", "==", user_id)
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .limit(1)
        .get()
    )
    if not members:
        raise HTTPException(status_code=404, detail="Not a member of this organization")

    ref = db.collection("members").document(members[0].id)
    updates = {}
    if req.nickname is not None:
        updates["nickname"] = (req.nickname or "").strip() or None
    if req.title is not None:
        updates["title"] = (req.title or "").strip() or None
    if req.mute_notifications is not None:
        updates["mute_notifications"] = req.mute_notifications

    if updates:
        from datetime import datetime
        updates["updated_at"] = datetime.utcnow()
        ref.update(updates)

    d = ref.get().to_dict()
    d["id"] = ref.id
    return {"role": d.get("role", "member"), **d}


@router.post("/{org_id}/members/me/leave")
def leave_organization(org_id: str, user_id: str = Depends(get_current_user_id)):
    """Leave the organization. Owner must transfer ownership first."""
    db = get_firestore()
    members = list(
        db.collection("members")
        .where("user_id", "==", user_id)
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .get()
    )
    if not members:
        raise HTTPException(status_code=404, detail="Not a member of this organization")
    role = members[0].to_dict().get("role", "member")
    if role == "owner":
        raise HTTPException(
            status_code=400,
            detail="Owners cannot leave. Transfer ownership to another member first (Organization Settings).",
        )
    db.collection("members").document(members[0].id).delete()
    return {"ok": True}


class UpdateOrgRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    location: Optional[str] = Field(None, max_length=200)
    logo: Optional[str] = None
    icon_color: Optional[str] = None
    public_slug: Optional[str] = None
    dues_label: Optional[str] = None
    menu_hidden_pages: Optional[list] = None
    type: Optional[str] = None
    organization_category: Optional[str] = None
    sport_type: Optional[str] = None
    cultural_identity: Optional[str] = None


def _require_owner_or_admin(db, org_id: str, user_id: str):
    members = db.collection("members").where("user_id", "==", user_id).where("organization_id", "==", org_id).limit(1).get()
    if not members:
        raise HTTPException(status_code=404, detail="Organization not found")
    role = members[0].to_dict().get("role", "member")
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin or owner access required")
    return role


@router.get("/{org_id}")
def get_organization(org_id: str, user_id: str = Depends(get_current_user_id)):
    db = get_firestore()
    members = db.collection("members").where("user_id", "==", user_id).where("organization_id", "==", org_id).limit(1).get()
    if not members:
        raise HTTPException(status_code=404, detail="Organization not found")

    doc = db.collection("organizations").document(org_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Organization not found")
    d = doc.to_dict()
    if d.get("is_deleted"):
        raise HTTPException(status_code=404, detail="Organization not found")
    d["id"] = doc.id
    return d


@router.put("/{org_id}")
def update_organization(org_id: str, req: UpdateOrgRequest, user_id: str = Depends(get_current_user_id)):
    db = get_firestore()
    _require_owner_or_admin(db, org_id, user_id)
    ref = db.collection("organizations").document(org_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("is_deleted"):
        raise HTTPException(status_code=404, detail="Organization not found")

    updates = {}
    if req.name is not None:
        name = req.name.strip()
        if len(name) < 2:
            raise HTTPException(status_code=400, detail="Organization name must be at least 2 characters")
        if len(name) > 100:
            raise HTTPException(status_code=400, detail="Organization name must be at most 100 characters")
        updates["name"] = name
    if req.description is not None:
        desc = (req.description or "").strip() or None
        if desc is not None and len(desc) > 500:
            raise HTTPException(status_code=400, detail="Description must be at most 500 characters")
        updates["description"] = desc
    if req.location is not None:
        loc = (req.location or "").strip() or None
        if loc is not None and len(loc) > 200:
            raise HTTPException(status_code=400, detail="Location must be at most 200 characters")
        updates["location"] = loc
    if req.logo is not None:
        if req.logo and len(req.logo.encode("utf-8")) > 500_000:
            raise HTTPException(status_code=400, detail="Logo image too large. Use a smaller image (under 400 KB).")
        updates["logo"] = (req.logo or "").strip() or None
    if req.icon_color is not None:
        color = (req.icon_color or "").strip() or "#3f3f46"
        if color and not re.match(r"^#[0-9A-Fa-f]{6}$", color):
            raise HTTPException(status_code=400, detail="Icon color must be a valid hex value (e.g. #FFFFFF)")
        updates["icon_color"] = color
    if req.dues_label is not None:
        updates["dues_label"] = (req.dues_label or "").strip() or "Dues"
    if req.menu_hidden_pages is not None:
        updates["menu_hidden_pages"] = req.menu_hidden_pages
    if req.type is not None:
        updates["type"] = (req.type or "").strip()
    if req.organization_category is not None:
        updates["organization_category"] = (req.organization_category or "").strip() or None
    if req.sport_type is not None:
        updates["sport_type"] = (req.sport_type or "").strip() or None
    if req.cultural_identity is not None:
        updates["cultural_identity"] = (req.cultural_identity or "").strip() or None

    if req.public_slug is not None:
        slug = re.sub(r"[^a-z0-9-]", "", (req.public_slug or "").lower().strip())
        if len(slug) < 3:
            raise HTTPException(status_code=400, detail="Slug must be at least 3 characters")
        if len(slug) > 50:
            raise HTTPException(status_code=400, detail="Slug must be at most 50 characters")
        existing = list(db.collection("organizations").where("public_slug", "==", slug).limit(1).get())
        if existing and existing[0].id != org_id:
            raise HTTPException(status_code=400, detail="Slug already in use")
        updates["public_slug"] = slug

    if updates:
        from datetime import datetime
        updates["updated_at"] = datetime.utcnow()
        ref.update(updates)

    return ref.get().to_dict() | {"id": org_id}


@router.post("/{org_id}/regenerate-invite")
def regenerate_invite(org_id: str, user_id: str = Depends(get_current_user_id)):
    db = get_firestore()
    _require_owner_or_admin(db, org_id, user_id)
    ref = db.collection("organizations").document(org_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("is_deleted"):
        raise HTTPException(status_code=404, detail="Organization not found")

    new_code = generate_invite_code()
    ref.update({"invite_code": new_code})
    return {"invite_code": new_code}


@router.delete("/{org_id}")
def delete_organization(org_id: str, user_id: str = Depends(get_current_user_id)):
    db = get_firestore()
    members = db.collection("members").where("user_id", "==", user_id).where("organization_id", "==", org_id).limit(1).get()
    if not members:
        raise HTTPException(status_code=404, detail="Organization not found")
    if members[0].to_dict().get("role") != "owner":
        raise HTTPException(status_code=403, detail="Only owner can delete organization")

    ref = db.collection("organizations").document(org_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("is_deleted"):
        raise HTTPException(status_code=404, detail="Organization not found")

    from datetime import datetime
    ref.update({"is_deleted": True, "deleted_at": datetime.utcnow()})
    return {"ok": True}
