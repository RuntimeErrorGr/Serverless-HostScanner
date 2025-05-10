from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from app.api.dependencies import idp
from app.api import (
    scan_router,
    auth_router,
)
from app.log import get_logger

log = get_logger(__name__)

app = FastAPI(title="Serverless Webserver API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

idp.add_swagger_config(app)
app.include_router(auth_router, tags=["auth"])
app.include_router(scan_router, prefix="/scan", tags=["scan"])


@app.get("/")
async def root(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return RedirectResponse(url=idp.login_uri)

    token = auth_header[7:]

    try:
        current_user = idp.get_current_user()(token)
        log.info(f"Current user: {current_user}")
        return RedirectResponse(url="/scan")
    except HTTPException as exc:
        if exc.status_code == 401:
            return RedirectResponse(url=idp.login_uri)
        raise
