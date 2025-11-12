# backend/app/security.py
import os
import time
import jwt
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "60"))
REFRESH_TOKEN_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "7"))


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(sub: str, minutes: int = ACCESS_TOKEN_MINUTES, scope: str = "access", extra_payload: dict = None) -> str:
    now = int(time.time())
    exp = now + minutes * 60
    payload = {"sub": sub, "iat": now, "exp": exp, "scope": scope}

    if extra_payload:
        payload.update(extra_payload)

    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def create_refresh_token(sub: str, days: int = REFRESH_TOKEN_DAYS) -> str:
    now = int(time.time())
    exp = now + days * 24 * 60 * 60
    payload = {"sub": sub, "iat": now, "exp": exp, "scope": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
