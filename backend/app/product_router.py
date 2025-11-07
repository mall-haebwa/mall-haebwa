from __future__ import annotations

import math
from typing import Any

from fastapi import APIRouter, Depends, Query, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from .database import get_db

from bson import ObjectId

from elasticsearch import Elasticsearch
from .search_client import get_search_client, get_index_name
from fastapi.concurrency import run_in_threadpool


# /products 네임스페이스 아래 상품 관련 엔드포인트를 제공하는 FastAPI 라우터.
router = APIRouter(prefix="/products", tags=["products"])


def _build_es_filters(category, category2, brand_list, min_price, max_price):
    filters = [{"range": {"numericPrice": {"gte": min_price, "lte": max_price}}}]
    if category and category != "all":
        filters.append({"term": {"category1": category}})
    if category2:
        filters.append({"term": {"category2": category2}})
    if brand_list:
        filters.append({"terms": {"brand": brand_list}})
    return filters


ES_SORT_MAP = {
    "relevance": [{"rank": "asc"}],  # 검색 결과를 rank 순으로 정렬 (네이버 순위 높은 순)
    "price-low": [{"numericPrice": "asc"}, {"_score": "desc"}],
    "price-high": [{"numericPrice": "desc"}, {"_score": "desc"}],
    "rating": [{"rating": "desc"}, {"reviewCount": "desc"}],
    "latest": [{"updated_at": "desc"}, {"created_at": "desc"}],
    "popular": [{"reviewCount": "desc"}, {"_score": "desc"}],
}


def _safe_int(value: Any, default: int = 0) -> int:
    """안전하게 정수로 변환하고 실패 시 기본값을 반환한다."""
    try:
        if value is None:
            # None 또는 유사 값은 즉시 기본값을 돌려준다.
            return default
        if isinstance(value, (int, float)):
            # 이미 숫자형이면 바로 정수로 변환한다.
            return int(value)
        value_str = str(value).replace(",", "").strip()
        if not value_str:
            # 공백 문자열은 기본값을 사용한다.
            return default
        return int(value_str)
    except (TypeError, ValueError):
        # 변환 중 예외가 생기면 기본값을 반환한다.
        return default


def _normalise_list(raw: str | None) -> list[str]:
    """콤마로 구분된 문자열을 깔끔한 토큰 리스트로 변환한다."""
    if not raw:
        return []
    # 콤마 기준으로 나누고 항목마다 공백을 제거한다.
    return [item.strip() for item in raw.split(",") if item.strip()]


def _reshape_product(doc: dict[str, Any]) -> dict[str, Any]:
    """Mongo 문서를 UI에서 쓰기 좋은 딕셔너리 형태로 변환한다."""
    # 가격 정보는 항상 숫자로 변환한다.
    price = _safe_int(doc.get("numericPrice", doc.get("lprice")), 0)
    original_price = _safe_int(doc.get("hprice"), 0)
    if original_price <= 0:
        original_price = None

    # 리뷰 관련 값들을 기본값과 함께 정리한다.
    review_count = _safe_int(
        doc.get("reviewCount", doc.get("review_count", doc.get("comment_count"))), 0)
    rating_value = doc.get("rating", doc.get("score"))
    rating = float(rating_value) if isinstance(
        rating_value, (int, float)) else _safe_int(rating_value, 0)
    try:
        rating = float(rating)
    except (TypeError, ValueError):
        rating = 0.0

    # 설명 및 목록형 메타데이터를 리스트 형태로 맞춘다.
    description = doc.get("description") or doc.get("summary") or ""
    images = doc.get("images")
    if not isinstance(images, list):
        images = []
    colors = doc.get("colors")
    if not isinstance(colors, list):
        colors = []
    sizes = doc.get("sizes")
    if not isinstance(sizes, list):
        sizes = []

    stock = _safe_int(doc.get("stock"), 0)

    created_at = doc.get("updated_at") or doc.get("created_at")
    if created_at is None and "_id" in doc:
        created_at = str(doc["_id"])

    # 프론트에서 사용하는 최종 형태의 데이터로 조립한다.
    raw_id = doc.get("_id") or doc.get(
        "mongoId") or doc.get("mongo_id") or doc.get("id")

    return {
        "id": str(raw_id) if raw_id is not None else "",
        "name": doc.get("title") or doc.get("name") or "",
        "price": price,
        "originalPrice": original_price,
        "image": doc.get("image") or "",
        "category": doc.get("category1") or doc.get("category") or "Misc",
        "brand": doc.get("brand") or doc.get("maker") or "",
        "rating": rating,
        "reviewCount": review_count,
        "description": description,
        "images": images,
        "colors": colors,
        "sizes": sizes,
        "stock": stock,
        "createdAt": created_at,
    }


