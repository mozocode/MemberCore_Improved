"""Documents API - list, templates, upload. Firestore backend."""
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.db.firebase import get_firestore
from app.core.security import get_current_user_id, get_current_user, generate_uuid
from app.core.images import normalize_image_value

router = APIRouter()


class CreateOrgDocumentRequest(BaseModel):
    title: str
    content: str  # base64 or URL
    file_type: str = "pdf"
    folder_name: Optional[str] = None
    visibility: str = "club"  # club | custom
    viewer_user_ids: Optional[List[str]] = None


class UpdateOrgDocumentRequest(BaseModel):
    title: Optional[str] = None
    folder_name: Optional[str] = None
    is_pinned: Optional[bool] = None


class UpdateDocumentViewersRequest(BaseModel):
    visibility: str = "club"  # club | custom
    viewer_user_ids: Optional[List[str]] = None


class CreateTemplateRequest(BaseModel):
    title: str
    description: str = ""
    uploader_mode: str = "all"  # admins | all | selected
    default_visibility: str = "club"
    uploader_user_ids: Optional[List[str]] = None
    viewer_user_ids: Optional[List[str]] = None


class UpdateTemplateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    uploader_mode: Optional[str] = None
    default_visibility: Optional[str] = None
    uploader_user_ids: Optional[List[str]] = None
    viewer_user_ids: Optional[List[str]] = None


class UploadForTemplateRequest(BaseModel):
    title: str = "Upload"
    file_url: str


class CreateGoogleFormRequest(BaseModel):
    title: str
    form_url: str


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
    return members[0].to_dict().get("role", "member")


def _require_admin_or_owner(role: str):
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin or owner access required")


