from fastapi import APIRouter, Depends
from fastapi_keycloak import OIDCUser
from app.api.dependencies import get_current_user_from_cookie
from app.log import get_logger
router = APIRouter()

log = get_logger(__name__)

@router.get("/")
def index(user: OIDCUser = Depends(get_current_user_from_cookie())):
    log.info(f"Current user: {user}")
    return {"message": "Hello test route"}

