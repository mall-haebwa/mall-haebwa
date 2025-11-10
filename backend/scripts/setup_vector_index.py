#!/usr/bin/env python3
"""
Elasticsearch 벡터 인덱스 생성 스크립트
products_v2_vector 인덱스를 생성하고 dense_vector 매핑을 설정합니다.
"""

import os
import sys
from pathlib import Path
import json
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from elasticsearch import Elasticsearch
from elasticsearch.exceptions import RequestError
import logging
from datetime import datetime

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


class VectorIndexManager:
    """Elasticsearch 벡터 인덱스 관리 클래스"""

    def __init__(self):
        """초기화 및 Elasticsearch 연결"""
        self.es_url = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")
        self.vector_index = os.getenv("ELASTICSEARCH_VECTOR_INDEX", "products_v2_vector")
        self.embedding_dim = int(os.getenv("EMBEDDING_DIMENSION", "1536"))

        logger.info(f"Elasticsearch URL: {self.es_url}")
        logger.info(f"Vector Index: {self.vector_index}")
        logger.info(f"Embedding Dimension: {self.embedding_dim}")

        # Elasticsearch 클라이언트 생성
        self.es = Elasticsearch([self.es_url])

        # 연결 확인
        if not self.es.ping():
            raise ConnectionError(f"Elasticsearch에 연결할 수 없습니다: {self.es_url}")

        logger.info("Elasticsearch 연결 성공")

    def get_index_mapping(self) -> Dict[str, Any]:
        """벡터 인덱스 매핑 정의"""
        return {
            "settings": {
                "number_of_shards": 2,
                "number_of_replicas": 1,
                "analysis": {
                    "analyzer": {
                        # 기존 한국어 분석기 사용
                        "korean_analyzer": {
                            "type": "custom",
                            "tokenizer": "nori_tokenizer",
                            "filter": [
                                "nori_part_of_speech",
                                "lowercase",
                                "nori_number"
                            ]
                        },
                        "korean_ngram_analyzer": {
                            "type": "custom",
                            "tokenizer": "nori_tokenizer",
                            "filter": [
                                "nori_part_of_speech",
                                "lowercase",
                                "edge_ngram_filter"
                            ]
                        }
                    },
                    "filter": {
                        "edge_ngram_filter": {
                            "type": "edge_ngram",
                            "min_gram": 1,
                            "max_gram": 10
                        },
                        "nori_part_of_speech": {
                            "type": "nori_part_of_speech",
                            "stoptags": [
                                "E", "IC", "J", "MAG", "MAJ",
                                "MM", "SP", "SSC", "SSO",
                                "SC", "SE", "XPN", "XSA",
                                "XSN", "XSV", "UNA", "NA",
                                "VSV"
                            ]
                        },
                        "nori_number": {
                            "type": "nori_number"
                        }
                    },
                    "tokenizer": {
                        "nori_tokenizer": {
                            "type": "nori_tokenizer",
                            "decompound_mode": "mixed"
                        }
                    }
                }
            },
            "mappings": {
                "properties": {
                    # 기본 식별자
                    "product_id": {
                        "type": "keyword"
                    },
                    "mongodb_id": {
                        "type": "keyword"
                    },

                    # 벡터 임베딩 (핵심)
                    "embedding": {
                        "type": "dense_vector",
                        "dims": self.embedding_dim,
                        "index": True,
                        "similarity": "cosine"
                    },

                    # 텍스트 검색용 필드 (하이브리드 검색)
                    "text_content": {
                        "type": "text",
                        "analyzer": "korean_analyzer",
                        "fields": {
                            "ngram": {
                                "type": "text",
                                "analyzer": "korean_ngram_analyzer"
                            },
                            "keyword": {
                                "type": "keyword"
                            }
                        }
                    },

                    # 상품 기본 정보
                    "name": {
                        "type": "text",
                        "analyzer": "korean_analyzer",
                        "fields": {
                            "keyword": {
                                "type": "keyword"
                            },
                            "ngram": {
                                "type": "text",
                                "analyzer": "korean_ngram_analyzer"
                            }
                        }
                    },
                    "brand": {
                        "type": "keyword",
                        "fields": {
                            "text": {
                                "type": "text",
                                "analyzer": "korean_analyzer"
                            }
                        }
                    },

                    # 카테고리
                    "category_path": {
                        "type": "keyword"
                    },
                    "category_full": {
                        "type": "text",
                        "analyzer": "korean_analyzer"
                    },

                    # 태그 및 키워드
                    "tags": {
                        "type": "keyword",
                        "fields": {
                            "text": {
                                "type": "text",
                                "analyzer": "korean_analyzer"
                            }
                        }
                    },
                    "features": {
                        "type": "keyword"
                    },
                    "target_audience": {
                        "type": "keyword"
                    },
                    "use_case": {
                        "type": "keyword"
                    },

                    # 설명
                    "description_summary": {
                        "type": "text",
                        "analyzer": "korean_analyzer"
                    },

                    # 가격 및 평점 (필터링/정렬용)
                    "price": {
                        "type": "long"
                    },
                    "rating": {
                        "type": "float"
                    },
                    "review_count": {
                        "type": "integer"
                    },
                    "rank": {
                        "type": "integer"
                    },

                    # 판매자 정보
                    "seller_name": {
                        "type": "keyword"
                    },
                    "seller_type": {
                        "type": "keyword"
                    },

                    # 이미지
                    "image_url": {
                        "type": "keyword",
                        "index": False
                    },

                    # 메타데이터
                    "source_provider": {
                        "type": "keyword"
                    },
                    "source_product_id": {
                        "type": "keyword"
                    },
                    "search_keyword": {
                        "type": "keyword"
                    },

                    # 임베딩 관련 메타데이터
                    "embedding_model": {
                        "type": "keyword"
                    },
                    "embedding_created_at": {
                        "type": "date"
                    },
                    "embedding_version": {
                        "type": "keyword"
                    },

                    # 타임스탬프
                    "created_at": {
                        "type": "date"
                    },
                    "updated_at": {
                        "type": "date"
                    },

                    # 상태
                    "status": {
                        "type": "keyword"
                    },
                    "published": {
                        "type": "boolean"
                    }
                }
            }
        }

    def index_exists(self) -> bool:
        """인덱스 존재 여부 확인"""
        return self.es.indices.exists(index=self.vector_index)

    def delete_index(self) -> bool:
        """기존 인덱스 삭제"""
        try:
            if self.index_exists():
                response = self.es.indices.delete(index=self.vector_index)
                logger.info(f"인덱스 '{self.vector_index}' 삭제 완료")
                return True
            else:
                logger.info(f"인덱스 '{self.vector_index}'가 존재하지 않습니다")
                return False
        except Exception as e:
            logger.error(f"인덱스 삭제 실패: {e}")
            raise

    def create_index(self, force: bool = False) -> bool:
        """벡터 인덱스 생성

        Args:
            force: True인 경우 기존 인덱스를 삭제하고 새로 생성
        """
        try:
            # 이미 존재하는지 확인
            if self.index_exists():
                if not force:
                    logger.warning(f"인덱스 '{self.vector_index}'가 이미 존재합니다")
                    response = input("기존 인덱스를 삭제하고 새로 만드시겠습니까? (y/N): ")
                    if response.lower() != 'y':
                        logger.info("인덱스 생성 취소")
                        return False

                # 기존 인덱스 삭제
                self.delete_index()

            # 인덱스 생성
            mapping = self.get_index_mapping()
            response = self.es.indices.create(
                index=self.vector_index,
                body=mapping
            )

            if response.get('acknowledged'):
                logger.info(f"인덱스 '{self.vector_index}' 생성 완료!")
                logger.info(f"- Embedding 차원: {self.embedding_dim}")
                logger.info(f"- Similarity: cosine")
                logger.info(f"- Shards: 2, Replicas: 1")
                return True
            else:
                logger.error("인덱스 생성 실패")
                return False

        except RequestError as e:
            if 'resource_already_exists_exception' in str(e):
                logger.error(f"인덱스 '{self.vector_index}'가 이미 존재합니다")
            else:
                logger.error(f"인덱스 생성 오류: {e}")
            raise
        except Exception as e:
            logger.error(f"예기치 않은 오류: {e}")
            raise

    def get_index_info(self) -> Optional[Dict[str, Any]]:
        """인덱스 정보 조회"""
        try:
            if not self.index_exists():
                logger.warning(f"인덱스 '{self.vector_index}'가 존재하지 않습니다")
                return None

            # 인덱스 매핑 조회
            mapping = self.es.indices.get_mapping(index=self.vector_index)

            # 인덱스 설정 조회
            settings = self.es.indices.get_settings(index=self.vector_index)

            # 인덱스 통계 조회
            stats = self.es.indices.stats(index=self.vector_index)

            doc_count = stats['indices'][self.vector_index]['primaries']['docs']['count']
            size_in_bytes = stats['indices'][self.vector_index]['primaries']['store']['size_in_bytes']
            size_in_mb = size_in_bytes / (1024 * 1024)

            info = {
                "index_name": self.vector_index,
                "document_count": doc_count,
                "size_mb": round(size_in_mb, 2),
                "shards": settings[self.vector_index]['settings']['index']['number_of_shards'],
                "replicas": settings[self.vector_index]['settings']['index']['number_of_replicas'],
                "embedding_dims": None
            }

            # 벡터 차원 확인
            properties = mapping[self.vector_index]['mappings'].get('properties', {})
            if 'embedding' in properties:
                embedding_config = properties['embedding']
                if embedding_config.get('type') == 'dense_vector':
                    info['embedding_dims'] = embedding_config.get('dims')

            return info

        except Exception as e:
            logger.error(f"인덱스 정보 조회 실패: {e}")
            return None

    def test_vector_search(self) -> None:
        """벡터 검색 테스트 (더미 데이터 사용)"""
        try:
            if not self.index_exists():
                logger.warning("인덱스가 존재하지 않습니다. 먼저 인덱스를 생성하세요.")
                return

            # 테스트 문서 생성
            import numpy as np

            test_doc = {
                "product_id": "test_product_001",
                "mongodb_id": "507f1f77bcf86cd799439011",
                "name": "테스트 운동화",
                "brand": "나이키",
                "category_path": ["패션의류", "신발", "운동화"],
                "category_full": "패션의류 > 신발 > 운동화",
                "tags": ["운동화", "런닝화", "스포츠"],
                "features": ["쿠션", "경량", "통기성"],
                "target_audience": ["20대", "30대", "남성"],
                "use_case": ["러닝", "조깅", "일상"],
                "description_summary": "편안한 착화감과 뛰어난 쿠션을 제공하는 런닝화",
                "text_content": "나이키 테스트 운동화 런닝화 스포츠 쿠션 경량 통기성",
                "embedding": np.random.rand(self.embedding_dim).tolist(),  # 랜덤 벡터
                "price": 89000,
                "rating": 4.5,
                "review_count": 234,
                "rank": 1,
                "seller_name": "나이키 공식스토어",
                "seller_type": "official",
                "embedding_model": "amazon.titan-embed-text-v2:0",
                "embedding_created_at": datetime.utcnow().isoformat(),
                "embedding_version": "1.0",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
                "status": "published",
                "published": True
            }

            # 테스트 문서 인덱싱
            response = self.es.index(
                index=self.vector_index,
                id="test_001",
                body=test_doc,
                refresh=True
            )

            if response['result'] in ['created', 'updated']:
                logger.info("테스트 문서 인덱싱 성공")

                # KNN 검색 테스트
                query_vector = np.random.rand(self.embedding_dim).tolist()

                search_query = {
                    "knn": {
                        "field": "embedding",
                        "query_vector": query_vector,
                        "k": 10,
                        "num_candidates": 100
                    },
                    "_source": ["product_id", "name", "brand", "price"]
                }

                search_response = self.es.search(
                    index=self.vector_index,
                    body=search_query
                )

                logger.info(f"KNN 검색 테스트 성공! 결과: {search_response['hits']['total']['value']}개")

                # 테스트 문서 삭제
                self.es.delete(index=self.vector_index, id="test_001")
                logger.info("테스트 문서 삭제 완료")

            else:
                logger.error("테스트 문서 인덱싱 실패")

        except Exception as e:
            logger.error(f"벡터 검색 테스트 실패: {e}")

    def print_summary(self) -> None:
        """인덱스 요약 정보 출력"""
        info = self.get_index_info()
        if info:
            print("\n" + "="*60)
            print(f"📊 Elasticsearch Vector Index 정보")
            print("="*60)
            print(f"인덱스명: {info['index_name']}")
            print(f"문서 수: {info['document_count']:,}개")
            print(f"크기: {info['size_mb']} MB")
            print(f"샤드: {info['shards']}, 레플리카: {info['replicas']}")
            print(f"임베딩 차원: {info['embedding_dims']}")
            print("="*60)
        else:
            print(f"\n❌ 인덱스 '{self.vector_index}'가 존재하지 않습니다")


