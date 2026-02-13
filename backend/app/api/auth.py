from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr

from app.db.firebase import get_firestore, doc_to_dict
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user_id,
    generate_uuid,
)

router = APIRouter()


class SignUpRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    password: str


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


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
        "is_platform_admin": email_lower == "admin@example.com",
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
    token = create_access_token({"sub": user_id})
    user_resp = {
        "id": user_id,
        "email": data.get("email", ""),
        "name": data.get("name", ""),
        "avatar": data.get("avatar"),
        "phone_number": data.get("phone_number"),
        "is_platform_admin": data.get("is_platform_admin", False),
    }
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_resp,
    }


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

    data = doc.to_dict()
    return _user_to_response({"id": doc.id, **data})


class UpdateMeRequest(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None
    phone_number: Optional[str] = None


# Firestore document limit is 1 MiB; keep avatar well under to leave room for other fields.
MAX_AVATAR_BASE64_BYTES = 400_000  # ~300 KB image as base64


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
        avatar_len = len(req.avatar.encode("utf-8"))
        if avatar_len > MAX_AVATAR_BASE64_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"Image too large ({avatar_len // 1024} KB). Please use a smaller photo (under 300 KB) or crop before uploading.",
            )
        updates["avatar"] = req.avatar

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
