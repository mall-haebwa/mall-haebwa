# backend/app/main.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .database import get_db
from .auth_router import router as auth_router, COOKIE_ACCESS
from .models import ensure_indexes
from .security import decode_token
import os
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()
from .admin_router import router as admin_router
from .product_router import router as product_router
from app.payment_router import router as payment_router
from app.order_router import router as order_router
from .cart_router import router as cart_router
from .product_random_router import router as product_random_router
from .category_router import router as category_router
from .wishlist_router import router as wishlist_router
from .user_router import router as user_router
from .redis_client import redis_client
from .chat_models import ChatRequest, ChatResponse
from .vector_search_router import router as vector_search_router

# Tool Use 관련 임포트는 엔드포인트 내부에서 동적 임포트
from .search_client import get_search_client

from .commands import match_command
from .seller_router import router as seller_router
from .seller_setting import router as seller_setting_router
from .seller_promotion import router as seller_promotion_router
from .seller_ordermanage import router as seller_ordermanage_router
import time
import uuid
import logging
import functools

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 대화 제한 상수
MAX_USER_MESSAGE_LENGTH = 500  # 사용자 입력 최대 길이
CONVERSATION_HISTORY_LIMIT = 10  # 멀티턴 대화를 위한 히스토리 개수 (기존과 동일)
MAX_TOOL_ITERATIONS = int(os.getenv("MAX_TOOL_ITERATIONS", "5"))  # Tool 실행 최대 반복 횟수

app = FastAPI(title="AI Shop API")

origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173")
origins = [origin.strip() for origin in origins_str.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,  # 쿠키 허용 중요!
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    db = get_db()
    await ensure_indexes(db)
    # Redis 연결
    await redis_client.connect()
    logger.info("서버 시작 완료 (MongoDB, Redis 연결)")

@app.on_event("shutdown")
async def shutdown():
    # Redis 연결 해제
    await redis_client.disconnect()
    logger.info("서버 종료 (Redis 연결 해제)")

app.include_router(auth_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(category_router, prefix="/api")
app.include_router(payment_router, prefix="/api")
app.include_router(order_router, prefix="/api")
app.include_router(cart_router, prefix="/api")
app.include_router(product_random_router, prefix="/api")
app.include_router(wishlist_router, prefix="/api")
app.include_router(user_router, prefix="/api")
app.include_router(product_router, prefix="/api")
app.include_router(seller_router, prefix="/api")
app.include_router(seller_setting_router, prefix="/api")
app.include_router(seller_promotion_router, prefix="/api")
app.include_router(seller_ordermanage_router, prefix="/api")
app.include_router(vector_search_router, prefix="/api")


@app.get("/api/chat/history/{conversation_id}")
async def get_chat_history(user_id: str, conversation_id: str):
    """대화 히스토리 조회 (프론트엔드에서 페이지 로드 시 사용)"""
    if not user_id:
        return {"messages": [], "error": "User ID is required"}

    try:
        history = await redis_client.get_conversation(user_id, conversation_id)
        return {"messages": history}
    except Exception as e:
        logger.error(f"[Chat History] 조회 실패: {e}")
        return {"messages": [], "error": str(e)}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(http_request: Request, chat_request: ChatRequest):
    """
    AI 쇼핑 어시스턴트 채팅 (Bedrock Tool Use 방식)

    Flow:
    1. JWT 쿠키에서 user_id 추출 (인증)
    2. Redis에서 대화 히스토리 로드
    3. Bedrock에게 Tool 제공
    4. Bedrock이 자동으로 Tool 호출 및 응답 생성
    5. Redis에 대화 저장
    6. ChatResponse 반환
    """
    start_time = time.time()
    user_message = chat_request.message[:MAX_USER_MESSAGE_LENGTH]
    conv_id = chat_request.conversation_id or str(uuid.uuid4())

    logger.info(f"[Chat] ⏱️  📨 요청 수신 (message: {user_message[:50]}...)")

    # JWT 쿠키에서 user_id 추출 (다른 엔드포인트와 동일한 인증 방식)
    auth_start = time.time()
    user_id = None
    token = http_request.cookies.get(COOKIE_ACCESS)

    if token:
        try:
            payload = decode_token(token)
            if payload.get("scope") == "access":
                user_id = payload["sub"]
                logger.info(f"[Chat] Authenticated user: {user_id}")
        except Exception as e:
            logger.warning(f"[Chat] Token validation failed: {e}")

    if not user_id:
        logger.warning("[Chat] No authenticated user (guest mode)")

    auth_duration = time.time() - auth_start
    logger.info(f"[Chat] ⏱️  ✅ 인증 완료 ({auth_duration:.3f}초)")
    logger.info(f"[Chat] User: {user_id or 'guest'}, Conv: {conv_id[:8]}, Message: {user_message[:50]}")

    # Bedrock 클라이언트 확인
    from .bedrock_client import bedrock_client
    if bedrock_client is None:
        logger.error("[Chat] Bedrock client not available")
        return ChatResponse(
            reply="현재 AI 서비스를 사용할 수 없습니다. 관리자에게 문의하세요.",
            action={"type": "ERROR", "params": {}},
            conversation_id=conv_id,
            llm_used=False,
            processing_time_ms=int((time.time() - start_time) * 1000)
        )

    # Redis에서 대화 히스토리 로드
    redis_load_start = time.time()
    logger.info(f"[Chat] ⏱️  📚 Redis 히스토리 로드 시작...")
    history = []
    if user_id:
        try:
            history = await redis_client.get_conversation(user_id, conv_id)
            redis_load_duration = time.time() - redis_load_start
            logger.info(f"[Chat] ⏱️  ✅ Redis 히스토리 로드 완료 ({redis_load_duration:.3f}초, {len(history)}개 메시지)")
        except Exception as e:
            redis_load_duration = time.time() - redis_load_start
            logger.error(f"[Chat] ⏱️  ❌ Redis 히스토리 로드 실패 ({redis_load_duration:.3f}초): {e}")
    else:
        redis_load_duration = time.time() - redis_load_start
        logger.info(f"[Chat] ⏱️  ✅ Redis 히스토리 로드 완료 ({redis_load_duration:.3f}초, 게스트 사용자)")

    # Tool Handlers 준비
    tool_prep_start = time.time()
    logger.info(f"[Chat] ⏱️  🔧 Tool Handlers 준비 시작...")
    from .tools import ToolHandlers, SHOPPING_TOOLS, TOOL_AUTH_REQUIRED
    # from .tool_registry import ToolRegistry  # 현재 사용 안 함

    # SHOPPING_TOOLS = ToolRegistry.get_tools()  # 이전 방식 (데코레이터 미사용)
    # TOOL_AUTH_REQUIRED = ToolRegistry.get_auth_required()
    db = get_db()
    es = get_search_client()
    tool_handlers_instance = ToolHandlers(db, es)

    # 게스트 사용자는 인증 필요 Tool 필터링
    if not user_id:
        logger.info("[Chat] Guest user - filtering auth-required tools")
        filtered_tools = [
            tool for tool in SHOPPING_TOOLS
	    if tool["toolSpec"]["name"] not in TOOL_AUTH_REQUIRED
        ]
    else:
        filtered_tools = SHOPPING_TOOLS

    # user_id를 자동으로 주입하는 래퍼 생성 (functools.partial 사용)
    original_handlers = tool_handlers_instance.get_handlers_dict()
    tool_handlers = {}

    for tool_name, handler in original_handlers.items():
        # user_id가 필요한 Tool에만 주입
        user_required_tools = [
            "get_cart", "get_orders", "get_wishlist",
            "search_orders_by_product", "add_to_cart", "get_order_detail",
            "get_recently_viewed"
        ]
        if tool_name in user_required_tools:
            # functools.partial을 사용하여 user_id를 바인딩 (closure 버그 방지)
            tool_handlers[tool_name] = functools.partial(handler, user_id=user_id)
        else:
            tool_handlers[tool_name] = handler

    tool_prep_duration = time.time() - tool_prep_start
    logger.info(f"[Chat] ⏱️  ✅ Tool Handlers 준비 완료 ({tool_prep_duration:.3f}초, {len(filtered_tools)}개 Tool)")

    # System Prompt
    from datetime import datetime
    current_date = datetime.now()
    current_year = current_date.year

    system_prompt = f"""# Mall-haebwa 쇼핑 어시스턴트

당신은 Mall-haebwa의 AI 쇼핑 어시스턴트입니다.
사용자의 자연어 쇼핑 의도를 이해하고 적절한 Tool을 사용하여 도움을 제공합니다.

## 🎯 핵심 원칙
1. **의도 파악 우선**: 사용자가 정확한 상품명을 모르더라도 의도를 파악하여 도움
2. **Tool 체이닝**: 복잡한 요청은 여러 Tool을 순차적으로 사용
3. **데이터 기반 응답**: 추측하지 말고 Tool 결과를 바탕으로 정확히 답변
4. **멀티턴 대화 지원**: 이전 대화 맥락을 고려한 Tool 선택

## 🔐 인증 상태
- 현재: {"✓ 로그인됨" if user_id else "✗ 게스트 (비로그인)"}
- user_id: {user_id or 'None'}

## 📅 시간 정보
- 오늘: {current_date.strftime('%Y년 %m월 %d일')}
- 올해: {current_year}년
- 작년: {current_year - 1}년

## 🛠️ Tool 사용 패턴

### 패턴 1: 추상적 요청 → 구체화
사용자: "김치찌개 먹고 싶다"
→ multi_search_products(queries=["김치찌개 밀키트", "김치", "돼지고기", "두부"], main_query="김치찌개")

### 패턴 2: 재주문 플로우
사용자: "지난달 산 커피 다시 주문"
→ search_orders_by_product(product_keyword="커피", days_ago=30)
→ 결과 1개면: add_to_cart(...)
→ 결과 여러개면: "다음 중 어떤 상품을 재주문하시겠어요?"

### 패턴 3: 비교 쇼핑
사용자: "운동화 추천해줘"
→ get_trending_products(category="운동화", sort_by="sales") 또는
→ recommend_products(based_on="purchase_history")

### 패턴 4: 스마트 검색
사용자: "편안한 집에서 입는 옷"
→ semantic_search(query="편안한 집에서 입는 옷") 또는
→ find_similar_products(description="편안한 홈웨어 라운지웨어")

### 패턴 5: 장바구니 관리
사용자: "장바구니에서 신발 빼고 커피는 3개로 변경"
→ get_cart() # 먼저 현재 상태 확인
→ remove_from_cart(product_id="신발ID")
→ update_cart_item(product_id="커피ID", quantity=3)

### 패턴 6: 리뷰 확인
사용자: "이 상품 리뷰 어때?"
→ get_product_reviews(product_id="...", sort_by="helpful")

## ⚡ Tool 선택 결정 트리

사용자 입력 분석:
├─ 상품 검색 관련
│   ├─ 명확한 키워드 → search_products (정렬 옵션 활용)
│   ├─ 추상적 표현 → semantic_search / find_similar_products
│   ├─ 복합 조건 → search_by_filters
│   └─ 여러 상품 → multi_search_products
├─ 구매 이력 관련
│   ├─ 주문 내역 → get_orders / search_orders_by_product
│   ├─ 재주문 → search_orders_by_product → add_to_cart
│   ├─ 자주 산 상품 → get_frequently_ordered_products
│   └─ 재구매 추천 → suggest_reorder_products
├─ 장바구니/찜 관련
│   ├─ 확인 → get_cart / get_wishlist
│   ├─ 추가 → add_to_cart / add_to_wishlist
│   ├─ 수량 변경 → update_cart_item
│   ├─ 제거 → remove_from_cart / remove_from_wishlist
│   └─ 비우기 → clear_cart
└─ 비교/추천/리뷰
    ├─ 브랜드 비교 → compare_brands
    ├─ 인기 상품 → get_trending_products
    ├─ 리뷰 확인 → get_product_reviews
    └─ 개인 추천 → recommend_products

## 🚨 중요 제약사항

1. **절대 금지**
   - 가짜 데이터 생성 (예: "상품ID_123", "https://example.com")
   - Tool 호출 없이 추측 답변
   - 실제 결제/주문 처리 (장바구니까지만 가능)

2. **로그인 필요 기능**
   - 게스트가 인증 필요 기능 요청 시: "로그인이 필요한 기능입니다. 우측 상단에서 로그인해주세요."

3. **재주문 규칙**
   - 검색 결과 1개: 자동으로 장바구니 추가
   - 검색 결과 여러개: 사용자에게 선택 요청
   - 검색 결과 없음: 대체 상품 제안

4. **의도 불명확 시**
   - 먼저 맥락에서 유추 시도
   - 실패 시 명확화 요청: "상품 검색, 주문 확인, 재주문 중 무엇을 도와드릴까요?"

5. **멀티턴 대화**
   - 이전 대화에서 검색한 상품을 참조 가능
   - 예: "그거 장바구니에 담아줘" → 이전에 검색한 상품 add_to_cart

## 💾 Redis 캐싱
- 자주 검색되는 상품은 Redis 캐시에서 빠르게 응답
- 60-90% 비용 절감 효과

## 📊 Tool 사용시 정렬 옵션 활용
- search_products의 sort_by: relevance(관련성), price_low(낮은 가격), price_high(높은 가격), rating(평점), review_count(리뷰)
- get_trending_products의 sort_by: sales(판매량), rating(평점), review_count(리뷰)
- get_product_reviews의 sort_by: helpful(도움순), recent(최신순), rating_high(높은 평점), rating_low(낮은 평점)

## 응답 작성 가이드
✅ 좋은 응답:
- 구체적인 상품명과 가격 제시
- 평점과 리뷰 수 포함
- 다음 액션 제안

❌ 피해야 할 응답:
- "상품이 있습니다" (구체적이지 않음)
- "상품ID_123" (가짜 데이터)
- "아마 50만원 정도" (추측)
- **과거 주문 상품 찾기** → search_orders_by_product Tool 사용
  * "작년에 샀던 커피" → product_keyword="커피", year={current_year - 1}
  * "올해 구매한 상품" → product_keyword="", year={current_year} (키워드 없이 연도만 가능)
  * "올해 3만원 이상 상품" → product_keyword="", year={current_year}, min_price=30000
  * "2024년에 구매한 커피" → product_keyword="커피", year=2024
  * 조합: year + min_price/max_price 가능, year와 days_ago는 동시 사용 불가
- **재주문 또는 장바구니 담기** → add_to_cart Tool 사용
  * search_orders_by_product로 찾은 matched_item 정보를 모두 전달:
    - product_id (필수)
    - price (matched_item.price)
    - product_name (matched_item.product_name)
    - image_url (matched_item.image_url)
- **배송 현황 확인** → get_order_detail Tool 사용

**재주문 요청 처리 규칙**:
- search_orders_by_product 결과가 **1개**인 경우 → 바로 add_to_cart 호출 가능
- search_orders_by_product 결과가 **2개 이상**인 경우 → add_to_cart 호출하지 말고, 사용자에게 선택 요청
  * 예: "3개의 아몬드 상품을 찾았습니다. 왼쪽 화면에서 원하시는 상품을 선택해주세요."

**복잡한 요청 처리 예시**:
1. "작년에 구매했던 커피 재주문 해줘" (결과 1개)
   → Step 1: search_orders_by_product(product_keyword="커피", year={current_year - 1})
   → Step 2: (결과가 1개이면) add_to_cart(
        product_id=orders[0].matched_item.product_id,
        price=orders[0].matched_item.price,
        product_name=orders[0].matched_item.product_name,
        image_url=orders[0].matched_item.image_url
      )
   → 응답: "작년에 구매하신 [상품명]을 장바구니에 담았습니다."

2. "올해 구매한 아몬드 재주문해줘" (결과 3개)
   → Step 1: search_orders_by_product(product_keyword="아몬드", year={current_year})
   → Step 2: (결과가 2개 이상이므로) add_to_cart 호출하지 않음
   → 응답: "올해 구매하신 아몬드 상품 3개를 찾았습니다. 왼쪽 화면에서 원하시는 상품을 선택해주세요."

3. "2024년에 구매한 커피 보여줘"
   → Step 1: search_orders_by_product(product_keyword="커피", year=2024)
   → 응답: "2024년에 구매하신 커피 상품을 찾았습니다."

**주문/결제 처리 안내**:
- "장바구니에 있는 것들 주문해줘" 같은 요청을 받으면:
  → 실제 주문 생성은 Tool로 불가능
  → 응답: "장바구니에 담긴 상품을 확인하셨습니다. 주문하시려면 장바구니 페이지에서 '주문하기' 버튼을 눌러 결제를 진행해주세요."

**응답 스타일**:
- Tool 결과에 따라 구체적이고 정확하게 답변하세요 (1-3문장)
- 여러 단계를 거쳤다면 과정을 간단히 설명하세요
- 쇼핑몰과 관련 없는 요청은 정중히 거절하세요"""

    # 메시지 구성
    messages = [{"role": "system", "content": system_prompt}]

    # 최근 히스토리 추가 (최대 10개 - 기존과 동일)
    for msg in history[-CONVERSATION_HISTORY_LIMIT:]:
        messages.append(msg)

    # 현재 메시지
    messages.append({"role": "user", "content": user_message})

    # Bedrock Tool Use 실행
    bedrock_call_start = time.time()
    logger.info(f"[Chat] ⏱️  🤖 Bedrock 호출 시작...")
    try:
        result = await bedrock_client.chat_with_tools(
            messages=messages,
            tools=filtered_tools,  # 게스트 필터링 적용
            tool_handlers=tool_handlers,
            max_iterations=MAX_TOOL_ITERATIONS,  # 환경 변수로 제어 (기본값: 5)
            temperature=0.1,  # Tool Use 최적화: 0.7→0.1 (정확한 Tool 선택)
            max_tokens=1500  # 응답 여유 확보: 1000→1500
        )

        bedrock_call_duration = time.time() - bedrock_call_start
        logger.info(f"[Chat] ⏱️  ✅ Bedrock 호출 완료 ({bedrock_call_duration:.2f}초)")

        reply = result["response"]
        tool_calls = result.get("tool_calls", [])

        logger.info(f"[Chat] Tool calls: {len(tool_calls)}")
        logger.info(f"[Chat] Reply: {reply[:50]}")

        # Action 생성 (Tool 호출 기반) - 프론트엔드와 일치하는 타입 사용
        # add_to_cart가 있으면 항상 장바구니 표시 (우선순위)
        action_gen_start = time.time()
        logger.info(f"[Chat] ⏱️  📦 Action 생성 시작...")
        action = {"type": "CHAT", "params": {}}

        # add_to_cart 우선 확인
        add_to_cart_tool = None
        for tool in tool_calls:
            if tool["name"] == "add_to_cart":
                add_to_cart_tool = tool
                break

        if add_to_cart_tool:
            # add_to_cart가 있으면 장바구니 표시
            tool_result = add_to_cart_tool.get("result", {})
            if tool_result.get("success"):
                try:
                    # 장바구니 데이터 다시 조회 (이미 생성된 tool_handlers_instance 재사용)
                    cart_data = await tool_handlers_instance.get_cart(user_id)

                    action = {
                        "type": "VIEW_CART",
                        "params": {
                            "items": cart_data.get("items", []),
                            "total_items": cart_data.get("total_items", 0),
                            "total_amount": cart_data.get("total_amount", 0),
                            "message": tool_result.get("message")
                        }
                    }
                except Exception as cart_error:
                    from app.config.messages import ErrorMessages
                    error_detail = ErrorMessages.get_dev_detail("cart_refresh_error", error=str(cart_error))
                    logger.error(f"[Chat] {error_detail}", exc_info=True)

                    # 장바구니 조회 실패 시에도 성공 메시지는 보여줌
                    action = {
                        "type": "CHAT",
                        "params": {
                            "message": tool_result.get("message"),
                            "error": ErrorMessages.get_message("cart_refresh_error", error=str(cart_error))
                        }
                    }
            else:
                # 에러 발생 시 에러 메시지만 전달
                action = {
                    "type": "CHAT",
                    "params": {
                        "error": tool_result.get("error")
                    }
                }
        elif tool_calls:
            # add_to_cart가 없으면 마지막 Tool로 action 결정
            last_tool = tool_calls[-1]
            tool_name = last_tool["name"]
            tool_result = last_tool.get("result", {})

            if tool_name == "search_products":
                # 프론트엔드가 기대하는 "SEARCH" 타입 사용
                action = {
                    "type": "SEARCH",
                    "params": {
                        "query": last_tool["input"].get("query"),
                        "products": tool_result.get("products", [])  # Tool 결과 직접 전달
                    }
                }
            elif tool_name == "multi_search_products":
                # 다중 검색 - MULTISEARCH Action 생성
                action = {
                    "type": "MULTISEARCH",
                    "params": {
                        "queries": tool_result.get("queries", []),
                        "main_query": tool_result.get("main_query", ""),
                        "results": tool_result.get("results", {})  # {"김치": [...], "돼지고기": [...]}
                    }
                }
            elif tool_name == "semantic_search":
                # 의미 기반 검색 결과 - items 필드를 products로 변환
                items = tool_result.get("items", [])
                # items를 products 형식으로 변환 (id, name, price, category, brand, image, rating, reviewCount)
                products = []
                for item in items:
                    products.append({
                        "id": item.get("product_id", ""),
                        "name": item.get("name", ""),
                        "price": item.get("price", 0),
                        "category": item.get("category", ""),
                        "brand": item.get("brand", ""),
                        "image": item.get("image", ""),
                        "rating": item.get("rating", 0),
                        "reviewCount": item.get("reviewCount", 0)
                    })

                action = {
                    "type": "SEARCH",
                    "params": {
                        "query": last_tool["input"].get("query", "의미 기반 검색"),
                        "products": products
                    }
                }
            elif tool_name == "get_cart":
                # 프론트엔드가 기대하는 "VIEW_CART" 타입 사용 + 데이터 포함
                action = {
                    "type": "VIEW_CART",
                    "params": {
                        "items": tool_result.get("items", []),
                        "total_items": tool_result.get("total_items", 0),
                        "total_amount": tool_result.get("total_amount", 0),
                        "error": tool_result.get("error")  # 로그인 필요 메시지 포함
                    }
                }
            elif tool_name == "get_orders":
                action = {
                    "type": "VIEW_ORDERS",
                    "params": {
                        "orders": tool_result.get("orders", []),
                        "error": tool_result.get("error")
                    }
                }
            elif tool_name == "get_wishlist":
                action = {
                    "type": "VIEW_WISHLIST",
                    "params": {
                        "items": tool_result.get("items", []),
                        "error": tool_result.get("error")
                    }
                }
            elif tool_name == "get_recently_viewed":
                # 최근 본 상품 - 상품 목록으로 표시 (SEARCH와 유사)
                items = tool_result.get("items", [])
                # 상품 형식으로 변환
                products = []
                for item in items:
                    products.append({
                        "id": item.get("product_id"),
                        "name": item.get("name"),
                        "price": item.get("price", 0),
                        "category": item.get("category", ""),
                        "brand": item.get("brand", ""),
                        "image": item.get("image", ""),
                        "rating": item.get("rating", 0),
                        "reviewCount": item.get("reviewCount", 0)
                    })

                action = {
                    "type": "VIEW_RECENTLY_VIEWED",
                    "params": {
                        "products": products,
                        "total": tool_result.get("total", 0),
                        "error": tool_result.get("error")
                    }
                }
            elif tool_name == "search_orders_by_product":
                # 재주문 옵션 표시 - 과거 주문 상품 목록을 좌측에 표시
                orders = tool_result.get("orders", [])
                # 상품 형식으로 변환 (프론트엔드는 상품 카드로 표시)
                products = []
                for order in orders:
                    matched_item = order.get("matched_item", {})
                    if matched_item:
                        products.append({
                            "id": matched_item.get("product_id"),
                            "name": matched_item.get("product_name"),
                            "price": matched_item.get("price", 0),
                            "image": matched_item.get("image_url"),
                            "order_id": order.get("order_id"),  # 주문 정보 추가
                            "order_date": order.get("created_at"),
                            "order_amount": order.get("amount")
                        })

                action = {
                    "type": "VIEW_REORDER_OPTIONS",
                    "params": {
                        "products": products,
                        "total": tool_result.get("total", 0),
                        "keyword": tool_result.get("keyword", ""),
                        "year": tool_result.get("year_searched"),
                        "error": tool_result.get("error")
                    }
                }

        action_gen_duration = time.time() - action_gen_start
        logger.info(f"[Chat] ⏱️  ✅ Action 생성 완료 ({action_gen_duration:.3f}초, type={action['type']})")

        # Redis에 대화 저장
        redis_save_start = time.time()
        logger.info(f"[Chat] ⏱️  💾 Redis 대화 저장 시작...")
        if user_id:
            try:
                await redis_client.add_message(user_id, conv_id, "user", user_message)
                await redis_client.add_message(user_id, conv_id, "assistant", reply)
                redis_save_duration = time.time() - redis_save_start
                logger.info(f"[Chat] ⏱️  ✅ Redis 대화 저장 완료 ({redis_save_duration:.3f}초)")
            except Exception as e:
                redis_save_duration = time.time() - redis_save_start
                logger.error(f"[Chat] ⏱️  ❌ Redis 대화 저장 실패 ({redis_save_duration:.3f}초): {e}")
        else:
            redis_save_duration = time.time() - redis_save_start
            logger.info(f"[Chat] ⏱️  ✅ Redis 대화 저장 완료 ({redis_save_duration:.3f}초, 게스트 사용자 - 저장 안함)")

        processing_time = int((time.time() - start_time) * 1000)
        logger.info(f"[Chat] ⏱️  🎉 전체 요청 완료 ({processing_time}ms)")
        logger.info(f"[Chat] ⏱️  📊 시간 분해: 인증={auth_duration:.3f}s, Redis로드={redis_load_duration:.3f}s, Tool준비={tool_prep_duration:.3f}s, Bedrock={bedrock_call_duration:.2f}s, Action={action_gen_duration:.3f}s, Redis저장={redis_save_duration:.3f}s")

        return ChatResponse(
            reply=reply,
            action=action,
            conversation_id=conv_id,
            llm_used=True,
            processing_time_ms=processing_time
        )

    except Exception as e:
        from app.config.messages import ErrorMessages

        # 상세 로그 (항상 기록)
        error_detail = ErrorMessages.get_dev_detail("chat_error", error=str(e))
        logger.error(f"[Chat] Error: {error_detail}", exc_info=True)

        # 사용자에게 표시할 메시지 (환경에 따라 다름)
        user_message = ErrorMessages.get_message("chat_error", error=str(e))

        return ChatResponse(
            reply=user_message,
            action={"type": "ERROR", "params": {"error_detail": str(e) if ErrorMessages.DEBUG_MODE else None}},
            conversation_id=conv_id,
            llm_used=False,
            processing_time_ms=int((time.time() - start_time) * 1000)
        )
