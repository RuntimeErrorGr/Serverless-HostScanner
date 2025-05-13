from fastapi import APIRouter, Depends
from fastapi_keycloak import OIDCUser
from app.api.dependencies import idp
from app.log import get_logger
router = APIRouter()

log = get_logger(__name__)

@router.get("/")
def index(user: OIDCUser = Depends(idp.get_current_user())):
    return {"data": f"Welcome {user.preferred_username }! This is the scan page."}

