import os
from pathlib import Path
from typing import Any, Optional

_db = None

# Backend root (parent of app/), for resolving relative credential paths
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


def get_firestore():
    """Return Firestore client. Uses google-cloud-firestore with AnonymousCredentials
    when FIRESTORE_EMULATOR_HOST is set; otherwise uses firebase_admin."""
    global _db
    if _db is not None:
        return _db

    emulator = os.getenv("FIRESTORE_EMULATOR_HOST")
    # Cloud Run sets GOOGLE_CLOUD_PROJECT; GCLOUD_PROJECT is our env name in env.yaml
    project_id = os.getenv("GCLOUD_PROJECT") or os.getenv("GOOGLE_CLOUD_PROJECT", "membercore")

    if emulator:
        from google.cloud.firestore import Client
        from google.auth.credentials import AnonymousCredentials
        _db = Client(project=project_id, credentials=AnonymousCredentials())
    else:
        import firebase_admin
        from firebase_admin import credentials, firestore
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or os.getenv("FIREBASE_CREDENTIALS_PATH")
        if cred_path and not os.path.isabs(cred_path):
            cred_path = str(_BACKEND_ROOT / cred_path.lstrip("./"))
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            try:
                firebase_admin.get_app()
            except ValueError:
                firebase_admin.initialize_app(cred)
        else:
            try:
                firebase_admin.get_app()
            except ValueError:
                firebase_admin.initialize_app(options={"projectId": project_id})
        _db = firestore.client()
    return _db


def doc_to_dict(doc: Any) -> Optional[dict]:
    if doc is None:
        return None
    data = doc.to_dict()
    data["id"] = doc.id
    return data
