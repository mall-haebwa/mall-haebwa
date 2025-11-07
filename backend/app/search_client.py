from functools import lru_cache
from elasticsearch import Elasticsearch
import os

INDEX_NAME = os.getenv("ELASTICSEARCH_INDEX", "products")

@lru_cache(maxsize=1)
def get_search_client():
    url = os.getenv("ELASTICSEARCH_URL", "http://elasticsearch:9200")
    return Elasticsearch(url)

def get_index_name():
    return INDEX_NAME