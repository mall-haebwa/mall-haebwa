"""LLM 답변 생성 전용 모듈 (Action은 생성하지 않음)"""
from typing import Dict, Any, List, Optional
from app.intents import Intent, IntentType
from app.llm_client import llm_client


# 답변 생성용 시스템 프롬프트
REPLY_SYSTEM_PROMPT = """당신은 친절하고 전문적인 쇼핑 어시스턴트입니다.
사용자의 요청에 대해 수집된 데이터를 바탕으로 자연스럽고 친절한 답변을 생성하세요.

## 답변 가이드라인
- 간결하고 명확하게 (1-2문장)
- 친근하고 자연스러운 한국어
- 이모지 사용 자제
- 데이터를 과도하게 나열하지 말 것 (요약만)

## 예시
- 검색: "노트북 검색 결과 50개를 찾았어요! 인기 상품들을 보여드릴게요."
- 장바구니: "장바구니에 5개 상품이 담겨있네요. 총 250,000원입니다!"
- 주문내역: "최근 주문 내역 3건을 찾았어요."
- 일반 대화: "안녕하세요! 무엇을 도와드릴까요?"
- 이미지 검색: "업로드하신 이미지를 분석했어요. 파란색 청바지로 보이네요. 비슷한 상품을 찾아볼게요!"
"""


async def generate_reply(
    intent: Intent,
    data: Optional[Dict[str, Any]],
    conversation_history: List[Dict] = None,
    has_image: bool = False
) -> str:
    """
    Intent와 데이터를 기반으로 자연스러운 답변 생성
    
    Args:
        intent: 파악된 의도
        data: Orchestrator가 수집한 데이터
        conversation_history: 대화 맥락 유지용
        has_image: 이미지 검색 여부
    
    Returns:
        str: 사용자에게 보여줄 친절한 메시지
    """
    if conversation_history is None:
        conversation_history = []

    # LLM 사용 불가 시 기본 메시지 반환
    if llm_client is None:
        return _get_fallback_reply(intent, data, has_image)

    # Intent별 프롬프트 생성
    prompt = _build_prompt(intent, data, has_image)

    # 특정 케이스는 LLM 호출 없이 고정 메시지 반환
    if prompt is None:
        return _get_fallback_reply(intent, data, has_image)

    try:
        # 메시지 구성
        messages = [
            {"role": "system", "content": REPLY_SYSTEM_PROMPT},
        ]

        # 대화 히스토리 추가 (최근 3개만)
        for msg in conversation_history[-3:]:
            messages.append(msg)

        # 현재 프롬프트
        messages.append({"role": "user", "content": prompt})

        # LLM 호출
        reply = await llm_client.chat(
            messages,
            temperature=0.7,
            max_tokens=300
        )

        # None 체크
        if reply is None:
            return _get_fallback_reply(intent, data, has_image)

        return reply.strip()

    except Exception as e:
        print(f"[Reply Generator] LLM 호출 실패: {e}")
        return _get_fallback_reply(intent, data, has_image)