@router.get("/search")
async def search_products(
    # 헤더 입력에서 전달되는 검색어.
    q: str | None = Query(None, description="Search keyword"),
    # 선택적으로 전달되는 필터들.
    category: str | None = Query(None, description="Category"),
    category2: str | None = Query(None, description="Category 2"),
    brands: str | None = Query(None, description="Comma separated brand list"),
    minPrice: int = Query(0, ge=0, alias="minPrice"),
    maxPrice: int = Query(1_000_000_000, ge=0, alias="maxPrice"),
    sort: str = Query("relevance"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=60),
    es: Elasticsearch = Depends(get_search_client)
):
    brand_list = _normalise_list(brands)
    filters = _build_es_filters(
        category, category2, brand_list, minPrice, maxPrice)
    must_queries: list[dict[str, Any]] = []

    if q:
        # 검색어의 모든 단어가 반드시 포함되어야 함 (필수 조건)
        must_queries.append({
            "multi_match": {
                "query": q,
                "fields": ["title", "summary", "tags", "brand"],
                "operator": "and",  # 모든 검색어 단어가 반드시 포함
                "type": "cross_fields",
            }
        })

        # 점수 향상을 위한 추가 매칭 (선택 조건)
        must_queries.append({
            "bool": {
                "should": [
                    # 1. 제목 정확한 phrase 매칭 (띄어쓰기 포함하여 정확히 일치) - 최우선
                    {"match_phrase": {
                        "title": {
                            "query": q,
                            "boost": 20,
                            "slop": 0,
                        }
                    }},
                    # 2. 제목에서 모든 검색어 단어 포함 (순서 무관)
                    {"match": {
                        "title": {
                            "query": q,
                            "operator": "and",
                            "boost": 10,
                        }
                    }},
                    # 3. search_keyword exact match
                    {"term": {"search_keyword": {"value": q, "boost": 8}}},
                    # 4. 일반 텍스트 검색
                    {"multi_match": {
                        "query": q,
                        "fields": ["title^2", "summary", "tags^1.5"],
                        "type": "best_fields",
                    }},
                ],
                "minimum_should_match": 1
            }
        })

    bool_query: dict[str, Any] = {"filter": filters}
    if must_queries:
        bool_query["must"] = must_queries
    else:
        bool_query["must"] = [{"match_all": {}}]

    # 정렬 방식
    es_sort = ES_SORT_MAP.get(sort, ES_SORT_MAP["relevance"])

    body = {
        "query": {
            "function_score": {
                "query": {"bool": bool_query},
                "functions": [
                    {"field_value_factor": {"field": "reviewCount",
                                            "missing": 0, "factor": 0.001, "modifier": "log1p"}},
                    {"field_value_factor": {"field": "rating",
                                            "missing": 0, "factor": 0.1}},
                ],
                "score_mode": "sum",
                "boost_mode": "sum",  # multiply에서 sum으로 변경 - 검색 관련도 우선
            }
        },
        "from": (page - 1) * limit,
        "size": limit,
        "sort": es_sort,
        "aggs": {
            "brands": {"terms": {"field": "brand.keyword", "size": 20}},
            "price_ranges": {
                "range": {
                    "field": "numericPrice",
                    "ranges": [
                        {"to": 10000},
                        {"from": 10000, "to": 50000},
                        {"from": 50000, "to": 100000},
                        {"from": 100000},
                    ],
                }
            },
        },
    }

    res = await run_in_threadpool(lambda: es.search(index=get_index_name(), body=body))
    total = res["hits"]["total"]["value"]
    items = [_reshape_product(hit["_source"]) for hit in res["hits"]["hits"]]

    return {
        "items": items,
        "page": page,
        "limit": limit,
        "total": total,
        "totalPages": math.ceil(total / limit),
        "aggregations": res.get("aggregations", {}),
    }


@router.get("/{product_id}")
async def get_product_detail(
    product_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        obj_id = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="잘못된 상품 ID입니다.")

    doc = await db["products"].find_one({"_id": obj_id})
    if not doc:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다.")

    return _reshape_product(doc)
