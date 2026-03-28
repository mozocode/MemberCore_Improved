"""Direct messaging (DM) between organization members. Firestore-backed."""
from datetime import datetime, timezone
from typing import Optional, List
import ipaddress
import re
import urllib.parse
import urllib.request

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from google.cloud import firestore

from app.db.firebase import get_firestore
from app.core.security import get_current_user_id, get_current_user, generate_uuid
from app.core.images import normalize_image_value

router = APIRouter()

MAX_DM_IMAGE_DATA_URL_LENGTH = 700_000
MAX_LINK_PREVIEW_HTML_BYTES = 350_000
_URL_RE = re.compile(r"(https?://[^\s<>()\"']+)")
_META_TAG_RE = re.compile(r"<meta[^>]+>", re.IGNORECASE)
_ATTR_RE = re.compile(r"([a-zA-Z_:.-]+)\s*=\s*([\"'])(.*?)\2")
_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)


def _normalize_image_data_url(raw: Optional[str]) -> Optional[str]:
    return normalize_image_value(
        raw,
        field_label="Image attachment",
        strict_data_url=True,
        max_data_url_length=MAX_DM_IMAGE_DATA_URL_LENGTH,
        max_dimension=1280,
        jpeg_quality=72,
    )


def _extract_first_url(content: str) -> Optional[str]:
    m = _URL_RE.search(content or "")
    if not m:
        return None
    return m.group(1).strip()


def _is_public_url(url: str) -> bool:
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        host = (parsed.hostname or "").strip().lower()
        if not host or host in ("localhost",):
            return False
        try:
            ip = ipaddress.ip_address(host)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False
        except ValueError:
            pass
        return True
    except Exception:
        return False


def _pick_meta(html: str, names: List[str]) -> Optional[str]:
    wanted = {n.lower() for n in names}
    for tag in _META_TAG_RE.findall(html):
        attrs = {}
        for k, _, v in _ATTR_RE.findall(tag):
            attrs[k.lower()] = v.strip()
        key = (attrs.get("property") or attrs.get("name") or "").lower()
        if key in wanted:
            value = attrs.get("content") or ""
            if value:
                return value
    return None


def _build_link_preview(content: str) -> Optional[dict]:
    url = _extract_first_url(content)
    if not url or not _is_public_url(url):
        return None
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "MemberCoreBot/1.0 (+https://membercore.io)",
                "Accept": "text/html,application/xhtml+xml",
            },
        )
        with urllib.request.urlopen(req, timeout=6) as resp:
            ctype = (resp.headers.get("Content-Type") or "").lower()
            if "text/html" not in ctype and "application/xhtml+xml" not in ctype:
                return {"url": url}
            html = resp.read(MAX_LINK_PREVIEW_HTML_BYTES).decode("utf-8", errors="ignore")
        og_title = _pick_meta(html, ["og:title", "twitter:title"])
        og_desc = _pick_meta(html, ["og:description", "twitter:description", "description"])
        og_image = _pick_meta(html, ["og:image", "twitter:image"])
        og_site = _pick_meta(html, ["og:site_name"])
        if not og_title:
            tm = _TITLE_RE.search(html)
            if tm:
                og_title = re.sub(r"\s+", " ", tm.group(1)).strip()
        preview = {"url": url}
        if og_title:
            preview["title"] = og_title[:180]
        if og_desc:
            preview["description"] = og_desc[:300]
        if og_image:
            preview["image"] = urllib.parse.urljoin(url, og_image)
        if og_site:
            preview["site_name"] = og_site[:120]
        return preview
    except Exception:
        return {"url": url}


def _get_conversation_id(user_id1: str, user_id2: str) -> str:
    sorted_ids = sorted([user_id1, user_id2])
    return f"{sorted_ids[0]}_{sorted_ids[1]}"


def _require_org_member(db, org_id: str, user_id: str) -> dict:
    members = list(
        db.collection("members")
        .where("user_id", "==", user_id)
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .limit(1)
        .get()
    )
    if not members:
        raise HTTPException(status_code=404, detail="Organization not found")
    d = members[0].to_dict()
    d["id"] = members[0].id
    return d


