from datetime import datetime

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from .auth_router import COOKIE_ACCESS
from .database import get_db
from .models import USERS_COL
from .product_router import _reshape_product
from .schemas import (
    BasicResp,
    RecentlyViewedListOut,
    RecentlyViewedPayload,
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

    return {"message": "최근 본 상품에 추가되었습니다."}


@router.get("/recently-viewed", response_model=RecentlyViewedListOut)
async def list_recently_viewed(
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_doc = await db[USERS_COL].find_one(
        {"_id": ObjectId(current_user["_id"])},
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
            try:
                viewed_at = datetime.fromisoformat(viewed_at.replace("Z", "+00:00"))
            except ValueError:
                viewed_at = datetime.utcnow()
        elif not isinstance(viewed_at, datetime):
            viewed_at = datetime.utcnow()

        items.append({"product": product, "viewedAt": viewed_at})

    return {"items": items}
