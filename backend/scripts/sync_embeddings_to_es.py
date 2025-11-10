#!/usr/bin/env python3
"""
MongoDB에서 Elasticsearch로 임베딩 동기화 스크립트
products_v2의 임베딩 데이터를 products_v2_vector 인덱스로 동기화합니다.
"""

import os
import sys
from pathlib import Path
import json
import time
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import logging
from dataclasses import dataclass
from collections import defaultdict
import threading

import pymongo
from pymongo import MongoClient
from elasticsearch import Elasticsearch, helpers
from elasticsearch.exceptions import BulkIndexError
import redis
from dotenv import load_dotenv
from tqdm import tqdm

# 프로젝트 루트 경로 추가
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# 환경 변수 로드
load_dotenv(PROJECT_ROOT / ".env.docker")
load_dotenv(PROJECT_ROOT / ".env", override=True)

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class SyncConfig:
    """동기화 설정 클래스"""
    batch_size: int = 1000
    max_retries: int = 3
    retry_delay: int = 2
    enable_change_stream: bool = True
    sync_interval: int = 60  # seconds


class EmbeddingSynchronizer:
    """임베딩 동기화 클래스"""

    def __init__(self):
        """초기화"""
        self.config = SyncConfig()

        # MongoDB 연결
        mongo_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        db_name = os.getenv("MONGODB_DB_NAME", "ecommerce_ai")
        self.mongo_client = MongoClient(mongo_url)
        self.db = self.mongo_client[db_name]
        self.products_collection = self.db["products_v2"]

        # Elasticsearch 연결
        es_url = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")
        self.vector_index = os.getenv("ELASTICSEARCH_VECTOR_INDEX", "products_v2_vector")
        self.es = Elasticsearch([es_url])

        if not self.es.ping():
            raise ConnectionError(f"Elasticsearch에 연결할 수 없습니다: {es_url}")

        # Redis 연결 (진행 상황 추적)
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.redis_client = redis.from_url(redis_url, decode_responses=True)

        # 세션 ID 생성
        self.session_id = datetime.now().strftime("%Y%m%d_%H%M%S")

        logger.info(f"동기화 시작 - Session ID: {self.session_id}")

    def create_es_document(self, product: Dict[str, Any]) -> Dict[str, Any]:
        """MongoDB 문서를 Elasticsearch 문서로 변환"""
        try:
            # 기본 필드
            es_doc = {
                "product_id": str(product["_id"]),
                "mongodb_id": str(product["_id"]),
                "name": product.get("name", ""),
                "brand": product.get("brand", ""),
                "created_at": product.get("createdAt"),
                "updated_at": product.get("updatedAt"),
                "status": product.get("status", {}).get("processed"),
                "published": product.get("status", {}).get("published"),
            }

            # 임베딩 벡터
            if "embedding_vector" in product:
                es_doc["embedding"] = product["embedding_vector"]
                es_doc["embedding_model"] = product.get("embedding_model", "")
                es_doc["embedding_created_at"] = product.get("embedding_created_at")
                es_doc["embedding_version"] = product.get("embedding_dimension", "1.0")

            # 임베딩 텍스트 (검색용)
            if "embedding_text" in product:
                es_doc["text_content"] = product["embedding_text"]

            # 카테고리
            if category := product.get("category", {}):
                if path := category.get("path"):
                    es_doc["category_path"] = path
                    es_doc["category_full"] = " > ".join(path)

            # 검색 키워드
            if search_keywords := product.get("searchKeywords", {}):
                es_doc["tags"] = search_keywords.get("tags", [])
                es_doc["features"] = search_keywords.get("features", [])
                es_doc["target_audience"] = search_keywords.get("targetAudience", [])
                es_doc["use_case"] = search_keywords.get("useCase", [])

            # 설명
            if description := product.get("description", {}):
                es_doc["description_summary"] = description.get("summary", "")

            # 가격
            if price_info := product.get("price", {}):
                es_doc["price"] = price_info.get("current", 0)

            # 리뷰
            if reviews := product.get("reviews", {}):
                es_doc["rating"] = reviews.get("rating", 0.0)
                es_doc["review_count"] = reviews.get("count", 0)

            # 순위
            if source := product.get("source", {}):
                es_doc["rank"] = source.get("rank", 999999)
                es_doc["source_provider"] = source.get("provider", "")
                es_doc["source_product_id"] = source.get("productId", "")
                es_doc["search_keyword"] = source.get("searchKeyword", "")

            # 판매자
            if seller := product.get("seller", {}):
                es_doc["seller_name"] = seller.get("name", "")
                es_doc["seller_type"] = seller.get("type", "")

            # 이미지
            if images := product.get("images", {}):
                es_doc["image_url"] = images.get("thumbnail", "")

            return es_doc

        except Exception as e:
            logger.error(f"ES 문서 생성 실패: {e}")
            return None

    def get_products_with_embeddings(self, last_id: Optional[str] = None) -> pymongo.cursor.Cursor:
        """임베딩이 있는 상품 조회"""
        query = {
            "embedding_vector": {"$exists": True},
            "embedding_status": "completed"
        }

        if last_id:
            query["_id"] = {"$gt": pymongo.ObjectId(last_id)}

        return self.products_collection.find(query).sort("_id", 1)

    def bulk_index(self, documents: List[Dict[str, Any]]) -> Tuple[int, int]:
        """벌크 인덱싱

        Returns:
            (성공 수, 실패 수)
        """
        if not documents:
            return 0, 0

        actions = []
        for doc in documents:
            if doc:
                actions.append({
                    "_index": self.vector_index,
                    "_id": doc["product_id"],
                    "_source": doc
                })

        if not actions:
            return 0, 0

        try:
            success, failed = helpers.bulk(
                self.es,
                actions,
                raise_on_error=False,
                raise_on_exception=False,
                stats_only=True
            )

            if failed > 0:
                logger.warning(f"벌크 인덱싱 일부 실패 - 성공: {success}, 실패: {failed}")

            return success, failed

        except BulkIndexError as e:
            logger.error(f"벌크 인덱싱 오류: {e}")
            # 일부 성공한 경우 처리
            success = len(actions) - len(e.errors)
            return success, len(e.errors)

        except Exception as e:
            logger.error(f"벌크 인덱싱 실패: {e}")
            return 0, len(actions)

    def initial_sync(self) -> None:
        """초기 전체 동기화"""
        logger.info("초기 동기화 시작...")

        # 전체 개수 확인
        total_count = self.products_collection.count_documents({
            "embedding_vector": {"$exists": True},
            "embedding_status": "completed"
        })

        if total_count == 0:
            logger.info("동기화할 임베딩이 없습니다.")
            return

        logger.info(f"동기화할 상품: {total_count:,}개")

        # 진행 상황 추적
        progress = {
            "session_id": self.session_id,
            "type": "initial_sync",
            "processed": 0,
            "success": 0,
            "failed": 0,
            "total": total_count,
            "start_time": datetime.utcnow().isoformat()
        }

        cursor = self.get_products_with_embeddings()

        batch = []
        total_processed = 0
        total_success = 0
        total_failed = 0

        start_time = time.time()

        with tqdm(total=total_count, desc="Elasticsearch 동기화") as pbar:
            for product in cursor:
                # ES 문서 생성
                es_doc = self.create_es_document(product)
                if es_doc:
                    batch.append(es_doc)

                # 배치가 가득 차면 인덱싱
                if len(batch) >= self.config.batch_size:
                    success, failed = self.bulk_index(batch)

                    total_success += success
                    total_failed += failed
                    total_processed += len(batch)

                    pbar.update(len(batch))

                    # 진행 상황 저장
                    progress.update({
                        "processed": total_processed,
                        "success": total_success,
                        "failed": total_failed,
                        "last_id": str(product["_id"]),
                        "elapsed_time": int(time.time() - start_time)
                    })
                    self.save_progress(progress)

                    # 로그
                    if total_processed % 10000 == 0:
                        rate = total_processed / (time.time() - start_time)
                        logger.info(
                            f"진행: {total_processed:,}/{total_count:,} "
                            f"({total_processed/total_count*100:.1f}%) "
                            f"속도: {rate:.1f}/s"
                        )

                    batch = []

            # 마지막 배치 처리
            if batch:
                success, failed = self.bulk_index(batch)
                total_success += success
                total_failed += failed
                total_processed += len(batch)
                pbar.update(len(batch))

        # 완료
        elapsed_time = time.time() - start_time
        progress.update({
            "status": "completed",
            "processed": total_processed,
            "success": total_success,
            "failed": total_failed,
            "elapsed_time": int(elapsed_time),
            "completed_at": datetime.utcnow().isoformat()
        })
        self.save_progress(progress)

        # 결과 출력
        print("\n" + "="*60)
        print("✅ 초기 동기화 완료!")
        print("="*60)
        print(f"세션 ID: {self.session_id}")
        print(f"처리 문서: {total_processed:,}개")
        print(f"성공: {total_success:,}개")
        print(f"실패: {total_failed:,}개")
        print(f"소요 시간: {elapsed_time/60:.1f}분")
        print(f"평균 속도: {total_processed/elapsed_time:.1f}개/초")
        print("="*60)

    def watch_changes(self) -> None:
        """Change Stream을 통한 실시간 동기화"""
        logger.info("실시간 동기화 시작 (Change Stream)...")

        # Change Stream 파이프라인
        pipeline = [
            {
                "$match": {
                    "operationType": {"$in": ["insert", "update", "replace"]},
                    "$or": [
                        {"fullDocument.embedding_vector": {"$exists": True}},
                        {"updateDescription.updatedFields.embedding_vector": {"$exists": True}}
                    ]
                }
            }
        ]

        try:
            with self.products_collection.watch(pipeline) as stream:
                logger.info("Change Stream 활성화됨")

                for change in stream:
                    try:
                        operation = change["operationType"]
                        document_id = change["documentKey"]["_id"]

                        logger.info(f"변경 감지 - Type: {operation}, ID: {document_id}")

                        if operation in ["insert", "update", "replace"]:
                            # 전체 문서 조회
                            product = self.products_collection.find_one({"_id": document_id})

                            if product and "embedding_vector" in product:
                                # ES 문서 생성 및 인덱싱
                                es_doc = self.create_es_document(product)
                                if es_doc:
                                    response = self.es.index(
                                        index=self.vector_index,
                                        id=es_doc["product_id"],
                                        body=es_doc
                                    )

                                    if response["result"] in ["created", "updated"]:
                                        logger.info(f"동기화 완료 - ID: {document_id}")
                                    else:
                                        logger.warning(f"동기화 실패 - ID: {document_id}")

                    except Exception as e:
                        logger.error(f"Change 처리 오류: {e}")
                        continue

        except pymongo.errors.OperationFailure as e:
            if "The $changeStream stage is only supported on replica sets" in str(e):
                logger.error("Change Stream은 Replica Set에서만 지원됩니다.")
                logger.info("Replica Set 설정 후 다시 시도하세요.")
            else:
                logger.error(f"Change Stream 오류: {e}")
        except Exception as e:
            logger.error(f"실시간 동기화 오류: {e}")

    def verify_sync(self) -> Dict[str, Any]:
        """동기화 검증"""
        logger.info("동기화 검증 시작...")

        # MongoDB 통계
        mongo_stats = {
            "total": self.products_collection.count_documents({}),
            "with_embedding": self.products_collection.count_documents({
                "embedding_vector": {"$exists": True},
                "embedding_status": "completed"
            })
        }

        # Elasticsearch 통계
        es_response = self.es.count(index=self.vector_index)
        es_count = es_response.get("count", 0)

        # 샘플 검증 (임베딩 차원)
        es_sample = self.es.search(
            index=self.vector_index,
            size=1,
            body={"query": {"exists": {"field": "embedding"}}}
        )

        embedding_dim = None
        if es_sample["hits"]["hits"]:
            sample_doc = es_sample["hits"]["hits"][0]["_source"]
            if "embedding" in sample_doc:
                embedding_dim = len(sample_doc["embedding"])

        # 결과 반환
        return {
            "mongo_total": mongo_stats["total"],
            "mongo_with_embedding": mongo_stats["with_embedding"],
            "es_count": es_count,
            "sync_rate": es_count / mongo_stats["with_embedding"] * 100 if mongo_stats["with_embedding"] > 0 else 0,
            "embedding_dimension": embedding_dim
        }

    def save_progress(self, progress: Dict[str, Any]) -> None:
        """진행 상황 저장"""
        key = f"sync:progress:{self.session_id}"
        self.redis_client.setex(
            key,
            86400,  # 24시간 TTL
            json.dumps(progress)
        )

    def print_verification_result(self, stats: Dict[str, Any]) -> None:
        """검증 결과 출력"""
        print("\n" + "="*60)
        print("📊 동기화 검증 결과")
        print("="*60)
        print(f"MongoDB:")
        print(f"  - 전체 상품: {stats['mongo_total']:,}개")
        print(f"  - 임베딩 있음: {stats['mongo_with_embedding']:,}개")
        print(f"\nElasticsearch:")
        print(f"  - 인덱스 문서: {stats['es_count']:,}개")
        print(f"  - 임베딩 차원: {stats['embedding_dimension']}")
        print(f"\n동기화율: {stats['sync_rate']:.1f}%")

        if stats['sync_rate'] < 100:
            diff = stats['mongo_with_embedding'] - stats['es_count']
            print(f"⚠️  동기화 필요: {diff:,}개 문서")
        else:
            print("✅ 모든 임베딩이 동기화되었습니다!")

        print("="*60)

    def run_continuous_sync(self) -> None:
        """지속적인 동기화 실행"""
        logger.info("지속적인 동기화 모드 시작...")

        # 초기 동기화
        self.initial_sync()

        # 실시간 동기화 시작 (별도 스레드)
        if self.config.enable_change_stream:
            watch_thread = threading.Thread(target=self.watch_changes, daemon=True)
            watch_thread.start()
            logger.info("Change Stream 스레드 시작")

        # 주기적인 검증 및 재동기화
        try:
            while True:
                time.sleep(self.config.sync_interval)

                # 동기화 검증
                stats = self.verify_sync()

                if stats['sync_rate'] < 100:
                    logger.info(f"동기화율 {stats['sync_rate']:.1f}% - 재동기화 시작...")
                    self.initial_sync()
                else:
                    logger.info(f"동기화 상태 양호 - {stats['es_count']:,}개 문서")

        except KeyboardInterrupt:
            logger.info("사용자에 의해 중단됨")


