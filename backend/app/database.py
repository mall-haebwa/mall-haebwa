# backend/app/database.py
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from dotenv import load_dotenv
import os

load_dotenv()

# Docker Compose 환경변수와 일치하도록 수정
_MONGO_URI = os.getenv("MONGODB_URL")  # 기본 주소값 제거하고 에러 메시지 추가
DB_NAME = os.getenv("MONGODB_DB_NAME", "ecommerce_ai")
if not _MONGO_URI:
    raise ValueError("MONGODB_URL 환경변수가 설정되지 않았습니다.")
_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(_MONGO_URI)
        print("✅ MongoDB 연결 성공")
    return _client


def get_db() -> AsyncIOMotorDatabase:
    client = get_client()
    return client[DB_NAME]