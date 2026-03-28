from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.config import settings
from app.db.firebase import get_firestore, doc_to_dict
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user_id,
    generate_uuid,
)
from app.core.email import build_reset_password_url, send_password_reset_email
from app.core.images import normalize_image_value

router = APIRouter()


class SignUpRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    password: str


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


class GoogleAuthRequest(BaseModel):
    id_token: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    avatar: Optional[str] = None
    is_platform_admin: bool = False


def _user_to_response(d: dict) -> dict:
    return {
        "id": d["id"],
        "email": d["email"],
        "name": d["name"],
        "avatar": d.get("avatar"),
        "phone_number": d.get("phone_number"),
        "is_platform_admin": d.get("is_platform_admin", False),
    }


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _create_reset_token() -> str:
    return secrets.token_urlsafe(32)


def _password_valid(password: str) -> bool:
    return len(password or "") >= 8


def _is_super_admin_email(email: str) -> bool:
    return (email or "").strip().lower() == (settings.super_admin_email or "").strip().lower()


def _ensure_super_admin_flag(db, user_id: str, user_data: dict) -> dict:
    """Backfill is_platform_admin for existing users when SUPER_ADMIN_EMAIL matches."""
    email = (user_data.get("email") or "").strip().lower()
    if _is_super_admin_email(email) and not bool(user_data.get("is_platform_admin")):
        db.collection("users").document(user_id).update({
            "is_platform_admin": True,
            "updated_at": datetime.utcnow(),
        })
        return {**user_data, "is_platform_admin": True}
    return user_data


def _allowed_google_client_ids() -> set[str]:
    raw = settings.google_client_ids or ""
    return {v.strip() for v in raw.split(",") if v.strip()}


