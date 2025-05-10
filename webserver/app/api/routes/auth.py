from fastapi import APIRouter, Request, Depends
from fastapi.responses import RedirectResponse
from app.api.dependencies import idp, get_current_user_from_cookie
from fastapi_keycloak import OIDCUser, KeycloakUser
from sqlalchemy.orm import Session
from app.config import settings
from app.database.db import get_db
from app.models.user import User
from app.log import get_logger

log = get_logger(__name__)

router = APIRouter()

def get_or_create_db_user(keycloak_user: KeycloakUser, db: Session) -> User:
    user = db.query(User).filter(User.keycloack_uuid == keycloak_user.id).first()
    if not user:
        log.info(f"Creating user: {keycloak_user}")
        user = User(
            keycloack_uuid=keycloak_user.id,
            username=keycloak_user.username,
            first_name=keycloak_user.firstName,
            last_name=keycloak_user.lastName,
            enabled=keycloak_user.enabled,
            email_verified=keycloak_user.emailVerified,
            email=keycloak_user.email
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

@router.get("/login")
def login():
    return RedirectResponse(idp.login_uri)

@router.get("/callback")
def callback(request: Request, session_state: str = None, code: str = None, db: Session = Depends(get_db)):
    # Exchange the authorization code for tokens
    token = idp.exchange_authorization_code(session_state=session_state, code=code)
    decoded_token = idp._decode_token(token=token.access_token)

    keycloak_user = idp.get_user(decoded_token["sub"])
    log.info(f"Keycloak user: {keycloak_user}")
    user = get_or_create_db_user(keycloak_user, db)
    if not user:
        log.error("User not found")
        return RedirectResponse(url="/login")
    
    response = RedirectResponse(url="/scan")
    response.set_cookie(
        key="access_token",
        value=token.access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=3600  # 1 hour
    )
    return response

@router.get("/logout")
async def logout(user: OIDCUser = Depends(get_current_user_from_cookie())):
    logout_url = (
        f"https://{settings.KEYCLOAK_HOST}/realms/{settings.KEYCLOAK_REALM}"
        f"/protocol/openid-connect/logout?"
        f"post_logout_redirect_uri=https://{settings.WEBSERVER_HOST}/login&"
        f"client_id={settings.KEYCLOAK_CLIENT_ID}"
    )
    return RedirectResponse(url=logout_url)
