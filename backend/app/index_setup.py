from elasticsearch import Elasticsearch

es = Elasticsearch("http://elasticsearch:9200")

# 인덱스 이름
INDEX_NAME = "products"

index_body = {
    "settings": {
        "analysis": {
            "analyzer": {
                "korean_analyzer": {
                    # 의미 중심 검색을 위한 정확 매칭용 한국어 형태소 분석기
                    # 정확 매칭 / 랭킹 순서 결정 (점수 계산 기준)
                    # 검색 결과의 순서, 랭킹을 책임
                    "type": "custom",
                    "tokenizer": "nori_tokenizer",
                    "filter": ["lowercase", "nori_part_of_speech", "unique_token_filter"]
                    # lowercase: 대문자를 소문자로 변환
                    # nori_part_of_speech: 한국어 형태소 분석 후 필요 없는 품사(조사, 어미, 접속사 등)를 제거 -> 의미 중심 토큰만 남김
                    # unique_token_filter: 중복 토큰 제거 (ex: "국거리 국거리 국거리" -> "국거리")
                },
                "korean_ngram_analyzer": {
                    # 부분 검색(일부 단어 검색/중간 단어 검색/오타 유사검색을)을 지원하기 위한 분석기
                    # 부분 검색 / 유연한 매칭 보조
                    # 검색 결과의 노출 범위를 넓히기 위해 사용
                    "type": "custom",
                    "tokenizer": "nori_tokenizer",
                    "filter": ["lowercase", "nori_part_of_speech", "edge_ngram_filter"]
                    # edge_ngram_filter: 형태소를 글자 단위 여러 길이로 자름 -> 부분 검색 가능 ex) [한, 한우, 한우국, ... 한우국거리]
                }
            },
            "filter": {
                "edge_ngram_filter": {
                    "type": "edge_ngram",
                    "min_gram": 1,
                    "max_gram": 10
                    # 최대 1글자에서 10글자까지만 끊어서 인덱싱 저장
                },
                "unique_token_filter": {
                    "type": "unique",
                    "only_on_same_position": False
                    # 같은 위치가 아니어도 중복 토큰 제거
                    # "국거리 소고기 국거리" -> "국거리 소고기"
                }
            }
        }
    },
    "mappings": {
        "properties": {
            "title": {
                "type": "text",
                "fields": {
                    "nori": {
                        "type": "text",
                        "analyzer": "korean_analyzer" # 저장할때와 검색할때 모두 같은 방식으로 처리
                    },
                    "ngram": {
                        "type": "text",
                        "analyzer": "korean_ngram_analyzer", # 문장을  어떻게 쪼갤지 결정
                        "search_analyzer": "korean_analyzer" # 사용자가 입력한 검색어를 어떻게 해석할지 결정
                    },
                    "keyword": {
                        # 원본 문자 저장용 (정렬, 필터, 집계에 사용하기 위해)
                        "type": "keyword", 
                        "ignore_above": 256 # 256글자 초과시 저장 x
                    }
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
