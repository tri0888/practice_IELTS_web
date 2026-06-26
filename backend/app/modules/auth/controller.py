from fastapi import APIRouter, Depends
from pydantic import BaseModel

from .middleware import require_auth
from .services import login_user, register_user

router = APIRouter(prefix="/api/auth", tags=["Auth"])


class RegisterIn(BaseModel):
    email: str
    password: str
    name: str


class LoginIn(BaseModel):
    email: str
    password: str


@router.post("/register")
def register(body: RegisterIn):
    user = register_user(body.email, body.password, body.name)
    return {"user": user}


@router.post("/login")
def login(body: LoginIn):
    return login_user(body.email, body.password)


@router.get("/me")
def me(user: dict = Depends(require_auth)):
    return {"user": user}
