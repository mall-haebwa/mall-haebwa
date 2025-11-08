# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import get_db
from .auth_router import router as auth_router
from .models import ensure_indexes
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
from .llm_client import llm_client
from .redis_client import redis_client
from pydantic import BaseModel
from .chat_models import ChatRequest, ChatResponse
from .commands import match_command
import time
import uuid
import json
import re



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

# 시스템 프롬프트 추가
SYSTEM_PROMPT = """당신은 친절하고 전문적인 쇼핑 어시스턴트입니다.
사용자의 요청을 이해하고 적절한 응답과 액션을 JSON 형태로 반환하세요.


  ## 이미지 검색 기능:
  - 사용자가 이미지를 업로드하면, 이미지의 내용을     
  분석하여 유사한 상품을 검색할 수 있도록 응답합니다.
  - 이미지에서 색상, 스타일, 카테고리, 브랜드를       
  파악합니다

## 가능한 액션:
1. SEARCH: 상품 검색 (상품명, 카테고리, 브랜드 등)
2. VIEW_CART: 장바구니 보기
3. VIEW_ORDERS: 주문 내역 조회
4. TRACK_DELIVERY: 배송 조회
5. VIEW_WISHLIST: 찜 목록 보기
6. CHAT: 일반 대화 (액션 없음)
7. MULTISEARCH: 다중 상품 검색 (여러 키워드 동시 검색)

## 응답 형식 (반드시 이 형식만 사용):
{
    "reply": "사용자에게 보여줄 친절한 메시지",
    "action": {"type": "액션타입", "params": {"query": "검색어"}}
}

## 예시:
1. 상품 검색:
사용자: "모니터 보여줘"
{"reply": "모니터 상품을 찾아볼게요!", "action": {"type": "SEARCH", "params": {"query": "모니터"}}}

사용자: "검정 패딩"
{"reply": "검정 패딩 상품을 검색해드릴게요!", "action": {"type": "SEARCH", "params": {"query": "검정 패딩"}}}

2. 주문 조회:
사용자: "주문 내역 보여줘"
{"reply": "주문 내역을 가져올게요!", "action": {"type": "VIEW_ORDERS", "params": {}}}

3. 일반 대화:
사용자: "안녕"
{"reply": "안녕하세요! 무엇을 도와드릴까요?", "action": {"type": "CHAT", "params": {}}}

4. 다중 상품 검색:
사용자: "김치찌개 재료 찾아줘"
{"reply": "김치찌개 재료를 찾아볼게요!", "action": {"type": "MULTISEARCH", "params": {"queries": ["김치", "두부", "돼지고기", "고추가루", "대파", "마늘"]}}}

5. 이미지 검색:
사용자: [이미지: 파란색 청바지] + "이거랑 비슷한 제품 찾아줘"
{"reply": "업로드하신 이미지를 분석했어요.
"분석한 내용" 제품으로 보여요. 비슷한 상품을 찾아볼게요!", "action": {"type": "SEARCH", "params": {"query": "파란색 스키니 청바지"}}}

중요:
- 반드시 순수 JSON만 반환 (마크다운 코드 블록 사용 금지)
- reply는 친절하고 자연스러운 한국어로
- 상품 관련 키워드가 있으면 무조건 SEARCH action 사용
- params의 query(SEARCH) 또는 queries(MULTISEARCH)는 사용자가 찾고자 하는 핵심 키워드만 추출"""

def is_simple_search(text: str) -> bool:
    """간단한 검색어인지 판별"""
    text = text.strip().lower()
    command_keywords = ["조회", "확인", "보여줘", "담아", "삭제", "결제", "추천"]
    if any(keyword in text for keyword in command_keywords):
        return False
    if '?' in text or len(text) >= 30:
        return False
    return True


@app.on_event("startup")
async def startup():
    db = get_db()
    await ensure_indexes(db)
    # Redis 연결
    await redis_client.connect()

@app.on_event("shutdown")
async def shutdown():
    # Redis 연결 해제
    await redis_client.disconnect()

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


