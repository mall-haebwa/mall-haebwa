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
from .scheduler import start_scheduler, stop_scheduler
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

    # 상품 풀 초기화
    try:
        from .product_random_router import update_product_pool
        await update_product_pool(db)
        logger.info("[Startup] 상품 풀 초기화 완료")
    except Exception as e:
        logger.error(f"[Startup] 상품 풀 초기화 실패: {e}")

    # 스케쥴러 시작 (1시간마다 자동 갱신)
    try:
        start_scheduler()
        logger.info("[Startup] 스케쥴러 시작 완료")
    except Exception as e:
        logger.error(f"[Startup] 스케쥴러 시작 실패: {e}")

    logger.info("서버 시작 완료 (MongoDB, Redis 연결)")

@app.on_event("shutdown")
async def shutdown():
    # 스케쥴러 중지
    try:
        stop_scheduler()
    except Exception as e:
        logger.error(f"[Shutdown] 스케쥴러 중지 실패: {e}")

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

    # JWT 쿠키에서 user_id 추출 (다른 엔드포인트와 동일한 인증 방식)
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
    history = []
    if user_id:
        try:
            history = await redis_client.get_conversation(user_id, conv_id)
            logger.info(f"[Redis] 히스토리 로드 완료: {len(history)}개 메시지")
        except Exception as e:
            logger.error(f"[Redis] 히스토리 로드 실패: {e}")

    # Tool Handlers 준비
    from .tools import SHOPPING_TOOLS, TOOL_AUTH_REQUIRED, ToolHandlers
    db = get_db()
    es = get_search_client()
    tool_handlers_instance = ToolHandlers(db, es, redis_client=redis_client, user_id=user_id, conversation_id=conv_id)

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
        # user_id가 필요한 Tool에만 주입 (TOOL_AUTH_REQUIRED 사용)
        if tool_name in TOOL_AUTH_REQUIRED:
            # functools.partial을 사용하여 user_id를 바인딩 (closure 버그 방지)
            tool_handlers[tool_name] = functools.partial(handler, user_id=user_id)
        else:
            tool_handlers[tool_name] = handler

    # System Prompt
    from datetime import datetime
    current_date = datetime.now()
    current_year = current_date.year

    system_prompt = f"""당신은 친절하고 전문적인 쇼핑 어시스턴트입니다.
  사용자의 쇼핑을 도와주세요. 상품 검색, 장바구니 확인, 주문 내역 조회, 재주문 등을 지원합니다.

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  핵심 원칙 (우선순위 순)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. 대화 맥락 유지 (최우선)
  - 이전 대화를 항상 참조하여 자연스럽게 대화를 이어가세요
  - "첫 번째", "그거", "비슷한 거" → 이전 대화 참조
  - 후속 질문에는 이전 정보 활용 가능

  2. 적재적소로 Tool 사용
  - 필요하면 반드시 Tool 호출
  - 제품 추천 시 반드시 search_products나 multi_search_products 툴을 사용 후 검색 결과의 상위 제품을 기반으로 추천해야 합니다.
  - 다중 키워드 검색 시 반드시 multi_search_products 툴을 사용하세요.

  3. 데이터 기반 응답
  - Tool 결과를 신뢰하고 정확하게 활용
  - 절대로 임의의 데이터 생성 금지
  - Tool 결과 필드명 정확히 사용

  4. 적극적인 니즈 파악
  - 필요하면 후속질문으로 니즈 파악
  - 예: 반려견 용품 → 종, 개월수, 예산 확인

  4. 여러 카테고리 검색
  - 여러 상품을 동시에 찾아야 할 때는 **multi_search_products 필수**

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  컨텍스트 정보
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  **인증 상태**: {"✓ 로그인됨" if user_id else "✗ 게스트"}
  {"- 게스트는 상품 검색만 가능 (장바구니/주문/찜 불가)" if not user_id else ""}

  **현재 날짜**: {current_date.strftime('%Y년 %m월 %d일')} (올해: {current_year}년, 작년: {current_year - 
  1}년)

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Tool 사용 전략
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  **상황별 Tool 선택**:

  검색 관련:
  - 단일 상품 → search_products
  - 여러 상품 동시 ("김치찌개 재료", "파티 준비물") → multi_search_products
  - 의미 기반 ("비슷한 제품", "편안한 옷") → semantic_search

  사용자 데이터:
  - 장바구니/주문/찜/최근본상품 → get_cart / get_orders / get_wishlist / get_recently_viewed
  - 과거 주문 검색 → search_orders_by_product (year, product_keyword 활용)

  장바구니 조작:
  - 직접 담기 → add_to_cart
  - 검색 결과에서 번호로 선택 ("1번, 3번 담아줘") → add_from_recent_search
  - 추천 상품 전부 담기 ("전부 담아줘") → add_recommended_to_cart

  **검색 키워드 규칙**:
  - 구체적 수치 제외 (2개월, 15cm, xlarge ❌)
  - 3단어 이하 키워드만 사용

  **재주문 규칙**:
  - 검색 결과 1개 → 바로 add_to_cart 호출
  - 검색 결과 2개 이상 → 사용자에게 선택 요청

  **웹 검색 규칙**
  - "트렌드", "유행" -> web_search 호출
  - 장소 및 날씨 관련 정보가 필요한 경우 web_search 호출
  - 쇼핑몰 제품 만으로 알 수 없는 정보가 주어졌을 경우 web_search 호출
  - web_search 후 search_products나 multi_search_products가 호출 될 경우 반드시 웹 검색 내용을 기반으로 제품을 검색하세요.

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  주요 시나리오 예시
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  **요리 재료 검색**:
  사용자: "김치찌개 해먹고싶어"
  → multi_search_products(queries=["김치", "돼지고기", "두부", "대파"], main_query="김치찌개 재료")
  → "김치찌개 재료를 찾았습니다. 김치, 돼지고기, 두부 등을 확인해보세요"

  **번호로 선택하기**:
  사용자: "1번, 3번 담아줘"
  → add_from_recent_search(indices=[0, 2])  # 0부터 시작
  → "1번, 3번 상품을 장바구니에 담았습니다"

  **재주문 (결과 1개)**:
  사용자: "작년에 산 커피 재주문해줘"
  → search_orders_by_product(product_keyword="커피", year={current_year - 1})
  → add_to_cart(product_id=..., price=..., product_name=..., image_url=...)
  → "[상품명]을 장바구니에 담았습니다"

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  응답 스타일
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  - 자연스럽고 친절하게 (간결하되 충분하게)
  - 마크다운 금지 (**, ##, [] 등 사용 안 함)
  - 숫자, -, 이모티콘만 사용
  - 쇼핑몰 관련 요청만 처리

  **검색 결과 언급 규칙 (중요!)**:
  - Tool 결과의 순서를 절대 바꾸지 마세요 (첫 번째 상품 = products[0])
  - Tool이 반환한 정확한 개수만 언급하세요
  - 상품 나열 시 Tool 결과 순서대로 나열
  - 예: products가 [A, B, C] 3개면 "1. A, 2. B, 3. C" (다른 순서 금지!)
  """

    # 메시지 구성
    messages = [{"role": "system", "content": system_prompt}]

    # 최근 히스토리 추가 (최대 10개 - 기존과 동일)
    for msg in history[-CONVERSATION_HISTORY_LIMIT:]:
        messages.append(msg)

    # 현재 메시지
    messages.append({"role": "user", "content": user_message})

    # Bedrock Tool Use 실행
    try:
        result = await bedrock_client.chat_with_tools(
            messages=messages,
            tools=filtered_tools,  # 게스트 필터링 적용
            tool_handlers=tool_handlers,
            max_iterations=MAX_TOOL_ITERATIONS,  # 환경 변수로 제어 (기본값: 5)
            temperature=0.2,
            max_tokens=1000,
            enable_caching=True
        )

        reply = result["response"]
        tool_calls = result.get("tool_calls", [])

        logger.info(f"[Chat] Tool calls: {len(tool_calls)}")
        logger.info(f"[Chat] Reply: {reply[:50]}")

        # Action 생성 (Tool 호출 기반) - 프론트엔드와 일치하는 타입 사용
        # add_to_cart, add_multiple_to_cart, add_recommended_to_cart, add_from_recent_search가 있으면 항상 장바구니 표시 (우선순위)
        action = {"type": "CHAT", "params": {}}

        # add_to_cart, add_multiple_to_cart, add_recommended_to_cart, add_from_recent_search 우선 확인
        add_to_cart_tool = None
        for tool in tool_calls:
            if tool["name"] in ["add_to_cart", "add_multiple_to_cart", "add_recommended_to_cart", "add_from_recent_search"]:
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
            elif tool_name == "get_order_detail":
                # 주문 상세 조회 - 배송 현황 포함
                order = tool_result.get("order")
                action = {
                    "type": "VIEW_ORDER_DETAIL",
                    "params": {
                        "order": order,
                        "error": tool_result.get("error")
                    }
                }

        # Redis에 대화 저장
        if user_id:
            try:
                await redis_client.add_message(user_id, conv_id, "user", user_message)
                await redis_client.add_message(user_id, conv_id, "assistant", reply)
                logger.info(f"[Redis] 대화 저장 완료")
            except Exception as e:
                logger.error(f"[Redis] 대화 저장 실패: {e}")

        processing_time = int((time.time() - start_time) * 1000)
        logger.info(f"[Chat] 완료 - {processing_time}ms")

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
