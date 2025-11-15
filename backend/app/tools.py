"""쇼핑몰 Tool 정의 및 Handler 구현"""
from typing import Dict, Any, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from elasticsearch import AsyncElasticsearch
from bson import ObjectId
from datetime import datetime, timedelta
import logging
import functools
import asyncio
import boto3
import json
from fastapi.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)


# ============================================
# 인증 데코레이터
# ============================================

def requires_authentication(func):
    """
    인증이 필요한 Tool에 적용하는 데코레이터
    user_id가 None이면 에러 응답 반환
    """
    @functools.wraps(func)
    async def wrapper(self, user_id: str, *args, **kwargs):
        if not user_id:
            logger.warning(f"[Tool] {func.__name__}: authentication required")
            return {
                "error": "로그인이 필요합니다. 우측 상단에서 로그인해주세요.",
            }
        return await func(self, user_id, *args, **kwargs)
    return wrapper

# 인증이 필요한 Tool 목록 (별도 관리)


TOOL_AUTH_REQUIRED = {
    "get_cart",
    "get_orders",
    "search_orders_by_product",
    "add_to_cart",
    "add_multiple_to_cart",
    "add_recommended_to_cart",
    "add_from_recent_search",
    "get_order_detail",
    "get_wishlist",
    "get_recently_viewed"
}


# ============================================
# Bedrock Tool 정의 (JSON Schema)
# ============================================

SHOPPING_TOOLS = [
    {
        "toolSpec": {
            "name": "search_products",
            "description": "단일 상품을 검색합니다. 사용자가 특정 상품 하나를 찾고 싶을 때 사용하세요.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "검색할 상품명 또는 키워드 (예: 노트북, 청바지)"
                        },
                        "category": {
                            "type": "string",
                            "description": "카테고리 필터 (선택)"
                        },
                        "min_price": {
                            "type": "number",
                            "description": "최소 가격 (선택)"
                        },
                        "max_price": {
                            "type": "number",
                            "description": "최대 가격 (선택)"
                        },
                        "limit": {
                            "type": "number",
                            "description": "최대 결과 개수 (기본: 10)"
                        }
                    },
                    "required": ["query"]
                }
            }
        }
    },
    {
        "toolSpec": {
            "name": "multi_search_products",
            "description": "여러 상품을 동시에 검색합니다. '김치찌개 재료', '파티 준비물'처럼 여러 카테고리의 상품이 필요할 때 사용하세요.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "queries": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "검색할 상품 목록 (예: ['김치', '돼지고기', '두부'])"
                        },
                        "main_query": {
                            "type": "string",
                            "description": "원래 사용자 요청 (예: '김치찌개 재료')"
                        }
                    },
                    "required": ["queries", "main_query"]
                }
            }
        }
    },
    {
        "toolSpec": {
            "name": "get_cart",
            "description": "사용자의 장바구니를 조회합니다. **로그인 필요**",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        },
    },
    {
        "toolSpec": {
            "name": "get_orders",
            "description": "사용자의 주문 내역을 조회합니다. **로그인 필요**",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "limit": {
                            "type": "number",
                            "description": "최대 결과 개수 (기본: 10)"
                        }
                    },
                    "required": []
                }
            }
        },
    },
    {
        "toolSpec": {
            "name": "search_orders_by_product",
            "description": "과거 주문을 검색합니다. **로그인 필요**. 상품명, 연도, 가격 등으로 필터링 가능합니다.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "product_keyword": {
                            "type": "string",
                            "description": "검색할 상품 키워드 (선택). 비어있으면 모든 상품 검색. 예: 닭가슴살, 신발, 노트북"
                        },
                        "days_ago": {
                            "type": "number",
                            "description": "며칠 전까지 검색할지 (예: 7=지난주, 30=지난달, 365=작년). year와 함께 사용 불가"
                        },
                        "year": {
                            "type": "number",
                            "description": "특정 연도의 주문만 검색 (예: 2024, 2025). days_ago와 함께 사용 불가"
                        },
                        "min_price": {
                            "type": "number",
                            "description": "최소 주문 금액 (선택). 예: 30000"
                        },
                        "max_price": {
                            "type": "number",
                            "description": "최대 주문 금액 (선택). 예: 50000"
                        },
                        "limit": {
                            "type": "number",
                            "description": "최대 결과 개수 (기본: 5)"
                        }
                    },
                    "required": []
                }
            }
        },
    },
    {
        "toolSpec": {
            "name": "add_to_cart",
            "description": "상품을 장바구니에 추가합니다. **로그인 필요**. 재주문 시에는 search_orders_by_product 결과의 matched_item 정보를 사용하세요.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "product_id": {
                            "type": "string",
                            "description": "추가할 상품 ID"
                        },
                        "quantity": {
                            "type": "number",
                            "description": "수량 (기본: 1)"
                        },
                        "price": {
                            "type": "number",
                            "description": "상품 가격 (선택). 재주문 시 matched_item.price 사용"
                        },
                        "product_name": {
                            "type": "string",
                            "description": "상품명 (선택). 재주문 시 matched_item.product_name 사용"
                        },
                        "image_url": {
                            "type": "string",
                            "description": "상품 이미지 URL (선택). 재주문 시 matched_item.image_url 사용"
                        }
                    },
                    "required": ["product_id"]
                }
            }
        },
    },
    {
        "toolSpec": {
            "name": "add_multiple_to_cart",
            "description": "여러 상품을 한번에 장바구니에 추가합니다. **로그인 필요**. product_id를 직접 알고 있을 때 사용합니다.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "products": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "product_id": {
                                        "type": "string",
                                        "description": "상품 ID"
                                    },
                                    "quantity": {
                                        "type": "number",
                                        "description": "수량 (기본: 1)"
                                    }
                                },
                                "required": ["product_id"]
                            },
                            "description": "추가할 상품 목록"
                        }
                    },
                    "required": ["products"]
                }
            }
        },
    },
    {
        "toolSpec": {
            "name": "add_recommended_to_cart",
            "description": "최근 multi_search로 찾은 추천 상품들을 장바구니에 담습니다. **로그인 필요**. '추천 상품들 담아줘', '전부 담아줘' 같은 요청에 반드시 이 tool을 사용하세요. multi_search_products 실행 후에만 사용 가능합니다.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        },
    },
    {
        "toolSpec": {
            "name": "get_order_detail",
            "description": "특정 주문의 상세 정보와 배송 현황을 조회합니다. **로그인 필요**",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "order_id": {
                            "type": "string",
                            "description": "조회할 주문 ID"
                        }
                    },
                    "required": ["order_id"]
                }
            }
        },
    },
    {
        "toolSpec": {
            "name": "get_wishlist",
            "description": "사용자의 찜 목록을 조회합니다. **로그인 필요**. 상품명 외에는 다른 정보 나열하지 마세요.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        },
    },
    {
        "toolSpec": {
            "name": "get_recently_viewed",
            "description": "사용자가 최근에 본 상품 목록을 조회합니다. **로그인 필요**. '지난번에 봤던 상품', '최근 본 상품' 등의 요청에 사용하세요.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "limit": {
                            "type": "number",
                            "description": "최대 결과 개수 (기본: 10)"
                        }
                    },
                    "required": []
                }
            }
        },
    },
    {
        "toolSpec": {
            "name": "semantic_search",
            "description": "의미 기반 검색으로 상품을 찾습니다. **다음과 같은 경우에 반드시 사용하세요**: (1) '비슷한 제품', '유사한 상품', '추천' 같은 요청, (2) '편안한 집에서 입는 옷', '여름에 시원한 음료' 같은 의미적 표현, (3) 이전 대화에서 언급된 상품과 비슷한 제품 찾기. 키워드 검색(search_products)보다 의미적 유사성 기반으로 더 정확한 추천이 가능합니다.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "의미 기반 검색 쿼리 (예: '편안한 집에서 입는 옷', '여름에 시원한 음료', '더치커피와 비슷한 콜드브루')"
                        },
                        "category": {
                            "type": "string",
                            "description": "카테고리 필터 (선택)"
                        },
                        "min_price": {
                            "type": "number",
                            "description": "최소 가격 (선택)"
                        },
                        "max_price": {
                            "type": "number",
                            "description": "최대 가격 (선택)"
                        },
                        "limit": {
                            "type": "number",
                            "description": "최대 결과 개수 (기본: 10)"
                        }
                    },
                    "required": ["query"]
                }
            }
        }
    },
    {
        "toolSpec": {
            "name": "add_from_recent_search",
            "description": "최근 검색 결과에서 특정 번호의 상품들을 장바구니에 담습니다. **로그인 필요**. 사용자가 '1번, 3번, 5번 담아줘' 또는 '첫 번째, 세 번째 상품 담아줘' 같이 번호로 지정할 때 사용하세요.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "indices": {
                            "type": "array",
                            "items": {"type": "number"},
                            "description": "담을 상품의 인덱스 (0부터 시작). 사용자가 '1번'이라고 하면 0, '3번'이라고 하면 2를 전달. 예: [0, 2, 4]는 1번, 3번, 5번 상품"
                        }
                    },
                    "required": ["indices"]
                }
            }
        }
    }
]


