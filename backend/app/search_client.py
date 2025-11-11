from functools import lru_cache
from elasticsearch import AsyncElasticsearch
import os

INDEX_NAME = os.getenv("ELASTICSEARCH_INDEX", "products")

@lru_cache(maxsize=1)
def get_search_client():
    url = os.getenv("ELASTICSEARCH_URL", "http://elasticsearch:9200")
    return AsyncElasticsearch(url)

def get_index_name():
    return INDEX_NAME