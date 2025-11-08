"""찜 목록 Service"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

WISHLIST_COL = "wishlists"
PRODUCTS_COL = "products"

class WishlistService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def get_wishlist(self, user_id: str) -> list:
        """
        찜 목록 조회 (wishlist_router 로직 복사)
        
        Returns:
            [{"wishlist_id": "...", "product": {...}, "added_at": "..."}, ...]
        """
        from app.product_router import _reshape_product

        cursor = self.db[WISHLIST_COL].find(
            {"user_id": ObjectId(user_id)}
        ).sort("created_at", -1)

        wishlist_docs = await cursor.to_list(length=100)

        # 상품 정보 조인
        result = []
        for item in wishlist_docs:
            product = await self.db[PRODUCTS_COL].find_one(
                {"_id": item["product_id"]}
            )
            if product:
                result.append({
                    "wishlist_id": str(item["_id"]),
                    "product": _reshape_product(product),
                    "added_at": item.get("created_at")
                })

        return result
        