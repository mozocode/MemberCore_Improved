"""FCM push via firebase_admin (same device path as Cloud Functions)."""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def _get_device_tokens(db, user_id: str) -> List[str]:
    tokens: List[str] = []
    try:
        for doc in db.collection("users").document(user_id).collection("devices").stream():
            t = (doc.to_dict() or {}).get("token")
            if isinstance(t, str) and t.strip():
                tokens.append(t.strip())
    except Exception:
        logger.exception("Failed to list device tokens for user %s", user_id)
    return tokens


def send_push_to_user(
    *,
    db,
    user_id: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
) -> int:
    """
    Send FCM to all registered devices for user_id. Returns success count (best effort).
    """
    try:
        import firebase_admin
        from firebase_admin import messaging
    except ImportError:
        logger.warning("firebase_admin.messaging not available")
        return 0

    try:
        firebase_admin.get_app()
    except ValueError:
        logger.warning("Firebase app not initialized; skip push")
        return 0

    tokens = _get_device_tokens(db, user_id)
    if not tokens:
        return 0

    str_data = {str(k): str(v) for k, v in (data or {}).items()}
    success = 0
    # send_each_for_multicast max 500 tokens
    batch_size = 500
    for i in range(0, len(tokens), batch_size):
        batch = tokens[i : i + batch_size]
        msg = messaging.MulticastMessage(
            tokens=batch,
            notification=messaging.Notification(title=title, body=body),
            data=str_data,
        )
        try:
            resp = messaging.send_each_for_multicast(msg)
            success += resp.success_count
        except Exception:
            logger.exception("FCM send_each_for_multicast failed for user %s", user_id)
    return success
