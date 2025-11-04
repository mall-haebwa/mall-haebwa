# backend/app/order_router.py
from fastapi import APIRouter, HTTPException, Depends, Request
from bson import ObjectId
from .database import get_db
from .models import ORDERS_COL, USERS_COL
from .auth_router import COOKIE_ACCESS
from .security import decode_token
from typing import List, Dict, Any

router = APIRouter(prefix="/orders", tags=["orders"])


# 현재 사용자 가져오기
async def get_current_user(
    request: Request,
    db=Depends(get_db),
):
    token = request.cookies.get(COOKIE_ACCESS)
    if not token:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    try:
        payload = decode_token(token)
        if payload.get("scope") != "access":
            raise ValueError("Not an access token")
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="토큰이 유효하지 않습니다.")

    user = await db[USERS_COL].find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")

    user["_id"] = str(user["_id"])
    return user


@router.get("")
async def get_orders(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
) -> List[Dict[str, Any]]:
    """현재 사용자의 주문 목록 조회"""
    try:
        # 현재 사용자의 주문만 조회, 최신 주문부터 정렬
        cursor = db[ORDERS_COL].find({"user_id": current_user["_id"]}).sort("created_at", -1)
        orders = await cursor.to_list(length=100)  # 최대 100개

        # MongoDB의 _id를 문자열로 변환
        for order in orders:
            order["_id"] = str(order["_id"])

        return orders
    except Exception as e:
        raise HTTPException(500, f"주문 조회 실패: {str(e)}")


@router.get("/{order_id}")
async def get_order(
    order_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
) -> Dict[str, Any]:
    """특정 주문 상세 조회 (본인 주문만)"""
    try:
        order = await db[ORDERS_COL].find_one({
            "order_id": order_id,
            "user_id": current_user["_id"]  # 본인 주문만 조회
        })

        if not order:
            raise HTTPException(404, "주문을 찾을 수 없습니다")

        # MongoDB의 _id를 문자열로 변환
        order["_id"] = str(order["_id"])

        return order
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"주문 조회 실패: {str(e)}")
