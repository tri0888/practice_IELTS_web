from fastapi import Depends, Header, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .services import decode_token, find_user_by_id

bearer_scheme = HTTPBearer(auto_error=False)


def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    authorization: str | None = Header(default=None),
    token: str | None = Query(default=None),
):
    raw_token = token
    if not raw_token and credentials:
        raw_token = credentials.credentials
    if not raw_token and authorization and authorization.lower().startswith("bearer "):
        raw_token = authorization.split(" ", 1)[1].strip()

    if not raw_token:
        raise HTTPException(status_code=401, detail="Authentication required")

    payload = decode_token(raw_token)
    user = find_user_by_id(payload.get("sub"))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    return user


def require_approved(user: dict = Depends(require_auth)):
    if user.get("role") != "approved":
        raise HTTPException(status_code=403, detail="Account is pending approval")
    return user
