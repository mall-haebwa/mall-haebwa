"""
Redis 클라이언트 - 대화 히스토리 관리 (user_id 기반)
"""
import os
import json
import redis.asyncio as aioredis
import logging
from typing import List, Dict, Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

class RedisClient:
    def __init__(self):
        """Redis 클라이언트 초기화"""
        self.redis = None
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")

        # TTL 설정 (환경변수에서 읽기, 없으면 기본값)
        self.ttl_conversations = int(os.getenv("REDIS_TTL_CONVERSATIONS", 604800))  # 7일

        print(f"\n{'='*60}")
        print("[Redis] Initializing Redis Client...")
        print(f"[Redis] Redis URL: {self.redis_url}")
        print(f"[Redis] TTL - Conversations: {self.ttl_conversations}s ({self.ttl_conversations//86400}d)")
        print(f"{'='*60}\n")

    async def connect(self):
        """Redis에 연결"""
        try:
            self.redis = await aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            # 연결 테스트
            await self.redis.ping()
            print("[Redis] ✓ Successfully connected to Redis")
            return True
        except Exception as e:
            print(f"[Redis] ✗ Failed to connect to Redis: {e}")
            self.redis = None
            return False

    async def disconnect(self):
        """Redis 연결 종료"""
        if self.redis:
            await self.redis.close()
            print("[Redis] Disconnected from Redis")

    # ========================
    # 대화 히스토리 관련 메서드 (user_id 기반)
    # ========================

    async def get_conversation(self, user_id: str, conversation_id: str) -> List[Dict]:
        """
        대화 히스토리 조회

        Args:
            user_id: 사용자 ID
            conversation_id: 대화 ID

        Returns:
            대화 메시지 리스트
        """
        if not self.redis:
            logger.warning("Redis not connected, returning empty list")
            return []

        try:
            key = f"conversation:{user_id}:{conversation_id}"
            data = await self.redis.get(key)

            if data:
                return json.loads(data)
            return []
        except Exception as e:
            logger.error(f"Error getting conversation {user_id}:{conversation_id}: {e}")
            return []

    async def add_message(
        self,
        user_id: str,
        conversation_id: str,
        role: str,
        content: str
    ) -> bool:
        """
        대화에 메시지 추가

        Args:
            user_id: 사용자 ID
            conversation_id: 대화 ID
            role: 역할 ("user" 또는 "assistant")
            content: 메시지 내용

        Returns:
            성공 여부
        """
        if not self.redis:
            logger.warning("Redis not connected, cannot add message")
            return False

        try:
            key = f"conversation:{user_id}:{conversation_id}"

            # 기존 대화 조회 (최근 10개만)
            existing_data = await self.redis.get(key)
            if existing_data:
                messages = json.loads(existing_data)
                # 최근 10개 유지
                if len(messages) >= 20:
                    messages = messages[-18:]
            else:
                messages = []

            # 새 메시지 추가
            messages.append({
                "role": role,
                "content": content
            })

            # Redis에 저장 (TTL 적용)
            await self.redis.setex(
                key,
                self.ttl_conversations,
                json.dumps(messages, ensure_ascii=False)
            )

            return True
        except Exception as e:
            logger.error(f"Error adding message to conversation {user_id}:{conversation_id}: {e}")
            return False

    async def delete_user_conversations(self, user_id: str) -> bool:
        """
        사용자의 모든 대화 삭제 (로그아웃 시 호출)

        Args:
            user_id: 사용자 ID

        Returns:
            성공 여부
        """
        if not self.redis:
            return False

        try:
            # 해당 user_id의 모든 conversation 키 조회
            pattern = f"conversation:{user_id}:*"
            keys = await self.redis.keys(pattern)

            if keys:
                # 모든 키 삭제
                await self.redis.delete(*keys)
                logger.info(f"Deleted {len(keys)} conversations for user {user_id}")
                return True
            return True
        except Exception as e:
            logger.error(f"Error deleting conversations for user {user_id}: {e}")
            return False

    async def delete_conversation(self, user_id: str, conversation_id: str) -> bool:
        """
        특정 대화 삭제

        Args:
            user_id: 사용자 ID
            conversation_id: 대화 ID

        Returns:
            성공 여부
        """
        if not self.redis:
            return False

        try:
            key = f"conversation:{user_id}:{conversation_id}"
            await self.redis.delete(key)
            return True
        except Exception as e:
            logger.error(f"Error deleting conversation {user_id}:{conversation_id}: {e}")
            return False

    # ========================
    # 최근 본 상품 캐시 관련 메서드
    # ========================

    async def get_recently_viewed(self, user_id: str) -> Optional[List[Dict]]:
        """
        최근 본 상품 캐시 조회 (Redis)

        Args:
            user_id: 사용자 ID

        Returns:
            캐시된 최근 본 상품 리스트 또는 None
        """
        if not self.redis:
            logger.warning("Redis not connected")
            return None

        try:
            key = f"recently_viewed:{user_id}"
            data = await self.redis.get(key)

            if data:
                items = json.loads(data)
                item_count = len(items) if items else 0
                print(f"[Redis] 🚀 최근 본 상품 캐시 히트: user {user_id}, {item_count}개 상품")
                return items
            print(f"[Redis] 📦 캐시 미스: user {user_id}, DB에서 조회 필요")
            return None
        except Exception as e:
            logger.error(f"Error getting recently viewed for {user_id}: {e}")
            print(f"[Redis] ❌ 캐시 조회 실패: user {user_id}, Error: {e}")
            return None

    async def set_recently_viewed(self, user_id: str, items: List[Dict]) -> bool:
        """
        최근 본 상품 캐시 저장 (Redis, TTL: 1시간)

        Args:
            user_id: 사용자 ID
            items: 최근 본 상품 리스트

        Returns:
            성공 여부
        """
        if not self.redis:
            logger.warning("Redis not connected")
            return False

        try:
            from datetime import datetime

            key = f"recently_viewed:{user_id}"
            ttl = 3600  # 1시간 TTL

            # 모든 datetime 객체를 ISO 문자열로 변환
            def convert_to_serializable(obj):
                if isinstance(obj, datetime):
                    return obj.isoformat()
                elif isinstance(obj, dict):
                    return {k: convert_to_serializable(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [convert_to_serializable(item) for item in obj]
                return obj

            serializable_items = convert_to_serializable(items)

            await self.redis.setex(
                key,
                ttl,
                json.dumps(serializable_items, ensure_ascii=False)
            )
            item_count = len(items) if items else 0
            print(f"[Redis] 💾 최근 본 상품 캐시 저장: user {user_id}, {item_count}개 상품, TTL 1시간")
            return True
        except Exception as e:
            logger.error(f"Error setting recently viewed for {user_id}: {e}")
            print(f"[Redis] ❌ 최근 본 상품 캐시 저장 실패: user {user_id}, Error: {e}")
            return False

    async def delete_recently_viewed(self, user_id: str) -> bool:
        """
        최근 본 상품 캐시 삭제 (로그아웃 시 호출)

        Args:
            user_id: 사용자 ID

        Returns:
            성공 여부
        """
        if not self.redis:
            return False

        try:
            key = f"recently_viewed:{user_id}"
            result = await self.redis.delete(key)
            if result:
                print(f"[Redis] 🗑️ 최근 본 상품 캐시 삭제: user {user_id}")
                logger.info(f"Deleted recently viewed cache for user {user_id}")
            else:
                print(f"[Redis] ℹ️ 삭제할 캐시 없음: user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting recently viewed for {user_id}: {e}")
            print(f"[Redis] ❌ 캐시 삭제 실패: user {user_id}, Error: {e}")
            return False


# 글로벌 Redis 클라이언트 인스턴스
redis_client = RedisClient()
