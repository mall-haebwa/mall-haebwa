"""주문 Service"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.models import ORDERS_COL

class OrderService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def get_orders(self, user_id: str) -> list:
        """
        주문 내역 조회 (order_router 로직 복사)
        
        Returns:
            [{"order_id": "...", "amount": 50000, ...}, ...]
        """
        cursor = self.db[ORDERS_COL].find(
            {"user_id": user_id}
        ).sort("created_at", -1)

        orders = await cursor.to_list(length=100)

        # _id를 문자열로 변환
        for order in orders:
            order["_id"] = str(order["_id"])

        return orders
        