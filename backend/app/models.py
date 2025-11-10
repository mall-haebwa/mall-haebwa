# backend/app/models.py
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import OperationFailure


USERS_COL = "users"
ORDERS_COL = "orders"
CARTS_COL = "carts"
PRODUCTS_COL = "products"



async def ensure_indexes(db: AsyncIOMotorDatabase):
    await db[USERS_COL].create_index("email", unique=True)
    await db[ORDERS_COL].create_index("order_id", unique=True)
    await db[ORDERS_COL].create_index("user_id")  # 사용자별 주문 조회용
    await db[CARTS_COL].create_index("userId", unique=True)

    try:
        await db[CARTS_COL].drop_index("user_item_options")
    except OperationFailure:
        pass # 인덱스가 없거나 다른 문제면 그냥 넘어간다
    
    await db[CARTS_COL].create_index(
        [
            ("userId", 1), 
            ("items.productId", 1), 
            ("items.selectedColor", 1),
            ("items.selectedSize", 1),
        ],
        name = "user_item_options", 
        unique = True, 
        sparse = True,
        )
