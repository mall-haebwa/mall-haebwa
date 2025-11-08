from datetime import datetime

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from .auth_router import COOKIE_ACCESS
from .database import get_db
from .models import USERS_COL
from .product_router import _reshape_product
from .redis_client import redis_client
from .schemas import (
    BasicResp,
    RecentlyViewedListOut,
    RecentlyViewedPayload,
    SellerRegistrationIn,
    UserOut,
)
from .security import decode_token

router = APIRouter(prefix="/users", tags=["users"])


async def get_current_user(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    token = request.cookies.get(COOKIE_ACCESS)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="로그인이 필요합니다.",
        )

    try:
        payload = decode_token(token)
        if payload.get("scope") != "access":
            raise ValueError("Not an access token")
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰이 유효하지 않습니다.",
        )

    user = await db[USERS_COL].find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다.",
        )
    user["_id"] = str(user["_id"])
    return user


async def find_product_by_id(db: AsyncIOMotorDatabase, product_id: str):
    collection = db["products"]

    candidates: list[dict] = []
    try:
        candidates.append({"_id": ObjectId(product_id)})
    except InvalidId:
        pass
    candidates.append({"_id": product_id})
    candidates.append({"id": product_id})

    for query in candidates:
        doc = await collection.find_one(query)
        if doc:
            return doc
    return None


@router.post(
    "/recently-viewed",
    response_model=BasicResp,
    status_code=status.HTTP_201_CREATED,
)
async def add_recently_viewed(
    payload: RecentlyViewedPayload,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    product_doc = await find_product_by_id(db, payload.productId)
    if not product_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="상품을 찾을 수 없습니다.",
        )

    user_id = current_user["_id"]
    now = datetime.utcnow()

    # 1단계: DB 업데이트
    await db[USERS_COL].update_one(
        {"_id": ObjectId(user_id)},
        {"$pull": {"recentlyViewed": {"productId": payload.productId}}},
    )

    await db[USERS_COL].update_one(
        {"_id": ObjectId(user_id)},
        {
            "$push": {
                "recentlyViewed": {
                    "$each": [
                        {
                            "productId": payload.productId,
                            "viewedAt": now,
                        }
                    ],
                    "$position": 0,
                    "$slice": 10,
                }
            }
        },
    )

    # 2단계: Redis 캐시도 업데이트
    try:
        # Redis의 현재 캐시 조회
        cached_items = await redis_client.get_recently_viewed(user_id)

        if cached_items:
            # 기존 캐시가 있으면 상품 추가/이동
            product = _reshape_product(product_doc)

            # 이미 있는 상품이면 제거
            filtered = [item for item in cached_items if item.get("product", {}).get("id") != payload.productId]

            # 맨 앞에 추가 (최대 10개 유지)
            updated_items = [
                {"product": product, "viewedAt": now.isoformat()}
            ] + filtered[:9]

            # Redis에 저장
            await redis_client.set_recently_viewed(user_id, updated_items)
            print(f"[Add Recently Viewed] Redis 캐시 업데이트: user {user_id}, 상품: {product_doc.get('name')}")
        else:
            # Redis에 캐시가 없으면 DB에서 새로 로드해서 저장
            print(f"[Add Recently Viewed] Redis 캐시 미스, DB에서 재로드: user {user_id}")
            # GET 엔드포인트가 자동으로 Redis에 저장할 것임
    except Exception as e:
        print(f"[Add Recently Viewed] Redis 업데이트 실패: {e}")
        # Redis 실패해도 DB는 업데이트되었으므로 계속 진행

    return {"message": "최근 본 상품에 추가되었습니다."}


@router.get("/recently-viewed", response_model=RecentlyViewedListOut)
async def list_recently_viewed(
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    최근 본 상품 조회 (3중 캐싱)

    조회 순서:
    1. Redis 캐시 (1시간 TTL) ← 빠름
    2. DB 조회 ← 느림
    3. Redis에 캐시 저장

    응답에는 cacheSource 필드로 캐시 여부 표시
    """
    user_id = current_user["_id"]

    # 1단계: Redis 캐시에서 조회 (1시간)
    cached_items = await redis_client.get_recently_viewed(user_id)
    if cached_items:
        print(f"[Recently Viewed] 🚀 Redis 캐시 히트! user: {user_id}")
        return {"items": cached_items, "cacheSource": "redis"}

    print(f"[Recently Viewed] 📦 DB에서 조회 user: {user_id}")

    # 2단계: DB에서 조회
    user_doc = await db[USERS_COL].find_one(
        {"_id": ObjectId(user_id)},
        {"recentlyViewed": 1},
    )
    entries = user_doc.get("recentlyViewed", []) if user_doc else []

    items = []
    for entry in entries:
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

        items.append({"product": product, "viewedAt": viewed_at_str})

    # 3단계: Redis에 캐시 저장 (1시간)
    success = await redis_client.set_recently_viewed(user_id, items)
    if success:
        print(f"[Recently Viewed] 💾 Redis에 캐시 저장 성공 user: {user_id}")
    else:
        print(f"[Recently Viewed] ⚠️ Redis 캐시 저장 실패 user: {user_id}")

    return {"items": items, "cacheSource": "db"}


@router.post("/seller/register", response_model=UserOut, status_code=status.HTTP_200_OK)
async def register_as_seller(
    payload: SellerRegistrationIn,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    판매자 등록

    일반 사용자를 판매자로 등록합니다.
    """
    user_id = current_user["_id"]

    # 이미 판매자인지 확인
    if current_user.get("isSeller"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 판매자로 등록되어 있습니다.",
        )

    # 사업자 등록번호 중복 확인
    existing_seller = await db[USERS_COL].find_one({
        "sellerInfo.businessNumber": payload.businessNumber
    })

    if existing_seller:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 사업자 등록번호입니다.",
        )

    # 판매자 정보 업데이트
    now = datetime.utcnow()
    update_result = await db[USERS_COL].update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "isSeller": True,
                "sellerInfo": {
                    "businessName": payload.businessName,
                    "businessNumber": payload.businessNumber,
                    "registeredAt": now,
                }
            }
        }
    )

    if update_result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="판매자 등록에 실패했습니다.",
        )

    # 업데이트된 사용자 정보 조회
    updated_user = await db[USERS_COL].find_one({"_id": ObjectId(user_id)})
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다.",
        )

    # _id를 문자열로 변환
    updated_user["_id"] = str(updated_user["_id"])

    return updated_user


@router.get("/me", response_model=UserOut)
async def get_current_user_info(
    current_user=Depends(get_current_user),
):
    """
    현재 로그인한 사용자 정보 조회
    """
    return current_user
