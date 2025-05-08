from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi_keycloak import FastAPIKeycloak, OIDCUser
from app.config import settings
from app.api import (
    scan_router,
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

app.include_router(scan_router, prefix="/scan", tags=["scan"])

idp = FastAPIKeycloak(
    server_url=settings.KEYCLOAK_SERVER_URL,
    client_id=settings.KEYCLOAK_CLIENT_ID,
    client_secret=settings.KEYCLOAK_CLIENT_SECRET,
    admin_client_secret=settings.KEYCLOAK_ADMIN_CLIENT_SECRET,
    realm=settings.KEYCLOAK_REALM,
    callback_uri=settings.KEYCLOAK_CALLBACK_URI,
    ssl_verification=False,
)
idp.add_swagger_config(app)

@app.get("/")   
def root():
    return {"message": "Hello mamasita world"}

@app.get("/login")
def login():
    log.info(f"session_state: {idp.login_uri}")
    return RedirectResponse(idp.login_uri)

@app.get("/callback")
def callback(request: Request, session_state: str = None, code: str = None):
    # Exchange the authorization code for tokens
    token = idp.exchange_authorization_code(session_state=session_state, code=code)
    # token is a KeycloakToken containing access_token, refresh_token, etc.

    # Optionally sync user into local DB using Keycloak UUID:
    log.info(f"token: {token}")
    
    # (Alternatively, decode JWT: payload = idp.decode_token(token.access_token); keycloak_user_id = payload['sub'])

    # Example DB sync:
    # user = db.get_user_by_id(keycloak_user_id)
    # if not user:
    #     db.create_user(id=keycloak_user_id, email=user_info.email, name=user_info.name)

    # Finally, redirect to the main frontend route
    response = RedirectResponse(url="/")

    return response

@app.get("/logout")
def logout():
    return RedirectResponse(idp.logout_uri)

@app.get("/protected")
def protected(user: OIDCUser = Depends(idp.get_current_user())):
    return user
