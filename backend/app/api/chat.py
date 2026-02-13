"""Chat API - channels, messages, WebSocket."""
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.db.firebase import get_firestore
from app.core.security import get_current_user_id, get_current_user, generate_uuid, decode_token

router = APIRouter()


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
            "visibility": "everyone",
            "allowed_members": [],
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
    """Check if user can see this channel."""
    if channel.get("visibility") == "everyone":
        if channel.get("is_restricted") and member_role == "restricted":
            return False
        return True
    # visibility == "select"
    allowed = channel.get("allowed_members") or []
    if not allowed:
        return member_role in ("owner", "admin")
    # Resolve member id from user_id
    member_docs = list(
        db.collection("members")
        .where("user_id", "==", user_id)
        .where("organization_id", "==", org_id)
        .limit(1)
        .get()
    )
    member_id = member_docs[0].id if member_docs else None
    return member_id in allowed


# --- HTTP API ---


class CreateChannelRequest(BaseModel):
    name: str
    is_restricted: bool = False
    visibility: str = "everyone"
    allowed_members: List[str] = []


class UpdateChannelRequest(BaseModel):
    name: Optional[str] = None
    is_restricted: Optional[bool] = None
    visibility: Optional[str] = None
    allowed_members: Optional[List[str]] = None


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
    """Create channel. Admin/owner only."""
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
    _require_admin_or_owner(role)

    name = (req.name or "").strip().lower().replace(" ", "-")
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

    ch_id = generate_uuid()
    now = datetime.now(timezone.utc)
    db.collection("channels").document(ch_id).set({
        "id": ch_id,
        "organization_id": org_id,
        "name": name,
        "is_restricted": req.is_restricted,
        "visibility": req.visibility or "everyone",
        "allowed_members": req.allowed_members or [],
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
    """Update channel. Admin/owner only."""
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
    _require_admin_or_owner(role)

    ref = db.collection("channels").document(channel_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Channel not found")

    updates = {}
    if req.name is not None:
        name = req.name.strip().lower().replace(" ", "-")
        if name and name != "general":
            updates["name"] = name
    if req.is_restricted is not None:
        updates["is_restricted"] = req.is_restricted
    if req.visibility is not None:
        updates["visibility"] = req.visibility
    if req.allowed_members is not None:
        updates["allowed_members"] = req.allowed_members

    if updates:
        ref.update(updates)
    return {"ok": True}


@router.delete("/{org_id}/channels/{channel_id}")
def delete_channel(
    org_id: str,
    channel_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete channel. Admin/owner only. Cannot delete #general."""
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
    _require_admin_or_owner(role)

    ref = db.collection("channels").document(channel_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("organization_id") != org_id:
        raise HTTPException(status_code=404, detail="Channel not found")
    if doc.to_dict().get("name") == "general":
        raise HTTPException(status_code=400, detail="Cannot delete #general")

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
    for d in docs:
        m = d.to_dict()
        m["id"] = d.id
        created = m.get("created_at")
        if hasattr(created, "isoformat"):
            m["created_at"] = created.isoformat()
        messages.append(m)

    messages.reverse()
    return messages


class SendMessageRequest(BaseModel):
    content: str = ""
    event_data: Optional[dict] = None
    poll_data: Optional[dict] = None


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
    if not content and not req.event_data and not req.poll_data:
        raise HTTPException(status_code=400, detail="Message content required")

    msg_type = "text"
    if req.event_data:
        msg_type = "event"
    elif req.poll_data:
        msg_type = "poll"

    msg_id = generate_uuid()
    now = datetime.now(timezone.utc)
    msg_doc = {
        "id": msg_id,
        "channel_id": channel_id,
        "organization_id": org_id,
        "sender_id": user["id"],
        "sender_name": user.get("name", "Unknown"),
        "sender_nickname": member_dict.get("nickname"),
        "content": content,
        "type": msg_type,
        "event_data": req.event_data,
        "poll_data": req.poll_data,
        "created_at": now,
    }
    db.collection("messages").document(msg_id).set(msg_doc)
    return {
        "id": msg_id,
        "channel_id": channel_id,
        "sender_id": user["id"],
        "sender_name": user.get("name", "Unknown"),
        "sender_nickname": member_dict.get("nickname"),
        "content": content,
        "type": msg_type,
        "created_at": now.isoformat(),
    }


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
                if not content and not data.get("event_data") and not data.get("poll_data"):
                    continue

                msg_id = generate_uuid()
                now = datetime.now(timezone.utc)
                msg_type_val = "text"
                if data.get("event_data"):
                    msg_type_val = "event"
                elif data.get("poll_data"):
                    msg_type_val = "poll"

                msg_doc = {
                    "id": msg_id,
                    "channel_id": channel_id,
                    "organization_id": org_id,
                    "sender_id": user["id"],
                    "sender_name": user.get("name", "Unknown"),
                    "sender_nickname": member.get("nickname"),
                    "content": content,
                    "type": msg_type_val,
                    "event_data": data.get("event_data"),
                    "poll_data": data.get("poll_data"),
                    "created_at": now.isoformat(),
                }

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
