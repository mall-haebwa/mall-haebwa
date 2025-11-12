from __future__ import annotations

from typing import Any
import random
import json
import logging
import time

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from .database import get_db
from .product_router import _reshape_product
from .redis_client import redis_client


router = APIRouter(prefix="/products", tags=["products-random"])

logger = logging.getLogger(__name__)

# 메모리 기반 폴백 캐시 (Redis 실패 시 사용)
_memory_pool_cache = {
    "ids": [],
    "expires_at": 0
}
_MEMORY_CACHE_TTL = 3600  # 1시간


async def update_product_pool(db: AsyncIOMotorDatabase) -> list[str]:
    """
    rank 1-5000 상품의 ID를 Redis에 저장 (또는 메모리 폴백)

    이 함수는 다음과 같은 경우에 호출됩니다:
    - 서버 시작 시 (main.py startup event)
    - 풀이 만료되었을 때 (자동)

    Returns:
        상품 ID 리스트
    """
    try:
        collection = db["products"]

        # 1. 추천 가능한 상품 ID만 가져오기 (빠른 쿼리)
        pipeline = [
            {"$sample": {"size": 5000}},  # 전체에서 랜덤 5000개
            {"$project": {"_id": 1}}
        ]

        docs = await collection.aggregate(pipeline).to_list(length=5000)
        product_ids = [str(doc["_id"]) for doc in docs]

        logger.info(f"[Product Pool] 상품 풀 생성: {len(product_ids)}개 상품")

        # 2. Redis에 저장 시도
        if redis_client.redis:
            try:
                await redis_client.redis.setex(
                    "product_pool:ids",
                    3600,   # 1시간 TTL
                    json.dumps(product_ids)
                )
                logger.info(f"[Product Pool] Redis 저장 완료, TTL: 1시간")
            except Exception as e:
                logger.warning(f"[Product Pool] Redis 저장 실패, 메모리 폴백 사용: {e}")
                # Redis 저장 실패 시 메모리 캐시 사용
                _memory_pool_cache["ids"] = product_ids
                _memory_pool_cache["expires_at"] = time.time() + _MEMORY_CACHE_TTL
        else:
            # Redis 연결 없음 - 메모리 캐시 사용
            logger.warning(f"[Product Pool] Redis 연결 없음, 메모리 폴백 사용")
            _memory_pool_cache["ids"] = product_ids
            _memory_pool_cache["expires_at"] = time.time() + _MEMORY_CACHE_TTL

        return product_ids

    except Exception as e:
        logger.error(f"[Product Pool] 생성 실패: {e}", exc_info=True)
        return []


@router.get("/random")
async def random_products(
    limit: int = Query(20, ge=1, le=60),
    exclude: list[str] = Query(default=[]),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    ID 풀 기반 고속 랜덤 추천

    구현:
    - Redis에 저장된 상품 ID 풀(rank 1-5000) 사용
    - Redis 실패 시 메모리 캐시 폴백
    - Python random.sample로 빠른 샘플링(메모리 연산)
    - MongoDB _id 인덱스 조회로 상품 정보 가져오기

    성능:
    - 풀 있음: ~10-15ms
    - 풀 없음: ~500ms (최초 1회 생성 후 1시간 동안 재사용)
    """

    # 1. exclude 파라미터 처리: 쉼표 구분/반복 파라미터 모두 지원
    exclude_ids: list[ObjectId] = []
    for token in exclude:
        if not token:
            continue
        parts = [p.strip() for p in token.split(",") if p.strip()]
        for p in parts:
            try:
                exclude_ids.append(ObjectId(p))
            except Exception:
                # 유효하지 않은 ObjectId는 무시
                pass

    # 2. Redis에서 상품 ID 풀 가져오기
    product_pool = None

    if redis_client.redis:
        try:
            pool_data = await redis_client.redis.get("product_pool:ids")
            if pool_data:
                product_pool = json.loads(pool_data)
                logger.info(f"[Random] 상품 풀 로드 (Redis): {len(product_pool)}개")
        except Exception as e:
            logger.warning(f"[Random] Redis 조회 실패: {e}")

    # 3. Redis에서 못 가져왔으면 메모리 캐시 확인
    if not product_pool:
        if _memory_pool_cache["ids"] and time.time() < _memory_pool_cache["expires_at"]:
            product_pool = _memory_pool_cache["ids"]
            logger.info(f"[Random] 상품 풀 로드 (메모리 캐시): {len(product_pool)}개")
        else:
            # 메모리 캐시도 만료됨
            logger.info(f"[Random] 상품 풀 생성 중...")
            product_pool = await update_product_pool(db)

    if not product_pool:
        logger.error(f"[Random] 상품 풀 생성 실패")
        return {"items": [], "limit": limit, "count": 0}

    # 4. exclude 처리
    exclude_set = set(str(oid) for oid in exclude_ids)  # 문자열로 비교
    available_ids = [
        pid for pid in product_pool
        if pid not in exclude_set   # 문자열 비교, O(1)
    ]

    # 5. Python random.sample로 빠르게 선택
    sample_size = min(limit, len(available_ids))
    if sample_size == 0:
        return {"items": [], "limit": limit, "count": 0}

    selected_ids = random.sample(available_ids, sample_size)

    # 6. MongoDB에서 선택된 ID로 조회 (인덱스 사용!)
    collection = db["products"]
    object_ids = [ObjectId(pid) for pid in selected_ids]

    docs = await collection.find(
        {"_id": {"$in": object_ids}}
    ).to_list(length=sample_size)

    # 7. 셔플
    random.shuffle(docs)

    # 8. 응답 포맷팅
    items = [_reshape_product(doc) for doc in docs]

    result = {
        "items": items,
        "limit": limit,
        "count": len(items),
    }

    logger.info(f"[Random] 랜덤 상품 반환: {len(items)}개")

    return result