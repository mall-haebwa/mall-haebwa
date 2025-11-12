#!/usr/bin/env python3
"""
MongoDB → Elasticsearch 동기화 스크립트 (벡터 임베딩 포함)
- MongoDB의 products_v2 컬렉션을 Elasticsearch의 products_v2_vector 인덱스로 동기화
- 임베딩이 있는 제품만 동기화
- 벡터 검색을 위한 dense_vector 필드 포함
"""
import os
import sys
import time
from pymongo import MongoClient
from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk
from datetime import datetime
from typing import Dict, Any, List
from tqdm import tqdm

# MongoDB 연결
MONGO_URL = os.getenv('MONGODB_URL', 'mongodb://54.116.25.146:27017/?replicaSet=rs0')
DB_NAME = os.getenv('MONGODB_DB_NAME', 'ecommerce_ai')

# Elasticsearch 연결
ES_HOST = os.getenv('ELASTICSEARCH_URL', 'http://elasticsearch:9200')
VECTOR_INDEX = 'products_v2_vector'
EMBEDDING_DIMENSION = 1024

# MongoDB 클라이언트
mongo_client = MongoClient(MONGO_URL)
db = mongo_client[DB_NAME]
collection = db.products_v2

# Elasticsearch 클라이언트
es = Elasticsearch([ES_HOST])

def create_vector_index():
    """벡터 검색용 Elasticsearch 인덱스 생성"""

    index_body = {
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 1,
            "analysis": {
                "analyzer": {
                    "korean_analyzer": {
                        "type": "custom",
                        "tokenizer": "nori_tokenizer",
                        "filter": ["lowercase", "nori_part_of_speech"]
                    }
                }
            }
        },
        "mappings": {
            "properties": {
                # 상품 기본 정보
                "product_id": {"type": "keyword"},
                "name": {
                    "type": "text",
                    "analyzer": "korean_analyzer",
                    "fields": {
                        "keyword": {"type": "keyword"}
                    }
                },
                "brand": {"type": "keyword"},
                "price": {"type": "integer"},
                "image_url": {"type": "keyword", "index": False},

                # 카테고리 정보
                "category_path": {"type": "keyword"},
                "category_full": {"type": "text", "analyzer": "korean_analyzer"},

                # 상세 정보
                "description_summary": {"type": "text", "analyzer": "korean_analyzer"},
                "text_content": {"type": "text", "analyzer": "korean_analyzer"},

                # 통계 정보
                "rating": {"type": "float"},
                "review_count": {"type": "integer"},
                "seller_name": {"type": "keyword"},
                "tags": {"type": "keyword"},

                # 벡터 임베딩
                "embedding": {
                    "type": "dense_vector",
                    "dims": EMBEDDING_DIMENSION,
                    "index": True,
                    "similarity": "cosine"
                },

                # 메타데이터
                "embedding_model": {"type": "keyword"},
                "embedding_created_at": {"type": "date"},
                "synced_at": {"type": "date"}
            }
        }
    }

    if es.indices.exists(index=VECTOR_INDEX):
        print(f"⚠️  인덱스 '{VECTOR_INDEX}'가 이미 존재합니다.")
        response = input("기존 인덱스를 삭제하고 다시 생성하시겠습니까? (y/N): ")
        if response.lower() == 'y':
            es.indices.delete(index=VECTOR_INDEX)
            print(f"✓ 기존 인덱스 삭제 완료")
        else:
            print("기존 인덱스 유지")
            return

    es.indices.create(index=VECTOR_INDEX, body=index_body)
    print(f"✅ 벡터 인덱스 '{VECTOR_INDEX}' 생성 완료!")


