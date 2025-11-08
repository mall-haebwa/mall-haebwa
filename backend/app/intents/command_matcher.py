import re
from typing import Optional
from .intent_types import (
    Intent, ViewCartIntent, ViewOrdersIntent,
    ViewWishlistIntent, TrackDeliveryIntent,
    SearchIntent
)

class CommandMatcher:
    """정규식 패턴으로 사용자 메시지 빠르게 매칭"""

    def __init__(self):
        # 패턴 정의: (정규식, Intent 생성 함수)
        self.patterns = [
            # 장바구니 관련
            (r'(장바구니|cart|카트)\s*(보여|확인|조회|알려)',
            lambda m: ViewCartIntent()),

            # 주문 관련
            (r'(주문|order|구매)\s*(내역|목록|리스트|확인|조회)',
            lambda m: ViewOrdersIntent()),
            
            # 배송 관련
            (r'배송\s*(추적|조회|확인|어디)',
            lambda m: TrackDeliveryIntent()),
            
            # 찜 목록
            (r'(찜|wishlist|위시리스트|좋아요)\s*(보여|확인|조회|목록)',
            lambda m: ViewWishlistIntent()),
            
            # MULTISEARCH 패턴 (SEARCH보다 먼저 체크)
            (r'(재료|필요한\s*것|필요한거|준비물|꾸미|세팅)',
            lambda m: None),  # None 반환하여 LLM으로 넘김

            # 간단한 상품 검색 (단일 키워드)
            # 예: "수영복", "노트북 보여줘"
            (r'^(?!.*(?:장바구니|주문|배송|찜))(.+?)\s*(찾아|보여|추천|알려)?$', lambda m: SearchIntent(query=m.group(1).strip())
                if len(m.group(1).strip()) > 1 else None),
        ]

    def match(self, message: str) -> Optional[Intent]:
        """
        메시지를 패턴에 매칭 시도

        Returns:
            Intent: 매칭 성공 시 해당 Intent
            None: 매칭 실패 시 (이후 LLM으로 넘김)
        """
        message = message.strip()

        for pattern, intent_factory in self.patterns:
            match_obj = re.search(pattern, message, re.IGNORECASE)
            if match_obj:
                intent = intent_factory(match_obj)
                if intent:                      # None이 아닌 경우
                    intent.confidence = 1.0     # 정규식 매칭은 확신도 100%
                    return intent
                else:
                    return None # None 반환 시 즉시 종료 (다음 패턴 체크 안 함)
        return None     # 매칭 실패