import os
import time
from pymongo import MongoClient
from elasticsearch import Elasticsearch, helpers

INDEX_NAME = os.getenv("ELASTICSEARCH_INDEX", "products")
mongo_client = MongoClient(os.getenv("MONGODB_URL"))
collection = mongo_client[os.getenv("MONGODB_DB_NAME", "ecommerce_ai")]["products"]
es = Elasticsearch(os.getenv("ELASTICSEARCH_URL", "http://elasticsearch:9200"))


def wait_for_elasticsearch(max_retries=30, delay=2):
    """Elasticsearch가 준비될 때까지 대기"""
    print(f"Elasticsearch 연결 시도 시작: {os.getenv('ELASTICSEARCH_URL', 'http://elasticsearch:9200')}", flush=True)
    for i in range(max_retries):
        try:
            print(f"ping 시도 {i+1}/{max_retries}", flush=True)
            if es.ping():
                print("Elasticsearch 연결 성공", flush=True)
                return True
            else:
                print(f"ping 실패 (False 반환)", flush=True)
        except Exception as e:
            print(f"Elasticsearch 연결 대기 중... ({i+1}/{max_retries}): {str(e)}", flush=True)
        time.sleep(delay)
    raise Exception("Elasticsearch 연결 실패")


def to_es_doc(doc):
    return {
        "mongoId": str(doc.get("_id")),
        "title": doc.get("title", ""),
        "summary": doc.get("description", ""),
        "image": doc.get("image", ""),
        "brand": doc.get("brand", ""),
        "category1": doc.get("category1", "misc"),
        "category2": doc.get("category2"),
        "category3": doc.get("category3"),
        "category4": doc.get("category4"),
        "tags": doc.get("tags", []),
        "search_keyword": doc.get("search_keyword", ""),
        "rank": int(doc.get("rank") or 999),
        "numericPrice": int(doc.get("numericPrice") or doc.get("lprice") or 0),
        "reviewCount": int(doc.get("reviewCount") or 0),
        "rating": float(doc.get("rating") or 0),
        "stock": int(doc.get("stock") or 0),
        "updated_at": doc.get("updated_at"),
        "created_at": doc.get("created_at"),
    }

def bulk_index():
    actions = ({
        "_index": INDEX_NAME,
        "_id": str(doc["_id"]),
        "_source": to_es_doc(doc),
    } for doc in collection.find())
    helpers.bulk(es, actions)
    print("초기 색인 완료")

def watch_changes():
    with collection.watch(full_document="updateLookup") as stream:
        for change in stream:
            doc_id = str(change["documentKey"]["_id"])
            op = change["operationType"]
            if op in {"insert", "update", "replace"}:
                doc = change["fullDocument"]
                es.index(index=INDEX_NAME, id=doc_id, document=to_es_doc(doc))
            elif op == "delete":
                es.delete(index=INDEX_NAME, id=doc_id, ignore=[404])

def run():
    wait_for_elasticsearch()
    bulk_index()
    watch_changes()

if __name__ == "__main__":
    run()