# ============================================
# Bedrock 임베딩 서비스
# ============================================

class BedrockEmbeddingService:
    """Bedrock Titan 임베딩 서비스"""

    def __init__(self, region_name: str = "ap-northeast-2"):
        self.bedrock = boto3.client(
            service_name='bedrock-runtime',
            region_name=region_name
        )
        self.model_id = "amazon.titan-embed-text-v2:0"
        self.max_text_length = 8192
        self.embedding_dimension = 1024  # Bedrock Titan V2 기본 차원

    def create_embedding(self, text: str) -> Optional[List[float]]:
        """텍스트를 벡터로 변환"""
        try:
            # 텍스트 길이 제한
            if len(text) > self.max_text_length:
                text = text[:self.max_text_length]

            # Bedrock API 호출 (dimensions 파라미터 제거 - 기본 1024 사용)
            body = json.dumps({
                "inputText": text
            })

            response = self.bedrock.invoke_model(
                body=body,
                modelId=self.model_id,
                accept='application/json',
                contentType='application/json'
            )

            response_body = json.loads(response['body'].read())
            embedding = response_body.get('embedding')

            if embedding and len(embedding) == self.embedding_dimension:
                return embedding
            else:
                logger.error(
                    f"Invalid embedding dimension: expected {self.embedding_dimension}, got {len(embedding) if embedding else 0}")
                return None

        except Exception as e:
            logger.error(f"Embedding creation failed: {e}")
            return None


# 전역 임베딩 서비스 인스턴스
embedding_service = BedrockEmbeddingService()


# ============================================
# Tool Handler 클래스
# ============================================

