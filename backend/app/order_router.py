# backend/app/order_router.py
from fastapi import APIRouter, HTTPException, Depends
from .database import get_db
from .models import ORDERS_COL
from typing import List, Dict, Any

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.get("")
async def get_orders(db=Depends(get_db)) -> List[Dict[str, Any]]:
    """주문 목록 조회"""
    try:
        # 최신 주문부터 정렬
        cursor = db[ORDERS_COL].find().sort("created_at", -1)
        orders = await cursor.to_list(length=100)  # 최대 100개

        # MongoDB의 _id를 문자열로 변환
        for order in orders:
            order["_id"] = str(order["_id"])

        return orders
    except Exception as e:
        raise HTTPException(500, f"주문 조회 실패: {str(e)}")


@router.get("/{order_id}")
async def get_order(order_id: str, db=Depends(get_db)) -> Dict[str, Any]:
    """특정 주문 상세 조회"""
    try:
        order = await db[ORDERS_COL].find_one({"order_id": order_id})

        if not order:
            raise HTTPException(404, "주문을 찾을 수 없습니다")

        # MongoDB의 _id를 문자열로 변환
        order["_id"] = str(order["_id"])

        return order
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"주문 조회 실패: {str(e)}")
