"""Chat API - channels, messages, WebSocket."""
from datetime import datetime, timezone
from typing import Optional, List
import ipaddress
import re
import urllib.parse
import urllib.request

from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from google.cloud import firestore

from app.db.firebase import get_firestore
from app.core.security import get_current_user_id, get_current_user, generate_uuid, decode_token
from app.core.images import normalize_image_value

router = APIRouter()

MAX_CHAT_IMAGE_DATA_URL_LENGTH = 700_000
MAX_LINK_PREVIEW_HTML_BYTES = 350_000
_URL_RE = re.compile(r"(https?://[^\s<>()\"']+)")
_META_TAG_RE = re.compile(r"<meta[^>]+>", re.IGNORECASE)
_ATTR_RE = re.compile(r"([a-zA-Z_:.-]+)\s*=\s*([\"'])(.*?)\2")
_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)


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


def _normalize_image_data_url(raw: Optional[str]) -> Optional[str]:
    return normalize_image_value(
        raw,
        field_label="Image attachment",
        strict_data_url=True,
        max_data_url_length=MAX_CHAT_IMAGE_DATA_URL_LENGTH,
        max_dimension=1280,
        jpeg_quality=72,
    )


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
    return members[0].to_dict()


def _require_admin_or_owner(role: str):
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin or owner access required")


def _ensure_general_channel(db, org_id: str):
    """Create #general channel if none exist."""
    existing = list(
        db.collection("channels")
        .where("organization_id", "==", org_id)
        .limit(1)
        .get()
    )
    if not existing:
        ch_id = generate_uuid()
        now = datetime.now(timezone.utc)
        db.collection("channels").document(ch_id).set({
            "id": ch_id,
            "organization_id": org_id,
            "name": "general",
            "is_restricted": False,
            "is_default": True,
            "visibility": "everyone",
            "allowed_members": [],
            "allowed_roles": [],
            "created_by": None,
            "created_at": now,
        })
        return ch_id
    return None


def _get_general_channel_id(db, org_id: str) -> Optional[str]:
    """Return the general/main channel id for the org. Finds 'general' by name or first channel; creates if none."""
    docs = list(
        db.collection("channels")
        .where("organization_id", "==", org_id)
        .stream()
    )
    for doc in docs:
        d = doc.to_dict()
        if (d.get("name") or "").lower() == "general":
            return doc.id
    if docs:
        return docs[0].id
    ch_id = _ensure_general_channel(db, org_id)
    return ch_id


def post_to_general_chat(
    db,
    org_id: str,
    user_id: str,
    message_type: str,
    content: str,
    *,
    event_data: Optional[dict] = None,
    event_id: Optional[str] = None,
    poll_data: Optional[dict] = None,
    poll_id: Optional[str] = None,
    poll_options: Optional[list] = None,
):
    """
    Post a message to the organization's general channel. Used for activity feed (events, polls).
    Returns (channel_id, message_doc) so caller can broadcast via WebSocket. Does not broadcast.
    """
    channel_id = _get_general_channel_id(db, org_id)
    if not channel_id:
        return None, None
    user_doc = db.collection("users").document(user_id).get()
    user = user_doc.to_dict() if user_doc.exists else {}
    user["id"] = user_doc.id if user_doc.exists else user_id
    member_docs = list(
        db.collection("members")
        .where("user_id", "==", user_id)
        .where("organization_id", "==", org_id)
        .limit(1)
        .get()
    )
    member = member_docs[0].to_dict() if member_docs else {}
    msg_id = generate_uuid()
    now = datetime.now(timezone.utc)
    msg_doc = {
        "id": msg_id,
        "channel_id": channel_id,
        "organization_id": org_id,
        "sender_id": user_id,
        "sender_name": user.get("name", "Unknown"),
        "sender_nickname": member.get("nickname"),
        "sender_avatar": user.get("avatar"),
        "content": content,
        "type": message_type,
        "event_data": event_data,
        "event_id": event_id,
        "poll_data": poll_data,
        "poll_id": poll_id,
        "poll_options": poll_options,
        "created_at": now,
    }
    db.collection("messages").document(msg_id).set(msg_doc)
    out = dict(msg_doc)
    out["created_at"] = now.isoformat()
    return channel_id, out


