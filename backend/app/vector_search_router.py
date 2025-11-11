#!/usr/bin/env python3
"""
벡터 검색 라우터
RAG 기반 시맨틱 검색 및 하이브리드 검색 엔드포인트 제공
"""

from __future__ import annotations

import math
import json
from typing import Any, Dict, List, Optional
import logging

from fastapi import APIRouter, Depends, Query, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from elasticsearch import AsyncElasticsearch
from pydantic import BaseModel
import boto3
from botocore.exceptions import ClientError

from .database import get_db
from .search_client import get_search_client, get_index_name
from .product_router import _reshape_product, _safe_int, _normalise_list, _build_es_filters, ES_SORT_MAP

# 로깅 설정
logger = logging.getLogger(__name__)

# 벡터 검색 라우터
router = APIRouter(prefix="/products/vector", tags=["vector_search"])

# 설정
VECTOR_INDEX = "products_v2_vector"
EMBEDDING_DIMENSION = 1024  # Bedrock Titan V2 기본 차원
TITAN_MODEL_ID = "amazon.titan-embed-text-v2:0"
MAX_TEXT_LENGTH = 8000


class VectorSearchRequest(BaseModel):
    """벡터 검색 요청 모델"""
    query: str
    search_type: str = "hybrid"  # "vector", "hybrid", "keyword"
    category: Optional[str] = None
    category2: Optional[str] = None
    brands: Optional[str] = None
    min_price: int = 0
    max_price: int = 1_000_000_000
    sort: str = "relevance"
    page: int = 1
    limit: int = 20
    vector_weight: float = 0.5  # 하이브리드 검색에서 벡터 가중치
    k: int = 50  # KNN 검색에서 후보 개수


class BedrockEmbeddingService:
    """Bedrock Titan 임베딩 서비스"""

    def __init__(self, region_name: str = "ap-northeast-2"):
        self.bedrock = boto3.client(
            service_name='bedrock-runtime',
            region_name=region_name
        )
        self.model_id = TITAN_MODEL_ID

    def create_embedding(self, text: str) -> Optional[List[float]]:
        """텍스트를 벡터로 변환"""
        try:
            # 텍스트 길이 제한
            if len(text) > MAX_TEXT_LENGTH:
                text = text[:MAX_TEXT_LENGTH]

            # Bedrock API 호출 (Titan V2는 기본 1024 차원 사용)
            body = json.dumps({
                "inputText": text
                # dimensions 파라미터 제거 - Titan V2는 항상 1024 차원 반환
            })

            response = self.bedrock.invoke_model(
                body=body,
                modelId=self.model_id,
                accept='application/json',
                contentType='application/json'
            )

            response_body = json.loads(response['body'].read())
            embedding = response_body.get('embedding')

            if embedding and len(embedding) == EMBEDDING_DIMENSION:
                return embedding
            else:
                logger.error(f"Invalid embedding dimension: {len(embedding) if embedding else 0}")
                return None

        except ClientError as e:
            logger.error(f"Bedrock API error: {e}")
            return None
        except Exception as e:
            logger.error(f"Embedding creation failed: {e}")
            return None


# 전역 임베딩 서비스 인스턴스
embedding_service = BedrockEmbeddingService()


def build_vector_query(
    query_vector: List[float],
    filters: List[Dict[str, Any]],
    k: int = 50,
    num_candidates: int = 100
) -> Dict[str, Any]:
    """벡터 검색 쿼리 생성"""

    knn_query = {
        "field": "embedding",
        "query_vector": query_vector,
        "k": k,
        "num_candidates": max(num_candidates, k * 2),
    }

    if filters:
        knn_query["filter"] = {"bool": {"filter": filters}}

    return {"knn": knn_query}


