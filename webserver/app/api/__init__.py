from app.api.routes.scan import router as scan_router
from app.api.routes.auth import router as auth_router

__all__ = ["scan_router", "auth_router"]