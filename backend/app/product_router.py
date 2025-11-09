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
    # 검색어로 찾은 상품 중에서 카테고리, 브랜드, 가격 범위 등을 기준으로 걸러내기 위한 조건 생성기
    filters = [{"range": {"numericPrice": {"gte": min_price, "lte": max_price}}}]
    if category and category != "all":
        filters.append({"term": {"category1": category}})
    if category2:
        filters.append({"term": {"category2": category2}})
    if brand_list:
        filters.append({"terms": {"brand": brand_list}})
    return filters


ES_SORT_MAP = {
    # 검색 결과를 어떤 순서로 정렬할지 결정하는 정렬 테이블
    "relevance": [{"_score": "desc"}, {"rank": "asc"}],
    "price-low": [{"numericPrice": "asc"}, {"_score": "desc"}, {"rank": "asc"}],
    "price-high": [{"numericPrice": "desc"}, {"_score": "desc"}, {"rank": "asc"}],
    "rating": [{"rating": "desc"}, {"reviewCount": "desc"}, {"_score": "desc"}, {"rank": "asc"}],
    "latest": [{"updated_at": "desc"}, {"created_at": "desc"}, {"_score": "desc"}, {"rank": "asc"}],
    "popular": [{"reviewCount": "desc"}, {"_score": "desc"}, {"rank": "asc"}],
}
# 앞에 았을수록 우선 적용
# _score desc: 엘라스틱서치의 BM25 + analyzer 검색 점수 기반 정렬
# rank asc: 네이버 쇼핑 순위 정렬


def _safe_int(value: Any, default: int = 0) -> int:
    """안전하게 정수로 변환하고 실패 시 기본값을 반환한다."""
    # 혹시라도 숫자가 문자열로 들어올 것을 대비하는 함수
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
# 혹시라도 " 애플, 삼성 " 이렇게 들어올 경우 ["애플", "삼성"] 으로 분리


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
    q: str | None = Query(None, description="Search keyword"), # 검색어
    # 선택적으로 전달되는 필터들.
    category: str | None = Query(None, description="Category"), # 카테고리 필터
    category2: str | None = Query(None, description="Category 2"), # 카테고리 필터
    brands: str | None = Query(None, description="Comma separated brand list"), 
    minPrice: int = Query(0, ge=0, alias="minPrice"),
    maxPrice: int = Query(1_000_000_000, ge=0, alias="maxPrice"),
    sort: str = Query("relevance"), # 정렬 방식 선택
    page: int = Query(1, ge=1), # 페이지네이션
    limit: int = Query(20, ge=1, le=60), # 페이지네이션
    es: Elasticsearch = Depends(get_search_client)
):
    # 이건 필터링 조건
    brand_list = _normalise_list(brands)
    filters = _build_es_filters(
        category, category2, brand_list, minPrice, maxPrice)
    must_queries: list[dict[str, Any]] = []

    if q:
        # 검색어의 모든 단어가 반드시 포함되어야 함 (필수 조건)
        # 정확한 매칭 또는 오타 허용 매칭 중 하나만 만족하면 됨
        must_queries.append({
            "bool": {
                "should": [
                    # 1) 정확한 매칭 (cross_fields)
                    {
                        "multi_match": {
                            "query": q,
                            "fields": [
                                "category1^6",      # 카테고리 (최우선)
                                "category2^6",
                                "category3^6",
                                "category4^6",
                                "tags^3",           # 태그
                                "title.nori^2",     # 타이틀 (낮춤)
                                "title.ngram^1",
                                "summary^1",
                                "brand^1"
                            ],
                            "operator": "and",
                            "type": "cross_fields",
                        }
                    },
                    # 2) 오타 허용 매칭 (best_fields + fuzziness)
                    {
                        "multi_match": {
                            "query": q,
                            "fields": [
                                "category1^6",
                                "category2^6",
                                "category3^6",
                                "category4^6",
                                "tags^3",
                                "title.nori^2",
                                "summary^1",
                                "brand^1"
                            ],
                            "operator": "and",
                            "type": "best_fields",
                            "fuzziness": "AUTO",
                            "prefix_length": 1,
                        }
                    }
                ],
                "minimum_should_match": 1
            }
        })

        # 점수 향상을 위한 추가 매칭 (선택 조건)
        must_queries.append({
            "bool": {
                "should": [
                    # 1. search_keyword 정확 매칭 (최우선)
                    # "한우 국거리" 검색어와 정확히 일치
                    {"term": {"search_keyword": {"value": q, "boost": 25}}},

                    # 2. 카테고리 정확 매칭
                    {"term": {"category1": {"value": q, "boost": 20}}},
                    {"term": {"category2": {"value": q, "boost": 20}}},
                    {"term": {"category3": {"value": q, "boost": 20}}},
                    {"term": {"category4": {"value": q, "boost": 20}}},

                    # 3. 제목 정확한 phrase 매칭 (띄어쓰기 포함하여 정확히 일치)
                    # "한우 국거리" 로 완벽하게 맞도록
                    {"match_phrase": {
                        "title.nori": {
                            "query": q,
                            "boost": 15,
                            "slop": 0,
                        }
                    }},

                    # 4. 제목에서 모든 검색어 단어 포함 (순서 무관)
                    # "국거리 한우"도 가능
                    {"match": {
                        "title.nori": {
                            "query": q,
                            "operator": "and",
                            "boost": 8,
                        }
                    }},

                    # 5. 일반 텍스트 검색
                    {"multi_match": {
                        "query": q,
                        "fields": ["tags^3", "title^2", "summary^1"],
                        "type": "best_fields",
                    }},
                ],
                "minimum_should_match": 1
            }
        })

    bool_query: dict[str, Any] = {"filter": filters}
    # filter = 검색 범위 제한 (점수 변화 x)
    # must = 검색 정확도 계산 (점수 변화 o)
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
                    # 리뷰 개수 반영: log1p(reviewCount) * 0.001
                    # 예) 100개 리뷰 → log1p(100) * 0.001 ≈ 0.0046점 추가
                    {"field_value_factor": {"field": "reviewCount",
                                            "missing": 0, "factor": 0.001, "modifier": "log1p"}},
                    # 평점 반영: rating * 0.1
                    # 예) 4.5점 → 4.5 * 0.1 = 0.45점 추가
                    {"field_value_factor": {"field": "rating",
                                            "missing": 0, "factor": 0.1}},
                    # 네이버 순위 반영: rank가 낮을수록(순위 높을수록) 점수 높임
                    # rank 1 → 10/(1+1) = 5점 추가
                    # rank 10 → 10/(10+1) ≈ 0.9점 추가
                    # rank 999 → 10/(999+1) ≈ 0.01점 추가
                    {"script_score": {
                        "script": {
                            "source": "10.0 / (doc['rank'].value + 1)"
                        }
                    }},
                ],
                "score_mode": "sum",      # 여러 함수 점수를 더함
                "boost_mode": "sum",      # 검색 점수 + 인기도 점수 (검색 관련도 우선)
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
