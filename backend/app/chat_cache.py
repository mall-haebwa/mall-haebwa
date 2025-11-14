"""
Simple Chat Cache - 최소한의 정규화
"""
import hashlib
import re
import json
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class ChatCache:
    """간단한 채팅 캐시"""

    def __init__(self, redis_client, ttl: int = 1800):
        self.redis = redis_client.redis if redis_client else None
        self.ttl = ttl
        self.hits = 0
        self.misses = 0

        logger.info(f"[ChatCache] Initialized (TTL: {ttl}s)")

    def normalize_query(self, query: str) -> str:
        # 공백, 대소문자 정규화
        query = query.strip().lower()
        # 공백, 온점, 느낌표, 물음표 모두 제거
        query = re.sub(r'[\s.\!\?~]', '', query)
        return query

    def get_cache_key(self, query: str) -> str:
        """캐시 키 생성"""
        normalized = self.normalize_query(query)
        # 중복 공백만 처리 (현재는 정규화로 공백을 전부 제거해서 주석 처리)
        # normalized = re.sub(r'\s+', ' ', normalized)
        hash_val = hashlib.md5(normalized.encode()).hexdigest()[:16]
        return f"chat:{hash_val}"

    def is_personal_query(self, query: str) -> bool:
        """개인 데이터 쿼리인지 간단히 체크"""
        query_lower = query.lower()

        # 간단한 키워드만 체크
        personal_keywords = ['내', '나의', '주문', '장바구니', '찜', '카트']
        return any(kw in query_lower for kw in personal_keywords)

    async def get(self, query: str) -> Optional[Dict[str, Any]]:
        """캐시 조회"""
        if not self.redis:
            return None

        # 개인 데이터는 스킵
        if self.is_personal_query(query):
            return None

        try:
            cache_key = self.get_cache_key(query)
            cached = await self.redis.get(cache_key)

            if cached:
                self.hits += 1
                total = self.hits + self.misses
                hit_rate = (self.hits / total * 100) if total > 0 else 0

                logger.info(
                    f"[ChatCache] HIT ({hit_rate:.1f}%): '{query[:40]}...'"
                )

                result = json.loads(cached)
                result['from_cache'] = True
                return result

            self.misses += 1
            return None

        except Exception as e:
            logger.error(f"[ChatCache] Error: {e}")
            return None

    async def set(
        self,
        query: str,
        response: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """캐시 저장"""
        if not self.redis:
            return False

        # 개인 데이터는 스킵
        if self.is_personal_query(query):
            return False

        try:
            cache_key = self.get_cache_key(query)
            cache_ttl = ttl or self.ttl

            cache_data = {k: v for k, v in response.items() if k != 'from_cache'}

            await self.redis.setex(
                cache_key,
                cache_ttl,
                json.dumps(cache_data, ensure_ascii=False)
            )

            logger.info(f"[ChatCache] Cached: '{query[:40]}...'")
            return True

        except Exception as e:
            logger.error(f"[ChatCache] Error: {e}")
            return False

    def get_stats(self) -> Dict[str, Any]:
        """통계"""
        total = self.hits + self.misses
        hit_rate = (self.hits / total * 100) if total > 0 else 0

        return {
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": f"{hit_rate:.1f}%",
            "ttl": self.ttl
        }