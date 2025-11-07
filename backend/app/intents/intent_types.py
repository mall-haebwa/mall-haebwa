"""
Intent 데이터 클래스 정의
- 모든 Intent는 type 필드를 가짐
- 각 Intent는 자신에게 필요한 파라미터를 가짐
"""

from dataclasses import dataclass, field
from typing import Literal, Optional, List, Any
from enum import Enum

# Intent 타입 Enum
class IntentType(Enum):
    SEARCH = "SEARCH"              # 단일 상품 검색
    MULTISEARCH = "MULTISEARCH"    # 다중 카테고리 검색
    VIEW_CART = "VIEW_CART"        # 장바구니 조회
    VIEW_ORDERS = "VIEW_ORDERS"    # 주문 내역 조회
    TRACK_DELIVERY = "TRACK_DELIVERY"  # 배송 추적
    VIEW_WISHLIST = "VIEW_WISHLIST"    # 찜 목록 조회
    ADD_TO_CART = "ADD_TO_CART"    # 장바구니 추가
    CHAT = "CHAT"                  # 일반 대화
    UNKNOWN = "UNKNOWN"            # 의도 불명확

# Base Intent
@dataclass
class Intent:
    """모든 Intent의 베이스 클래스"""
    type: IntentType
    confidence: float = 1.0  # 확신도 (0.0 ~ 1.0)

# 구체적인 Intent 클래스들
@dataclass
class SearchIntent(Intent):
    """상품 검색 의도"""
    type: IntentType = IntentType.SEARCH
    query: str = ""
    category: Optional[str] = None
    brand: Optional[str] = None
    min_price: Optional[int] = None
    max_price: Optional[int] = None

@dataclass
class MultiSearchIntent(Intent):
    """다중 카테고리 검색 의도 (예: 김치찌개 재료)"""
    type: IntentType = IntentType.MULTISEARCH
    queries: List[str] = field(default_factory=list)
    main_query: str = ""  # 원래 질문

@dataclass
class ViewCartIntent(Intent):
    """장바구니 조회 의도"""
    type: IntentType = IntentType.VIEW_CART

@dataclass
class ViewOrdersIntent(Intent):
    """주문 내역 조회 의도"""
    type: IntentType = IntentType.VIEW_ORDERS

@dataclass
class TrackDeliveryIntent(Intent):
    """배송 추적 의도"""
    type: IntentType = IntentType.TRACK_DELIVERY
    order_id: Optional[str] = None

@dataclass
class ViewWishlistIntent(Intent):
    """찜 목록 조회 의도"""
    type: IntentType = IntentType.VIEW_WISHLIST

@dataclass
class AddToCartIntent(Intent):
    """장바구니 추가 의도"""
    type: IntentType = IntentType.ADD_TO_CART
    product_name: str = ""
    quantity: int = 1

@dataclass
class ChatIntent(Intent):
    """일반 대화 의도"""
    type: IntentType = IntentType.CHAT
    message: str = ""

@dataclass
class UnknownIntent(Intent):
    """의도를 파악하지 못한 경우"""
    type: IntentType = IntentType.UNKNOWN
    original_message: str = ""