# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import get_db
from .auth_router import router as auth_router
from .models import ensure_indexes
import os
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
from pydantic import BaseModel

app = FastAPI(title="AI Shop API")


class ChatRequest(BaseModel):
    message: str


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

app.include_router(auth_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(category_router, prefix="/api")
app.include_router(payment_router, prefix="/api")
app.include_router(order_router, prefix="/api")
app.include_router(cart_router, prefix="/api")
app.include_router(product_random_router, prefix="/api")
app.include_router(product_router, prefix="/api")
app.include_router(wishlist_router, prefix="/api")
app.include_router(user_router, prefix="/api")


async def _test_llm_chat_handler(request: ChatRequest):
    """LM Studio를 사용한 AI 챗봇 테스트 - 공통 핸들러"""
    try:
        messages = [
            {
                "role": "system",
                "content": "당신은 친절한 쇼핑몰 AI 어시스턴트입니다. 사용자의 질문에 간단하고 명확하게 답변하세요."
            },
            {
                "role": "user",
                "content": request.message
            }
        ]

        response = await llm_client.chat(messages, temperature=0.7, max_tokens=500)

        return {
            "success": True,
            "ai_response": response,
            "user_message": request.message
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "ai_response": "죄송합니다. AI 서버에 연결할 수 없습니다. LM Studio가 실행 중인지 확인해주세요."
        }


@app.post("/api/test-llm-chat")
async def test_llm_chat_api(request: ChatRequest):
    """LM Studio AI 챗봇 - /api 경로"""
    return await _test_llm_chat_handler(request)


@app.post("/test-llm-chat")
async def test_llm_chat(request: ChatRequest):
    """LM Studio AI 챗봇 - /api 없는 경로 (proxy rewrite 대응)"""
    return await _test_llm_chat_handler(request)


@app.post("/api/test-llm-intent")
async def test_llm_intent(request: ChatRequest):
    """사용자 의도 분석 테스트"""
    try:
        response = await llm_client.generate_intent_analysis(request.message)

        return {
            "success": True,
            "intent_analysis": response,
            "user_message": request.message
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
