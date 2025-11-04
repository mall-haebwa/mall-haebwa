# backend/app/payment_router.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import os
import base64

router = APIRouter(prefix="/api/payment", tags=["payment"])

TOSS_CLIENT_KEY = os.getenv("TOSS_CLIENT_KEY", "test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq")
TOSS_SECRET_KEY = os.getenv("TOSS_SECRET_KEY", "test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R")

def get_auth_header():
    auth_string = f"{TOSS_SECRET_KEY}:"
    encoded = base64.b64encode(auth_string.encode()).decode()
    return f"Basic {encoded}"

# 임시 주문 저장소
orders = {}

class OrderCreate(BaseModel):
    amount: int
    order_name: str
    customer_name: str

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
        "status": "READY"
    }
    
    return {"success": True, "order": orders[order_id]}

@router.post("/confirm")
async def confirm_payment(confirm: PaymentConfirm):
    """결제 승인"""
    
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
            orders[confirm.order_id]["status"] = "PAID"
            
            return {
                "success": True,
                "message": "결제 완료",
                "payment": payment_data
            }
            
        except Exception as e:
            raise HTTPException(500, f"서버 오류: {str(e)}")