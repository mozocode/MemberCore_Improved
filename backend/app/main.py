import logging
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from cwd and from backend/ so it works when run from repo root or backend/
load_dotenv()
_backend_dir = Path(__file__).resolve().parent.parent
load_dotenv(_backend_dir / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, organizations, events, members, org_events, polls, documents, dues, payments, billing, chat, analytics, dm, feedback, member_invites
from app.api.admin.router import admin_router

logger = logging.getLogger(__name__)

app = FastAPI(title="MemberCore API", version="1.0.0")


@app.exception_handler(Exception)
def unhandled_exception_handler(request, exc):
    """Return 500 with JSON body so CORS headers are applied and client gets a proper response."""
    logger.exception("Unhandled exception: %s", exc)
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

# CORS: allow localhost in dev and known production web hosts by default.
# Can be overridden/extended with CORS_ORIGINS (comma-separated).
_default_origins = ",".join(
    [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://membercore.io",
        "https://www.membercore.io",
        "https://membercore-f0b3f.web.app",
    ]
)
_origins = os.getenv("CORS_ORIGINS", _default_origins).strip().split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(organizations.router, prefix="/api/organizations", tags=["organizations"])
app.include_router(members.router, prefix="/api/organizations", tags=["members"])
app.include_router(events.router, prefix="/api/events", tags=["events"])
app.include_router(org_events.router, prefix="/api/events", tags=["events"])
app.include_router(polls.router, prefix="/api/polls", tags=["polls"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(dues.router, prefix="/api/dues", tags=["dues"])
app.include_router(payments.router, prefix="/api/payments", tags=["payments"])
app.include_router(billing.router, prefix="/api/billing", tags=["billing"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(dm.router, prefix="/api/organizations", tags=["dm"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(feedback.router, prefix="/api/feedback", tags=["feedback"])
app.include_router(member_invites.router, prefix="/api", tags=["member-invites"])
app.include_router(admin_router, prefix="/api", tags=["admin"])


@app.get("/api/health")
def health():
    """Lightweight health check; no DB. Use 127.0.0.1:8001 if localhost spins (IPv6 vs IPv4)."""
    return {"status": "ok"}


@app.get("/")
def root():
    """Root redirect so http://127.0.0.1:8001/ returns something immediately."""
    return {"status": "ok", "api": "/api/health"}


@app.get("/api/health/db")
def health_db():
    """Verify Firestore connection. Useful for debugging auth issues."""
    try:
        from app.db.firebase import get_firestore
        db = get_firestore()
        # Minimal read to verify connection
        list(db.collection("users").limit(1).get())
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": str(e)}, 503
