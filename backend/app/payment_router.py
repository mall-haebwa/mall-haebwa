# backend/app/payment_router.py
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
import httpx
import os
import base64
from datetime import datetime
from bson import ObjectId
from .database import get_db
from .models import ORDERS_COL, USERS_COL, CARTS_COL
from .auth_router import COOKIE_ACCESS
from .security import decode_token

router = APIRouter(prefix="/payment", tags=["payment"])

TOSS_CLIENT_KEY = os.getenv("TOSS_CLIENT_KEY", "test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq")
TOSS_SECRET_KEY = os.getenv("TOSS_SECRET_KEY", "test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R")

def get_auth_header():
    auth_string = f"{TOSS_SECRET_KEY}:"
    encoded = base64.b64encode(auth_string.encode()).decode()
    return f"Basic {encoded}"

# 현재 사용자 가져오기
async def get_current_user(
    request: Request,
    db = Depends(get_db),
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
    cart_item_ids: list[str] = []  # 장바구니 아이템 ID 목록

class PaymentConfirm(BaseModel):
    payment_key: str
    order_id: str
    amount: int

@router.get("/config")
async def get_payment_config():
    """토스 클라이언트 키"""
    return {"client_key": TOSS_CLIENT_KEY}

@router.post("/orders")
async def create_order(
    order: OrderCreate,
    current_user: dict = Depends(get_current_user)
):
    """주문 생성"""
    import time
    order_id = f"ORDER_{int(time.time() * 1000)}"

    orders[order_id] = {
        "order_id": order_id,
        "user_id": current_user["_id"],  # 사용자 ID 추가
        "amount": order.amount,
        "order_name": order.order_name,
        "customer_name": order.customer_name,
        "items": [item.dict() for item in order.items],
        "cart_item_ids": order.cart_item_ids,  # 장바구니 아이템 ID 저장
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
                "user_id": saved_order["user_id"],  # 사용자 ID 저장
                "amount": confirm.amount,
                "order_name": saved_order["order_name"],
                "customer_name": saved_order["customer_name"],
                "items": saved_order.get("items", []),  # 상품 목록 저장
                "cart_item_ids": saved_order.get("cart_item_ids", []),  # 장바구니 아이템 ID 저장
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

            # 장바구니에서 구매한 상품 삭제
            cart_item_ids = saved_order.get("cart_item_ids", [])
            if cart_item_ids:
                user_id = saved_order["user_id"]
                print(f"🗑️ 결제 완료 후 장바구니 삭제: user_id={user_id}, cart_item_ids={cart_item_ids}")

                # 삭제 전 장바구니 상태 확인
                before_cart = await db[CARTS_COL].find_one({"userId": user_id})
                if before_cart:
                    print(f"📦 삭제 전 장바구니 아이템 수: {len(before_cart.get('items', []))}")
                    print(f"📋 삭제 전 아이템 ID 목록: {[item.get('_id') for item in before_cart.get('items', [])]}")

                result = await db[CARTS_COL].update_one(
                    {"userId": user_id},
                    {
                        "$pull": {"items": {"_id": {"$in": cart_item_ids}}},
                        "$set": {"updatedAt": datetime.utcnow()},
                    },
                )

                # 삭제 후 장바구니 상태 확인
                after_cart = await db[CARTS_COL].find_one({"userId": user_id})
                if after_cart:
                    print(f"✅ 삭제 후 장바구니 아이템 수: {len(after_cart.get('items', []))}")
                    print(f"📋 삭제 후 아이템 ID 목록: {[item.get('_id') for item in after_cart.get('items', [])]}")

                print(f"✅ 장바구니에서 {result.modified_count}개의 문서 수정됨")

            return {
                "success": True,
                "message": "결제 완료",
                "payment": payment_data,
                "cart_item_ids": cart_item_ids  # 클라이언트에 전달
            }

        except HTTPException:
            # HTTPException은 그대로 다시 던짐
            raise
        except httpx.RequestError as e:
            raise HTTPException(500, f"결제 API 요청 실패: {str(e)}")
        except Exception as e:
            raise HTTPException(500, f"서버 오류: {str(e)}")