def _user_dict(db, user_id: str) -> dict:
    doc = db.collection("users").document(user_id).get()
    if not doc.exists:
        return {"id": user_id, "name": "Unknown", "email": "", "avatar": None}
    d = doc.to_dict()
    d["id"] = doc.id
    return {"id": doc.id, "name": d.get("name", "Unknown"), "email": d.get("email", ""), "avatar": d.get("avatar")}


def _display_name_for_org_user(db, org_id: str, user_id: str) -> str:
    """Nickname if set, else first name only."""
    user_doc = db.collection("users").document(user_id).get()
    ud = user_doc.to_dict() if user_doc.exists else {}
    full_name = (ud.get("name") or ud.get("email") or "").strip()
    first_name = full_name.split()[0] if full_name else "Unknown"
    members = list(
        db.collection("members")
        .where("user_id", "==", user_id)
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .limit(1)
        .get()
    )
    nickname = (members[0].to_dict().get("nickname") or "").strip() if members else ""
    return nickname if nickname else first_name


def _normalize_reactions(raw: dict) -> dict:
    out: dict = {}
    for emoji, value in (raw or {}).items():
        if isinstance(value, list):
            uid_map = {uid: True for uid in value}
            out[emoji] = {"count": len(value), "uids": uid_map}
        elif isinstance(value, dict):
            out[emoji] = {
                "count": value.get("count", len(value.get("uids") or {})),
                "uids": value.get("uids") or {},
            }
    return out


def _reactions_for_api(raw: dict, current_uid: str) -> list:
    normalized = _normalize_reactions(raw)
    result = []
    for emoji, meta in normalized.items():
        count = meta.get("count", 0)
        if count <= 0:
            continue
        result.append({
            "emoji": emoji,
            "count": count,
            "reactedByMe": bool((meta.get("uids") or {}).get(current_uid)),
        })
    return result


# --- Conversations ---


