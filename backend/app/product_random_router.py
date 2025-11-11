from __future__ import annotations

from collections import OrderedDict
from typing import Any
import random
import json
import hashlib
import os

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from .database import get_db
from .product_router import _reshape_product
from .redis_client import redis_client


router = APIRouter(prefix="/products", tags=["products-random"])

def _generate_cache_key(limit: int, exclude_ids: list[ObjectId]) -> str:
    """
    캐시 키 생성 함수

    Args:
        limit: 요청한 상품 개수
        exclude_ids: 제외할 상품 ID 리스트

    Returns:
        Redis 캐시 키 (예: "random_products:24:abc123")
    """
    # exclude_ids를 정렬해서 해시 생성 (순서 무관하게 동일한 키 생성)
    exclude_str = ",".join(sorted([str(oid) for oid in exclude_ids]))
    exclude_hash = hashlib.md5(exclude_str.encode()).hexdigest()[:8] if exclude_ids else "none"

    return f"random_products:{limit}:{exclude_hash}"

@router.get("/random")
async def random_products(
    limit: int = Query(20, ge=1, le=60),
    exclude: list[str] = Query(default=[]),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """중복 없이 완전 랜덤, 순서도 매번 다른 상품 목록을 반환합니다.

    구현:
    - Redis 캐시 우선 조회 (TTL: 10분)
    - 캐시 미스 시: rank를 정수로 변환(numericRank) 후 1~5000 범위로 필터
    - MongoDB `$sample`로 limit개 랜덤 추출(중복 없음, 매 호출 무작위)
    - 결과 순서는 샘플 특성상 랜덤이지만, 안전하게 한 번 더 셔플
    - Redis에 결과 캐싱
    """

    # exclude 파라미터 처리: 쉼표 구분/반복 파라미터 모두 지원
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

    # Redis 캐시 조회
    cache_key = _generate_cache_key(limit, exclude_ids)

    if redis_client.redis:
        try:
            cached_data = await redis_client.redis.get(cache_key)
            if cached_data:
                result = json.loads(cached_data)
                print(f"[Redis] 랜덤 상품 캐시 히트: {cache_key}, {result['count']}개 상품")
                return result
            print(f"[Redis] 캐시 미스: {cache_key}, MongoDB에서 조회")
        except Exception as e:
            print(f"[Redis] 캐시 조회 실패: {e}, MongoDB로 폴백")

    # MongoDB 쿼리 (캐시 미스 시)
    collection = db["products"]

    pipeline: list[dict[str, Any]] = [
        {
            "$addFields": {
                "numericRank": {
                    "$convert": {
                        "input": "$rank",
                        "to": "int",
                        "onError": None,
                        "onNull": None,
                    }
                }
            }
        },
        {"$match": {"numericRank": {"$gte": 1, "$lte": 5000}}},
    ]

    if exclude_ids:
        pipeline.append({"$match": {"_id": {"$nin": exclude_ids}}})

    pipeline.append({"$sample": {"size": limit}})

    docs = await collection.aggregate(pipeline).to_list(length=limit)

    # 안전을 위해 한 번 더 셔플(샘플 순서도 랜덤이긴 함)
    random.shuffle(docs)

    items = [_reshape_product(doc) for doc in docs]

    result = {
        "items": items,
        "limit": limit,
        "count": len(items),
    }

    # Redis 캐시 저장 (TTL: 10분 = 600초)
    if redis_client.redis:
        try:
            ttl = int(os.getenv("REDIS_TTL_RANDOM_PRODUCTS", 600))
            await redis_client.redis.setex(
                cache_key,
                ttl,
                json.dumps(result, ensure_ascii=False, default=str)
            )
            print(f"[Redis] 랜덤 상품 캐시 저장: {cache_key}, {len(items)}개 상품, TTL 10분")
        except Exception as e:
            print(f"[Redis] 캐시 저장 실패: {e}")

    return result
