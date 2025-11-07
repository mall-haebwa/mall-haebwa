from elasticsearch import Elasticsearch

es = Elasticsearch("http://elasticsearch:9200")

# 인덱스 이름
INDEX_NAME = "products"

index_body = {
    "settings": {
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
            "title": {
                "type": "text",
                "analyzer": "korean_analyzer",
                "fields": {
                    "keyword": {"type": "keyword", "ignore_above": 256}
                }
            },
            "summary": {
                "type": "text",
                "analyzer": "korean_analyzer"
            },
            "image": {
                "type": "keyword",
                "index": False
            },
            "brand": {
                "type": "keyword",
                "ignore_above": 256
            },
            "category1": {"type": "keyword"},
            "category2": {"type": "keyword"},
            "category3": {"type": "keyword"},
            "category4": {"type": "keyword"},
            "tags": {"type": "keyword"},
            "search_keyword": {
                "type": "keyword",
                "ignore_above": 256
            },
            "rank": {"type": "integer"},
            "price": {"type": "integer"},
            "numericPrice": {"type": "integer"},
            "reviewCount": {"type": "integer"},
            "rating": {"type": "float"},
            "stock": {"type": "integer"},
            "updated_at": {"type": "date", "ignore_malformed": True},
            "created_at": {"type": "date", "ignore_malformed": True}
        }
    }
}

if es.indices.exists(index=INDEX_NAME):
    print("✅ 이미 인덱스가 존재합니다:", INDEX_NAME)
else:
    es.indices.create(index=INDEX_NAME, body=index_body)
    print("🎉 인덱스 생성 완료:", INDEX_NAME)
