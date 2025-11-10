from datetime import datetime
from typing import Literal, Optional, Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from .database import get_db
from .models import ORDERS_COL
from .user_router import get_current_user

router = APIRouter(prefix="/seller/orders", tags=["seller-orders"])

# 주문 상태는 프런트와 동일한 문자열을 사용한다.
OrderStatus = Literal["pending", "shipping", "completed", "canceled"]

STATUS_FILTER_MAP: Dict[OrderStatus, List[str]] = {
    "pending": ["PENDING", "PAID", "READY", "AWAITING_PAYMENT", "pending"],
    "shipping": ["SHIPPING", "DELIVERING", "IN_TRANSIT", "shipping"],
    "completed": ["COMPLETED", "DONE", "DELIVERED", "SUCCESS", "completed"],
    "canceled": ["CANCELED", "CANCELLED", "REFUNDED", "FAILED", "canceled"],
}

def normalise_status(raw_status: Optional[str]) -> OrderStatus:
    if not raw_status:
        return "pending"
    upper = raw_status.upper()
    for ui_status, raw_values in STATUS_FILTER_MAP.items():
        if upper in raw_values:
            return ui_status
    return "pending"

def ensure_seller(current_user: dict):
    """판매자 계정이 아니라면 즉시 차단."""
    if not current_user.get("isSeller"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "판매자만 접근할 수 있습니다.")
    
@router.get("")
async def list_orders(
    status_filter: Optional[OrderStatus] = Query(None),
    page: int = Query(1, ge =1),
    limit: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    판매자의 주문 목록을 상태·페이지네이션 조건으로 조회.
    """
    ensure_seller(current_user)

    seller_id = str(current_user["_id"])
    skip = (page - 1) * limit

    match_stage: Dict[str, Any] = {"items.sellerId": seller_id}
    if status_filter:
        target_values = STATUS_FILTER_MAP.get(status_filter, [])
        match_stage["status"] = {
            "$in": target_values + [status_filter, status_filter.upper()]
        }

    pipeline = [
        {"$match": match_stage},
        {
            "$addFields": {
                "sellerItems": {
                    "$filter": {
                        "input": "$items",
                        "as": "item",
                        "cond": {"$eq": ["$$item.sellerId", seller_id]},
                    }
                }
            }
        },
        {"$match": {"sellerItems": {"$ne": []}}},
        {
            "$addFields": {
                "sellerAmount": {
                    "$sum": {
                        "$map": {
                            "input": "$sellerItems",
                            "as": "item",
                            "in": {
                                "$multiply": ["$$item.quantity", "$$item.price"]
                            },
                        }
                    }
                },
                "primaryProduct": {
                    "$arrayElemAt": ["$sellerItems.product_name", 0]
                },
                "itemCount": {"$size": "$sellerItems"},
            }
        },
        {"$sort": {"created_at": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {
            "$project": {
                "_id": 1,
                "order_id": 1,
                "customer_name": 1,
                "status": 1,
                "created_at": 1,
                "sellerAmount": 1,
                "primaryProduct": 1,
                "itemCount": 1,
                "sellerItems": 1,
            }
        },
    ]

    cursor = db[ORDERS_COL].aggregate(pipeline)
    raw_orders = await cursor.to_list(length=limit)
    orders = []
    for order in raw_orders:
        products = [
            {
                "productName": item.get("product_name"),
                "quantity": item.get("quantity"),
                "price": item.get("price"),
                "imageUrl": item.get("image_url"),
            }
            for item in order.get("sellerItems", [])
        ]

        orders.append(
            {
                "_id": str(order["_id"]),
                "order_id": order.get("order_id"),
                "customerName": order.get("customer_name"),
                "status": normalise_status(order.get("status")),
                "created_at": order.get("created_at"),
                "amount": order.get("sellerAmount", 0),
                "productName": order.get("primaryProduct"),
                "itemCount": order.get("itemCount", 0),
                "products": products,
            }
        )

    total = await db[ORDERS_COL].count_documents(match_stage)
    return {"items": orders, "total": total, "page": page, "limit": limit}

@router.patch("/{order_id}/status")
async def update_order_status(
    order_id: str,
    new_status: OrderStatus,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    단일 주문의 상태를 업데이트. 판매자 본인 주문만 변경 가능.
    """
    ensure_seller(current_user)

    try:
        order_obj_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "유효하지 않은 주문 ID입니다.")
    
    result = await db[ORDERS_COL].update_one(
        {"_id": order_obj_id, "sellerId": str(current_user["_id"])},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}},
    )

    if result.matched_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "주문을 찾을 수 없습니다.")
    
    updated = await db[ORDERS_COL].find_one({"_id": order_obj_id})
    updated["_id"] = str(updated["_id"])
    return updated

@router.get("/dashboard")
async def order_dashboard(
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    주문 상태별 건수와 AI 사기 탐지 목록을 한 번에 반환.
    """
    ensure_seller(current_user)

    seller_id = str(current_user["_id"])
    status_pipeline = [
        {"$match": {"items.sellerId": seller_id}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    summary = await db[ORDERS_COL].aggregate(status_pipeline).to_list(None)
    status_counts: Dict[str, int] = {
        "pending": 0,
        "shipping": 0,
        "completed": 0,
        "canceled": 0,
    }
    for item in summary:
        ui_status = normalise_status(item["_id"])
        status_counts[ui_status] += item["count"]
    status_counts["total"] = sum(status_counts.values())

    suspicious_cursor = db[ORDERS_COL].find(
        {"items.sellerId": seller_id, "isSuspicious": True},
        {"order_id": 1, "fraudReasons": 1, "created_at": 1},
    ).sort("created_at", -1).limit(5)
    suspicious = await suspicious_cursor.to_list(length=5)
    for row in suspicious:
        row["_id"] = str(row["_id"])

    return {"statusCounts": status_counts, "suspiciousOrders": suspicious}
