# backend/app/models.py
from motor.motor_asyncio import AsyncIOMotorDatabase

USERS_COL = "users"
ORDERS_COL = "orders"


async def ensure_indexes(db: AsyncIOMotorDatabase):
    await db[USERS_COL].create_index("email", unique=True)
    await db[ORDERS_COL].create_index("order_id", unique=True)
    await db[ORDERS_COL].create_index("user_id")  # 사용자별 주문 조회용
