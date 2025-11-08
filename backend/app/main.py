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
from .redis_client import redis_client
from .chat_models import ChatRequest, ChatResponse

# Intent + Orchestrator + Reply Generator 임포트
from .intents import IntentParser
from .orchestrators import ChatOrchestrator
from .reply_generator import generate_reply
from .search_client import get_search_client

import time
import uuid
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
async def chat(request: ChatRequest):
    """
    AI 쇼핑 어시스턴트 채팅 (Intent + Orchestrator 방식)

    Flow:
    1. Redis에서 대화 히스토리 로드
    2. Intent 파악 (LLM)
    3. Orchestrator가 데이터 수집 (ES, DB)
    4. 인증 체크 (Orchestrator 결과 기반)
    5. Reply Generator가 자연스러운 답변 생성
    6. Redis에 대화 저장
    7. ChatResponse 반환
    """
    start_time = time.time()
    user_message = request.message
    user_id = request.user_id  # user_id 추출
    conv_id = request.conversation_id or str(uuid.uuid4())
    has_image = bool(request.images and len(request.images) > 0)

    logger.info(f"[Chat] User: {user_id}, Conv: {conv_id[:8]}, Message: {user_message[:50]}, Image: {has_image}")

    # 1단계: Redis에서 대화 히스토리 로드
    history = []
    if user_id:
        try:
            history = await redis_client.get_conversation(user_id, conv_id)
            logger.info(f"[Redis] 히스토리 로드 완료: {len(history)}개 메시지")
        except Exception as e:
            logger.error(f"[Redis] 히스토리 로드 실패: {e}")
            history = []

    # 2단계: Intent 파악
    parser = IntentParser()

    try:
        intent = await parser.parse(
            message=user_message,
            conversation_history=history[-10:]  # 최근 10개만 컨텍스트로 전달
        )
        logger.info(f"[Intent] Type: {intent.type.value}, Confidence: {intent.confidence}")

    except Exception as e:
        logger.error(f"[Intent Parser] 오류: {e}", exc_info=True)
        # Fallback: CHAT으로 처리
        from .intents import ChatIntent
        intent = ChatIntent(message=user_message, confidence=0.0)

    # 3단계: Orchestrator로 데이터 수집
    db = get_db()
    es = get_search_client()
    orchestrator = ChatOrchestrator(db, es)

    try:
        result = await orchestrator.execute(intent, user_id=user_id)
        logger.info(f"[Orchestrator] Action: {result['action']['type']}, Has Data: {result.get('data') is not None}")

    except Exception as e:
        logger.error(f"[Orchestrator] 오류: {e}", exc_info=True)
        # Fallback: ERROR 응답
        return ChatResponse(
            reply="죄송합니다. 일시적인 오류가 발생했어요. 다시 시도해주세요.",
            action={"type": "ERROR", "params": {}},
            conversation_id=conv_id,
            llm_used=False,
            processing_time_ms=int((time.time() - start_time) * 1000)
        )

    # 4단계: 인증 체크 (Orchestrator 결과 기반)
    if result.get("requires_auth") and not user_id:
        logger.warning(f"[Auth] 인증 필요: {intent.type.value}")
        return ChatResponse(
            reply="로그인이 필요한 기능입니다.",
            action={"type": "ERROR", "params": {}},
            conversation_id=conv_id,
            llm_used=False,
            processing_time_ms=int((time.time() - start_time) * 1000)
        )

    # 5단계: Reply Generator로 자연스러운 답변 생성
    try:
        reply = await generate_reply(
            intent=intent,
            data=result.get("data"),
            conversation_history=history[-3:],  # 최근 3개만 답변 생성 컨텍스트로
            has_image=has_image
        )
        logger.info(f"[Reply] Generated: {reply[:50]}")

    except Exception as e:
        logger.error(f"[Reply Generator] 오류: {e}", exc_info=True)
        # Fallback: 기본 메시지
        from .reply_generator import _get_fallback_reply
        reply = _get_fallback_reply(intent, result.get("data"), has_image)
        logger.warning(f"[Reply] Fallback 사용: {reply[:50]}")

    # 6단계: Redis에 대화 저장
    if user_id:
        try:
            await redis_client.add_message(user_id, conv_id, "user", user_message)
            await redis_client.add_message(user_id, conv_id, "assistant", reply)
            logger.info(f"[Redis] 대화 저장 완료 (user: {user_id})")
        except Exception as e:
            logger.error(f"[Redis] 대화 저장 실패: {e}")

    # 7단계: 응답 반환
    processing_time = int((time.time() - start_time) * 1000)
    logger.info(f"[Chat] 완료 - {processing_time}ms")

    return ChatResponse(
        reply=reply,
        action=result["action"],
        conversation_id=conv_id,
        llm_used=True,
        processing_time_ms=processing_time
    )