def main():
    """메인 실행 함수"""
    import argparse

    parser = argparse.ArgumentParser(description='Elasticsearch 벡터 인덱스 설정')
    parser.add_argument('--create', action='store_true', help='인덱스 생성')
    parser.add_argument('--delete', action='store_true', help='인덱스 삭제')
    parser.add_argument('--force', action='store_true', help='강제 실행 (확인 없이)')
    parser.add_argument('--info', action='store_true', help='인덱스 정보 조회')
    parser.add_argument('--test', action='store_true', help='벡터 검색 테스트')

    args = parser.parse_args()

    try:
        manager = VectorIndexManager()

        if args.delete:
            if args.force or input(f"정말 '{manager.vector_index}' 인덱스를 삭제하시겠습니까? (y/N): ").lower() == 'y':
                manager.delete_index()

        elif args.create:
            manager.create_index(force=args.force)
            if args.test:
                print("\n벡터 검색 테스트 실행...")
                manager.test_vector_search()

        elif args.info:
            manager.print_summary()

        elif args.test:
            manager.test_vector_search()

        else:
            # 기본: 정보 표시
            manager.print_summary()
            print("\n사용법:")
            print("  --create : 새 인덱스 생성")
            print("  --delete : 인덱스 삭제")
            print("  --info   : 인덱스 정보 조회")
            print("  --test   : 벡터 검색 테스트")
            print("  --force  : 확인 없이 강제 실행")
            print(f"\n예: python {Path(__file__).name} --create --test")

    except Exception as e:
        logger.error(f"실행 오류: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()