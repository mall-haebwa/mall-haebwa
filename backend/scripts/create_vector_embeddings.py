#!/usr/bin/env python3
"""
AWS Bedrock Titan을 사용한 벡터 임베딩 생성 스크립트
MongoDB products_v2 컬렉션의 상품 데이터에 대해 임베딩을 생성합니다.
"""

import os
import sys
from pathlib import Path
import json
import time
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import hashlib
import logging
from dataclasses import dataclass
from collections import defaultdict

import pymongo
from pymongo import MongoClient, UpdateOne
import redis
from dotenv import load_dotenv
import boto3
from botocore.exceptions import ClientError
import numpy as np
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
class EmbeddingConfig:
    """임베딩 설정 클래스"""
    model_id: str = "amazon.titan-embed-text-v2:0"
    embedding_dimension: int = 1536
    batch_size: int = 1000
    bedrock_batch_size: int = 25  # Bedrock API 제한
    max_retries: int = 3
    retry_delay: int = 2  # seconds
    max_text_length: int = 8000  # Titan 최대 토큰


class BedrockEmbeddingClient:
    """AWS Bedrock Titan Embedding 클라이언트"""

    def __init__(self, config: EmbeddingConfig):
        self.config = config
        self.region = os.getenv("AWS_REGION", "ap-northeast-2")

        # Bedrock 클라이언트 생성
        self.bedrock = boto3.client(
            service_name='bedrock-runtime',
            region_name=self.region
        )

        logger.info(f"Bedrock 클라이언트 초기화 - Region: {self.region}, Model: {self.config.model_id}")

    def create_embedding(self, text: str) -> Optional[List[float]]:
        """단일 텍스트에 대한 임베딩 생성"""
        try:
            # 텍스트 길이 제한
            if len(text) > self.config.max_text_length:
                text = text[:self.config.max_text_length]

            # Bedrock API 호출
            # Titan Embeddings v2: dimensions만 지정 (normalize는 기본 적용됨)
            body = json.dumps({
                "inputText": text,
                "dimensions": self.config.embedding_dimension
            })

            response = self.bedrock.invoke_model(
                body=body,
                modelId=self.config.model_id,
                accept='application/json',
                contentType='application/json'
            )

            response_body = json.loads(response['body'].read())
            embedding = response_body.get('embedding')

            if embedding and len(embedding) == self.config.embedding_dimension:
                return embedding
            else:
                logger.error(f"Invalid embedding dimension: expected {self.config.embedding_dimension}, got {len(embedding) if embedding else 0}")
                return None

        except ClientError as e:
            logger.error(f"Bedrock API 오류: {e}")
            return None
        except Exception as e:
            logger.error(f"임베딩 생성 실패: {e}")
            return None

    def create_embeddings_batch(self, texts: List[str]) -> List[Optional[List[float]]]:
        """배치 텍스트에 대한 임베딩 생성

        참고: Titan은 배치 API를 직접 지원하지 않으므로 개별 호출로 처리
        """
        embeddings = []

        for text in texts:
            embedding = self.create_embedding(text)
            embeddings.append(embedding)
            time.sleep(0.1)  # API 호출 제한 방지

        return embeddings