class ToolHandlers:
    """쇼핑몰 Tool 실행 핸들러"""

    def __init__(self, db: AsyncIOMotorDatabase, es: AsyncElasticsearch, redis_client=None, user_id: str = None, conversation_id: str = None):
        self.db = db
        self.es = es
        self.redis_client = redis_client
        self.user_id = user_id
        self.conversation_id = conversation_id

    async def search_products(
        self,
        query: str,
        category: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        limit: int = 10
    ) -> Dict[str, Any]:
        """상품 검색 Tool (일반 검색과 동일한 로직)"""
        try:
            logger.info(
                f"[Tool] search_products: query={query}, category={category}")

            # 필터 구성
            filter_clauses = []

            # 가격 필터
            price_min = min_price if min_price is not None else 0
            price_max = max_price if max_price is not None else 1_000_000_000
            filter_clauses.append(
                {"range": {"numericPrice": {"gte": price_min, "lte": price_max}}})

            # 카테고리 필터
            if category:
                filter_clauses.append({"term": {"category1": category}})

            # must 쿼리 구성 (product_router.py와 동일)
            must_queries = []

            if query:
                # 검색어의 모든 단어가 반드시 포함되어야 함 (필수 조건)
                must_queries.append({
                    "bool": {
                        "should": [
                            # 1) 정확한 매칭 (cross_fields)
                            {
                                "multi_match": {
                                    "query": query,
                                    "fields": [
                                        "category1^6",
                                        "category2^6",
                                        "category3^6",
                                        "category4^6",
                                        "tags^3",
                                        "title.nori^2",
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
                                    "query": query,
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
                            # 1. search_keyword 정확 매칭
                            {"term": {"search_keyword": {"value": query, "boost": 25}}},

                            # 2. 카테고리 정확 매칭
                            {"term": {"category1": {"value": query, "boost": 20}}},
                            {"term": {"category2": {"value": query, "boost": 20}}},
                            {"term": {"category3": {"value": query, "boost": 20}}},
                            {"term": {"category4": {"value": query, "boost": 20}}},

                            # 3. 제목 정확한 phrase 매칭
                            {"match_phrase": {
                                "title.nori": {
                                    "query": query,
                                    "boost": 15,
                                    "slop": 0,
                                }
                            }},

                            # 4. 제목에서 모든 검색어 단어 포함
                            {"match": {
                                "title.nori": {
                                    "query": query,
                                    "operator": "and",
                                    "boost": 8,
                                }
                            }},

                            # 5. 일반 텍스트 검색
                            {"multi_match": {
                                "query": query,
                                "fields": ["tags^3", "title^2", "summary^1"],
                                "type": "best_fields",
                            }},
                        ],
                        "minimum_should_match": 1
                    }
                })

            # Bool 쿼리 구성
            bool_query = {"filter": filter_clauses}
            if must_queries:
                bool_query["must"] = must_queries
            else:
                bool_query["must"] = [{"match_all": {}}]

            # function_score로 인기도 반영
            query_body = {
                "query": {
                    "function_score": {
                        "query": {"bool": bool_query},
                        "functions": [
                            # 리뷰 개수 반영
                            {"field_value_factor": {
                                "field": "reviewCount",
                                "missing": 0,
                                "factor": 0.001,
                                "modifier": "log1p"
                            }},
                            # 평점 반영
                            {"field_value_factor": {
                                "field": "rating",
                                "missing": 0,
                                "factor": 0.1
                            }},
                            # 네이버 순위 반영
                            {"script_score": {
                                "script": {
                                    "source": "10.0 / (doc['rank'].value + 1)"
                                }
                            }},
                        ],
                        "score_mode": "sum",
                        "boost_mode": "sum",
                    }
                },
                "size": min(limit, 50),
                "sort": [{"_score": "desc"}, {"rank": "asc"}]
            }

            # Elasticsearch 실행
            response = await self.es.search(index="products", body=query_body)
            hits = response["hits"]["hits"]

            products = []
            for hit in hits:
                source = hit["_source"]
                products.append({
                    "id": str(source.get("mongoId", hit["_id"])),
                    "name": source.get("title", ""),
                    "price": source.get("numericPrice", 0),
                    "category": source.get("category1", ""),
                    "brand": source.get("brand", ""),
                    "description": source.get("summary", "")[:100],
                    "image": source.get("image", ""),
                    "rating": source.get("rating", 0),
                    "reviewCount": source.get("reviewCount", 0)
                })

            total = response["hits"]["total"]["value"]
            logger.info(f"[Tool] search_products: found {total} products")

            # Redis에 검색 결과 저장 (번호 선택 담기용)
            if self.redis_client and self.user_id and self.conversation_id and products:
                try:
                    await self.redis_client.set_recent_search_results(
                        self.user_id,
                        self.conversation_id,
                        products
                    )
                except Exception as redis_error:
                    logger.error(
                        f"[Tool] search_products: Redis 저장 실패: {redis_error}")

            return {
                "total": total,
                "products": products,
                "query": query
            }

        except Exception as e:
            logger.error(f"[Tool] search_products error: {e}", exc_info=True)
            return {"error": str(e), "total": 0, "products": []}

    @requires_authentication
    async def get_cart(self, user_id: str) -> Dict[str, Any]:
        """장바구니 조회 Tool"""
        try:
            logger.info(f"[Tool] get_cart: user_id={user_id}")

            # IMPORTANT: MongoDB uses "userId" (camelCase), not "user_id"
            cart = await self.db.carts.find_one({"userId": user_id})
            if not cart:
                logger.info(f"[Tool] get_cart: empty cart")
                return {"total_items": 0, "total_amount": 0, "items": []}

            items = cart.get("items", [])
            # Cart items use "priceSnapshot" not "price"
            total_amount = sum(item.get("priceSnapshot", 0)
                               * item.get("quantity", 0) for item in items)

            logger.info(
                f"[Tool] get_cart: {len(items)} items, total {total_amount}")

            # Format items for LLM readability
            formatted_items = []
            for item in items[:10]:  # 최대 10개만
                formatted_items.append({
                    "name": item.get("nameSnapshot", ""),
                    "quantity": item.get("quantity", 0),
                    "price": item.get("priceSnapshot", 0),
                    "total": item.get("priceSnapshot", 0) * item.get("quantity", 0)
                })

            return {
                "total_items": len(items),
                "total_amount": total_amount,
                "items": formatted_items
            }

        except Exception as e:
            logger.error(f"[Tool] get_cart error: {e}", exc_info=True)
            return {"error": str(e), "total_items": 0, "total_amount": 0, "items": []}

    @requires_authentication
    async def get_orders(self, user_id: str, limit: int = 5) -> Dict[str, Any]:
        """주문 내역 조회 Tool"""
        try:
            logger.info(f"[Tool] get_orders: user_id={user_id}, limit={limit}")

            cursor = self.db.orders.find({"user_id": user_id}).sort(
                "created_at", -1).limit(limit)
            orders = await cursor.to_list(length=limit)

            order_list = []
            for order in orders:
                order_list.append({
                    "order_id": str(order["_id"]),
                    "order_name": order.get("order_name"),
                    "amount": order.get("amount"),
                    "status": order.get("status"),
                    "created_at": order.get("created_at").isoformat() if order.get("created_at") else None
                })

            logger.info(f"[Tool] get_orders: found {len(order_list)} orders")

            return {"orders": order_list, "total": len(order_list)}

        except Exception as e:
            logger.error(f"[Tool] get_orders error: {e}", exc_info=True)
            return {"error": str(e), "orders": [], "total": 0}

    @requires_authentication
    async def get_wishlist(self, user_id: str) -> Dict[str, Any]:
        """찜 목록 조회 Tool"""
        try:
            logger.info(f"[Tool] get_wishlist: user_id={user_id}")

            # IMPORTANT: Each wishlist item is a separate document (not an array in a single document)
            # Use aggregation to join with products collection (same as wishlist_router.py)
            pipeline = [
                {"$match": {"user_id": ObjectId(user_id)}},
                {
                    "$lookup": {
                        "from": "products",
                        "localField": "product_id",
                        "foreignField": "_id",
                        "as": "product_info"
                    }
                },
                {"$unwind": "$product_info"},
                {"$sort": {"created_at": -1}},
                {"$limit": 10}  # 최대 10개만
            ]

            cursor = self.db.wishlists.aggregate(pipeline)
            wishlist_items = await cursor.to_list(length=10)

            if not wishlist_items:
                logger.info(f"[Tool] get_wishlist: empty wishlist")
                return {"items": [], "total": 0}

            logger.info(
                f"[Tool] get_wishlist: found {len(wishlist_items)} items")

            # Format items for LLM readability (keep original field names)
            formatted_items = []
            for item in wishlist_items:
                product = item.get("product_info", {})
                formatted_items.append({
                    "product_id": str(product.get("_id", "")),
                    "name": product.get("title", ""),
                    "price": product.get("lprice", 0),
                    "image": product.get("image", "")
                })

            return {"items": formatted_items, "total": len(wishlist_items)}

        except Exception as e:
            logger.error(f"[Tool] get_wishlist error: {e}", exc_info=True)
            return {"error": str(e), "items": [], "total": 0}

    async def multi_search_products(self, queries: List[str], main_query: str) -> Dict[str, Any]:
        """다중 상품 검색 Tool (MULTISEARCH용)"""
        try:
            logger.info(
                f"[Tool] multi_search_products: queries={queries}, main_query={main_query}")

            results = {}
            recommended_products = []  # 각 카테고리의 첫 번째 상품

            # 병렬 검색 실행 (asyncio.gather 사용)
            search_tasks = [
                self.search_products(query=query, limit=50)
                for query in queries[:10]    # 최대 5개까지만
            ]
            search_results = await asyncio.gather(*search_tasks)

            for query, search_result in zip(queries[:10], search_results):
                products = search_result.get("products", [])
                results[query] = products

                # 첫 번째 상품을 추천 상품으로 저장
                if products:
                    first_product = products[0]
                    product_info = {
                        "product_id": first_product.get("id"),
                        "name": first_product.get("name"),
                        "price": first_product.get("price"),
                        "image": first_product.get("image"),
                        "category": query
                    }
                    recommended_products.append(product_info)
                    logger.info(
                        f"[Tool] multi_search_products: Saved product '{product_info['name']}' with price {product_info['price']}")

                logger.info(
                    f"[Tool] multi_search_products: {query} → {len(products)} products")

            # Redis에 추천 상품 저장 (user_id와 conversation_id가 있을 때만)
            if self.redis_client and self.user_id and self.conversation_id and recommended_products:
                try:
                    await self.redis_client.set_recommended_products(
                        self.user_id,
                        self.conversation_id,
                        recommended_products
                    )
                    logger.info(
                        f"[Tool] multi_search_products: Saved {len(recommended_products)} recommended products to Redis")
                except Exception as redis_error:
                    logger.error(
                        f"[Tool] multi_search_products: Failed to save to Redis: {redis_error}")

            # Redis에 전체 검색 결과 저장 (번호 선택 담기용)
            if self.redis_client and self.user_id and self.conversation_id:
                try:
                    # 모든 카테고리의 상품을 하나의 리스트로 합치기
                    all_products = []
                    for query_products in results.values():
                        all_products.extend(query_products)

                    if all_products:
                        await self.redis_client.set_recent_search_results(
                            self.user_id,
                            self.conversation_id,
                            all_products
                        )
                        logger.info(
                            f"[Tool] multi_search_products: Saved {len(all_products)} total products to Redis")
                except Exception as redis_error:
                    logger.error(
                        f"[Tool] multi_search_products: 전체 결과 Redis 저장 실패: {redis_error}")

            return {
                "results": results,  # {"김치": [...], "돼지고기": [...]}
                "queries": queries,
                "main_query": main_query,
                "recommended_count": len(recommended_products)
            }

        except Exception as e:
            logger.error(
                f"[Tool] multi_search_products error: {e}", exc_info=True)
            return {"error": str(e), "results": {}, "queries": queries}

    @requires_authentication
    async def search_orders_by_product(
        self,
        user_id: str,
        product_keyword: Optional[str] = None,
        days_ago: Optional[int] = None,
        year: Optional[int] = None,
        min_price: Optional[int] = None,
        max_price: Optional[int] = None,
        limit: int = 5
    ) -> Dict[str, Any]:
        """주문 검색 Tool (상품명, 연도, 가격 필터 지원)"""
        try:
            logger.info(
                f"[Tool] search_orders_by_product: user_id={user_id}, keyword={product_keyword}, days_ago={days_ago}, year={year}, min_price={min_price}, max_price={max_price}")

            # 날짜 필터 구성
            query_filter = {"user_id": user_id}

            # year와 days_ago는 함께 사용할 수 없음 (year 우선)
            if year:
                # 특정 연도 필터링
                year_start = datetime(year, 1, 1)
                year_end = datetime(year + 1, 1, 1)
                query_filter["created_at"] = {
                    "$gte": year_start, "$lt": year_end}
            elif days_ago:
                # 여유를 두고 +10일 더 검색 (경계 케이스 대비)
                cutoff_date = datetime.now() - timedelta(days=days_ago + 10)
                query_filter["created_at"] = {"$gte": cutoff_date}

            # 가격 필터 구성
            if min_price is not None or max_price is not None:
                price_filter = {}
                if min_price is not None:
                    price_filter["$gte"] = min_price
                if max_price is not None:
                    price_filter["$lte"] = max_price
                if price_filter:
                    query_filter["amount"] = price_filter

            # 모든 주문 조회
            cursor = self.db.orders.find(query_filter).sort("created_at", -1)
            all_orders = await cursor.to_list(length=100)

            # 상품명으로 필터링 (product_keyword가 있는 경우에만)
            matching_orders = []

            for order in all_orders:
                # product_keyword가 없으면 모든 주문 매칭
                if not product_keyword:
                    # 첫 번째 item을 matched_item으로 사용
                    items = order.get("items", [])
                    if items:
                        matching_orders.append({
                            "order_id": order.get("order_id"),
                            "order_name": order.get("order_name"),
                            "amount": order.get("amount"),
                            "status": order.get("status"),
                            "created_at": order.get("created_at").isoformat() if order.get("created_at") else None,
                            "matched_item": {
                                "product_id": items[0].get("product_id"),
                                "product_name": items[0].get("product_name"),
                                "quantity": items[0].get("quantity"),
                                "price": items[0].get("price"),
                                "image_url": items[0].get("image_url")
                            }
                        })
                else:
                    # items 배열에서 상품명 검색
                    for item in order.get("items", []):
                        product_name = item.get("product_name", "")
                        if product_keyword.lower() in product_name.lower():
                            matching_orders.append({
                                "order_id": order.get("order_id"),
                                "order_name": order.get("order_name"),
                                "amount": order.get("amount"),
                                "status": order.get("status"),
                                "created_at": order.get("created_at").isoformat() if order.get("created_at") else None,
                                "matched_item": {
                                    "product_id": item.get("product_id"),
                                    "product_name": item.get("product_name"),
                                    "quantity": item.get("quantity"),
                                    "price": item.get("price"),
                                    "image_url": item.get("image_url")
                                }
                            })
                            break  # 주문당 1개만 매칭

                if len(matching_orders) >= limit:
                    break

            logger.info(
                f"[Tool] search_orders_by_product: found {len(matching_orders)} matching orders")

            return {
                "orders": matching_orders[:limit],
                "total": len(matching_orders),
                "keyword": product_keyword or "",
                "year_searched": year,
                "days_searched": days_ago,
                "price_range": {"min": min_price, "max": max_price} if min_price or max_price else None
            }

        except Exception as e:
            logger.error(
                f"[Tool] search_orders_by_product error: {e}", exc_info=True)
            return {"error": str(e), "orders": [], "total": 0}

    @requires_authentication
    async def add_to_cart(
        self,
        user_id: str,
        product_id: str,
        quantity: int = 1,
        price: Optional[int] = None,
        product_name: Optional[str] = None,
        image_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """장바구니에 상품 추가 Tool"""
        try:
            logger.info(
                f"[Tool] add_to_cart: user_id={user_id}, product_id={product_id}, quantity={quantity}, price={price}")

            # 상품 정보 조회 (MongoDB에서) - 파라미터로 제공되지 않은 정보만 조회
            product = None
            if not price or not product_name or not image_url:
                try:
                    product_obj_id = ObjectId(product_id)
                except:
                    return {"error": "잘못된 상품 ID입니다.", "success": False}

                product = await self.db.products.find_one({"_id": product_obj_id})
                if not product:
                    return {"error": "상품을 찾을 수 없습니다.", "success": False}

            # 가격, 이름, 이미지 결정 (파라미터 우선, 없으면 DB에서)
            final_price = price if price is not None else (
                product.get("numericPrice", 0) if product else 0)
            final_name = product_name or (
                product.get("title", "") if product else "")
            final_image = image_url or (
                product.get("image", "") if product else "")

            # 장바구니 조회 또는 생성
            cart = await self.db.carts.find_one({"userId": user_id})

            # 새로운 아이템
            import uuid
            new_item = {
                "_id": str(uuid.uuid4()),
                "productId": product_id,
                "quantity": quantity,
                "selectedColor": None,
                "selectedSize": None,
                "priceSnapshot": final_price,
                "nameSnapshot": final_name,
                "imageSnapshot": final_image
            }

            if not cart:
                # 장바구니 생성
                await self.db.carts.insert_one({
                    "userId": user_id,
                    "items": [new_item],
                    "updatedAt": datetime.now()
                })
            else:
                # 기존 장바구니에 추가
                items = cart.get("items", [])
                # 동일 상품이 있는지 확인
                found_item = None
                found_index = -1
                for i, item in enumerate(items):
                    if item.get("productId") == product_id:
                        found_item = item
                        found_index = i
                        break

                if found_item:
                    # 동일 상품이 있으면 수량 증가 후 맨 위로 이동
                    found_item["quantity"] += quantity
                    items.pop(found_index)
                    items.insert(0, found_item)
                else:
                    # 최근에 추가된 아이템이 위에 오도록 맨 앞에 추가
                    items.insert(0, new_item)

                await self.db.carts.update_one(
                    {"userId": user_id},
                    {
                        "$set": {
                            "items": items,
                            "updatedAt": datetime.now()
                        }
                    }
                )

            logger.info(
                f"[Tool] add_to_cart: successfully added {quantity}x {final_name[:30]}")

            return {
                "success": True,
                "product_name": final_name,
                "quantity": quantity,
                "price": final_price,
                "message": f"{final_name} {quantity}개를 장바구니에 담았습니다."
            }

        except Exception as e:
            logger.error(f"[Tool] add_to_cart error: {e}", exc_info=True)
            return {"error": str(e), "success": False}

    @requires_authentication
    async def add_multiple_to_cart(
        self,
        user_id: str,
        products: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """여러 상품을 한번에 장바구니에 추가 Tool"""
        try:
            logger.info(
                f"[Tool] add_multiple_to_cart: user_id={user_id}, count={len(products)}")

            success_count = 0
            failed_count = 0
            added_products = []

            for product_data in products:
                product_id = product_data.get("product_id")
                quantity = product_data.get("quantity", 1)
                price = product_data.get("price")
                product_name = product_data.get(
                    "product_name") or product_data.get("name")
                image_url = product_data.get(
                    "image_url") or product_data.get("image")

                logger.info(
                    f"[Tool] add_multiple_to_cart: Processing product {product_name} (ID: {product_id}, Price: {price})")

                if not product_id:
                    failed_count += 1
                    continue

                # add_to_cart 재사용 (가격, 이름, 이미지 정보 전달)
                result = await self.add_to_cart(
                    user_id=user_id,
                    product_id=product_id,
                    quantity=quantity,
                    price=price,
                    product_name=product_name,
                    image_url=image_url
                )

                if result.get("success"):
                    success_count += 1
                    added_products.append(result.get("product_name", "상품"))
                else:
                    failed_count += 1

            logger.info(
                f"[Tool] add_multiple_to_cart: success={success_count}, failed={failed_count}")

            if success_count == 0:
                return {
                    "success": False,
                    "error": "장바구니에 추가할 수 있는 상품이 없습니다.",
                    "success_count": 0,
                    "failed_count": failed_count
                }

            # 성공 메시지 생성
            if failed_count == 0:
                message = f"{success_count}개 상품을 장바구니에 담았습니다."
            else:
                message = f"{success_count}개 상품을 장바구니에 담았습니다. ({failed_count}개 실패)"

            return {
                "success": True,
                "message": message,
                "success_count": success_count,
                "failed_count": failed_count,
                "added_products": added_products[:5]  # 최대 5개만 표시
            }

        except Exception as e:
            logger.error(
                f"[Tool] add_multiple_to_cart error: {e}", exc_info=True)
            return {"error": str(e), "success": False, "success_count": 0, "failed_count": len(products)}

    @requires_authentication
    async def add_recommended_to_cart(self, user_id: str) -> Dict[str, Any]:
        """최근 multi_search로 찾은 추천 상품들을 장바구니에 담기 Tool"""
        try:
            logger.info(f"[Tool] add_recommended_to_cart: user_id={user_id}")

            # Redis에서 추천 상품 조회
            if not self.redis_client or not self.conversation_id:
                return {
                    "success": False,
                    "error": "추천 상품 정보를 찾을 수 없습니다. 먼저 상품 검색을 해주세요."
                }

            recommended_products = await self.redis_client.get_recommended_products(
                user_id,
                self.conversation_id
            )

            if not recommended_products:
                return {
                    "success": False,
                    "error": "저장된 추천 상품이 없습니다. 먼저 '김치찌개 재료 찾아줘' 같은 검색을 해주세요."
                }

            logger.info(
                f"[Tool] add_recommended_to_cart: Found {len(recommended_products)} recommended products")
            for p in recommended_products:
                logger.info(
                    f"[Tool] add_recommended_to_cart: Product {p.get('name')} - Price: {p.get('price')}")

            # add_multiple_to_cart 재사용 (가격, 이름, 이미지 정보 포함)
            products_to_add = [
                {
                    "product_id": p["product_id"],
                    "quantity": 1,
                    "price": p.get("price"),
                    "name": p.get("name"),
                    "image": p.get("image")
                }
                for p in recommended_products
            ]

            result = await self.add_multiple_to_cart(user_id=user_id, products=products_to_add)

            return result

        except Exception as e:
            logger.error(
                f"[Tool] add_recommended_to_cart error: {e}", exc_info=True)
            return {"error": str(e), "success": False}

    @requires_authentication
    async def get_order_detail(self, user_id: str, order_id: str) -> Dict[str, Any]:
        """주문 상세 조회 Tool (배송 현황 포함)"""
        try:
            logger.info(
                f"[Tool] get_order_detail: user_id={user_id}, order_id={order_id}")

            # 본인 주문만 조회
            order = await self.db.orders.find_one({
                "order_id": order_id,
                "user_id": user_id
            })

            if not order:
                logger.warning(f"[Tool] get_order_detail: order not found")
                return {
                    "error": "주문을 찾을 수 없습니다.",
                    "order": None
                }

            # 배송 상태 매핑 (한글)
            status_map = {
                "PAID": "결제 완료",
                "PREPARING": "상품 준비중",
                "SHIPPING": "배송중",
                "DELIVERED": "배송 완료",
                "CANCELED": "주문 취소"
            }

            order_detail = {
                "order_id": order.get("order_id"),
                "order_name": order.get("order_name"),
                "amount": order.get("amount"),
                "status": order.get("status"),
                "status_text": status_map.get(order.get("status"), order.get("status")),
                "payment_method": order.get("payment_method"),
                "approved_at": order.get("approved_at"),
                "created_at": order.get("created_at").isoformat() if order.get("created_at") else None,
                "items": order.get("items", [])
            }

            logger.info(
                f"[Tool] get_order_detail: order found, status={order.get('status')}")

            return {
                "order": order_detail,
                "success": True
            }

        except Exception as e:
            logger.error(f"[Tool] get_order_detail error: {e}", exc_info=True)
            return {"error": str(e), "order": None}

    @requires_authentication
    async def get_recently_viewed(self, user_id: str, limit: int = 10) -> Dict[str, Any]:
        """최근 본 상품 조회 Tool"""
        try:
            logger.info(
                f"[Tool] get_recently_viewed: user_id={user_id}, limit={limit}")

            # 사용자 정보 조회
            user = await self.db.users.find_one({"_id": ObjectId(user_id)})
            if not user:
                logger.warning(f"[Tool] get_recently_viewed: user not found")
                return {"items": [], "total": 0}

            recently_viewed = user.get("recentlyViewed", [])
            if not recently_viewed:
                logger.info(
                    f"[Tool] get_recently_viewed: no recently viewed products")
                return {"items": [], "total": 0}

            # viewedAt 기준 내림차순 정렬 (최신순)
            recently_viewed.sort(key=lambda x: x.get(
                "viewedAt", datetime.min), reverse=True)

            # limit 적용
            recently_viewed = recently_viewed[:limit]

            # 상품 ID 목록 추출
            product_ids = []
            for entry in recently_viewed:
                try:
                    product_ids.append(ObjectId(entry.get("productId")))
                except:
                    logger.warning(
                        f"[Tool] get_recently_viewed: invalid product ID {entry.get('productId')}")
                    continue

            # MongoDB에서 상품 정보 조회
            products = await self.db.products.find({"_id": {"$in": product_ids}}).to_list(length=limit)

            # product_id를 키로 하는 딕셔너리 생성 (빠른 조회)
            product_dict = {str(p["_id"]): p for p in products}

            # 결과 포맷팅 (viewedAt 순서 유지)
            formatted_items = []
            for entry in recently_viewed:
                product_id = entry.get("productId")
                product = product_dict.get(product_id)

                if product:
                    formatted_items.append({
                        "product_id": product_id,
                        "name": product.get("title", ""),
                        "price": product.get("numericPrice", 0),
                        "category": product.get("category1", ""),
                        "brand": product.get("brand", ""),
                        "image": product.get("image", ""),
                        "rating": product.get("rating", 0),
                        "reviewCount": product.get("reviewCount", 0),
                        "viewed_at": entry.get("viewedAt").isoformat() if entry.get("viewedAt") else None
                    })

            logger.info(
                f"[Tool] get_recently_viewed: found {len(formatted_items)} products")

            return {
                "items": formatted_items,
                "total": len(formatted_items)
            }

        except Exception as e:
            logger.error(
                f"[Tool] get_recently_viewed error: {e}", exc_info=True)
            return {"error": str(e), "items": [], "total": 0}

    async def semantic_search(
        self,
        query: str,
        category: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        limit: int = 10
    ) -> Dict[str, Any]:
        """의미 기반 검색 Tool (벡터 검색)"""
        try:
            logger.info(
                f"[Tool] semantic_search: query={query}, category={category}")

            # 1. 쿼리 텍스트 임베딩 생성
            query_embedding = await run_in_threadpool(
                lambda: embedding_service.create_embedding(query)
            )

            if not query_embedding:
                logger.error(
                    "[Tool] semantic_search: embedding generation failed")
                return {
                    "error": "임베딩 생성에 실패했습니다.",
                    "items": [],
                    "total": 0
                }

            # 2. 필터 구성
            filters = []

            if category:
                filters.append({
                    "term": {"category_path": category}
                })

            if min_price is not None or max_price is not None:
                price_filter = {"range": {"price": {}}}
                if min_price is not None:
                    price_filter["range"]["price"]["gte"] = min_price
                if max_price is not None:
                    price_filter["range"]["price"]["lte"] = max_price
                filters.append(price_filter)

            # 3. KNN 벡터 검색 쿼리 구성
            knn_query = {
                "field": "embedding",
                "query_vector": query_embedding,
                "k": min(limit * 2, 100),  # 후보는 더 많이
                "num_candidates": min(limit * 4, 200)
            }

            if filters:
                knn_query["filter"] = {"bool": {"filter": filters}}

            # 4. Elasticsearch 검색 실행
            search_body = {
                "knn": knn_query,
                "_source": [
                    "product_id", "title", "brand", "numericPrice",
                    "rating", "reviewCount", "image",
                    "category1", "summary"
                ],
                "size": limit
            }

            # Elasticsearch 검색
            result = await self.es.search(
                index="products_v2_vector",
                body=search_body
            )

            # 5. 결과 포맷팅
            items = []
            for hit in result["hits"]["hits"]:
                source = hit["_source"]
                items.append({
                    "product_id": source.get("product_id", ""),
                    "name": source.get("title", ""),
                    "price": source.get("numericPrice", 0),
                    "category": source.get("category1", ""),
                    "brand": source.get("brand", ""),
                    "image": source.get("image", ""),
                    "rating": source.get("rating", 0),
                    "reviewCount": source.get("reviewCount", 0),
                    "similarity": hit.get("_score", 0)  # 유사도 점수
                })

            logger.info(f"[Tool] semantic_search: found {len(items)} products")

            # Redis에 검색 결과 저장 (번호 선택 담기용)
            if self.redis_client and self.user_id and self.conversation_id and items:
                try:
                    # items의 필드명을 products 형식에 맞게 변환
                    products_for_redis = []
                    for item in items:
                        products_for_redis.append({
                            "id": item.get("product_id"),
                            "name": item.get("name"),
                            "price": item.get("price"),
                            "category": item.get("category"),
                            "brand": item.get("brand"),
                            "image": item.get("image"),
                            "rating": item.get("rating"),
                            "reviewCount": item.get("reviewCount")
                        })
                    await self.redis_client.set_recent_search_results(
                        self.user_id,
                        self.conversation_id,
                        products_for_redis
                    )
                except Exception as redis_error:
                    logger.error(
                        f"[Tool] semantic_search: Redis 저장 실패: {redis_error}")

            return {
                "items": items,
                "total": len(items),
                "search_type": "semantic"
            }

        except Exception as e:
            logger.error(f"[Tool] semantic_search error: {e}", exc_info=True)
            return {"error": str(e), "items": [], "total": 0}

    @requires_authentication
    async def add_from_recent_search(
        self,
        user_id: str,
        indices: List[int]
    ) -> Dict[str, Any]:
        """최근 검색 결과에서 인덱스로 상품 선택해서 장바구니에 담기 Tool"""
        try:
            logger.info(
                f"[Tool] add_from_recent_search: user_id={user_id}, indices={indices}")

            # 1. Redis에서 최근 검색 결과 조회
            if not self.redis_client or not self.conversation_id:
                return {
                    "success": False,
                    "error": "검색 결과 정보를 찾을 수 없습니다. 먼저 상품 검색을 해주세요."
                }

            recent_products = await self.redis_client.get_recent_search_results(
                user_id,
                self.conversation_id
            )

            if not recent_products:
                return {
                    "success": False,
                    "error": "저장된 검색 결과가 없습니다. 먼저 상품을 검색해주세요."
                }

            logger.info(
                f"[Tool] add_from_recent_search: Found {len(recent_products)} products in Redis")

            # 2. 인덱스 유효성 검증 및 상품 추출
            products_to_add = []
            invalid_indices = []

            for idx in indices:
                if 0 <= idx < len(recent_products):
                    product = recent_products[idx]
                    products_to_add.append({
                        "product_id": product.get("id"),
                        "quantity": 1,
                        "price": product.get("price"),
                        "name": product.get("name"),
                        "image": product.get("image")
                    })
                    logger.info(
                        f"[Tool] add_from_recent_search: Selected [{idx}] {product.get('name')}")
                else:
                    invalid_indices.append(idx)
                    logger.warning(
                        f"[Tool] add_from_recent_search: Invalid index {idx} (max: {len(recent_products)-1})")

            if not products_to_add:
                if invalid_indices:
                    return {
                        "success": False,
                        "error": f"잘못된 번호입니다. 1번부터 {len(recent_products)}번까지 선택 가능합니다."
                    }
                return {
                    "success": False,
                    "error": "선택된 상품이 없습니다."
                }

            # 3. add_multiple_to_cart 호출
            result = await self.add_multiple_to_cart(user_id=user_id, products=products_to_add)

            # 4. 결과에 경고 추가 (일부 인덱스가 유효하지 않은 경우)
            if invalid_indices and result.get("success"):
                result["warning"] = f"일부 번호가 유효하지 않아 제외되었습니다: {invalid_indices}"

            return result

        except Exception as e:
            logger.error(
                f"[Tool] add_from_recent_search error: {e}", exc_info=True)
            return {"error": str(e), "success": False}

    def get_handlers_dict(self) -> Dict[str, Any]:
        """Tool 이름 → Handler 함수 매핑 반환"""
        return {
            "search_products": self.search_products,
            "multi_search_products": self.multi_search_products,
            "get_cart": self.get_cart,
            "get_orders": self.get_orders,
            "get_wishlist": self.get_wishlist,
            "search_orders_by_product": self.search_orders_by_product,
            "add_to_cart": self.add_to_cart,
            "add_multiple_to_cart": self.add_multiple_to_cart,
            "add_recommended_to_cart": self.add_recommended_to_cart,
            "add_from_recent_search": self.add_from_recent_search,
            "get_order_detail": self.get_order_detail,
            "get_recently_viewed": self.get_recently_viewed,
            "semantic_search": self.semantic_search
        }