@app.get("/api/chat/history/{conversation_id}")
async def get_chat_history(user_id: str, conversation_id: str):
    """대화 히스토리 조회 (프론트엔드에서 페이지 로드 시 사용)"""
    if not user_id:
        return {"messages": [], "error": "User ID is required"}

    try:
        history = await redis_client.get_conversation(user_id, conversation_id)
        return {"messages": history}
    except Exception as e:
        print(f"[Error] Failed to get chat history: {e}")
        return {"messages": [], "error": str(e)}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """AI 쇼핑 어시스턴트 채팅 (멀티모달 지원, Redis 기반)"""
    start_time = time.time()
    user_message = request.message
    user_id = request.user_id  # user_id 추출
    conv_id = request.conversation_id or str(uuid.uuid4())

    # 로그인하지 않은 사용자의 경우, 인증이 필요한 명령어는 차단
    if not user_id:
        if any(keyword in user_message for keyword in ["주문", "구매", "배송", "장바구니", "카트", "찜"]):
            return ChatResponse(reply="로그인이 필요한 기능입니다.", action={"type": "ERROR"}, conversation_id=conv_id, llm_used=False, processing_time_ms=0)


    # #1단계: 명령어 매칭 (임시 주석 처리)
    # command_result = match_command(user_message)
    # if command_result["matched"]:
    #     return ChatResponse(
    #         reply=command_result["reply"],
    #         action=command_result["action"],
    #         conversation_id=conv_id,
    #         llm_used=False,
    #         processing_time_ms=int((time.time() - start_time) * 1000)
    #     )

    # #2단계: 간단한 검색 (임시 주석 처리)
    # if is_simple_search(user_message):
    #     query = user_message.strip()
    #     return ChatResponse(
    #         reply=f'"{query}" 검색 결과를 보여드릴게요!',
    #         action={"type": "SEARCH", "params": {"query": query}},
    #         conversation_id=conv_id,
    #         llm_used=False,
    #         processing_time_ms=int((time.time() - start_time) * 1000)
    #     )

    # #3단계: LLM 호출
    if llm_client is None:
        return ChatResponse(
            reply="AI 기능이 현재 비활성화되어 있습니다. 관리자에게 문의하세요.",
            action={"type": "ERROR", "params": {}},
            conversation_id=conv_id,
            llm_used=False,
            processing_time_ms=int((time.time() - start_time) * 1000)
        )

    # Redis에서 대화 히스토리 조회 (user_id 기반)
    if user_id:
        history = await redis_client.get_conversation(user_id, conv_id)
    else:
        # 비로그인 사용자는 현재 세션만 유지 (TTL 없는 임시 메모리)
        history = []

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # 최근 10개 메시지만 사용
    for msg in history[-10:]:
        messages.append(msg)
    messages.append({"role": "user", "content": user_message})

    # 이미지 데이터 추출
    image_data = None
    if request.images and len(request.images) > 0:
        image_data = [
            {
                "mime_type": img.mime_type,
                "data": img.data
            }
            for img in request.images
        ]

    # llm_client 호출 이미지 포함
    llm_output = await llm_client.chat(
        messages,
        images=image_data,
        temperature=0.5,
        max_tokens=1000
    )
    print(f"[LLM Raw Output] {llm_output}")

    # JSON파싱 (마크다운 코드 블록 제거)
    try:
        # ```json ... ``` 형식 제거
        cleaned = llm_output.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]  # ```json 제거
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]  # ``` 제거
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]  # ``` 제거
        cleaned = cleaned.strip()

        print(f"[Cleaned JSON] {cleaned}")
        parsed = json.loads(cleaned)
        print(f"[Parsed Action] {parsed.get('action')}")

        # action 필드 검증
        if "action" not in parsed or "reply" not in parsed:
            raise ValueError("Missing required fields")

    except Exception as e:
        print(f"JSON Parse Error: {e}, Raw output: {llm_output}")
        parsed = {
            "reply": llm_output if len(llm_output) < 200 else "죄송해요, 다시 말씀해주시겠어요?",
            "action": {"type": "CHAT", "params": {}}
        }

    # Redis에 대화 저장 (user_id 기반)
    if user_id:
        await redis_client.add_message(user_id, conv_id, "user", user_message)
        await redis_client.add_message(user_id, conv_id, "assistant", parsed["reply"])
        print(f"[Chat] Saved conversation for user {user_id}")

    return ChatResponse(
        reply=parsed["reply"],
        action=parsed.get("action"),
        conversation_id=conv_id,
        llm_used=True,
        processing_time_ms=int((time.time() - start_time) * 1000)
    )