def _can_see_channel(db, channel: dict, user_id: str, org_id: str, member_role: str) -> bool:
    """Check if user can see this channel.
    - Restricted-role members: can ONLY see restricted channels they are allowed into (allowed_roles or allowed_members).
    - Other members: public channels visible to all; restricted channels if creator, admin/owner, or in allowed_roles/allowed_members.
    """
    vis = channel.get("visibility") or "everyone"
    is_restricted_channel = vis == "restricted" or channel.get("is_restricted")

    if member_role == "restricted":
        if not is_restricted_channel:
            return False
        if channel.get("created_by") == user_id:
            return True
        if "restricted" in (channel.get("allowed_roles") or []):
            return True
        if user_id in (channel.get("allowed_members") or []):
            return True
        return False

    if vis in ("public", "everyone"):
        if channel.get("is_restricted"):
            return (
                channel.get("created_by") == user_id
                or member_role in ("owner", "admin")
                or member_role in (channel.get("allowed_roles") or [])
                or user_id in (channel.get("allowed_members") or [])
            )
        return True
    if vis == "restricted":
        if channel.get("created_by") == user_id:
            return True
        if member_role in ("owner", "admin"):
            return True
        if member_role in (channel.get("allowed_roles") or []):
            return True
        return user_id in (channel.get("allowed_members") or [])
    # legacy "select" or private: only allowed_members (user IDs)
    allowed = channel.get("allowed_members") or []
    if not allowed:
        return member_role in ("owner", "admin")
    return user_id in allowed


# --- HTTP API ---


class CreateChannelRequest(BaseModel):
    name: str
    description: Optional[str] = None
    is_restricted: bool = False
    visibility: str = "public"  # "public" | "restricted"
    allowed_members: List[str] = []  # user IDs


class UpdateChannelRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_restricted: Optional[bool] = None
    visibility: Optional[str] = None
    allowed_members: Optional[List[str]] = None
    allowed_roles: Optional[List[str]] = None


class PinMessageRequest(BaseModel):
    message_id: Optional[str] = None  # null or omit to unpin


