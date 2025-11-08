"""상품 Service (Elasticsearch 기반)"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from elasticsearch import Elasticsearch
from typing import List, Any
from fastapi.concurrency import run_in_threadpool
import asyncio

# product_router의 헬퍼 함수들 임포트
from app.product_router import (
    _build_es_filters,
    _reshape_product,
    ES_SORT_MAP,
    _normalise_list
)
from app.search_client import get_index_name

class ProductService:
    def __init__(self, db: AsyncIOMotorDatabase, es: Elasticsearch):
        self.db = db
        self.es = es

    async def search(
        self,
        query: str = "",
        category: str = None,
        brand: str = None,
        sort: str = "relevance",
        page: int = 1,
        limit: int = 20
    ) -> dict:
        """
        상품 검색 (기존 product_router 로직 복사)
        
        Returns:
            {"items": [...], "total": 100}
        """
        # 필터 구성
        filters = _build_es_filters(
            category=category,
            category2=None,
            brand_list=[brand] if brand else [],
            min_price=0,
            max_price=1_000_000_000
        )

        must_queries: List[dict[str, Any]] = []

        if query:
            must_queries.append({
                "multi_match": {
                    "query": query,
                    "fields": ["title", "summary", "tags", "brand"],
                    "operator": "and",
                    "type": "cross_fields",
                }
            })

            must_queries.append({
                "bool": {
                    "should": [
                        {"match_phrase": {"title": {"query": query, "boost": 20, "slop": 0}}},
                        {"match": {"title": {"query": query, "operator": "and", "boost": 10}}},
                        {"term": {"search_keyword": {"value": query, "boost": 8}}},
                    ],
                    "minimum_should_match": 1
                }
            })

        bool_query: dict[str, Any] = {"filter": filters}
        if must_queries:
            bool_query["must"] = must_queries
        else:
            bool_query["must"] = [{"match_all": {}}]

        # 정렬
        es_sort = ES_SORT_MAP.get(sort, ES_SORT_MAP["relevance"])

        # 쿼리 바디
        body = {
            "query": {
                "function_score": {
                    "query": {"bool": bool_query},
                    "functions": [
                        {"field_value_factor": {"field": "reviewCount", "missing": 0, "factor": 0.001, "modifier": "log1p"}},
                        {"field_value_factor": {"field": "rating", "missing": 0, "factor": 0.1}},
                    ],
                    "score_mode": "sum",
                    "boost_mode": "sum",
                }
            },
            "from": (page - 1) * limit,
            "size": limit,
            "sort": es_sort,
        }

        # ES 검색 (동기 함수를 비동기로)
        res = await run_in_threadpool(
            lambda: self.es.search(index=get_index_name(), body=body)
        )

        total = res["hits"]["total"]["value"]
        items = [_reshape_product(hit["_source"]) for hit in res["hits"]["hits"]]

        return {
            "items": items,
            "total": total
        }

    async def multi_search(self, queries: List[str], limit: int = 20) -> dict:
        """
        다중 검색 (MULTISEARCH용)
        
        Returns:
            {"김치": [상품들], "두부": [상품들]}
        """
        results = await asyncio.gather(
            *[self.search(query=q, limit=limit) for q in queries]
        )

        return {
            queries[i]: results[i]["items"]
            for i in range(len(queries))
        }