def main():
    """메인 실행 함수"""
    import argparse

    parser = argparse.ArgumentParser(description='임베딩 Elasticsearch 동기화')
    parser.add_argument('--initial', action='store_true', help='초기 전체 동기화')
    parser.add_argument('--watch', action='store_true', help='Change Stream 모니터링')
    parser.add_argument('--continuous', action='store_true', help='지속적인 동기화')
    parser.add_argument('--verify', action='store_true', help='동기화 검증')
    parser.add_argument('--batch-size', type=int, default=1000, help='배치 크기')

    args = parser.parse_args()

    try:
        synchronizer = EmbeddingSynchronizer()

        if args.batch_size:
            synchronizer.config.batch_size = args.batch_size

        if args.verify:
            stats = synchronizer.verify_sync()
            synchronizer.print_verification_result(stats)

        elif args.initial:
            synchronizer.initial_sync()

        elif args.watch:
            synchronizer.watch_changes()

        elif args.continuous:
            synchronizer.run_continuous_sync()

        else:
            # 기본: 초기 동기화 후 검증
            synchronizer.initial_sync()
            stats = synchronizer.verify_sync()
            synchronizer.print_verification_result(stats)

    except KeyboardInterrupt:
        logger.info("\n사용자에 의해 중단됨")
    except Exception as e:
        logger.error(f"실행 오류: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()