def _build_prompt(
    intent: Intent, 
    data: Optional[Dict[str, Any]], 
    has_image: bool = False
) -> Optional[str]:
    """Intent와 데이터를 기반으로 LLM용 프롬프트 생성"""

    # SEARCH
    if intent.type == IntentType.SEARCH:
        query = getattr(intent, 'query', '')

        # 이미지 검색인 경우
        if has_image:
            if data and 'products' in data:
                total = data.get('total', 0)
                return f"""사용자가 이미지를 업로드하고 "{query}"를 검색했습니다.
이미지 분석 결과를 바탕으로 총 {total}개의 유사 상품을 찾았습니다.

이미지 검색 결과를 친절하게 안내하세요. 
예: "업로드하신 이미지를 분석했어요. {query}로 보이네요. 비슷한 상품을 찾아볼게요!"
"""
            else:
                return f'이미지를 분석해서 "{query}" 상품을 찾는다고 안내하세요.'

        # 일반 텍스트 검색
        if data and 'products' in data:
            total = data.get('total', 0)
            products = data.get('products', [])

            # 검색 결과가 0개인 경우 처리
            if total == 0:
                return f'"{query}"로 검색했지만 상품을 찾지 못했어요. 다른 검색어로 시도해보시겠어요?'

            # 상위 3개 상품 정보만 전달
            product_summary = []
            for p in products[:3]:
                name = p.get('name', '상품')
                price = p.get('price', 0)
                product_summary.append(f"- {name} ({price:,}원)")

            products_text = "\n".join(product_summary) if product_summary else "상품 정보 없음"

            return f"""{query} 검색 결과 {total}개를 찾았습니다.

상위 상품:
{products_text}

이 결과를 1-2문장으로 요약해서 사용자에게 알려주세요."""
        else:
            return f'"{query}" 검색을 시작했다고 간단히 안내하세요.'

    # MULTISEARCH
    elif intent.type == IntentType.MULTISEARCH:
        queries = getattr(intent, 'queries', [])
        main_query = getattr(intent, 'main_query', '')

        if data and 'results' in data:
            results = data['results']
            summary = []
            for q, items in results.items():
                summary.append(f"- {q}: {len(items)}개")

            results_text = "\n".join(summary) if summary else "검색 결과 없음"
            return f"""{main_query} 검색 결과입니다.

{results_text}

이 결과를 1-2문장으로 요약해서 사용자에게 알려주세요."""
        else:
            return f'"{main_query}"에 필요한 상품들을 찾고 있다고 안내하세요.'

    # VIEW_CART
    elif intent.type == IntentType.VIEW_CART:
        if data:
            total_items = data.get('total_items', 0)
            total_amount = data.get('total_amount', 0)

            return f"""장바구니 정보:
- 총 {total_items}개 상품
- 총액: {total_amount:,}원

위 정보를 간단히 안내하세요."""
        else:
            return None  # Fallback 사용

    # VIEW_ORDERS
    elif intent.type == IntentType.VIEW_ORDERS:
        if data and 'orders' in data:
            orders = data['orders']
            order_count = len(orders)

            # 주문 내역이 있는 경우
            if order_count > 0:
                recent_order = orders[0]
                order_name = recent_order.get('order_name', '상품')
                amount = recent_order.get('amount', 0)

                return f"""사용자의 주문 내역 {order_count}건을 조회했습니다.
최근 주문: {order_name} ({amount:,}원)

간단히 안내하세요."""
            else:
                return "주문 내역이 없다고 안내하세요."
        else:
            return "주문 내역을 조회했다고 안내하세요."

    # TRACK_DELIVERY
    elif intent.type == IntentType.TRACK_DELIVERY:
        return "배송 조회 화면으로 안내한다고 말하세요."

    # VIEW_WISHLIST
    elif intent.type == IntentType.VIEW_WISHLIST:
        if data and 'items' in data:
            items = data['items']
            item_count = len(items)

            if item_count > 0:
                return f"""찜 목록에 {item_count}개 상품이 있습니다.

간단히 안내하세요."""
            else:
                return "찜 목록이 비어있다고 안내하세요."
        else:
            return "찜 목록을 보여준다고 안내하세요."

    # CHAT (일반 대화)
    elif intent.type == IntentType.CHAT:
        message = getattr(intent, 'message', '')
        # 일반 대화는 LLM이 자유롭게 응답
        return f"""사용자 메시지: "{message}"

친절하게 응답하세요. 쇼핑몰 어시스턴트로서 도움을 제안하세요."""

    # UNKNOWN
    else:
        return "무엇을 도와드릴지 다시 물어보세요."


def _get_fallback_reply(
    intent: Intent, 
    data: Optional[Dict[str, Any]], 
    has_image: bool = False
) -> str:
    """LLM 호출 실패 시 기본 응답 반환"""

    if intent.type == IntentType.SEARCH:
        query = getattr(intent, 'query', '상품')

        if has_image:
            return f"업로드하신 이미지를 분석했어요. {query}로 보이네요. 비슷한 상품을 찾아볼게요!"

        # data를 확인하여 검색 결과 0개 처리
        if data and data.get('total', 0) == 0:
            return f'"{query}"로 검색했지만 상품을 찾지 못했어요. 다른 검색어를 시도해보시겠어요?'

        return f'"{query}" 검색 결과를 보여드릴게요!'

    elif intent.type == IntentType.MULTISEARCH:
        main_query = getattr(intent, 'main_query', '')
        return f'"{main_query}"에 필요한 상품들을 찾아볼게요!'

    elif intent.type == IntentType.VIEW_CART:
        if data:
            total_items = data.get('total_items', 0)
            total_amount = data.get('total_amount', 0)
            return f"장바구니에 {total_items}개 상품이 담겨있어요. 총 {total_amount:,}원입니다!"
        return "장바구니를 불러올게요!"

    elif intent.type == IntentType.VIEW_ORDERS:
        if data and 'orders' in data:
            order_count = len(data['orders'])
            if order_count > 0:
                return f"주문 내역 {order_count}건을 찾았어요!"
            else:
                return "아직 주문 내역이 없어요."
        return "주문 내역을 가져올게요!"

    elif intent.type == IntentType.TRACK_DELIVERY:
        return "배송 조회 화면으로 안내해드릴게요!"

    elif intent.type == IntentType.VIEW_WISHLIST:
        if data and 'items' in data:
            item_count = len(data['items'])
            if item_count > 0:
                return f"찜 목록에 {item_count}개 상품이 있어요!"
            else:
                return "찜 목록이 비어있어요."
        return "찜 목록을 보여드릴게요!"

    elif intent.type == IntentType.CHAT:
        return "안녕하세요! 무엇을 도와드릴까요?"

    else:
        return "죄송해요, 다시 말씀해주시겠어요?"