def prepare_es_document(product: Dict[str, Any]) -> Dict[str, Any]:
    """MongoDB 문서를 Elasticsearch 문서로 변환"""

    # 카테고리 처리
    category = product.get('category', {})
    category_path = []
    if category.get('level1'):
        category_path.append(category['level1'])
    if category.get('level2'):
        category_path.append(category['level2'])
    if category.get('level3'):
        category_path.append(category['level3'])
    if category.get('level4'):
        category_path.append(category['level4'])

    category_full = ' > '.join(category_path)

    # 설명 처리
    desc = product.get('description', {})
    desc_text = ''
    if isinstance(desc, dict):
        desc_text = desc.get('text', desc.get('summary', ''))
    elif isinstance(desc, str):
        desc_text = desc

    # 텍스트 콘텐츠 구성 (검색용)
    text_parts = [
        product.get('name', ''),
        product.get('brand', ''),
        category_full,
        desc_text[:500] if desc_text else '',
        ' '.join(product.get('searchKeywords', {}).get('tags', []))
    ]
    text_content = ' '.join([p for p in text_parts if p])

    # Elasticsearch 문서 구성
    es_doc = {
        "product_id": str(product['_id']),
        "name": product.get('name', ''),
        "brand": product.get('brand', ''),
        "price": product.get('price', {}).get('amount', 0),
        "image_url": product.get('images', [{}])[0].get('url', ''),

        "category_path": category_path,
        "category_full": category_full,

        "description_summary": desc_text[:500] if desc_text else '',
        "text_content": text_content,

        "rating": product.get('ratings', {}).get('average', 0),
        "review_count": product.get('ratings', {}).get('count', 0),
        "seller_name": product.get('seller', {}).get('name', ''),
        "tags": product.get('searchKeywords', {}).get('tags', []),

        "embedding": product.get('embedding'),
        "embedding_model": product.get('embedding_model', ''),
        "embedding_created_at": product.get('embedding_created_at'),
        "synced_at": datetime.utcnow()
    }

    return es_doc


def generate_bulk_actions(batch: List[Dict], index_name: str):
    """Bulk API용 액션 생성"""
    for product in batch:
        es_doc = prepare_es_document(product)
        yield {
            "_index": index_name,
            "_id": es_doc["product_id"],
            "_source": es_doc
        }


def sync_products_to_elasticsearch(batch_size: int = 1000, delay: float = 0.1):
    """MongoDB 제품을 Elasticsearch로 동기화 (최적화)"""

    print("\n" + "=" * 60)
    print("MongoDB → Elasticsearch 동기화 시작 (최적화 모드)")
    print(f"배치 크기: {batch_size}, 배치당 딜레이: {delay}초")
    print("=" * 60)

    # 통계 (estimated 사용으로 부하 감소)
    try:
        total = collection.estimated_document_count()
        with_embedding = collection.count_documents({'embedding': {'$exists': True, '$ne': None}})
    except Exception as e:
        print(f"⚠️  통계 조회 실패, 추정값 사용: {e}")
        total = 0
        with_embedding = 0

    print(f"총 제품: {total:,}")
    print(f"임베딩 있음: {with_embedding:,} ({with_embedding/total*100:.1f}%)")
    print(f"동기화 대상: {with_embedding:,}")
    print("=" * 60)

    if with_embedding == 0:
        print("❌ 임베딩이 있는 제품이 없습니다. 먼저 임베딩을 생성하세요.")
        return

    # 배치 단위로 동기화
    batch = []
    success_count = 0
    error_count = 0

    cursor = collection.find(
        {'embedding': {'$exists': True, '$ne': None}},
        batch_size=batch_size
    )

    pbar = tqdm(total=with_embedding, desc="ES 동기화")

    for product in cursor:
        batch.append(product)

        if len(batch) >= batch_size:
            try:
                success, errors = bulk(
                    es,
                    generate_bulk_actions(batch, VECTOR_INDEX),
                    raise_on_error=False,
                    request_timeout=60
                )
                success_count += success
                if errors:
                    error_count += len(errors)
                    print(f"\n⚠️  배치에서 {len(errors)}개 오류 발생")

                pbar.update(len(batch))
                batch = []

                # MongoDB 부하 감소를 위한 딜레이
                time.sleep(delay)
            except Exception as e:
                print(f"\n❌ Bulk 인덱싱 오류: {e}")
                error_count += len(batch)
                batch = []

    # 마지막 배치 처리
    if batch:
        try:
            success, errors = bulk(
                es,
                generate_bulk_actions(batch, VECTOR_INDEX),
                raise_on_error=False,
                request_timeout=60
            )
            success_count += success
            if errors:
                error_count += len(errors)
            pbar.update(len(batch))
        except Exception as e:
            print(f"\n❌ Bulk 인덱싱 오류: {e}")
            error_count += len(batch)

    pbar.close()

    # 최종 통계
    print("\n" + "=" * 60)
    print("✅ 동기화 완료!")
    print("=" * 60)
    print(f"성공: {success_count:,}개")
    print(f"실패: {error_count:,}개")

    # ES 인덱스 통계
    es.indices.refresh(index=VECTOR_INDEX)
    es_count = es.count(index=VECTOR_INDEX)['count']
    print(f"ES 인덱스 문서 수: {es_count:,}개")
    print("=" * 60)