def _verify_google_id_token(raw_id_token: str) -> dict:
    token = (raw_id_token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Google token is required")
    try:
        info = google_id_token.verify_oauth2_token(token, google_requests.Request(), audience=None)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    allowed_aud = _allowed_google_client_ids()
    aud = str(info.get("aud", "")).strip()
    if allowed_aud and aud not in allowed_aud:
        raise HTTPException(status_code=401, detail="Google client ID is not allowed")
    if not info.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google email is not verified")
    return info


@router.post("/signup")
def signup(req: SignUpRequest):
    try:
        db = get_firestore()
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Database connection failed. Ensure Firestore emulator is running (FIRESTORE_EMULATOR_HOST=localhost:8080) or Firebase credentials are configured. Error: {str(e)}",
        )
    email_lower = req.email.lower().strip()
    users_ref = db.collection("users")

    # Check existing
    existing = users_ref.where("email", "==", email_lower).limit(1).get()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = generate_uuid()
    user_data = {
        "id": user_id,
        "email": email_lower,
        "name": f"{req.first_name.strip()} {req.last_name.strip()}".strip(),
        "hashed_password": hash_password(req.password),
        "avatar": None,
        "phone_number": None,
        "is_active": True,
        "is_platform_admin": _is_super_admin_email(email_lower),
        "created_at": None,  # Firestore will use server timestamp if we use set()
        "updated_at": None,
    }

    from datetime import datetime
    now = datetime.utcnow()
    user_data["created_at"] = now
    user_data["updated_at"] = now

    try:
        users_ref.document(user_id).set(user_data)
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to save user. Check Firestore connection. Error: {str(e)}",
        )
    user_data["id"] = user_id

    token = create_access_token({"sub": user_id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_to_response(user_data),
    }


@router.post("/signin")
def signin(req: SignInRequest):
    try:
        db = get_firestore()
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Database connection failed. Error: {str(e)}",
        )
    email_lower = req.email.lower().strip()
    users_ref = db.collection("users")

    users = users_ref.where("email", "==", email_lower).limit(1).get()
    if not users:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    doc = users[0]
    data = doc.to_dict()
    if not data.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is suspended")

    if not verify_password(req.password, data["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = doc.id
    data = _ensure_super_admin_flag(db, user_id, data)
    token = create_access_token({"sub": user_id})
    user_resp = {
        "id": user_id,
        "email": data.get("email", ""),
        "name": data.get("name", ""),
        "avatar": data.get("avatar"),
        "phone_number": data.get("phone_number"),
        "is_platform_admin": bool(data.get("is_platform_admin", False)),
    }
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_resp,
    }


@router.post("/google")
def google_auth(req: GoogleAuthRequest):
    db = get_firestore()
    payload = _verify_google_id_token(req.id_token)
    email_lower = str(payload.get("email", "")).strip().lower()
    if not email_lower:
        raise HTTPException(status_code=400, detail="Google account is missing an email")

    users_ref = db.collection("users")
    users = users_ref.where("email", "==", email_lower).limit(1).get()
    if users:
        doc = users[0]
        data = doc.to_dict() or {}
        if not data.get("is_active", True):
            raise HTTPException(status_code=401, detail="Account is suspended")

        updates = {"updated_at": datetime.utcnow()}
        if not data.get("avatar") and payload.get("picture"):
            updates["avatar"] = payload.get("picture")
        if (not data.get("name")) and payload.get("name"):
            updates["name"] = str(payload.get("name")).strip()
        if len(updates) > 1:
            users_ref.document(doc.id).update(updates)
            data = {**data, **updates}
        user_id = doc.id
    else:
        given = str(payload.get("given_name", "")).strip()
        family = str(payload.get("family_name", "")).strip()
        full_name = f"{given} {family}".strip() or str(payload.get("name", "")).strip()
        if not full_name:
            full_name = email_lower.split("@")[0]
        user_id = generate_uuid()
        now = datetime.utcnow()
        user_data = {
            "id": user_id,
            "email": email_lower,
            "name": full_name,
            "hashed_password": hash_password(secrets.token_urlsafe(32)),
            "avatar": payload.get("picture"),
            "phone_number": None,
            "is_active": True,
            "is_platform_admin": _is_super_admin_email(email_lower),
            "auth_provider": "google",
            "created_at": now,
            "updated_at": now,
        }
        users_ref.document(user_id).set(user_data)
        data = user_data

    data = _ensure_super_admin_flag(db, user_id, data)
    token = create_access_token({"sub": user_id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": data.get("email", ""),
            "name": data.get("name", ""),
            "avatar": data.get("avatar"),
            "phone_number": data.get("phone_number"),
            "is_platform_admin": bool(data.get("is_platform_admin", False)),
        },
    }


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    """Always return success to avoid account enumeration."""
    db = get_firestore()
    email_lower = req.email.lower().strip()
    users_ref = db.collection("users")
    users = users_ref.where("email", "==", email_lower).limit(1).get()

    if users:
        doc = users[0]
        token = _create_reset_token()
        token_hash = _hash_reset_token(token)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
        users_ref.document(doc.id).update({
            "password_reset_token_hash": token_hash,
            "password_reset_expires_at": expires_at,
            "updated_at": datetime.utcnow(),
        })
        send_password_reset_email(
            to_email=email_lower,
            reset_url=build_reset_password_url(token),
        )

    return {"ok": True, "message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    db = get_firestore()
    token = (req.token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Invalid reset token")
    if not _password_valid(req.password):
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    token_hash = _hash_reset_token(token)
    users_ref = db.collection("users")
    users = users_ref.where("password_reset_token_hash", "==", token_hash).limit(1).get()
    if not users:
        raise HTTPException(status_code=400, detail="Reset link is invalid or expired")

    doc = users[0]
    data = doc.to_dict() or {}
    expires_at = data.get("password_reset_expires_at")
    if not expires_at:
        raise HTTPException(status_code=400, detail="Reset link is invalid or expired")

    now = datetime.now(timezone.utc)
    if hasattr(expires_at, "tzinfo"):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
    if now > expires_at:
        raise HTTPException(status_code=400, detail="Reset link is invalid or expired")

    users_ref.document(doc.id).update({
        "hashed_password": hash_password(req.password),
        "password_reset_token_hash": None,
        "password_reset_expires_at": None,
        "updated_at": datetime.utcnow(),
    })
    return {"ok": True, "message": "Password updated successfully"}


@router.get("/me")
def get_me(user_id: str = Depends(get_current_user_id)):
    try:
        db = get_firestore()
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Database connection failed. Error: {str(e)}",
        )
    doc = db.collection("users").document(user_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    data = _ensure_super_admin_flag(db, doc.id, doc.to_dict() or {})
    return _user_to_response({"id": doc.id, **data})


class UpdateMeRequest(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None
    phone_number: Optional[str] = None


@router.put("/me")
def update_me(req: UpdateMeRequest, user_id: str = Depends(get_current_user_id)):
    db = get_firestore()
    ref = db.collection("users").document(user_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    updates = {}
    if req.name is not None:
        updates["name"] = req.name.strip()
    if req.phone_number is not None:
        updates["phone_number"] = (req.phone_number or "").strip() or None
    if req.avatar is not None:
        updates["avatar"] = normalize_image_value(
            req.avatar,
            field_label="Avatar image",
            strict_data_url=False,
            max_data_url_length=420_000,
            max_dimension=900,
            jpeg_quality=72,
        )

    if updates:
        from datetime import datetime
        updates["updated_at"] = datetime.utcnow()
        try:
            ref.update(updates)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to save profile. The image may be too large. Try a smaller photo. Error: {str(e)}",
            )

    data = ref.get().to_dict()
    return _user_to_response({"id": user_id, **data})
