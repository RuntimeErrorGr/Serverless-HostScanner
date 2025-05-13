from fastapi.responses import RedirectResponse
from fastapi import APIRouter, Depends, Request, Response
from fastapi_keycloak import KeycloakUser, OIDCUser
from sqlalchemy.orm import Session
from app.api.dependencies import idp
from app.config import settings
from app.database.db import get_db
from app.models.user import User
from app.log import get_logger


log = get_logger(__name__)

router = APIRouter()

def get_or_create_db_user(keycloak_user: KeycloakUser, db: Session) -> User:
    user = db.query(User).filter(User.keycloack_uuid == keycloak_user.id).first()

    if user:
        log.info(f"User already exists: {user}")
        return user
    
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
    log.info(f"Created user: {user}")
    return user


@router.get("/callback")
def sync_user(user: OIDCUser = Depends(idp.get_current_user()), db: Session = Depends(get_db)):
    keycloak_user = idp.get_user(user.sub)
    log.info(f"Keycloak user: {keycloak_user}")

    if not get_or_create_db_user(keycloak_user, db):
        log.error("User not found")
        return Response(status_code=402, content="User not found")
    return Response(status_code=200)
