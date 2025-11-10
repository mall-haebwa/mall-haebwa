from datetime import datetime
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from .auth_router import COOKIE_ACCESS
from .database import get_db
from .models import CARTS_COL, USERS_COL
from .schemas import (
    CartItemIn,
    CartItemQuantityUpdate,
    CartItemsDeleteRequest,
    CartOut,
    CartUpsert,
)
from .security import decode_token

router = APIRouter(prefix="/cart", tags=["cart"])

def merge_items(existing: list[dict], incoming: list[dict]) -> list[dict]:
    by_key: dict[tuple[str, str | None, str | None], dict] = {}
    for item in existing:
        key = (item["productId"], item.get("selectedColor"), item.get("selectedSize"))
        by_key[key] = {**item}
    for item in incoming:
        key = (item["productId"], item.get("selectedColor"), item.get("selectedSize"))
        if key in by_key:
            current = by_key[key]
            current["quantity"] += item["quantity"]
            # 스냅샷이 들어와 있으면 갱신
            if item.get("priceSnapshot") is not None:
                current["priceSnapshot"] = item["priceSnapshot"]
            if item.get("nameSnapshot"):
                current["nameSnapshot"] = item["nameSnapshot"]
            if item.get("imageSnapshot"):
                current["imageSnapshot"] = item["imageSnapshot"]
        else:
            by_key[key] = {**item}
    return list(by_key.values())


async def get_current_user(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    token = request.cookies.get(COOKIE_ACCESS)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="로그인이 필요합니다.")
    
    try:
        payload = decode_token(token)
        if payload.get("scope") != "access":
            raise ValueError("Not an access token")
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="토큰이 유효하지 않습니다.")
    
    user = await db[USERS_COL].find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다.")
    user["_id"] = str(user["_id"])
    return user

async def get_or_create_cart(user_id: str, db: AsyncIOMotorDatabase):
    cart = await db[CARTS_COL].find_one({"userId": user_id})
    if cart:
        return cart
    
    now = datetime.utcnow()
    result = await db[CARTS_COL].insert_one(
        {
            "userId": user_id,
            "items": [],
            "updatedAt": now,
        }
    )
    return {
        "_id": result.inserted_id,
        "userId": user_id,
        "items": [],
        "updatedAt": now,
    }

def serialize_cart(doc: dict) -> CartOut:
    items = []
    for item in doc.get("items", []):
        item_id = str(item.get("_id"))
        items.append(
            {
                "_id": item_id,
                "id": item_id,
                "productId": item["productId"],
                "quantity": item["quantity"],
                "selectedColor": item.get("selectedColor"),
                "selectedSize": item.get("selectedSize"),
                "priceSnapshot": item.get("priceSnapshot"),
                "nameSnapshot": item.get("nameSnapshot"),
                "imageSnapshot": item.get("imageSnapshot"),
            }
        )
    
    return CartOut.model_validate(
        {
            "_id": str(doc["_id"]),
            "id": str(doc["_id"]),
            "userId": doc["userId"],
            "items": items,
            "updatedAt": doc.get("updatedAt"),
        }
    )

