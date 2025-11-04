 # backend/app/wishlist_router.py
from fastapi import APIRouter, Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from .database import get_db
from .security import decode_token
from .models import USERS_COL
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/wishlist", tags=["wishlist"])

WISHLIST_COL = "wishlists"
PRODUCTS_COL = "products"

# 쿠키에서 사용자 인증하는 헬퍼 함수
async def get_current_user_id(request: Request, db: AsyncIOMotorDatabase) -> str:
    """쿠키에서 access_token을 읽어 user_id 반환"""
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    try:
        payload = decode_token(token)
        if payload.get("scope") != "access":
            raise ValueError("Invalid token scope")
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")

    # 사용자 존재 확인
    user = await db[USERS_COL].find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    return user_id


class WishlistAddRequest(BaseModel):
    product_id: str


@router.post("/add")
async def add_to_wishlist(
    payload: WishlistAddRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """찜 목록에 상품 추가"""
    user_id = await get_current_user_id(request, db)

    # 상품 존재 확인
    try:
        product_obj_id = ObjectId(payload.product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="잘못된 상품 ID입니다.")

    product = await db[PRODUCTS_COL].find_one({"_id": product_obj_id})
    if not product:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다.")

    # 이미 찜한 상품인지 확인
    existing = await db[WISHLIST_COL].find_one({
        "user_id": ObjectId(user_id),
        "product_id": product_obj_id
    })

    if existing:
        raise HTTPException(status_code=409, detail="이미 찜한 상품입니다.")

    # 찜 추가
    doc = {
        "user_id": ObjectId(user_id),
        "product_id": product_obj_id,
        "created_at": datetime.utcnow()
    }
    await db[WISHLIST_COL].insert_one(doc)

    return {"message": "찜 목록에 추가되었습니다."}


@router.delete("/remove/{product_id}")
async def remove_from_wishlist(
    product_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """찜 목록에서 상품 제거"""
    user_id = await get_current_user_id(request, db)

    try:
        product_obj_id = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="잘못된 상품 ID입니다.")

    result = await db[WISHLIST_COL].delete_one({
        "user_id": ObjectId(user_id),
        "product_id": product_obj_id
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="찜 목록에 없는 상품입니다.")

    return {"message": "찜 목록에서 제거되었습니다."}


@router.get("/check/{product_id}")
async def check_wishlist(
    product_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """특정 상품이 찜 목록에 있는지 확인"""
    user_id = await get_current_user_id(request, db)

    try:
        product_obj_id = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="잘못된 상품 ID입니다.")

    exists = await db[WISHLIST_COL].find_one({
        "user_id": ObjectId(user_id),
        "product_id": product_obj_id
    })

    return {"isWishlisted": exists is not None}


@router.get("/list")
async def get_wishlist(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """사용자의 전체 찜 목록 조회 (상품 정보 포함)"""
    user_id = await get_current_user_id(request, db)

    # MongoDB aggregation으로 product 정보와 조인
    pipeline = [
        {"$match": {"user_id": ObjectId(user_id)}},
        {
            "$lookup": {
                "from": PRODUCTS_COL,
                "localField": "product_id",
                "foreignField": "_id",
                "as": "product_info"
            }
        },
        {"$unwind": "$product_info"},
        {"$sort": {"created_at": -1}}  # 최신 순
    ]

    cursor = db[WISHLIST_COL].aggregate(pipeline)
    items = await cursor.to_list(length=None)

    # product_router의 _reshape_product와 동일한 형태로 변환
    from .product_router import _reshape_product

    result = []
    for item in items:
        product = _reshape_product(item["product_info"])
        result.append({
            "wishlist_id": str(item["_id"]),
            "product": product,
            "added_at": item["created_at"].isoformat() if item.get("created_at") else None
        })

    return {"items": result, "total": len(result)}