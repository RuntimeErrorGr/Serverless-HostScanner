from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from app.api.dependencies import idp
from app.api import (
    scan_router,
    auth_router,
    target_router,
    finding_router,
    report_router,
)
from app.log import get_logger

log = get_logger(__name__)

api_app = FastAPI()
api_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

idp.add_swagger_config(api_app)
api_app.include_router(auth_router, prefix="/auth", tags=["auth"])
api_app.include_router(scan_router, prefix="/scans", tags=["scans"])
api_app.include_router(target_router, prefix="/targets", tags=["targets"])
api_app.include_router(finding_router, prefix="/findings", tags=["findings"])
api_app.include_router(report_router, prefix="/reports", tags=["reports"])

app = FastAPI(title="Host Scanner Webserver API", version="0.1.0")
app.mount("/api", api_app)