class VectorEmbeddingGenerator:
    """상품 데이터 벡터 임베딩 생성기"""

    def __init__(self):
        """초기화"""
        self.config = EmbeddingConfig()

        # MongoDB 연결
        mongo_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        db_name = os.getenv("MONGODB_DB_NAME", "ecommerce_ai")
        self.mongo_client = MongoClient(mongo_url)
        self.db = self.mongo_client[db_name]
        self.products_collection = self.db["products_v2"]
        self.errors_collection = self.db["embedding_errors"]

        # Redis 연결 (진행 상황 추적)
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.redis_client = redis.from_url(redis_url, decode_responses=True)

        # Bedrock 클라이언트
        self.bedrock_client = BedrockEmbeddingClient(self.config)

        # 세션 ID 생성
        self.session_id = datetime.now().strftime("%Y%m%d_%H%M%S")

        logger.info(f"임베딩 생성기 초기화 완료 - Session ID: {self.session_id}")

    def create_text_for_embedding(self, product: Dict[str, Any]) -> str:
        """임베딩용 텍스트 생성

        products_v2 문서에서 주요 필드를 추출하여 결합
        """
        try:
            parts = []

            # 1. 상품명
            if name := product.get("name"):
                parts.append(f"상품명: {name}")

            # 2. 브랜드
            if brand := product.get("brand"):
                parts.append(f"브랜드: {brand}")

            # 3. 카테고리 경로
            if category := product.get("category", {}):
                if path := category.get("path"):
                    category_str = " > ".join(path)
                    parts.append(f"카테고리: {category_str}")

            # 4. 설명
            if description := product.get("description", {}):
                if summary := description.get("summary"):
                    parts.append(f"설명: {summary}")

            # 5. 검색 키워드
            if search_keywords := product.get("searchKeywords", {}):
                # 태그
                if tags := search_keywords.get("tags"):
                    parts.append(f"키워드: {', '.join(tags)}")

                # 특징
                if features := search_keywords.get("features"):
                    parts.append(f"특징: {', '.join(features)}")

                # 대상 고객
                if target := search_keywords.get("targetAudience"):
                    parts.append(f"대상: {', '.join(target)}")

                # 사용 용도
                if use_case := search_keywords.get("useCase"):
                    parts.append(f"용도: {', '.join(use_case)}")

                # 계절성
                if seasonality := search_keywords.get("seasonality"):
                    parts.append(f"계절: {', '.join(seasonality)}")

            # 6. 판매자 정보
            if seller := product.get("seller", {}):
                if seller_name := seller.get("name"):
                    parts.append(f"판매자: {seller_name}")

            # 텍스트 결합
            text = " | ".join(parts)

            # 텍스트 길이 제한
            if len(text) > self.config.max_text_length:
                text = text[:self.config.max_text_length]

            return text

        except Exception as e:
            logger.error(f"임베딩 텍스트 생성 실패: {e}")
            return ""

    def get_progress(self) -> Dict[str, Any]:
        """진행 상황 조회"""
        key = f"embedding:progress:{self.session_id}"
        progress = self.redis_client.get(key)

        if progress:
            return json.loads(progress)
        else:
            return {
                "session_id": self.session_id,
                "status": "not_started",
                "processed": 0,
                "total": 0,
                "errors": 0,
                "last_id": None,
                "start_time": None,
                "elapsed_time": 0
            }

    def save_progress(self, progress: Dict[str, Any]) -> None:
        """진행 상황 저장"""
        key = f"embedding:progress:{self.session_id}"
        self.redis_client.setex(
            key,
            86400,  # 24시간 TTL
            json.dumps(progress)
        )

    def save_error(self, product_id: str, error_msg: str) -> None:
        """에러 로그 저장"""
        self.errors_collection.insert_one({
            "session_id": self.session_id,
            "product_id": product_id,
            "error": error_msg,
            "timestamp": datetime.utcnow()
        })

    def get_unprocessed_products(self, last_id: Optional[str] = None) -> pymongo.cursor.Cursor:
        """임베딩이 없는 상품 조회"""
        query = {
            "$or": [
                {"embedding_vector": {"$exists": False}},
                {"embedding_status": {"$ne": "completed"}}
            ]
        }

        # 재개 지점이 있으면 그 이후부터
        if last_id:
            query["_id"] = {"$gt": pymongo.ObjectId(last_id)}

        return self.products_collection.find(query).sort("_id", 1)

    def process_batch(self, products: List[Dict[str, Any]]) -> Tuple[int, int]:
        """배치 처리

        Returns:
            (성공 수, 실패 수)
        """
        success_count = 0
        error_count = 0

        # 텍스트 생성
        texts = []
        valid_products = []

        for product in products:
            text = self.create_text_for_embedding(product)
            if text:
                texts.append(text)
                valid_products.append(product)
            else:
                self.save_error(str(product["_id"]), "텍스트 생성 실패")
                error_count += 1

        if not texts:
            return success_count, error_count

        # Bedrock API 제한에 맞춰 서브배치로 나누기
        sub_batches = [
            texts[i:i + self.config.bedrock_batch_size]
            for i in range(0, len(texts), self.config.bedrock_batch_size)
        ]

        all_embeddings = []

        for sub_batch in sub_batches:
            embeddings = self.bedrock_client.create_embeddings_batch(sub_batch)
            all_embeddings.extend(embeddings)

        # MongoDB 업데이트 준비
        bulk_operations = []

        for i, (product, embedding) in enumerate(zip(valid_products, all_embeddings)):
            if embedding:
                # 임베딩 성공
                bulk_operations.append(
                    UpdateOne(
                        {"_id": product["_id"]},
                        {
                            "$set": {
                                "embedding_vector": embedding,
                                "embedding_status": "completed",
                                "embedding_model": self.config.model_id,
                                "embedding_dimension": self.config.embedding_dimension,
                                "embedding_created_at": datetime.utcnow(),
                                "embedding_text": texts[i][:500],  # 처음 500자만 저장
                                "embedding_session": self.session_id
                            }
                        }
                    )
                )
                success_count += 1
            else:
                # 임베딩 실패
                self.save_error(str(product["_id"]), "임베딩 생성 실패")
                bulk_operations.append(
                    UpdateOne(
                        {"_id": product["_id"]},
                        {
                            "$set": {
                                "embedding_status": "failed",
                                "embedding_error": "Bedrock API 호출 실패",
                                "embedding_failed_at": datetime.utcnow(),
                                "embedding_session": self.session_id
                            }
                        }
                    )
                )
                error_count += 1

        # 벌크 업데이트 실행
        if bulk_operations:
            try:
                result = self.products_collection.bulk_write(bulk_operations)
                logger.info(f"MongoDB 업데이트 완료 - Modified: {result.modified_count}")
            except Exception as e:
                logger.error(f"MongoDB 업데이트 실패: {e}")
                error_count += success_count
                success_count = 0

        return success_count, error_count

    def run(self, resume: bool = False) -> None:
        """임베딩 생성 실행"""
        start_time = time.time()

        # 진행 상황 초기화 또는 복원
        progress = self.get_progress() if resume else {
            "session_id": self.session_id,
            "status": "processing",
            "processed": 0,
            "total": 0,
            "errors": 0,
            "last_id": None,
            "start_time": datetime.utcnow().isoformat(),
            "elapsed_time": 0
        }

        # 전체 개수 확인
        total_count = self.products_collection.count_documents({
            "$or": [
                {"embedding_vector": {"$exists": False}},
                {"embedding_status": {"$ne": "completed"}}
            ]
        })

        if total_count == 0:
            logger.info("처리할 상품이 없습니다. 모든 상품이 이미 임베딩되었습니다.")
            return

        progress["total"] = total_count
        logger.info(f"처리할 상품 수: {total_count:,}개")

        # 재개 지점부터 조회
        last_id = progress.get("last_id")
        if last_id and resume:
            logger.info(f"이전 세션 재개 - Last ID: {last_id}")

        cursor = self.get_unprocessed_products(last_id)

        # 배치 처리
        batch = []
        total_processed = progress.get("processed", 0)
        total_errors = progress.get("errors", 0)

        # 진행바 설정
        with tqdm(total=total_count, initial=total_processed, desc="임베딩 생성") as pbar:
            for product in cursor:
                batch.append(product)

                if len(batch) >= self.config.batch_size:
                    # 배치 처리 실행
                    success, errors = self.process_batch(batch)

                    # 통계 업데이트
                    total_processed += success
                    total_errors += errors
                    pbar.update(success + errors)

                    # 진행 상황 저장
                    progress.update({
                        "processed": total_processed,
                        "errors": total_errors,
                        "last_id": str(batch[-1]["_id"]),
                        "elapsed_time": int(time.time() - start_time)
                    })
                    self.save_progress(progress)

                    # 로그
                    if total_processed % 5000 == 0:
                        elapsed = time.time() - start_time
                        rate = total_processed / elapsed if elapsed > 0 else 0
                        eta = (total_count - total_processed) / rate if rate > 0 else 0
                        logger.info(
                            f"진행 상황: {total_processed:,}/{total_count:,} "
                            f"({total_processed/total_count*100:.1f}%) "
                            f"속도: {rate:.1f}/s, 예상 시간: {eta/60:.1f}분"
                        )

                    # 배치 초기화
                    batch = []

                    # API 제한 방지
                    time.sleep(0.5)

            # 마지막 배치 처리
            if batch:
                success, errors = self.process_batch(batch)
                total_processed += success
                total_errors += errors
                pbar.update(success + errors)

        # 완료
        elapsed_time = time.time() - start_time
        progress.update({
            "status": "completed",
            "processed": total_processed,
            "errors": total_errors,
            "elapsed_time": int(elapsed_time),
            "completed_at": datetime.utcnow().isoformat()
        })
        self.save_progress(progress)

        # 결과 출력
        print("\n" + "="*60)
        print("✅ 임베딩 생성 완료!")
        print("="*60)
        print(f"세션 ID: {self.session_id}")
        print(f"처리 상품: {total_processed:,}개")
        print(f"오류 발생: {total_errors:,}개")
        print(f"소요 시간: {elapsed_time/60:.1f}분")
        print(f"평균 속도: {total_processed/elapsed_time:.1f}개/초")
        print("="*60)

    def verify_embeddings(self) -> None:
        """임베딩 검증"""
        logger.info("임베딩 검증 시작...")

        # 통계
        stats = {
            "total": self.products_collection.count_documents({}),
            "with_embedding": self.products_collection.count_documents({
                "embedding_vector": {"$exists": True},
                "embedding_status": "completed"
            }),
            "without_embedding": self.products_collection.count_documents({
                "$or": [
                    {"embedding_vector": {"$exists": False}},
                    {"embedding_status": {"$ne": "completed"}}
                ]
            }),
            "failed": self.products_collection.count_documents({
                "embedding_status": "failed"
            })
        }

        # 차원 확인
        sample = self.products_collection.find_one({
            "embedding_vector": {"$exists": True}
        })

        if sample and "embedding_vector" in sample:
            embedding_dim = len(sample["embedding_vector"])
            stats["embedding_dimension"] = embedding_dim

        # 결과 출력
        print("\n" + "="*60)
        print("📊 임베딩 검증 결과")
        print("="*60)
        print(f"전체 상품: {stats['total']:,}개")
        print(f"임베딩 완료: {stats['with_embedding']:,}개 ({stats['with_embedding']/stats['total']*100:.1f}%)")
        print(f"임베딩 미완료: {stats['without_embedding']:,}개")
        print(f"실패: {stats['failed']:,}개")
        if "embedding_dimension" in stats:
            print(f"임베딩 차원: {stats['embedding_dimension']}")
        print("="*60)


