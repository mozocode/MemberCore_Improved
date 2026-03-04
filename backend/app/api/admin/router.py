"""Platform Admin API - combines all admin routes."""
from fastapi import APIRouter, Depends

from app.core.security import require_platform_admin
from app.api.admin import organizations, users, overview, feedback as admin_feedback

admin_router = APIRouter(prefix="/admin", tags=["admin"])

# Include all admin sub-routers (they already have require_platform_admin via dependencies)
admin_router.include_router(organizations.router, prefix="", tags=["admin-orgs"])
admin_router.include_router(users.router, prefix="", tags=["admin-users"])
admin_router.include_router(overview.router, prefix="", tags=["admin-overview"])
admin_router.include_router(admin_feedback.router, prefix="", tags=["admin-feedback"])
