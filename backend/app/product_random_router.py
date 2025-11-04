from __future__ import annotations

from collections import OrderedDict
from typing import Any
import random

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from .database import get_db
from .product_router import _reshape_product


router = APIRouter(prefix="/products", tags=["products-random"])


@router.get("/random")
async def random_products(
    limit: int = Query(20, ge=1, le=60),
    exclude: list[str] = Query(default=[]),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """중복 없이 완전 랜덤, 순서도 매번 다른 상품 목록을 반환합니다.

    구현:
    - rank를 정수로 변환(numericRank) 후 1~5000 범위로 필터
    - MongoDB `$sample`로 limit개 랜덤 추출(중복 없음, 매 호출 무작위)
    - 결과 순서는 샘플 특성상 랜덤이지만, 안전하게 한 번 더 셔플
    """
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

    if exclude_ids:
        pipeline.append({"$match": {"_id": {"$nin": exclude_ids}}})

    pipeline.append({"$sample": {"size": limit}})

    docs = await collection.aggregate(pipeline).to_list(length=limit)

    # 안전을 위해 한 번 더 셔플(샘플 순서도 랜덤이긴 함)
    random.shuffle(docs)

    items = [_reshape_product(doc) for doc in docs]

    return {
        "items": items,
        "limit": limit,
        "count": len(items),
    }