def build_hybrid_query(
    query_text: str,
    query_vector: List[float],
    filters: List[Dict[str, Any]],
    vector_weight: float = 0.5,
    k: int = 50
) -> Dict[str, Any]:
    """하이브리드 검색 쿼리 생성 (벡터 + 키워드)"""

    # KNN 벡터 검색
    knn_query = {
        "field": "embedding",
        "query_vector": query_vector,
        "k": k,
        "num_candidates": k * 2,
    }

    # BM25 키워드 검색
    keyword_query = {
        "bool": {
            "should": [
                # 텍스트 필드 검색
                {
                    "multi_match": {
                        "query": query_text,
                        "fields": [
                            "name^3",
                            "brand^2",
                            "category_full^2",
                            "tags^2",
                            "description_summary^1",
                            "text_content^1"
                        ],
                        "type": "best_fields",
                        "operator": "or",
                        "fuzziness": "AUTO"
                    }
                },
                # 정확한 phrase 매칭
                {
                    "match_phrase": {
                        "text_content": {
                            "query": query_text,
                            "boost": 2
                        }
                    }
                }
            ],
            "minimum_should_match": 1,
            "filter": filters
        }
    }

    # 하이브리드 쿼리 결합
    return {
        "knn": knn_query,
        "query": keyword_query,
        # 가중치를 통한 스코어 결합
        "rank": {
            "rrf": {
                "window_size": 100,
                "rank_constant": 20
            }
        }
    }