def main():
    """메인 실행 함수"""
    import argparse

    parser = argparse.ArgumentParser(description='상품 벡터 임베딩 생성')
    parser.add_argument('--resume', action='store_true', help='이전 세션 재개')
    parser.add_argument('--verify', action='store_true', help='임베딩 검증')
    parser.add_argument('--batch-size', type=int, default=1000, help='배치 크기')
    parser.add_argument('--model', default="amazon.titan-embed-text-v2:0", help='임베딩 모델')

    args = parser.parse_args()

    try:
        generator = VectorEmbeddingGenerator()

        if args.batch_size:
            generator.config.batch_size = args.batch_size

        if args.model:
            generator.config.model_id = args.model

        if args.verify:
            generator.verify_embeddings()
        else:
            print("\n" + "="*60)
            print("🚀 상품 벡터 임베딩 생성 시작")
            print("="*60)
            print(f"모델: {generator.config.model_id}")
            print(f"차원: {generator.config.embedding_dimension}")
            print(f"배치 크기: {generator.config.batch_size}")
            print("="*60)

            generator.run(resume=args.resume)

    except KeyboardInterrupt:
        logger.info("\n사용자에 의해 중단됨")
        print("\n⚠️  중단됨 - '--resume' 옵션으로 재개 가능")
    except Exception as e:
        logger.error(f"실행 오류: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()