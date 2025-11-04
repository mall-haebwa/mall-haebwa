# backend/app/payment_router.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import httpx
import os
import base64
from datetime import datetime
from .database import get_db
from .models import ORDERS_COL

router = APIRouter(prefix="/payment", tags=["payment"])

TOSS_CLIENT_KEY = os.getenv("TOSS_CLIENT_KEY", "test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq")
TOSS_SECRET_KEY = os.getenv("TOSS_SECRET_KEY", "test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R")

def get_auth_header():
    auth_string = f"{TOSS_SECRET_KEY}:"
    encoded = base64.b64encode(auth_string.encode()).decode()
    return f"Basic {encoded}"

# 임시 주문 저장소 (결제 전 임시 데이터)
orders = {}

class OrderItem(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    price: int
    image_url: str = ""
    selected_color: str = ""
    selected_size: str = ""

class OrderCreate(BaseModel):
    amount: int
    order_name: str
    customer_name: str
    items: list[OrderItem] = []

class PaymentConfirm(BaseModel):
    payment_key: str
    order_id: str
    amount: int

@router.get("/config")
async def get_payment_config():
    """토스 클라이언트 키"""
    return {"client_key": TOSS_CLIENT_KEY}

@router.post("/orders")
async def create_order(order: OrderCreate):
    """주문 생성"""
    import time
    order_id = f"ORDER_{int(time.time() * 1000)}"

    orders[order_id] = {
        "order_id": order_id,
        "amount": order.amount,
        "order_name": order.order_name,
        "customer_name": order.customer_name,
        "items": [item.dict() for item in order.items],
        "status": "READY"
    }

    return {"success": True, "order": orders[order_id]}

@router.post("/confirm")
async def confirm_payment(confirm: PaymentConfirm, db=Depends(get_db)):
    """결제 승인 및 주문 저장"""

    if confirm.order_id not in orders:
        raise HTTPException(404, "주문을 찾을 수 없습니다")

    saved_order = orders[confirm.order_id]

    # 금액 검증 (위변조 방지!)
    if saved_order["amount"] != confirm.amount:
        raise HTTPException(400, "결제 금액이 일치하지 않습니다")

    if saved_order["status"] == "PAID":
        raise HTTPException(400, "이미 결제된 주문입니다")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.tosspayments.com/v1/payments/confirm",
                json={
                    "paymentKey": confirm.payment_key,
                    "orderId": confirm.order_id,
                    "amount": confirm.amount
                },
                headers={
                    "Authorization": get_auth_header(),
                    "Content-Type": "application/json"
                },
                timeout=10.0
            )

            if response.status_code != 200:
                error = response.json()
                raise HTTPException(400, f"결제 실패: {error.get('message')}")

            payment_data = response.json()

            # DB에 주문 정보 저장
            order_document = {
                "order_id": confirm.order_id,
                "amount": confirm.amount,
                "order_name": saved_order["order_name"],
                "customer_name": saved_order["customer_name"],
                "items": saved_order.get("items", []),  # 상품 목록 저장
                "status": "PAID",
                "payment_key": confirm.payment_key,
                "payment_method": payment_data.get("method", ""),
                "approved_at": payment_data.get("approvedAt", datetime.utcnow().isoformat()),
                "created_at": datetime.utcnow(),
                "payment_data": payment_data  # 전체 결제 정보 저장
            }

            await db[ORDERS_COL].insert_one(order_document)

            # 메모리에서 임시 주문 데이터 제거
            orders[confirm.order_id]["status"] = "PAID"

            return {
                "success": True,
                "message": "결제 완료",
                "payment": payment_data
            }

        except Exception as e:
            raise HTTPException(500, f"서버 오류: {str(e)}")