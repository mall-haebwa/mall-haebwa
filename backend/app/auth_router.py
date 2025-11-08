# backend/app/auth_router.py
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from .database import get_db
from .schemas import UserIn, LoginIn, UserOut, BasicResp
from .security import hash_password, verify_password, create_token, create_refresh_token, decode_token
from .models import USERS_COL, ORDERS_COL
from .redis_client import redis_client
from bson import ObjectId
# from app.database import get_user_by_email
from datetime import timedelta
import os

router = APIRouter(prefix="/auth", tags=["auth"])

# 환경변수로 쿠키 설정 제어
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN") or None
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

COOKIE_ACCESS = "access_token"
COOKIE_REFRESH = "refresh_token"


async def calculate_user_points(user_id: str, db: AsyncIOMotorDatabase) -> int:
    """사용자의 적립금 계산 (배송완료 주문의 5%)"""
    try:
        # 사용자의 배송완료 주문 조회
        cursor = db[ORDERS_COL].find({"user_id": user_id, "status": "PAID"})
        orders = await cursor.to_list(length=None)

        # 총 주문 금액 계산
        total_amount = sum(order.get("amount", 0) for order in orders)

        # 5% 적립
        points = int(total_amount * 0.05)
        return points
    except Exception:
        return 0


def set_cookie(resp: Response, key: str, value: str, max_age: int | None):
    resp.set_cookie(
        key=key,
        value=value,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        max_age=max_age,
        path="/",
        domain=COOKIE_DOMAIN,
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
        "recentlyViewed": [],
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

    # 적립금 계산
    points = await calculate_user_points(uid, db)

    # 최근 본 상품을 Redis에 사전 로드 (로그인 시점에)
    try:
        recently_viewed = user.get("recentlyViewed", [])
        if recently_viewed:
            # DB의 최근 본 상품을 product 정보와 함께 구성
            from .user_router import find_product_by_id
            from .product_router import _reshape_product
            from datetime import datetime

            items_with_products = []
            for entry in recently_viewed:
                product_id = entry.get("productId")
                if not product_id:
                    continue

                product_doc = await find_product_by_id(db, product_id)
                if not product_doc:
                    continue

                product = _reshape_product(product_doc)
                viewed_at = entry.get("viewedAt")
                if isinstance(viewed_at, str):
                    viewed_at_str = viewed_at
                elif isinstance(viewed_at, datetime):
                    viewed_at_str = viewed_at.isoformat()
                else:
                    viewed_at_str = datetime.utcnow().isoformat()

                items_with_products.append({"product": product, "viewedAt": viewed_at_str})

            # Redis에 캐시 저장
            if items_with_products:
                success = await redis_client.set_recently_viewed(uid, items_with_products)
                if success:
                    print(f"[Login] 최근 본 상품 Redis 사전 로드 완료: user {uid}, {len(items_with_products)}개")
                else:
                    print(f"[Login] 최근 본 상품 Redis 사전 로드 실패: user {uid}")
    except Exception as e:
        print(f"[Login] 최근 본 상품 Redis 사전 로드 중 오류: {e}")
        # 오류가 발생해도 로그인 프로세스는 계속 진행

    # 프론트가 바로 user 정보 쓰도록 반환
    user_out = {
        "_id": uid,
        "email": user["email"],
        "name": user.get("name"),
        "phone": user.get("phone"),
        "address": user.get("address"),
        "role": user.get("role", "user"),
        "points": points,
        "isSeller": user.get("isSeller", False),
        "sellerInfo": user.get("sellerInfo"),
        "recentlyViewed": user.get("recentlyViewed", []),
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
async def logout(request: Request, response: Response, db: AsyncIOMotorDatabase = Depends(get_db)):
    # 토큰에서 user_id 추출
    at = request.cookies.get(COOKIE_ACCESS)
    if at:
        try:
            payload = decode_token(at)
            if payload.get("scope") == "access":
                user_id = payload["sub"]

                # Redis에서 최근 본 상품 조회 (최대 10개)
                recently_viewed_cache = await redis_client.get_recently_viewed(user_id)

                if recently_viewed_cache:
                    # Redis의 최근 본 상품을 DB에 저장
                    try:
                        # DB에 저장할 형식으로 변환 (productId와 viewedAt만)
                        items_for_db = []
                        for item in recently_viewed_cache[:10]:  # 최대 10개만 저장
                            if item.get("product") and item.get("product").get("id"):
                                items_for_db.append({
                                    "productId": item["product"]["id"],
                                    "viewedAt": item.get("viewedAt", datetime.utcnow()),
                                })

                        # DB에 저장
                        if items_for_db:
                            await db[USERS_COL].update_one(
                                {"_id": ObjectId(user_id)},
                                {
                                    "$set": {
                                        "recentlyViewed": items_for_db,
                                    }
                                }
                            )
                            print(f"[Logout] Redis의 최근 본 상품 {len(items_for_db)}개를 DB에 저장: user {user_id}")
                        else:
                            print(f"[Logout] Redis에 저장할 최근 본 상품이 없음: user {user_id}")
                    except Exception as e:
                        print(f"[Logout] Redis → DB 저장 중 오류: {e}")
                else:
                    print(f"[Logout] Redis에 최근 본 상품이 없음: user {user_id}")

                # Redis에서 최근 본 상품 캐시 삭제
                await redis_client.delete_recently_viewed(user_id)
                print(f"[Logout] Redis에서 최근 본 상품 캐시 삭제: user {user_id}")

                # Redis에서 해당 사용자의 모든 대화 삭제
                await redis_client.delete_user_conversations(user_id)
                print(f"[Logout] Redis에서 대화 히스토리 삭제: user {user_id}")
        except Exception as e:
            print(f"[Logout] 로그아웃 처리 중 오류: {e}")

    # 쿠키 삭제 - 설정 시와 동일한 속성 사용
    response.delete_cookie(COOKIE_ACCESS, path="/", samesite="lax", httponly=True)
    response.delete_cookie(COOKIE_REFRESH, path="/", samesite="lax", httponly=True)
    return {"message": "로그아웃 완료"}


@router.get("/me", response_model=UserOut)
async def me(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    print(f"[DEBUG /api/auth/me] All cookies: {dict(request.cookies)}")
    at = request.cookies.get(COOKIE_ACCESS)
    print(f"[DEBUG /api/auth/me] Access token present: {at is not None}")
    if not at:
        print("[DEBUG /api/auth/me] No access token found - returning 401")
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    try:
        payload = decode_token(at)
        if payload.get("scope") != "access":
            raise ValueError("Not access")
        uid = payload["sub"]
        print(f"[DEBUG /api/auth/me] Token validated successfully for user: {uid}")
    except Exception as e:
        print(f"[DEBUG /api/auth/me] Token validation failed: {str(e)}")
        raise HTTPException(status_code=401, detail="토큰이 유효하지 않습니다.")

    user = await db[USERS_COL].find_one({"_id": ObjectId(uid)})
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    points = await calculate_user_points(uid, db)

    return {
        "_id": uid,
        "email": user["email"],
        "name": user.get("name"),
        "phone": user.get("phone"),
        "address": user.get("address"),
        "role": user.get("role", "user"),
        "points": points,
        "isSeller": user.get("isSeller", False),
        "sellerInfo": user.get("sellerInfo"),
        "recentlyViewed": user.get("recentlyViewed", []),
    }