@router.get("/{org_id}/dm/conversations")
def list_conversations(
    org_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """List DM conversations for the current user in this org."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    conv_ref = db.collection("dm_conversations")
    # Firestore: query where organization_id == org_id AND participants array-contains user_id
    q = conv_ref.where("organization_id", "==", org_id).where("participants", "array_contains", user_id)
    docs = list(q.stream())

    result = []
    for doc in docs:
        d = doc.to_dict()
        other_id = next((p for p in d.get("participants", []) if p != user_id), None)
        other_details = (d.get("participant_details") or {}).get(other_id) if other_id else {}
        if other_id:
            display_name = _display_name_for_org_user(db, org_id, other_id)
            other_user = _user_dict(db, other_id)
            other_participant = {"id": other_id, "name": display_name, "email": other_user.get("email", ""), "avatar": other_details.get("avatar") or other_user.get("avatar")}
        else:
            other_participant = None
        result.append({
            "id": doc.id,
            "participants": d.get("participants", []),
            "participant_details": d.get("participant_details", {}),
            "other_participant": other_participant,
            "created_at": _ts_iso(d.get("created_at")),
            "updated_at": _ts_iso(d.get("updated_at")),
            "last_message": d.get("last_message"),
            "unread_count": (d.get("unread_count") or {}).get(user_id, 0),
        })
    # Sort by updated_at desc (client-side; for large lists use order_by in query + composite index)
    result.sort(key=lambda x: x.get("updated_at") or "", reverse=True)
    return result


def _ts_iso(ts):
    if ts is None:
        return None
    if hasattr(ts, "isoformat"):
        return ts.isoformat()
    if hasattr(ts, "timestamp"):
        return datetime.fromtimestamp(ts.timestamp(), tz=timezone.utc).isoformat()
    return str(ts)


class CreateConversationRequest(BaseModel):
    other_user_id: str


@router.post("/{org_id}/dm/conversations")
def create_or_get_conversation(
    org_id: str,
    req: CreateConversationRequest,
    user: dict = Depends(get_current_user),
):
    """Create a DM conversation with another org member, or return existing."""
    db = get_firestore()
    _require_org_member(db, org_id, user["id"])
    other_id = (req.other_user_id or "").strip()
    if not other_id or other_id == user["id"]:
        raise HTTPException(status_code=400, detail="Invalid other_user_id")

    # Other user must be an approved member of the org
    other_members = list(
        db.collection("members")
        .where("user_id", "==", other_id)
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .limit(1)
        .get()
    )
    if not other_members:
        raise HTTPException(status_code=404, detail="User is not a member of this organization")

    conv_id = _get_conversation_id(user["id"], other_id)
    conv_ref = db.collection("dm_conversations").document(conv_id)
    existing = conv_ref.get()

    if existing.exists:
        d = existing.to_dict()
        other_details = (d.get("participant_details") or {}).get(other_id)
        display_name = _display_name_for_org_user(db, org_id, other_id)
        other_user = _user_dict(db, other_id)
        other_participant = {"id": other_id, "name": display_name, "email": other_user.get("email", ""), "avatar": (other_details or {}).get("avatar") or other_user.get("avatar")}
        return {
            "id": conv_id,
            "participants": d.get("participants", []),
            "participant_details": d.get("participant_details", {}),
            "other_participant": other_participant,
            "created_at": _ts_iso(d.get("created_at")),
            "updated_at": _ts_iso(d.get("updated_at")),
            "last_message": d.get("last_message"),
            "unread_count": (d.get("unread_count") or {}).get(user["id"], 0),
        }

    other_user = _user_dict(db, other_id)
    other_display = _display_name_for_org_user(db, org_id, other_id)
    user_display = _display_name_for_org_user(db, org_id, user["id"])
    now = datetime.now(timezone.utc)
    conv_data = {
        "organization_id": org_id,
        "participants": [user["id"], other_id],
        "participant_details": {
            user["id"]: {
                "name": user_display,
                "email": user.get("email", ""),
                "avatar": user.get("avatar"),
            },
            other_id: {
                "name": other_display,
                "email": other_user.get("email", ""),
                "avatar": other_user.get("avatar"),
            },
        },
        "created_at": now,
        "updated_at": now,
        "last_message": None,
        "unread_count": {user["id"]: 0, other_id: 0},
    }
    conv_ref.set(conv_data)
    return {
        "id": conv_id,
        "participants": conv_data["participants"],
        "participant_details": conv_data["participant_details"],
        "other_participant": {"id": other_id, **conv_data["participant_details"][other_id]},
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "last_message": None,
        "unread_count": 0,
    }


@router.get("/{org_id}/dm/conversations/{conv_id}")
def get_conversation(
    org_id: str,
    conv_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Get a single conversation. User must be a participant."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    conv_ref = db.collection("dm_conversations").document(conv_id)
    doc = conv_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Conversation not found")
    d = doc.to_dict()
    if d.get("organization_id") != org_id or user_id not in d.get("participants", []):
        raise HTTPException(status_code=404, detail="Conversation not found")

    other_id = next((p for p in d.get("participants", []) if p != user_id), None)
    other_details = (d.get("participant_details") or {}).get(other_id) if other_id else {}
    if other_id:
        display_name = _display_name_for_org_user(db, org_id, other_id)
        other_user = _user_dict(db, other_id)
        other_participant = {"id": other_id, "name": display_name, "email": other_user.get("email", ""), "avatar": other_details.get("avatar") or other_user.get("avatar")}
    else:
        other_participant = None
    return {
        "id": doc.id,
        "participants": d.get("participants", []),
        "participant_details": d.get("participant_details", {}),
        "other_participant": other_participant,
        "created_at": _ts_iso(d.get("created_at")),
        "updated_at": _ts_iso(d.get("updated_at")),
        "last_message": d.get("last_message"),
        "unread_count": (d.get("unread_count") or {}).get(user_id, 0),
    }


# --- Messages ---


@router.get("/{org_id}/dm/conversations/{conv_id}/messages")
def list_messages(
    org_id: str,
    conv_id: str,
    limit: int = 100,
    user_id: str = Depends(get_current_user_id),
):
    """List messages in a DM conversation."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    conv_ref = db.collection("dm_conversations").document(conv_id)
    conv_doc = conv_ref.get()
    if not conv_doc.exists or conv_doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if user_id not in (conv_doc.to_dict().get("participants") or []):
        raise HTTPException(status_code=403, detail="Not a participant")

    messages_ref = conv_ref.collection("messages")
    docs = list(messages_ref.order_by("sent_at", direction="ASCENDING").limit(limit).stream())

    result = []
    for doc in docs:
        m = doc.to_dict()
        m["id"] = doc.id
        m["sent_at"] = _ts_iso(m.get("sent_at"))
        m["edited_at"] = _ts_iso(m.get("edited_at"))
        m["reactions"] = _reactions_for_api(m.get("reactions") or {}, user_id)
        result.append(m)
    return result


class SendMessageRequest(BaseModel):
    text: str = ""
    content: Optional[str] = None
    image_data_url: Optional[str] = None


class EditMessageRequest(BaseModel):
    text: str


class ToggleReactionRequest(BaseModel):
    emoji: str


@router.post("/{org_id}/dm/conversations/{conv_id}/messages")
def send_message(
    org_id: str,
    conv_id: str,
    req: SendMessageRequest,
    user: dict = Depends(get_current_user),
):
    """Send a DM. Updates conversation last_message and unread count for recipient."""
    db = get_firestore()
    _require_org_member(db, org_id, user["id"])

    conv_ref = db.collection("dm_conversations").document(conv_id)
    conv_doc = conv_ref.get()
    if not conv_doc.exists:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv_data = conv_doc.to_dict()
    if conv_data.get("organization_id") != org_id or user["id"] not in conv_data.get("participants", []):
        raise HTTPException(status_code=403, detail="Not a participant")

    text = ((req.text or req.content) or "").strip()
    image_data_url = _normalize_image_data_url(req.image_data_url)
    if not text and not image_data_url:
        raise HTTPException(status_code=400, detail="Message text or image required")

    now = datetime.now(timezone.utc)
    other_id = next((p for p in conv_data["participants"] if p != user["id"]), None)
    msg_id = generate_uuid()
    msg_data = {
        "sender_id": user["id"],
        "text": text,
        "image_data_url": image_data_url,
        "link_preview": _build_link_preview(text) if text else None,
        "sent_at": now,
        "read_by": [user["id"]],
    }
    conv_ref.collection("messages").document(msg_id).set(msg_data)

    # Update conversation: last_message, updated_at, increment other's unread
    last_message_text = text or "📷 Image"
    updates = {
        "last_message": {"text": last_message_text, "sender_id": user["id"], "sent_at": now},
        "updated_at": now,
        f"unread_count.{other_id}": conv_data.get("unread_count", {}).get(other_id, 0) + 1,
    }
    conv_ref.update(updates)

    return {
        "id": msg_id,
        "sender_id": user["id"],
        "text": text,
        "image_data_url": image_data_url,
        "link_preview": msg_data.get("link_preview"),
        "sent_at": now.isoformat(),
        "read_by": [user["id"]],
    }


@router.patch("/{org_id}/dm/conversations/{conv_id}/messages/{msg_id}")
def edit_message(
    org_id: str,
    conv_id: str,
    msg_id: str,
    req: EditMessageRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Edit a DM message. Only sender may edit."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    conv_ref = db.collection("dm_conversations").document(conv_id)
    conv_doc = conv_ref.get()
    if not conv_doc.exists or conv_doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv_data = conv_doc.to_dict() or {}
    if user_id not in (conv_data.get("participants") or []):
        raise HTTPException(status_code=403, detail="Not a participant")

    msg_ref = conv_ref.collection("messages").document(msg_id)
    msg_doc = msg_ref.get()
    if not msg_doc.exists:
        raise HTTPException(status_code=404, detail="Message not found")
    msg = msg_doc.to_dict() or {}
    if msg.get("sender_id") != user_id:
        raise HTTPException(status_code=403, detail="You can only edit your own messages")

    text = (req.text or "").strip()
    if not text and not msg.get("image_data_url"):
        raise HTTPException(status_code=400, detail="Message text required")
    now = datetime.now(timezone.utc)
    msg_ref.update({
        "text": text,
        "link_preview": _build_link_preview(text) if text else None,
        "edited_at": now,
    })

    latest_docs = list(
        conv_ref.collection("messages")
        .order_by("sent_at", direction="DESCENDING")
        .limit(1)
        .stream()
    )
    if latest_docs and latest_docs[0].id == msg_id:
        conv_ref.update({
            "last_message": {"text": text or "📷 Image", "sender_id": user_id, "sent_at": msg.get("sent_at")},
            "updated_at": now,
        })

    return {"ok": True, "id": msg_id, "text": text, "edited_at": now.isoformat()}


@router.post("/{org_id}/dm/conversations/{conv_id}/messages/{msg_id}/reactions")
def toggle_reaction(
    org_id: str,
    conv_id: str,
    msg_id: str,
    req: ToggleReactionRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Toggle reaction on a DM message."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    conv_ref = db.collection("dm_conversations").document(conv_id)
    conv_doc = conv_ref.get()
    if not conv_doc.exists or conv_doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv_data = conv_doc.to_dict() or {}
    if user_id not in (conv_data.get("participants") or []):
        raise HTTPException(status_code=403, detail="Not a participant")

    emoji = (req.emoji or "").strip()[:32]
    if not emoji:
        raise HTTPException(status_code=400, detail="Emoji required")

    msg_ref = conv_ref.collection("messages").document(msg_id)

    @firestore.transactional
    def _toggle_in_tx(tx, ref):
        snap = ref.get(transaction=tx)
        if not snap.exists:
            raise HTTPException(status_code=404, detail="Message not found")
        data = snap.to_dict() or {}
        reactions = _normalize_reactions(data.get("reactions") or {})
        existing = reactions.get(emoji, {"count": 0, "uids": {}})
        has_reacted = bool(existing["uids"].get(user_id))
        if has_reacted:
            existing["uids"].pop(user_id, None)
            existing["count"] = max(0, existing["count"] - 1)
        else:
            existing["uids"][user_id] = True
            existing["count"] = existing.get("count", 0) + 1
        if existing["count"] <= 0:
            reactions.pop(emoji, None)
        else:
            reactions[emoji] = existing
        tx.update(ref, {"reactions": reactions})
        return reactions

    tx = db.transaction()
    final_reactions = _toggle_in_tx(tx, msg_ref)
    return {"ok": True, "id": msg_id, "reactions": _reactions_for_api(final_reactions, user_id)}


@router.post("/{org_id}/dm/conversations/{conv_id}/read")
def mark_conversation_read(
    org_id: str,
    conv_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Mark this conversation as read for the current user."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    conv_ref = db.collection("dm_conversations").document(conv_id)
    conv_doc = conv_ref.get()
    if not conv_doc.exists or conv_doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if user_id not in (conv_doc.to_dict().get("participants") or []):
        raise HTTPException(status_code=403, detail="Not a participant")

    conv_ref.update({f"unread_count.{user_id}": 0})
    return {"ok": True}


# --- Member search for new DM ---


@router.get("/{org_id}/dm/members")
def list_dm_members(
    org_id: str,
    search: Optional[str] = "",
    user_id: str = Depends(get_current_user_id),
):
    """List org members (excluding self) for starting a new DM. Optional search by name/email."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    members = list(
        db.collection("members")
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .get()
    )
    out = []
    search_lower = (search or "").strip().lower()
    for m in members:
        md = m.to_dict()
        uid = md.get("user_id")
        if uid == user_id:
            continue
        user_doc = db.collection("users").document(uid).get()
        ud = user_doc.to_dict() if user_doc.exists else {}
        email = ud.get("email") or ""
        name = _display_name_for_org_user(db, org_id, uid)
        if search_lower and search_lower not in name.lower() and search_lower not in email.lower():
            continue
        out.append({
            "id": uid,
            "name": name,
            "email": email,
            "avatar": ud.get("avatar"),
            "role": md.get("role", "member"),
        })
    out.sort(key=lambda x: (x.get("name") or "").lower())
    return out
