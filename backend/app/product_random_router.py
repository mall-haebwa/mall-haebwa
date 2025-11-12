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

async def update_product_pool(db: AsyncIOMotorDatabase) -> list[str]:
    """
    rank 1-5000 상품의 ID를 Redis에 저장

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
            {"$project": {"_id": 1}}    # ID만 프로젝션 (데이터 전송량 최소화)
        ]

        docs = await collection.aggregate(pipeline).to_list(length=5000)
        product_ids = [str(doc["_id"]) for doc in docs]

        print(f"[Product Pool] 상품 풀 생성: {len(product_ids)}개 상품")

        # 2. Redis에 저장 (TTL: 1시간)
        if redis_client.redis:
            await redis_client.redis.setex(
                "product_pool:ids",
                3600,   # 1시간 TTL
                json.dumps(product_ids)
            )
            print(f"[Product Pool] Redis 저장 완료, TTL: 1시간")

        return product_ids

    except Exception as e:
        print(f"[Product Pool] 생성 실패: {e}")
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
    - Python random.sample로 빠른 샘플링(메모리 연산)
    - MongoDB _id 인덱스 조회로 상품 정보 가져오기

    성능:
    - 풀 있음: ~10-15ms
    - 풀 없음: ~500ms (최초 1회 생성 후 1시간 동안 재사용)
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

    # 2. Redis에서 상품 ID 풀 가져오기
    product_pool = None
    if redis_client.redis:
        try:
            pool_data = await redis_client.redis.get("product_pool:ids")
            if pool_data:
                product_pool = json.loads(pool_data)
                print(f"[Random] 상품 풀 로드: {len(product_pool)}개")
            else:
                print(f"[Random] 상품 풀 없음, 새로 생성 중...")
                product_pool = await update_product_pool(db)
        except Exception as e:
            print(f"[Random] Redis 조회 실패: {e}")

    # 3. 풀이 없으면 생성
    if not product_pool:
        print(f"[Random] 상품 풀 생성 중...")
        product_pool = await update_product_pool(db)

    if not product_pool:
        print(f"[Random] 상품 풀 생성 실패")
        return {"items": [], "limit": limit, "count": 0}

    # 4. exclude 처리
    available_ids = [
        pid for pid in product_pool
        if ObjectId(pid) not in exclude_ids
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

    print(f"[Random] 랜덤 상품 반환: {len(items)}개")

    return result
