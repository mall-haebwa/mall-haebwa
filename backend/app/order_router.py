# backend/app/order_router.py
from fastapi import APIRouter, HTTPException, Depends, Request
from bson import ObjectId
from .database import get_db
from .models import ORDERS_COL, USERS_COL
from .auth_router import COOKIE_ACCESS
from .security import decode_token
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import httpx
import os
import base64

router = APIRouter(prefix="/orders", tags=["orders"])

TOSS_SECRET_KEY = os.getenv("TOSS_SECRET_KEY", "test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R")

def get_toss_auth_header():
    """Toss Payment API 인증 헤더"""
    auth_string = f"{TOSS_SECRET_KEY}:"
    encoded = base64.b64encode(auth_string.encode()).decode()
    return f"Basic {encoded}"

class CancelRequest(BaseModel):
    cancel_reason: str = "고객 요청"    # 취소 사유

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

@router.post("/{order_id}/cancel")
async def cancel_order(
    order_id: str,
    cancel_request: CancelRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
) -> Dict[str, Any]:
    """주문 취소 (결제 취소 + 포인트 복구)"""
    try:
        # 1. 주문 조회 (본인 주문만)
        order = await db[ORDERS_COL].find_one({
            "order_id": order_id,
            "user_id": current_user["_id"]
        })

        if not order:
            raise HTTPException(404, "주문을 찾을 수 없습니다")

        # 2. 취소 가능 여부 확인
        if order.get("status") == "CANCELED":
            raise HTTPException(400, "이미 취소된 주문입니다")

        if order.get("status") not in ["PAID", "PREPARING"]:
            raise HTTPException(400, f"취소할 수 없는 주문 상태입니다: {order.get('status')}")

        # 3. 결제 후 24시간 이내만 취소 가능 (옵션)
        approved_at = order.get("approved_at")
        if approved_at:
            if isinstance(approved_at, str):
                approved_time = datetime.fromisoformat(approved_at.replace("Z", "+00:00"))
            else:
                approved_time = approved_at

            time_diff = datetime.utcnow() - approved_time.replace(tzinfo=None)
            if time_diff > timedelta(hours=24):
                raise HTTPException(400, "결제 후 24시간이 지나 취소할 수 없습니다. 고객센터에 문의하세요.")

        # 4. Toss Payment 취소 API 호출
        payment_key = order.get("payment_key")
        if not payment_key:
            raise HTTPException(400, "결제 정보를 찾을 수 없습니다")

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"https://api.tosspayments.com/v1/payments/{payment_key}/cancel",
                    json={
                        "cancelReason": cancel_request.cancel_reason
                    },
                    headers={
                        "Authorization": get_toss_auth_header(),
                        "Content-Type": "application/json"
                    },
                    timeout=10.0
                )

                if response.status_code != 200:
                    error = response.json()
                    raise HTTPException(400, f"결제 취소 실패: {error.get('message', '알 수 없는 오류')}")

                cancel_data = response.json()

            except httpx.RequestError as e:
                raise HTTPException(500, f"결제 취소 API 요청 실패: {str(e)}")

        # 5. 주문 상태 업데이트
        update_result = await db[ORDERS_COL].update_one(
            {"order_id": order_id},
            {
                "$set": {
                    "status": "CANCELED",
                    "canceled_at": datetime.utcnow(),
                    "cancel_reason": cancel_request.cancel_reason,
                    "cancel_data": cancel_data  # Toss 취소 응답 저장
                }
            }
        )

        if update_result.modified_count == 0:
            raise HTTPException(500, "주문 상태 업데이트 실패")

        # 6. 포인트 복구 (사용한 포인트가 있으면)
        # 현재는 포인트 사용 로직이 없으므로 스킵
        # 추후 포인트 차감 기능 구현 시 여기에 복구 로직 추가

        # 7. 사용자 포인트 복구 (결제 시 적립된 5% 차감)
        points_earned = int(order.get("amount", 0) * 0.05)
        if points_earned > 0:
            await db[USERS_COL].update_one(
                {"_id": ObjectId(current_user["_id"])},
                {"$inc": {"points": -points_earned}}  # 적립 포인트 차감
            )

        return {
            "success": True,
            "message": "주문이 취소되었습니다",
            "order_id": order_id,
            "refund_amount": order.get("amount"),
            "points_deducted": points_earned,
            "canceled_at": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"주문 취소 실패: {str(e)}")