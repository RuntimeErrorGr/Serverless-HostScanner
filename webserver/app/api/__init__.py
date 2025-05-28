from app.api.routes.scan import router as scan_router
from app.api.routes.auth import router as auth_router
from app.api.routes.target import router as target_router
from app.api.routes.finding import router as finding_router
from app.api.routes.report import router as report_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.admin import router as admin_router

__all__ = ["scan_router", "auth_router", "target_router", "finding_router", "report_router", "dashboard_router", "admin_router"]