def main():
    """메인 실행 함수"""
    import sys
    try:
        print("🚀 Elasticsearch 벡터 인덱스 동기화 시작\n")

        # 강제 재생성 플래그 확인
        force_recreate = '--force' in sys.argv or '-f' in sys.argv

        # 1. 인덱스 생성
        if force_recreate:
            if es.indices.exists(index=VECTOR_INDEX):
                print(f"⚠️  기존 인덱스 '{VECTOR_INDEX}' 삭제 중...")
                es.indices.delete(index=VECTOR_INDEX)
                print(f"✓ 기존 인덱스 삭제 완료")

            index_body = {
                "settings": {
                    "number_of_shards": 1,
                    "number_of_replicas": 1,
                    "analysis": {
                        "analyzer": {
                            "korean_analyzer": {
                                "type": "custom",
                                "tokenizer": "nori_tokenizer",
                                "filter": ["lowercase", "nori_part_of_speech"]
                            }
                        }
                    }
                },
                "mappings": {
                    "properties": {
                        "product_id": {"type": "keyword"},
                        "name": {
                            "type": "text",
                            "analyzer": "korean_analyzer",
                            "fields": {"keyword": {"type": "keyword"}}
                        },
                        "brand": {"type": "keyword"},
                        "price": {"type": "integer"},
                        "image_url": {"type": "keyword", "index": False},
                        "category_path": {"type": "keyword"},
                        "category_full": {"type": "text", "analyzer": "korean_analyzer"},
                        "description_summary": {"type": "text", "analyzer": "korean_analyzer"},
                        "text_content": {"type": "text", "analyzer": "korean_analyzer"},
                        "rating": {"type": "float"},
                        "review_count": {"type": "integer"},
                        "seller_name": {"type": "keyword"},
                        "tags": {"type": "keyword"},
                        "embedding": {
                            "type": "dense_vector",
                            "dims": EMBEDDING_DIMENSION,
                            "index": True,
                            "similarity": "cosine"
                        },
                        "embedding_model": {"type": "keyword"},
                        "embedding_created_at": {"type": "date"},
                        "synced_at": {"type": "date"}
                    }
                }
            }
            es.indices.create(index=VECTOR_INDEX, body=index_body)
            print(f"✅ 벡터 인덱스 '{VECTOR_INDEX}' 생성 완료!")
        else:
            create_vector_index()

        # 2. 제품 동기화
        sync_products_to_elasticsearch()

        print("\n✅ 모든 작업 완료!")

    except KeyboardInterrupt:
        print("\n\n⚠️  사용자가 중단했습니다.")
    except Exception as e:
        print(f"\n\n❌ 에러 발생: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