@router.get("/{org_id}/channels")
def list_channels(
    org_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """List channels for organization. Ensures #general exists."""
    db = get_firestore()
    member = _require_org_member(db, org_id, user_id)
    role = member.get("role", "member")
    _ensure_general_channel(db, org_id)

    docs = list(
        db.collection("channels")
        .where("organization_id", "==", org_id)
        .stream()
    )
    result = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        if _can_see_channel(db, d, user_id, org_id, role):
            result.append(d)
    result.sort(key=lambda x: (x.get("name") or "").lower())
    return result


@router.post("/{org_id}/channels")
def create_channel(
    org_id: str,
    req: CreateChannelRequest,
    user: dict = Depends(get_current_user),
):
    """Create channel. Any approved member can create public; only admin/owner can create restricted."""
    db = get_firestore()
    member = list(
        db.collection("members")
        .where("user_id", "==", user["id"])
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .limit(1)
        .get()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Organization not found")
    role = member[0].to_dict().get("role", "member")
    if role == "restricted":
        raise HTTPException(status_code=403, detail="Prospects cannot create chat channels")

    visibility = (req.visibility or "public").strip().lower()
    if visibility not in ("public", "restricted"):
        visibility = "public"
    is_restricted = req.is_restricted or (visibility == "restricted")
    if is_restricted and role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only admins can create restricted channels")

    name = (req.name or "").strip().lower().replace(" ", "-").replace("?", "").replace("'", "")
    if not name:
        raise HTTPException(status_code=400, detail="Channel name required")
    if name == "general":
        raise HTTPException(status_code=400, detail="Channel 'general' is reserved")

    existing = list(
        db.collection("channels")
        .where("organization_id", "==", org_id)
        .where("name", "==", name)
        .limit(1)
        .get()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Channel already exists")

    allowed_members = list(req.allowed_members or [])
    if is_restricted and user["id"] not in allowed_members:
        allowed_members.append(user["id"])
    allowed_roles = ["restricted", "admin", "owner"] if is_restricted else []

    ch_id = generate_uuid()
    now = datetime.now(timezone.utc)
    db.collection("channels").document(ch_id).set({
        "id": ch_id,
        "organization_id": org_id,
        "name": name,
        "description": (req.description or "").strip() or None,
        "is_restricted": is_restricted,
        "is_default": False,
        "visibility": visibility,
        "allowed_members": allowed_members,
        "allowed_roles": allowed_roles,
        "created_by": user["id"],
        "created_at": now,
    })
    return {"id": ch_id, "ok": True}


@router.patch("/{org_id}/channels/{channel_id}")
def update_channel(
    org_id: str,
    channel_id: str,
    req: UpdateChannelRequest,
    user: dict = Depends(get_current_user),
):
    """Update channel. Creator or admin/owner. Only admin can change visibility to restricted."""
    db = get_firestore()
    member = list(
        db.collection("members")
        .where("user_id", "==", user["id"])
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .limit(1)
        .get()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Organization not found")
    role = member[0].to_dict().get("role", "member")

    ref = db.collection("channels").document(channel_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Channel not found")
    ch = doc.to_dict()
    creator = ch.get("created_by")
    is_creator = creator == user["id"]
    is_admin = role in ("owner", "admin")
    if not is_creator and not is_admin:
        raise HTTPException(status_code=403, detail="Only the channel creator or an admin can update this channel")

    updates = {}
    if req.name is not None:
        name = req.name.strip().lower().replace(" ", "-").replace("?", "").replace("'", "")
        if name and name != "general":
            updates["name"] = name
    if req.description is not None:
        updates["description"] = (req.description or "").strip() or None
    if req.is_restricted is not None:
        updates["is_restricted"] = req.is_restricted
    if req.visibility is not None:
        new_vis = req.visibility.strip().lower()
        if new_vis in ("public", "restricted"):
            if new_vis == "restricted" and not is_admin:
                raise HTTPException(status_code=403, detail="Only admins can set channel to restricted")
            updates["visibility"] = new_vis
            if new_vis == "restricted":
                updates["is_restricted"] = True
                updates["allowed_roles"] = ["restricted", "admin", "owner"]
            else:
                updates["is_restricted"] = False
                updates["allowed_roles"] = []
                updates["allowed_members"] = []
    if req.allowed_members is not None:
        updates["allowed_members"] = req.allowed_members
    if req.allowed_roles is not None:
        updates["allowed_roles"] = req.allowed_roles

    if updates:
        ref.update(updates)
    return {"ok": True}


@router.put("/{org_id}/channels/{channel_id}/pin")
def pin_message(
    org_id: str,
    channel_id: str,
    req: PinMessageRequest,
    user: dict = Depends(get_current_user),
):
    """Pin or unpin a message in the channel. Admin/owner or channel creator only."""
    db = get_firestore()
    member = list(
        db.collection("members")
        .where("user_id", "==", user["id"])
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .limit(1)
        .get()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Organization not found")
    role = member[0].to_dict().get("role", "member")

    ref = db.collection("channels").document(channel_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Channel not found")
    ch = doc.to_dict()
    creator = ch.get("created_by")
    is_creator = creator == user["id"]
    if role not in ("owner", "admin") and not is_creator:
        raise HTTPException(status_code=403, detail="Only channel creator or admin/owner can pin messages")

    if req.message_id:
        msg_doc = db.collection("messages").document(req.message_id).get()
        if not msg_doc.exists or msg_doc.to_dict().get("channel_id") != channel_id:
            raise HTTPException(status_code=400, detail="Message not found in this channel")
        ref.update({"pinned_message_id": req.message_id})
    else:
        ref.update({"pinned_message_id": None})
    return {"ok": True, "pinned_message_id": req.message_id}


@router.delete("/{org_id}/channels/{channel_id}")
def delete_channel(
    org_id: str,
    channel_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete channel. Creator or admin/owner. Cannot delete #general."""
    db = get_firestore()
    member = list(
        db.collection("members")
        .where("user_id", "==", user["id"])
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .limit(1)
        .get()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Organization not found")
    role = member[0].to_dict().get("role", "member")

    ref = db.collection("channels").document(channel_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Channel not found")
    ch = doc.to_dict()
    if ch.get("is_default") or (ch.get("name") or "").lower() == "general":
        raise HTTPException(status_code=400, detail="Cannot delete #general")
    if ch.get("created_by") != user["id"] and role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only the channel creator or an admin can delete this channel")

    ref.delete()
    return {"ok": True}


@router.get("/{org_id}/channels/{channel_id}/messages")
def list_messages(
    org_id: str,
    channel_id: str,
    limit: int = 50,
    before_id: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
):
    """List messages in channel (paginated)."""
    db = get_firestore()
    member = _require_org_member(db, org_id, user_id)
    role = member.get("role", "member")

    ch_doc = db.collection("channels").document(channel_id).get()
    if not ch_doc.exists or ch_doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Channel not found")

    ch = ch_doc.to_dict()
    if not _can_see_channel(db, ch, user_id, org_id, role):
        raise HTTPException(status_code=403, detail="Cannot access this channel")

    query = (
        db.collection("messages")
        .where("channel_id", "==", channel_id)
        .order_by("created_at", direction="DESCENDING")
        .limit(limit)
    )
    if before_id:
        before_doc = db.collection("messages").document(before_id).get()
        if before_doc.exists:
            query = query.start_after(before_doc)

    docs = list(query.stream())
    messages = []
    sender_ids_missing_avatar = set()
    for d in docs:
        m = d.to_dict()
        m["id"] = d.id
        created = m.get("created_at")
        if hasattr(created, "isoformat"):
            m["created_at"] = created.isoformat()
        edited = m.get("edited_at")
        if hasattr(edited, "isoformat"):
            m["edited_at"] = edited.isoformat()
        if not m.get("sender_avatar") and m.get("sender_id"):
            sender_ids_missing_avatar.add(m["sender_id"])
        messages.append(m)

    if sender_ids_missing_avatar:
        users_ref = db.collection("users")
        avatars = {}
        for uid in sender_ids_missing_avatar:
            u = users_ref.document(uid).get()
            if u.exists:
                av = u.to_dict().get("avatar")
                if av:
                    avatars[uid] = av
        for m in messages:
            if not m.get("sender_avatar") and m.get("sender_id") in avatars:
                m["sender_avatar"] = avatars[m["sender_id"]]

    messages.reverse()

    # Transform reactions to API format with reactedByMe for current user
    for m in messages:
        raw_reactions = m.get("reactions") or {}
        if raw_reactions:
            m["reactions"] = _reactions_for_api(raw_reactions, user_id)
        else:
            m["reactions"] = []

    # Include last read position for this user (smart unread clusters)
    read_doc_id = f"{user_id}_{channel_id}"
    read_ref = db.collection("channel_reads").document(read_doc_id)
    read_doc = read_ref.get()
    last_read = {}
    if read_doc.exists:
        r = read_doc.to_dict()
        last_read["last_read_message_id"] = r.get("last_read_message_id")
        if r.get("last_read_timestamp") and hasattr(r["last_read_timestamp"], "isoformat"):
            last_read["last_read_timestamp"] = r["last_read_timestamp"].isoformat()
        elif isinstance(r.get("last_read_timestamp"), str):
            last_read["last_read_timestamp"] = r["last_read_timestamp"]

    return {
        "messages": messages,
        "pinned_message_id": ch.get("pinned_message_id"),
        **last_read,
    }


class PutReadRequest(BaseModel):
    last_read_message_id: Optional[str] = None
    last_read_timestamp: Optional[str] = None


@router.get("/{org_id}/channels/{channel_id}/read")
def get_channel_read(
    org_id: str,
    channel_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Get current user's last read position for this channel."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)
    ch_doc = db.collection("channels").document(channel_id).get()
    if not ch_doc.exists or ch_doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Channel not found")
    read_ref = db.collection("channel_reads").document(f"{user_id}_{channel_id}")
    read_doc = read_ref.get()
    if not read_doc.exists:
        return {"last_read_message_id": None, "last_read_timestamp": None}
    r = read_doc.to_dict()
    out = {"last_read_message_id": r.get("last_read_message_id"), "last_read_timestamp": None}
    ts = r.get("last_read_timestamp")
    if ts and hasattr(ts, "isoformat"):
        out["last_read_timestamp"] = ts.isoformat()
    elif isinstance(ts, str):
        out["last_read_timestamp"] = ts
    return out


@router.put("/{org_id}/channels/{channel_id}/read")
def put_channel_read(
    org_id: str,
    channel_id: str,
    req: PutReadRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Update current user's last read position (on scroll / open / reach bottom)."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)
    ch_doc = db.collection("channels").document(channel_id).get()
    if not ch_doc.exists or ch_doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Channel not found")
    read_ref = db.collection("channel_reads").document(f"{user_id}_{channel_id}")
    now = datetime.now(timezone.utc)
    data = {"updated_at": now}
    if req.last_read_message_id is not None:
        data["last_read_message_id"] = req.last_read_message_id
    if req.last_read_timestamp is not None:
        data["last_read_timestamp"] = req.last_read_timestamp
    read_ref.set(data, merge=True)
    return {"ok": True, "last_read_message_id": req.last_read_message_id, "last_read_timestamp": req.last_read_timestamp}


class SendMessageRequest(BaseModel):
    content: str = ""
    image_data_url: Optional[str] = None
    event_data: Optional[dict] = None
    poll_data: Optional[dict] = None
    reply_to_message_id: Optional[str] = None
    reply_to_snippet: Optional[str] = None


class EditMessageRequest(BaseModel):
    content: str


@router.post("/{org_id}/channels/{channel_id}/messages")
def send_message(
    org_id: str,
    channel_id: str,
    req: SendMessageRequest,
    user: dict = Depends(get_current_user),
):
    """Send message to channel (REST fallback when WebSocket unavailable)."""
    db = get_firestore()
    member = list(
        db.collection("members")
        .where("user_id", "==", user["id"])
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .limit(1)
        .get()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Organization not found")
    role = member[0].to_dict().get("role", "member")
    member_dict = member[0].to_dict()
    member_dict["id"] = member[0].id

    ch_doc = db.collection("channels").document(channel_id).get()
    if not ch_doc.exists or ch_doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Channel not found")

    ch = ch_doc.to_dict()
    if not _can_see_channel(db, ch, user["id"], org_id, role):
        raise HTTPException(status_code=403, detail="Access denied")

    content = (req.content or "").strip()
    image_data_url = _normalize_image_data_url(req.image_data_url)
    if not content and not image_data_url and not req.event_data and not req.poll_data:
        raise HTTPException(status_code=400, detail="Message content required")

    msg_type = "text"
    if req.event_data:
        msg_type = "event"
    elif req.poll_data:
        msg_type = "poll"
    link_preview = _build_link_preview(content) if msg_type == "text" and content else None

    msg_id = generate_uuid()
    now = datetime.now(timezone.utc)
    msg_doc = {
        "id": msg_id,
        "channel_id": channel_id,
        "organization_id": org_id,
        "sender_id": user["id"],
        "sender_name": user.get("name", "Unknown"),
        "sender_nickname": member_dict.get("nickname"),
        "sender_avatar": user.get("avatar"),
        "content": content,
        "image_data_url": image_data_url,
        "link_preview": link_preview,
        "type": msg_type,
        "event_data": req.event_data,
        "poll_data": req.poll_data,
        "created_at": now,
    }
    if req.reply_to_message_id:
        msg_doc["reply_to_message_id"] = req.reply_to_message_id
        msg_doc["reply_to_snippet"] = (req.reply_to_snippet or "")[:200]
    db.collection("messages").document(msg_id).set(msg_doc)
    out = {
        "id": msg_id,
        "channel_id": channel_id,
        "sender_id": user["id"],
        "sender_name": user.get("name", "Unknown"),
        "sender_nickname": member_dict.get("nickname"),
        "sender_avatar": user.get("avatar"),
        "content": content,
        "image_data_url": image_data_url,
        "link_preview": link_preview,
        "type": msg_type,
        "created_at": now.isoformat(),
    }
    if req.reply_to_message_id:
        out["reply_to_message_id"] = req.reply_to_message_id
        out["reply_to_snippet"] = msg_doc.get("reply_to_snippet")
    return out


@router.patch("/{org_id}/channels/{channel_id}/messages/{message_id}")
def edit_message(
    org_id: str,
    channel_id: str,
    message_id: str,
    req: EditMessageRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Edit a text message in channel chat."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    msg_ref = db.collection("messages").document(message_id)
    msg_doc = msg_ref.get()
    if not msg_doc.exists:
        raise HTTPException(status_code=404, detail="Message not found")
    msg = msg_doc.to_dict() or {}
    if msg.get("organization_id") != org_id or msg.get("channel_id") != channel_id:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.get("sender_id") != user_id:
        raise HTTPException(status_code=403, detail="You can only edit your own messages")
    if msg.get("type") != "text":
        raise HTTPException(status_code=400, detail="Only text messages can be edited")

    content = (req.content or "").strip()
    if not content and not msg.get("image_data_url"):
        raise HTTPException(status_code=400, detail="Message content required")

    now = datetime.now(timezone.utc)
    msg_ref.update({
        "content": content,
        "link_preview": _build_link_preview(content) if content else None,
        "edited_at": now,
    })
    return {
        "ok": True,
        "id": message_id,
        "content": content,
        "edited_at": now.isoformat(),
    }


class ToggleReactionRequest(BaseModel):
    emoji: str  # e.g. "👍", "❤️"


def _normalize_reactions(raw: dict) -> dict:
    """Normalize reactions to the canonical format { emoji: { count, uids } }.

    Handles both old format (emoji -> [uid, ...]) and new format (emoji -> {count, uids}).
    """
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
    """Convert stored reactions into a lightweight API list with reactedByMe flag."""
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


@router.post("/{org_id}/channels/{channel_id}/messages/{message_id}/reactions")
def toggle_reaction(
    org_id: str,
    channel_id: str,
    message_id: str,
    req: ToggleReactionRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Toggle the current user's reaction on a message using a Firestore transaction."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)

    emoji = (req.emoji or "").strip()[:32]
    if not emoji:
        raise HTTPException(status_code=400, detail="Emoji required")

    msg_ref = db.collection("messages").document(message_id)

    @firestore.transactional
    def _toggle_in_tx(tx, ref):
        snap = ref.get(transaction=tx)
        if not snap.exists or snap.to_dict().get("channel_id") != channel_id:
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

    return {
        "ok": True,
        "reactions": _reactions_for_api(final_reactions, user_id),
        "messageId": message_id,
        "emoji": emoji,
    }


class SummaryRequest(BaseModel):
    last_read_message_id: Optional[str] = None
    last_read_timestamp: Optional[str] = None


def _extractive_summary_bullets(messages: List[dict], max_bullets: int = 6) -> List[str]:
    """Build 4-6 bullet points from message content (no LLM). Filters short/ack-only; focuses on substance."""
    bullets = []
    seen = set()
    for m in messages:
        if m.get("type") != "text":
            if m.get("type") == "event" and m.get("event_data", {}).get("title"):
                line = f"Event: {m['event_data']['title']}"
                if line not in seen and len(bullets) < max_bullets:
                    seen.add(line)
                    bullets.append(line)
            elif m.get("type") == "poll":
                q = (m.get("poll_data") or {}).get("question") or (m.get("content") or "Poll")
                line = f"Poll: {q[:80]}{'…' if len(q) > 80 else ''}"
                if line not in seen and len(bullets) < max_bullets:
                    seen.add(line)
                    bullets.append(line)
            continue
        content = (m.get("content") or "").strip()
        if len(content) < 10:
            continue
        # Dedupe and limit length
        normalized = content[:200].replace("\n", " ")
        if normalized in seen:
            continue
        seen.add(normalized)
        bullets.append(normalized if len(normalized) <= 120 else normalized[:117] + "...")
        if len(bullets) >= max_bullets:
            break
    return bullets[:max_bullets]


@router.post("/{org_id}/channels/{channel_id}/summary")
def get_channel_summary(
    org_id: str,
    channel_id: str,
    req: SummaryRequest,
    user_id: str = Depends(get_current_user_id),
):
    """AI-style summary of missed messages (last_read -> now). Extractive for now; plug in LLM later."""
    db = get_firestore()
    _require_org_member(db, org_id, user_id)
    ch_doc = db.collection("channels").document(channel_id).get()
    if not ch_doc.exists or ch_doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Messages in channel, newest first; we want messages *after* last read
    query = (
        db.collection("messages")
        .where("channel_id", "==", channel_id)
        .order_by("created_at", direction="DESCENDING")
        .limit(100)
    )
    docs = list(query.stream())
    messages_desc = []
    for d in docs:
        m = d.to_dict()
        m["id"] = d.id
        created = m.get("created_at")
        if hasattr(created, "isoformat"):
            m["created_at"] = created.isoformat()
        messages_desc.append(m)

    # Filter to messages after last read (use datetime.fromisoformat, no extra deps)
    cutoff_time = None
    def parse_iso(s: str):
        if not s:
            return None
        s = s.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(s)
        except Exception:
            return None

    if req.last_read_timestamp:
        cutoff_time = parse_iso(req.last_read_timestamp)
    if cutoff_time is None and req.last_read_message_id:
        for m in messages_desc:
            if m["id"] == req.last_read_message_id:
                created = m.get("created_at")
                if isinstance(created, str):
                    cutoff_time = parse_iso(created)
                break

    if cutoff_time:
        missed = []
        for m in messages_desc:
            created_str = m.get("created_at")
            if not created_str:
                continue
            t = parse_iso(created_str) if isinstance(created_str, str) else None
            if t and t > cutoff_time:
                missed.append(m)
    else:
        missed = list(messages_desc)

    # Chronological for summary
    missed_chron = list(reversed(missed))
    bullets = _extractive_summary_bullets(missed_chron, max_bullets=6)
    summary_text = " • ".join(bullets) if bullets else "No new activity to summarize."
    return {"summary": summary_text, "bullets": bullets, "missed_count": len(missed)}


# --- WebSocket ---

# Active connections: (org_id, channel_id) -> [(websocket, user_id), ...]
_connections: dict = {}
# websocket id -> [(org_id, channel_id), ...] for cleanup
_ws_channels: dict = {}


async def _get_user_from_ws(websocket: WebSocket) -> Optional[dict]:
    """Extract user from token (query param)."""
    token = websocket.query_params.get("token")
    if token:
        payload = decode_token(token)
        if payload and "sub" in payload:
            db = get_firestore()
            doc = db.collection("users").document(payload["sub"]).get()
            if doc.exists:
                data = doc.to_dict()
                data["id"] = doc.id
                return data
    return None


async def _broadcast(org_id: str, channel_id: str, msg: dict):
    """Broadcast message to all subscribers of this channel."""
    key = (org_id, channel_id)
    subs = list(_connections.get(key, []))
    alive = []
    for ws, uid in subs:
        try:
            await ws.send_json(msg)
            alive.append((ws, uid))
        except Exception:
            pass
    _connections[key] = alive
    if not alive:
        _connections.pop(key, None)


async def broadcast_new_message(org_id: str, channel_id: str, message_doc: dict):
    """Call from activity feed (events, polls) to push new message to WebSocket subscribers."""
    await _broadcast(org_id, channel_id, {"type": "message", "message": message_doc})


@router.websocket("/{org_id}/ws")
async def chat_websocket(
    websocket: WebSocket,
    org_id: str,
):
    """Real-time chat WebSocket. Connect with ?token=JWT. Send JSON: {type, channel_id, content?, event_data?, poll_data?}"""
    await websocket.accept()

    user = await _get_user_from_ws(websocket)
    if not user:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    db = get_firestore()
    member_docs = list(
        db.collection("members")
        .where("user_id", "==", user["id"])
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .limit(1)
        .get()
    )
    if not member_docs:
        await websocket.close(code=4003, reason="Not a member")
        return

    member = member_docs[0].to_dict()
    member["id"] = member_docs[0].id
    role = member.get("role", "member")

    ws_id = id(websocket)
    _ws_channels[ws_id] = []

    def subscribe(channel_id: str):
        key = (org_id, channel_id)
        if key not in _connections:
            _connections[key] = []
        if not any(ws is websocket for ws, _ in _connections[key]):
            _connections[key].append((websocket, user["id"]))
        if key not in _ws_channels[ws_id]:
            _ws_channels[ws_id].append(key)

    def unsubscribe(channel_id: str):
        key = (org_id, channel_id)
        if key in _connections:
            _connections[key] = [(ws, uid) for ws, uid in _connections[key] if ws is not websocket]
            if not _connections[key]:
                del _connections[key]
        _ws_channels[ws_id] = [k for k in _ws_channels[ws_id] if k != key]

    try:
        while True:
            data = await websocket.receive_json()

            msg_type = data.get("type", "message")
            channel_id = data.get("channel_id")
            if not channel_id and msg_type not in ("ping",):
                await websocket.send_json({"error": "channel_id required"})
                continue

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if channel_id:
                ch_doc = db.collection("channels").document(channel_id).get()
                if not ch_doc.exists or ch_doc.to_dict().get("organization_id") != org_id:
                    await websocket.send_json({"error": "Channel not found"})
                    continue

                ch = ch_doc.to_dict()
                if not _can_see_channel(db, ch, user["id"], org_id, role):
                    await websocket.send_json({"error": "Access denied"})
                    continue

            if msg_type == "subscribe":
                subscribe(channel_id)
                await websocket.send_json({"type": "subscribed", "channel_id": channel_id})
                continue

            if msg_type == "unsubscribe":
                unsubscribe(channel_id)
                continue

            if msg_type == "message":
                content = (data.get("content") or "").strip()
                image_data_url = _normalize_image_data_url(data.get("image_data_url"))
                if not content and not image_data_url and not data.get("event_data") and not data.get("poll_data"):
                    continue

                msg_id = generate_uuid()
                now = datetime.now(timezone.utc)
                msg_type_val = "text"
                if data.get("event_data"):
                    msg_type_val = "event"
                elif data.get("poll_data"):
                    msg_type_val = "poll"
                link_preview = _build_link_preview(content) if msg_type_val == "text" and content else None

                msg_doc = {
                    "id": msg_id,
                    "channel_id": channel_id,
                    "organization_id": org_id,
                    "sender_id": user["id"],
                    "sender_name": user.get("name", "Unknown"),
                    "sender_nickname": member.get("nickname"),
                    "sender_avatar": user.get("avatar"),
                    "content": content,
                    "image_data_url": image_data_url,
                    "link_preview": link_preview,
                    "type": msg_type_val,
                    "event_data": data.get("event_data"),
                    "poll_data": data.get("poll_data"),
                    "created_at": now.isoformat(),
                }
                reply_to_id = data.get("reply_to_message_id")
                if reply_to_id:
                    msg_doc["reply_to_message_id"] = reply_to_id
                    msg_doc["reply_to_snippet"] = (data.get("reply_to_snippet") or "")[:200]

                db.collection("messages").document(msg_id).set({
                    **msg_doc,
                    "created_at": now,
                })

                msg_out = {"type": "message", "message": msg_doc}
                await _broadcast(org_id, channel_id, msg_out)

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        for key in _ws_channels.get(ws_id, []):
            if key in _connections:
                _connections[key] = [(ws, uid) for ws, uid in _connections[key] if ws is not websocket]
                if not _connections[key]:
                    del _connections[key]
        _ws_channels.pop(ws_id, None)
