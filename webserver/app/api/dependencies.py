from fastapi import HTTPException, Cookie
from fastapi_keycloak import FastAPIKeycloak, OIDCUser
from app.config import settings
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import RedirectResponse
from starlette.status import HTTP_302_FOUND

idp = FastAPIKeycloak(
    server_url=settings.KEYCLOAK_SERVER_URL,
    client_id=settings.KEYCLOAK_CLIENT_ID,
    client_secret=settings.KEYCLOAK_CLIENT_SECRET,
    admin_client_secret=settings.KEYCLOAK_ADMIN_CLIENT_SECRET,
    realm=settings.KEYCLOAK_REALM,
    callback_uri=settings.KEYCLOAK_CALLBACK_URI,
    ssl_verification=False,
)

def get_current_user_from_cookie():
    def wrapper(access_token: str = Cookie(None)):
        if not access_token:
            raise HTTPException(status_code=401, detail="Not authenticated (missing cookie)")
        try:
            decoded_token = idp._decode_token(token=access_token, audience="account")
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = OIDCUser.parse_obj(decoded_token)
        return user
    return wrapper