@router.post("/{org_id}")
def create_org_document(
    org_id: str,
    req: CreateOrgDocumentRequest,
    user: dict = Depends(get_current_user),
):
    """Create organization document. Admin/owner only."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(role)

    doc_id = generate_uuid()
    now = datetime.now(timezone.utc)
    visibility = (req.visibility or "club").strip()
    if visibility not in ("club", "custom"):
        visibility = "club"
    db.collection("documents").document(doc_id).set({
        "id": doc_id,
        "organization_id": org_id,
        "title": req.title.strip(),
        "content": normalize_image_value(
            req.content,
            field_label="Document image",
            strict_data_url=False,
            max_data_url_length=720_000,
            max_dimension=1400,
            jpeg_quality=74,
        ),
        "file_type": req.file_type,
        "folder_name": (req.folder_name or "").strip() or None,
        "is_pinned": False,
        "visibility": visibility,
        "viewer_user_ids": req.viewer_user_ids or [],
        "type_doc": "org",
        "created_by": user["id"],
        "created_at": now,
    })
    return {"id": doc_id, "ok": True}


@router.patch("/{org_id}/{doc_id}")
def update_org_document(
    org_id: str,
    doc_id: str,
    req: UpdateOrgDocumentRequest,
    user: dict = Depends(get_current_user),
):
    """Update org document (title, folder, pin). Admin/owner only."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(role)

    ref = db.collection("documents").document(doc_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.to_dict().get("organization_id") != org_id or doc.to_dict().get("type_doc") != "org":
        raise HTTPException(status_code=404, detail="Document not found")

    updates = {}
    if req.title is not None:
        updates["title"] = req.title.strip()
    if req.folder_name is not None:
        updates["folder_name"] = (req.folder_name or "").strip() or None
    if req.is_pinned is not None:
        updates["is_pinned"] = req.is_pinned
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        ref.update(updates)
    return {"ok": True}


@router.delete("/{org_id}/{doc_id}")
def delete_org_document(
    org_id: str,
    doc_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete org document. Admin/owner only."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(role)

    ref = db.collection("documents").document(doc_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.to_dict().get("organization_id") != org_id or doc.to_dict().get("type_doc") != "org":
        raise HTTPException(status_code=404, detail="Document not found")
    ref.delete()
    return {"ok": True}


@router.put("/{org_id}/{doc_id}/viewers")
def update_document_viewers(
    org_id: str,
    doc_id: str,
    req: UpdateDocumentViewersRequest,
    user: dict = Depends(get_current_user),
):
    """Update who can view this document. Admin/owner only."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(role)

    ref = db.collection("documents").document(doc_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.to_dict().get("organization_id") != org_id or doc.to_dict().get("type_doc") != "org":
        raise HTTPException(status_code=404, detail="Document not found")

    visibility = (req.visibility or "club").strip()
    if visibility not in ("club", "custom"):
        visibility = "club"
    ref.update({
        "visibility": visibility,
        "viewer_user_ids": req.viewer_user_ids or [],
        "updated_at": datetime.now(timezone.utc),
    })
    return {"ok": True}


@router.post("/{org_id}/templates")
def create_template(
    org_id: str,
    req: CreateTemplateRequest,
    user: dict = Depends(get_current_user),
):
    """Create required document template. Admin/owner only."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(role)

    doc_id = generate_uuid()
    now = datetime.now(timezone.utc)
    uploader_mode = (req.uploader_mode or "all").strip()
    if uploader_mode not in ("admins", "all", "selected"):
        uploader_mode = "all"
    default_visibility = (req.default_visibility or "club").strip()
    if default_visibility not in ("club", "custom"):
        default_visibility = "club"
    db.collection("document_templates").document(doc_id).set({
        "id": doc_id,
        "organization_id": org_id,
        "title": req.title.strip(),
        "description": (req.description or "").strip() or None,
        "uploader_mode": uploader_mode,
        "default_visibility": default_visibility,
        "uploader_user_ids": req.uploader_user_ids or [],
        "viewer_user_ids": req.viewer_user_ids or [],
        "is_active": True,
        "created_by": user["id"],
        "created_at": now,
    })
    return {"id": doc_id, "ok": True}


@router.put("/{org_id}/templates/{template_id}")
def update_template(
    org_id: str,
    template_id: str,
    req: UpdateTemplateRequest,
    user: dict = Depends(get_current_user),
):
    """Update template. Admin/owner only."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(role)

    ref = db.collection("document_templates").document(template_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Template not found")
    if doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Template not found")

    updates = {}
    if req.title is not None:
        updates["title"] = req.title.strip()
    if req.description is not None:
        updates["description"] = (req.description or "").strip() or None
    if req.uploader_mode is not None:
        updates["uploader_mode"] = req.uploader_mode if req.uploader_mode in ("admins", "all", "selected") else "all"
    if req.default_visibility is not None:
        updates["default_visibility"] = req.default_visibility if req.default_visibility in ("club", "custom") else "club"
    if req.uploader_user_ids is not None:
        updates["uploader_user_ids"] = req.uploader_user_ids
    if req.viewer_user_ids is not None:
        updates["viewer_user_ids"] = req.viewer_user_ids
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        ref.update(updates)
    return {"ok": True}


@router.delete("/{org_id}/templates/{template_id}")
def delete_template(
    org_id: str,
    template_id: str,
    user: dict = Depends(get_current_user),
):
    """Soft-delete template. Admin/owner only."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(role)

    ref = db.collection("document_templates").document(template_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Template not found")
    if doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Template not found")
    ref.update({"is_active": False, "updated_at": datetime.now(timezone.utc)})
    return {"ok": True}


@router.get("/{org_id}/templates/{template_id}/submissions")
def list_template_submissions(
    org_id: str,
    template_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """List all member submissions for a template. Admin/owner only."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user_id)
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin or owner access required")

    tdoc = db.collection("document_templates").document(template_id).get()
    if not tdoc.exists or tdoc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Template not found")

    docs = list(
        db.collection("member_documents")
        .where("template_id", "==", template_id)
        .where("organization_id", "==", org_id)
        .stream()
    )
    result = []
    for doc in docs:
        d = doc.to_dict()
        uid = d.get("user_id")
        user_name = user_email = "Unknown"
        if uid:
            udoc = db.collection("users").document(uid).get()
            if udoc.exists:
                u = udoc.to_dict()
                user_name = u.get("name") or u.get("email") or "Unknown"
                user_email = u.get("email") or ""
        result.append({
            "id": doc.id,
            "title": d.get("title", "Upload"),
            "file_url": d.get("file_url"),
            "uploaded_by_id": uid,
            "uploaded_by_name": user_name,
            "uploaded_by_email": user_email,
            "uploaded_at": d.get("created_at"),
        })
    result.sort(key=lambda x: (str(x.get("uploaded_at") or ""),), reverse=True)
    return result


@router.get("/{org_id}/google-forms")
def list_google_forms(
    org_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """List Google Forms linked to this organization. Any member can view."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    docs = list(
        db.collection("org_google_forms")
        .where("organization_id", "==", org_id)
        .stream()
    )
    result = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        result.append(d)
    result.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return result


@router.post("/{org_id}/google-forms")
def create_google_form(
    org_id: str,
    req: CreateGoogleFormRequest,
    user: dict = Depends(get_current_user),
):
    """Add a Google Form link. Admin/owner only."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(role)

    form_url = (req.form_url or "").strip()
    if not form_url:
        raise HTTPException(status_code=400, detail="Form URL is required")
    if not form_url.startswith("https://"):
        form_url = "https://" + form_url

    doc_id = generate_uuid()
    now = datetime.now(timezone.utc)
    db.collection("org_google_forms").document(doc_id).set({
        "id": doc_id,
        "organization_id": org_id,
        "title": (req.title or "Google Form").strip() or "Google Form",
        "form_url": form_url,
        "created_by": user["id"],
        "created_at": now,
    })
    return {"id": doc_id, "ok": True}


@router.delete("/{org_id}/google-forms/{form_id}")
def delete_google_form(
    org_id: str,
    form_id: str,
    user: dict = Depends(get_current_user),
):
    """Remove a linked Google Form. Admin/owner only."""
    db = get_firestore()
    role = _require_org_member(db, org_id, user["id"])
    _require_admin_or_owner(role)

    ref = db.collection("org_google_forms").document(form_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Form link not found")
    if doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Form link not found")
    ref.delete()
    return {"ok": True}


@router.get("/{org_id}")
def list_org_documents(
    org_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """List organization documents (admin-uploaded)."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    docs = list(
        db.collection("documents")
        .where("organization_id", "==", org_id)
        .where("type_doc", "==", "org")
        .stream()
    )
    result = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        result.append(d)
    result.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return result


@router.get("/{org_id}/templates")
def list_templates(
    org_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """List required document templates."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    docs = list(
        db.collection("document_templates")
        .where("organization_id", "==", org_id)
        .stream()
    )
    result = []
    for doc in docs:
        d = doc.to_dict()
        if d.get("is_active") is False:
            continue
        d["id"] = doc.id
        # Count submissions for this template
        submissions = list(
            db.collection("member_documents")
            .where("template_id", "==", doc.id)
            .where("organization_id", "==", org_id)
            .stream()
        )
        d["submission_count"] = len(submissions)
        # Check if current user has uploaded
        my_doc = [s for s in submissions if s.to_dict().get("user_id") == user_id]
        d["uploaded"] = len(my_doc) > 0
        d["my_document_id"] = my_doc[0].id if my_doc else None
        result.append(d)
    return result


@router.get("/{org_id}/my-documents")
def list_my_documents(
    org_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """List user's uploaded documents (for templates)."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    docs = list(
        db.collection("member_documents")
        .where("organization_id", "==", org_id)
        .where("user_id", "==", user_id)
        .stream()
    )
    result = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        # Fetch template title
        tid = d.get("template_id")
        if tid:
            tdoc = db.collection("document_templates").document(tid).get()
            if tdoc.exists:
                d["template_title"] = tdoc.to_dict().get("title", "")
        result.append(d)
    return result


@router.post("/{org_id}/templates/{template_id}")
def upload_for_template(
    org_id: str,
    template_id: str,
    req: UploadForTemplateRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Upload document for a required template."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    tdoc = db.collection("document_templates").document(template_id).get()
    if not tdoc.exists:
        raise HTTPException(status_code=404, detail="Template not found")
    if tdoc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Template not found")

    # Replace existing upload
    existing = list(
        db.collection("member_documents")
        .where("template_id", "==", template_id)
        .where("user_id", "==", user_id)
        .get()
    )
    for e in existing:
        db.collection("member_documents").document(e.id).delete()

    doc_id = generate_uuid()
    now = datetime.now(timezone.utc)
    db.collection("member_documents").document(doc_id).set({
        "id": doc_id,
        "organization_id": org_id,
        "template_id": template_id,
        "user_id": user_id,
        "title": req.title or "Upload",
        "file_url": normalize_image_value(
            req.file_url,
            field_label="Document image",
            strict_data_url=False,
            max_data_url_length=720_000,
            max_dimension=1400,
            jpeg_quality=74,
        ),
        "created_at": now,
    })
    return {"id": doc_id, "ok": True}
