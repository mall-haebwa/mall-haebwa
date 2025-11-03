# backend/app/auth_router.py
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from .database import get_db
from .schemas import UserIn, LoginIn, UserOut, BasicResp
from .security import hash_password, verify_password, create_token, create_refresh_token, decode_token
from .models import USERS_COL
from bson import ObjectId
# from app.database import get_user_by_email
from datetime import timedelta
router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_ACCESS = "access_token"
COOKIE_REFRESH = "refresh_token"


def set_cookie(resp: Response, key: str, value: str, max_age: int | None):
    resp.set_cookie(
        key=key,
        value=value,
        httponly=True,
        samesite="lax",
        secure=False,  # 로컬에서는 False, 배포시 True + HTTPS
        max_age=max_age,
        path="/",
    )


@router.post("/register", response_model=BasicResp, status_code=201)
async def register(payload: UserIn, db: AsyncIOMotorDatabase = Depends(get_db)):
    exists = await db[USERS_COL].find_one({"email": payload.email})
    if exists:
        raise HTTPException(status_code=409, detail="이미 가입된 이메일입니다.")
    doc = {
        "email": payload.email.lower(),
        "password": hash_password(payload.password),
        "name": payload.name,
        "phone": payload.phone,
        "address": payload.address,
        "role": "user",  # ✅ 기본값 추가
    }
    await db[USERS_COL].insert_one(doc)
    return {"message": "가입 완료"}


@router.post("/login", response_model=UserOut)
async def login(payload: LoginIn, response: Response, db: AsyncIOMotorDatabase = Depends(get_db)):
    user = await db[USERS_COL].find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password"]):
        raise HTTPException(status_code=401, detail="이메일 혹은 비밀번호가 올바르지 않습니다.")

    uid = str(user["_id"])
    role = user.get("role", "user")
    access = create_token(uid,  extra_payload={
                          "role": user.get("role", "user")})  # 기본 15분
    # 로그인 유지(remember)면 7일, 아니면 세션(브라우저 종료 시 삭제) → max_age=None 사용
    refresh = create_refresh_token(uid if payload.remember else uid)

    set_cookie(response, COOKIE_ACCESS, access, max_age=15*60)    # 15분
    set_cookie(response, COOKIE_REFRESH, refresh, max_age=7 *
               24*60*60 if payload.remember else None)

    # 프론트가 바로 user 정보 쓰도록 반환
    user_out = {
        "_id": uid,
        "email": user["email"],
        "name": user.get("name"),
        "phone": user.get("phone"),
        "address": user.get("address"),
        "role": user.get("role", "user")
    }
    return user_out


@router.post("/refresh", response_model=BasicResp)
async def refresh(request: Request, response: Response, db: AsyncIOMotorDatabase = Depends(get_db)):
    rt = request.cookies.get(COOKIE_REFRESH)
    if not rt:
        raise HTTPException(status_code=401, detail="리프레시 토큰이 없습니다.")
    try:
        payload = decode_token(rt)
        if payload.get("scope") != "refresh":
            raise ValueError("Not refresh")
        uid = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="리프레시 토큰이 유효하지 않습니다.")

    # 새 access 토큰에 role 포함
    # DB에서 사용자 role 조회 후 payload에 포함시켜 발급
    # from .models import USERS_COL
    # from bson import ObjectId
    user = await db[USERS_COL].find_one({"_id": ObjectId(uid)})
    role = user.get("role", "user")

    access = create_token(uid, extra_payload={"role": role})
    set_cookie(response, COOKIE_ACCESS, access, max_age=15*60)
    return {"message": "access 재발급 완료"}


@router.post("/logout", response_model=BasicResp)
async def logout(response: Response):
    # 쿠키 삭제
    response.delete_cookie(COOKIE_ACCESS, path="/")
    response.delete_cookie(COOKIE_REFRESH, path="/")
    return {"message": "로그아웃 완료"}


@router.get("/me", response_model=UserOut)
async def me(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    at = request.cookies.get(COOKIE_ACCESS)
    if not at:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    try:
        payload = decode_token(at)
        if payload.get("scope") != "access":
            raise ValueError("Not access")
        uid = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="토큰이 유효하지 않습니다.")

    user = await db[USERS_COL].find_one({"_id": ObjectId(uid)})
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    return {
        "_id": uid,
        "email": user["email"],
        "name": user.get("name"),
        "phone": user.get("phone"),
        "address": user.get("address"),
        "role": user.get("role", "user"),
    }