def build_keyword_query(
    query_text: str,
    filters: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """키워드 전용 검색 쿼리"""

    return {
        "query": {
            "bool": {
                "must": [
                    {
                        "multi_match": {
                            "query": query_text,
                            "fields": [
                                "name^3",
                                "brand^2",
                                "category_full^2",
                                "tags^2",
                                "description_summary^1",
                                "text_content^1"
                            ],
                            "type": "best_fields",
                            "operator": "or",
                            "fuzziness": "AUTO"
                        }
                    }
                ],
                "filter": filters
            }
        }
    }


@router.post("/search")
async def vector_search(
    request: VectorSearchRequest,
    es: Elasticsearch = Depends(get_search_client)
):
    """벡터 기반 검색 엔드포인트"""

    # 필터 생성
    brand_list = _normalise_list(request.brands)
    filters = _build_es_filters(
        request.category,
        request.category2,
        brand_list,
        request.min_price,
        request.max_price
    )

    # 쿼리 타입에 따른 처리
    if request.search_type in ["vector", "hybrid"]:
        # 쿼리 텍스트 임베딩 생성
        query_embedding = await run_in_threadpool(
            lambda: embedding_service.create_embedding(request.query)
        )

        if not query_embedding:
            raise HTTPException(
                status_code=500,
                detail="임베딩 생성에 실패했습니다."
            )

        if request.search_type == "vector":
            # 순수 벡터 검색
            body = build_vector_query(
                query_embedding,
                filters,
                request.k
            )
        else:
            # 하이브리드 검색
            body = build_hybrid_query(
                request.query,
                query_embedding,
                filters,
                request.vector_weight,
                request.k
            )
    else:
        # 키워드 검색
        body = build_keyword_query(request.query, filters)

    # 정렬 및 페이징 추가
    es_sort = ES_SORT_MAP.get(request.sort, ES_SORT_MAP["relevance"])

    # 최종 쿼리 구성
    if "query" not in body:
        body["query"] = {"match_all": {}}

    body.update({
        "from": (request.page - 1) * request.limit,
        "size": request.limit,
        "sort": es_sort,
        "_source": [
            "product_id", "name", "brand", "price",
            "rating", "review_count", "image_url",
            "category_path", "description_summary",
            "seller_name", "tags"
        ],
        "aggs": {
            "brands": {"terms": {"field": "brand", "size": 20}},
            "categories": {"terms": {"field": "category_path", "size": 20}},
            "price_ranges": {
                "range": {
                    "field": "price",
                    "ranges": [
                        {"to": 10000},
                        {"from": 10000, "to": 50000},
                        {"from": 50000, "to": 100000},
                        {"from": 100000},
                    ],
                }
            },
        }
    })

    # Elasticsearch 검색 실행
    try:
        res = await es.search(index=VECTOR_INDEX, body=body)
    except Exception as e:
        logger.error(f"Elasticsearch search error: {e}")
        raise HTTPException(
            status_code=500,
            detail="검색 중 오류가 발생했습니다."
        )

    # 결과 포맷팅
    total = res["hits"]["total"]["value"]
    items = []

    for hit in res["hits"]["hits"]:
        source = hit["_source"]
        item = {
            "id": source.get("product_id", ""),
            "name": source.get("name", ""),
            "price": source.get("price", 0),
            "image": source.get("image_url", ""),
            "category": " > ".join(source.get("category_path", [])),
            "brand": source.get("brand", ""),
            "rating": source.get("rating", 0),
            "reviewCount": source.get("review_count", 0),
            "description": source.get("description_summary", ""),
            "seller": source.get("seller_name", ""),
            "tags": source.get("tags", []),
            "score": hit.get("_score", 0),  # 관련도 점수
            "searchType": request.search_type
        }
        items.append(item)

    return {
        "items": items,
        "page": request.page,
        "limit": request.limit,
        "total": total,
        "totalPages": math.ceil(total / request.limit) if request.limit > 0 else 0,
        "aggregations": res.get("aggregations", {}),
        "searchType": request.search_type,
        "query": request.query
    }


@router.get("/similar/{product_id}")
async def find_similar_products(
    product_id: str,
    limit: int = Query(10, ge=1, le=50),
    es: Elasticsearch = Depends(get_search_client),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """유사 상품 찾기 (벡터 기반)"""

    # 1. 원본 상품의 벡터 조회
    try:
        # Elasticsearch에서 벡터 조회
        doc = await run_in_threadpool(
            lambda: es.get(index=VECTOR_INDEX, id=product_id)
        )

        if not doc or "_source" not in doc:
            raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다.")

        source = doc["_source"]
        product_vector = source.get("embedding")

        if not product_vector:
            raise HTTPException(
                status_code=400,
                detail="이 상품은 벡터 임베딩이 없습니다."
            )

    except Exception as e:
        logger.error(f"Product vector fetch error: {e}")
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다.")

    # 2. KNN 검색으로 유사 상품 찾기
    body = {
        "knn": {
            "field": "embedding",
            "query_vector": product_vector,
            "k": limit + 1,  # 자기 자신 포함
            "num_candidates": (limit + 1) * 2
        },
        "_source": [
            "product_id", "name", "brand", "price",
            "rating", "review_count", "image_url",
            "category_path", "description_summary"
        ]
    }

    try:
        res = await es.search(index=VECTOR_INDEX, body=body)
    except Exception as e:
        logger.error(f"Similar products search error: {e}")
        raise HTTPException(
            status_code=500,
            detail="유사 상품 검색 중 오류가 발생했습니다."
        )

    # 3. 결과 포맷팅 (자기 자신 제외)
    items = []
    for hit in res["hits"]["hits"]:
        if hit["_id"] == product_id:
            continue  # 자기 자신 제외

        source = hit["_source"]
        item = {
            "id": source.get("product_id", ""),
            "name": source.get("name", ""),
            "price": source.get("price", 0),
            "image": source.get("image_url", ""),
            "category": " > ".join(source.get("category_path", [])),
            "brand": source.get("brand", ""),
            "rating": source.get("rating", 0),
            "reviewCount": source.get("review_count", 0),
            "description": source.get("description_summary", ""),
            "similarity": hit.get("_score", 0)  # 유사도 점수
        }
        items.append(item)

        if len(items) >= limit:
            break

    return {
        "originalProductId": product_id,
        "originalProductName": source.get("name", ""),
        "similarProducts": items,
        "count": len(items)
    }


@router.post("/test-embedding")
async def test_embedding(text: str = Query(..., description="텍스트 입력")):
    """임베딩 테스트 엔드포인트"""

    embedding = await run_in_threadpool(
        lambda: embedding_service.create_embedding(text)
    )

    if not embedding:
        raise HTTPException(
            status_code=500,
            detail="임베딩 생성에 실패했습니다."
        )

    return {
        "text": text,
        "embedding_dimension": len(embedding),
        "embedding_sample": embedding[:10],  # 처음 10개 값만
        "model": TITAN_MODEL_ID
    }