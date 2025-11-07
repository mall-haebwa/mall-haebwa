"""LLM 기반 의도 파악 (정규식 실패 시)"""
import json
from typing import List, Dict, Any
from .intent_types import *
from app.llm_client import llm_client

# 의도 파악 전용 프롬프트
INTENT_SYSTEM_PROMPT = """당신은 의도 분류 전문가입니다.
사용자 메시지를 분석하여 의도만 파악하고 JSON으로 반환하세요.

## Intent 타입

1. **SEARCH**: 단일 상품 검색
    예: "수영복", "노트북 보여줘"
    
2. **MULTISEARCH**: 다중 카테고리 검색
    예: "김치찌개 재료", "홈오피스 꾸미기"
    키워드: 재료, 필요한 것, 준비물
    
3. **VIEW_CART**: 장바구니 조회
4. **VIEW_ORDERS**: 주문 내역 조회
5. **TRACK_DELIVERY**: 배송 추적
6. **VIEW_WISHLIST**: 찜 목록 조회
7. **CHAT**: 일반 대화

## 응답 형식 (순수 JSON만)

{
"intent_type": "SEARCH",
"parameters": {"query": "검색어"},
"confidence": 0.9
}

MULTISEARCH 예시:
{
"intent_type": "MULTISEARCH",
"parameters": {
    "queries": ["김치", "두부", "돼지고기"],
    "main_query": "김치찌개 재료"
},
"confidence": 0.85
}

중요:
- 마크다운 코드블록 금지
- 순수 JSON만 반환
- 답변 생성하지 말 것 (의도만 파악)
"""

class LLMIntentResolver:
    """LLM 기반 의도 파악기"""

    def __init__(self, conversation_history: List[Dict] = None):
        self.history = conversation_history or []

    async def resolve(self, message: str) -> Intent:
        """LLM으로 의도 파악"""
        if llm_client is None:
            print("LLM client 없음 → UnknownIntent 반환")
            return UnknownIntent(original_message=message, confidence=0.0)

        try:
            # 메시지 구성 (main.py와 동일한 방식)
            messages = [{"role": "system", "content": INTENT_SYSTEM_PROMPT}]

            # 히스토리 추가 (최근 5개만)
            for msg in self.history[-5:]:
                messages.append(msg)

            messages.append({"role": "user", "content": message})

            # LLM 호출 (main.py와 동일)
            response = await llm_client.chat(
                messages,
                temperature=0.3,  # 낮은 temperature (일관성 중요)
                max_tokens=500    # 짧은 응답
            )

            # JSON 파싱 (main.py와 동일한 방식)
            cleaned = response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            print(f"[LLM Intent] Cleaned JSON: {cleaned}")
            data = json.loads(cleaned)

            return self._create_intent(data)

        except Exception as e:
            print(f"LLM Intent Resolution 실패: {e}")
            return UnknownIntent(original_message=message, confidence=0.0)

    def _create_intent(self, data: Dict[str, Any]) -> Intent:
        """JSON → Intent 객체 변환"""
        intent_type_str = data.get("intent_type", "UNKNOWN")
        params = data.get("parameters", {})
        confidence = data.get("confidence", 0.8)

        try:
            intent_type = IntentType(intent_type_str)
        except ValueError:
            return UnknownIntent(confidence=0.0)

        # 타입별 객체 생성
        if intent_type == IntentType.SEARCH:
            return SearchIntent(
                query=params.get("query", ""),
                category=params.get("category"),
                brand=params.get("brand"),
                min_price=params.get("min_price"),
                max_price=params.get("max_price"),
                confidence=confidence
            )

        elif intent_type == IntentType.MULTISEARCH:
            return MultiSearchIntent(
                queries=params.get("queries", []),
                main_query=params.get("main_query", ""),
                confidence=confidence
            )

        elif intent_type == IntentType.VIEW_CART:
            return ViewCartIntent(confidence=confidence)

        elif intent_type == IntentType.VIEW_ORDERS:
            return ViewOrdersIntent(confidence=confidence)

        elif intent_type == IntentType.TRACK_DELIVERY:
            return TrackDeliveryIntent(
                order_id=params.get("order_id"),
                confidence=confidence
            )

        elif intent_type == IntentType.VIEW_WISHLIST:
            return ViewWishlistIntent(confidence=confidence)

        elif intent_type == IntentType.CHAT:
            return ChatIntent(
                message=params.get("message", ""),
                confidence=confidence
            )

        else:
            return UnknownIntent(confidence=0.0)