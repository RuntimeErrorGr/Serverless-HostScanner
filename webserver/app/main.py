from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from app.api.dependencies import idp
from app.api import (
    scan_router,
    auth_router,
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
api_app.include_router(scan_router, prefix="/scan", tags=["scan"])

app = FastAPI(title="Network Scanner Webserver API", version="0.1.0")
app.mount("/api", api_app)