@router.get("/", response_model=CartOut)
async def read_cart(
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    cart = await get_or_create_cart(current_user["_id"], db)
    return serialize_cart(cart)

@router.post("/items", response_model=CartOut, status_code=status.HTTP_201_CREATED)
async def add_cart_item(
    payload: CartItemIn,
    current_user = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    cart = await get_or_create_cart(current_user["_id"], db)
    items = cart.get("items", [])
    key = (payload.productId, payload.selectedColor, payload.selectedSize)

    found_index = -1
    for i, item in enumerate(items):
        if (
            item["productId"],
            item.get("selectedColor"),
            item.get("selectedSize"),
        ) == key:
            item["quantity"] += payload.quantity
            if payload.priceSnapshot is not None:
                item["priceSnapshot"] = payload.priceSnapshot
            if payload.nameSnapshot is not None:
                item["nameSnapshot"] = payload.nameSnapshot
            if payload.imageSnapshot is not None:
                item["imageSnapshot"] = payload.imageSnapshot
            found_index = i
            break

    if found_index >= 0:
        # 동일 상품이 있으면 맨 위로 이동
        found_item = items.pop(found_index)
        items.insert(0, found_item)
    else:
        # 새 상품은 맨 앞에 추가 (최신순)
        new_item = payload.model_dump(exclude_unset=True)
        new_item["_id"] = str(uuid4())
        items.insert(0, new_item)

    now = datetime.utcnow()
    await db[CARTS_COL].update_one(
        {"userId": current_user["_id"]},
        {"$set": {"items": items, "updatedAt": now}},
        upsert=True,
    )
    updated = await db[CARTS_COL].find_one({"userId": current_user["_id"]})
    return serialize_cart(updated)

@router.patch("/items/{item_id}", response_model=CartOut)
async def update_cart_item(
    item_id: str,
    payload: CartItemQuantityUpdate,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    now = datetime.utcnow()
    updated = await db[CARTS_COL].find_one_and_update(
        {"userId": current_user["_id"], "items._id": item_id},
        {
            "$set": {
                "items.$.quantity": payload.quantity,
                "updatedAt": now,
            }
        },
        return_document = ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="장바구니 항목을 찾을 수 없습니다.")
    return serialize_cart(updated)

@router.delete("/items/{item_id}", response_model=CartOut, status_code=status.HTTP_200_OK)
async def delete_cart_item(
    item_id: str,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    print(f"🗑️ 삭제 요청: user_id={current_user['_id']}, item_id={item_id}")
    now = datetime.utcnow()

    # 삭제 전 장바구니 상태 확인
    before_cart = await db[CARTS_COL].find_one({"userId": current_user["_id"]})
    if before_cart:
        print(f"📦 삭제 전 장바구니 아이템 수: {len(before_cart.get('items', []))}")
        print(f"📋 삭제 전 아이템 ID 목록: {[item.get('_id') for item in before_cart.get('items', [])]}")

    updated = await db[CARTS_COL].find_one_and_update(
        {"userId": current_user["_id"]},
        {
            "$pull": {"items": {"_id": item_id}},
            "$set": {"updatedAt": now},
        },
        return_document=ReturnDocument.AFTER,
    )

    if updated:
        print(f"✅ 삭제 후 장바구니 아이템 수: {len(updated.get('items', []))}")
        print(f"📋 삭제 후 아이템 ID 목록: {[item.get('_id') for item in updated.get('items', [])]}")

    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="장바구니 항목을 찾을 수 없습니다.")
    return serialize_cart(updated)

@router.post("/items/delete-batch", response_model=CartOut, status_code=status.HTTP_200_OK)
async def delete_cart_items_batch(
    payload: CartItemsDeleteRequest,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """여러 장바구니 아이템을 한 번에 삭제"""
    item_ids = payload.item_ids
    print(f"🗑️ 일괄 삭제 요청: user_id={current_user['_id']}, item_ids={item_ids}")
    now = datetime.utcnow()

    # 삭제 전 장바구니 상태 확인
    before_cart = await db[CARTS_COL].find_one({"userId": current_user["_id"]})
    if before_cart:
        print(f"📦 삭제 전 장바구니 아이템 수: {len(before_cart.get('items', []))}")
        print(f"📋 삭제 전 아이템 ID 목록: {[item.get('_id') for item in before_cart.get('items', [])]}")

    # $pull을 사용하여 여러 개의 아이템을 한 번에 삭제
    updated = await db[CARTS_COL].find_one_and_update(
        {"userId": current_user["_id"]},
        {
            "$pull": {"items": {"_id": {"$in": item_ids}}},
            "$set": {"updatedAt": now},
        },
        return_document=ReturnDocument.AFTER,
    )

    if updated:
        print(f"✅ 삭제 후 장바구니 아이템 수: {len(updated.get('items', []))}")
        print(f"📋 삭제 후 아이템 ID 목록: {[item.get('_id') for item in updated.get('items', [])]}")
    else:
        print(f"⚠️ 장바구니를 찾을 수 없습니다.")

    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="장바구니를 찾을 수 없습니다.")

    return serialize_cart(updated)

@router.put("/", response_model=CartOut)
async def replace_cart(
    payload: CartUpsert,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    existing = await get_or_create_cart(current_user["_id"], db)
    now = datetime.utcnow()

    incoming = []
    for item in payload.items:
        incoming.append(
            {
                "_id": str(uuid4()),
                "productId": item.productId,
                "quantity": item.quantity,
                "selectedColor": item.selectedColor,
                "selectedSize": item.selectedSize,
                "priceSnapshot": item.priceSnapshot,
                "nameSnapshot": item.nameSnapshot,
                "imageSnapshot": item.imageSnapshot,
            }
        )

    merged = merge_items(existing.get("items", []), incoming)

    await db[CARTS_COL].update_one(
        {"userId": current_user["_id"]},
        {"$set": {"items": merged, "updatedAt": now}},
        upsert=True,
    )
    updated = await db[CARTS_COL].find_one({"userId": current_user["_id"]})
    return serialize_cart(updated)
