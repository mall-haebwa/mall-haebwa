"""장바구니 Service"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.models import CARTS_COL

class CartService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def get_cart_summary(self, user_id: str) -> dict:
        """
        장바구니 요약 (AI 챗봇용)
        
        Returns:
            {"items": [...], "total_items": 5, "total_amount": 250000}
        """
        # cart_router의 get_or_create_cart 로직 복사
        cart = await self.db[CARTS_COL].find_one({"userId": user_id})

        if not cart:
            return {"items": [], "total_items": 0, "total_amount": 0}

        items = cart.get("items", [])
        total_items = len(items)
        total_amount = sum(
            item.get("quantity", 1) * item.get("priceSnapshot", 0)
            for item in items
        )

        return {
            "items": items,
            "total_items": total_items,
            "total_amount": total_amount
        }