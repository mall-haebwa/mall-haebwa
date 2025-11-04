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
    CartOut,
    CartUpsert,
)
from .security import decode_token

router = APIRouter(prefix="/cart", tags=["cart"])


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
            "updateAt": now,
        }
    )
    return {
        "_id": result.inserted_id,
        "userId": user_id,
        "items": [],
        "updateAt": now,
    }

def serialize_cart(doc: dict) -> CartOut:
    items = []
    for item in doc.get("items",[]):
        items.append(
            {
                "_id": item["_id"],
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

    for item in items:
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
            break
    
    else:
        new_item = payload.model_dump(exclude_unset=True)
        new_item["_id"] = str(uuid4())
        items.append(new_item)

    now = datetime.utcnow()
    await db[CARTS_COL].update_one(
        {"useId": current_user["_id"]},
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
    now = datetime.utcnow()
    updated = await db[CARTS_COL].find_one_and_update(
        {"userId": current_user["_id"]},
        {
            "$pull": {"items": {"_id": item_id}},
            "$set": {"updatedAt": now},
        },
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="장바구니 항목을 찾을 수 없습니다.")
    return serialize_cart(updated)

@router.put("/", response_model=CartOut)
async def replace_cart(
    payload: CartUpsert,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    deduped: dict[tuple[str, str | None, str | None], dict] = {}
    for item in payload.items:
        key = (item.productId, item.selectedColor, item.selectedSize)
        stored = deduped.setdefault(
            key,
            {
                "_id": str(uuid4()),
                "productId": item.productId,
                "quantity": 0,
                "selectedColor": item.selectedColor,
                "selectedSize": item.selectedSize,
                "priceSnapshot": item.priceSnapshot,
                "nameSnapshot": item.nameSnapshot,
                "imageSnapshot": item.imageSnapshot,
            },
        )
        stored["quantity"] += item.quantity
        if item.priceSnapshot is not None:
            stored["priceSnapshot"] = item.priceSnapshot
        if item.nameSnapshot is not None:
            stored["nameSnapshot"] = item.nameSnapshot
        if item.imageSnapshot is not None:
            stored["imageSnapshot"] = item.imageSnapshot

    now = datetime.utcnow()
    items = list(deduped.values())
    await db[CARTS_COL].update_one(
        {"userId": current_user["_id"]},
        {"$set": {"items": items, "updatedAt": now}},
        upsert=True,
    )
    updated = await db[CARTS_COL].find_one({"userId": current_user["_id"]})
    return serialize_cart(updated)