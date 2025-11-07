"""Intent 실행 및 데이터 수집 조율"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from elasticsearch import Elasticsearch
from typing import Optional

from app.intents import (
    Intent, IntentType,
    SearchIntent, MultiSearchIntent,
    ViewCartIntent, ViewOrdersIntent,
    TrackDeliveryIntent, ViewWishlistIntent
)
from app.services import (
    ProductService,
    CartService,
    OrderService,
    WishlistService
)

class ChatOrchestrator:
    """Intent에 따라 적절한 Service 호출 및 Action 생성"""

    def __init__(self, db: AsyncIOMotorDatabase, es: Elasticsearch):
        self.db = db
        self.es = es

        # Service 인스턴스 생성
        self.product_service = ProductService(db, es)
        self.cart_service = CartService(db)
        self.order_service = OrderService(db)
        self.wishlist_service = WishlistService(db)

    async def execute(
        self, 
        intent: Intent, 
        user_id: Optional[str] = None
    ) -> dict:
        """
        Intent 실행 → 데이터 수집 → Action 생성
        
        Args:
            intent: 파악된 의도
            user_id: 사용자 ID (인증 필요 시)
            
        Returns:
            {
                "action": {"type": "SEARCH", "params": {...}},
                "data": {...},  # 수집된 데이터
                "requires_auth": False
            }
        """

        # Intent 타입별 처리
        if intent.type == IntentType.SEARCH:
            return await self._handle_search(intent)

        elif intent.type == IntentType.MULTISEARCH:
            return await self._handle_multisearch(intent)

        elif intent.type == IntentType.VIEW_CART:
            if not user_id:
                return self._auth_required()
            return await self._handle_view_cart(user_id)

        elif intent.type == IntentType.VIEW_ORDERS:
            if not user_id:
                return self._auth_required()
            return await self._handle_view_orders(user_id)

        elif intent.type == IntentType.TRACK_DELIVERY:
            if not user_id:
                return self._auth_required()
            return await self._handle_view_orders(user_id)  # 주문 내역과 동일

        elif intent.type == IntentType.VIEW_WISHLIST:
            if not user_id:
                return self._auth_required()
            return await self._handle_view_wishlist(user_id)

        elif intent.type == IntentType.CHAT:
            return self._handle_chat()

        else:
            return self._handle_unknown()

    async def _handle_search(self, intent: SearchIntent) -> dict:
        """상품 검색 처리"""
        result = await self.product_service.search(
            query=intent.query,
            category=intent.category,
            brand=intent.brand,
            limit=20
        )

        return {
            "action": {
                "type": "SEARCH",
                "params": {"query": intent.query}
            },
            "data": {
                "products": result["items"],
                "total": result["total"]
            },
            "requires_auth": False
        }

    async def _handle_multisearch(self, intent: MultiSearchIntent) -> dict:
        """다중 검색 처리"""
        results = await self.product_service.multi_search(
            queries=intent.queries,
            limit=20
        )

        return {
            "action": {
                "type": "MULTISEARCH",
                "params": {"queries": intent.queries}
            },
            "data": {
                "results": results,
                "main_query": intent.main_query
            },
            "requires_auth": False
        }

    async def _handle_view_cart(self, user_id: str) -> dict:
        """장바구니 조회 처리"""
        summary = await self.cart_service.get_cart_summary(user_id)

        return {
            "action": {
                "type": "VIEW_CART",
                "params": {}
            },
            "data": summary,
            "requires_auth": True
        }

    async def _handle_view_orders(self, user_id: str) -> dict:
        """주문 내역 조회 처리"""
        orders = await self.order_service.get_orders(user_id)

        return {
            "action": {
                "type": "VIEW_ORDERS",
                "params": {}
            },
            "data": {"orders": orders},
            "requires_auth": True
        }

    async def _handle_view_wishlist(self, user_id: str) -> dict:
        """찜 목록 조회 처리"""
        items = await self.wishlist_service.get_wishlist(user_id)

        return {
            "action": {
                "type": "VIEW_WISHLIST",
                "params": {}
            },
            "data": {"items": items},
            "requires_auth": True
        }

    def _handle_chat(self) -> dict:
        """일반 대화 처리"""
        return {
            "action": {"type": "CHAT", "params": {}},
            "data": None,
            "requires_auth": False
        }

    def _handle_unknown(self) -> dict:
        """의도 불명 처리"""
        return {
            "action": {"type": "CHAT", "params": {}},
            "data": None,
            "requires_auth": False
        }

    def _auth_required(self) -> dict:
        """인증 필요 응답"""
        return {
            "action": {"type": "ERROR", "params": {}},
            "data": {"error": "login_required"},
            "requires_auth": True
        }