from __future__ import annotations

import math
import re
from collections import OrderedDict
from typing import Any

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from .database import get_product_db

# /products 네임스페이스 아래 상품 관련 엔드포인트를 제공하는 FastAPI 라우터.
router = APIRouter(prefix="/products", tags=["products"])


def _safe_int(value: Any, default: int = 0) -> int:
  """안전하게 정수로 변환하고 실패 시 기본값을 반환한다."""
  try:
    if value is None:
      # None 또는 유사 값은 즉시 기본값을 돌려준다.
      return default
    if isinstance(value, (int, float)):
      # 이미 숫자형이면 바로 정수로 변환한다.
      return int(value)
    value_str = str(value).replace(",", "").strip()
    if not value_str:
      # 공백 문자열은 기본값을 사용한다.
      return default
    return int(value_str)
  except (TypeError, ValueError):
    # 변환 중 예외가 생기면 기본값을 반환한다.
    return default


def _normalise_list(raw: str | None) -> list[str]:
  """콤마로 구분된 문자열을 깔끔한 토큰 리스트로 변환한다."""
  if not raw:
    return []
  # 콤마 기준으로 나누고 항목마다 공백을 제거한다.
  return [item.strip() for item in raw.split(",") if item.strip()]


def _build_sort(sort: str) -> OrderedDict[str, int]:
  """정렬 키를 MongoDB 필드 정렬 규칙으로 매핑한다."""
  if sort == "price-low":
    return OrderedDict([("numericPrice", 1), ("_id", -1)])
  if sort == "price-high":
    return OrderedDict([("numericPrice", -1), ("_id", -1)])
  if sort == "rating":
    return OrderedDict([("rating", -1), ("reviewCount", -1), ("_id", -1)])
  if sort == "latest":
    return OrderedDict([("updated_at", -1), ("created_at", -1), ("_id", -1)])
  # default popular
  return OrderedDict([("reviewCount", -1), ("_id", -1)])


def _reshape_product(doc: dict[str, Any]) -> dict[str, Any]:
  """Mongo 문서를 UI에서 쓰기 좋은 딕셔너리 형태로 변환한다."""
  # 가격 정보는 항상 숫자로 변환한다.
  price = _safe_int(doc.get("numericPrice", doc.get("lprice")), 0)
  original_price = _safe_int(doc.get("hprice"), 0)
  if original_price <= 0:
    original_price = None

  # 리뷰 관련 값들을 기본값과 함께 정리한다.
  review_count = _safe_int(
      doc.get("reviewCount", doc.get("review_count", doc.get("comment_count"))), 0)
  rating_value = doc.get("rating", doc.get("score"))
  rating = float(rating_value) if isinstance(
      rating_value, (int, float)) else _safe_int(rating_value, 0)
  try:
    rating = float(rating)
  except (TypeError, ValueError):
    rating = 0.0

  # 설명 및 목록형 메타데이터를 리스트 형태로 맞춘다.
  description = doc.get("description") or doc.get("summary") or ""
  images = doc.get("images")
  if not isinstance(images, list):
    images = []
  colors = doc.get("colors")
  if not isinstance(colors, list):
    colors = []
  sizes = doc.get("sizes")
  if not isinstance(sizes, list):
    sizes = []

  stock = _safe_int(doc.get("stock"), 0)

  created_at = doc.get("updated_at") or doc.get("created_at")
  if created_at is None and "_id" in doc:
    created_at = str(doc["_id"])

  # 프론트에서 사용하는 최종 형태의 데이터로 조립한다.
  return {
      "id": str(doc.get("_id")),
      "name": doc.get("title") or doc.get("name") or "",
      "price": price,
      "originalPrice": original_price,
      "image": doc.get("image") or "",
      "category": doc.get("category1") or doc.get("category") or "Misc",
      "brand": doc.get("brand") or doc.get("maker") or "",
      "rating": rating,
      "reviewCount": review_count,
      "description": description,
      "images": images,
      "colors": colors,
      "sizes": sizes,
      "stock": stock,
      "createdAt": created_at,
  }


@router.get("/search")
async def search_products(
    # 헤더 입력에서 전달되는 검색어.
    q: str | None = Query(None, description="Search keyword"),
    # 선택적으로 전달되는 필터들.
    category: str | None = Query(None, description="Category"),
    brands: str | None = Query(None, description="Comma separated brand list"),
    minPrice: int = Query(0, ge=0, alias="minPrice"),
    maxPrice: int = Query(1_000_000_000, ge=0, alias="maxPrice"),
    sort: str = Query("popular"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=60),
    db: AsyncIOMotorDatabase = Depends(get_product_db),
):
  """검색어/카테고리/브랜드/가격 조건으로 상품을 조회한다."""
  # 상품 정보를 보관하는 MongoDB 컬렉션을 가져온다.
  collection = db["products"]

  # 나중에 $match 단계로 결합할 조건들을 모은다.
  match_conditions: list[dict[str, Any]] = []

  if q:
    # 검색어 양끝의 공백을 제거한다.
    trimmed = q.strip()
    if trimmed:
      # 연속된 공백을 기준으로 토큰화하고 토큰 순서를 유지한다.
      tokens = [part for part in re.split(r"\s+", trimmed) if part]
      fields = ["title", "description", "brand", "mallName"]

      if tokens:
        # 토큰 사이에 임의의 글자가 끼어도 순서를 유지하면 매칭되도록 정규식을 구성한다.
        fuzzy_pattern = ".*".join(re.escape(token) for token in tokens)
      else:
        # 토큰이 비어 있을 경우(이론상 없음)를 대비한 안전장치.
        fuzzy_pattern = re.escape(trimmed)

      regex = {"$regex": fuzzy_pattern, "$options": "i"}
      match_conditions.append(
          {"$or": [{field: regex} for field in fields]})

  if category and category != "all":
    # 특정 상위 카테고리만 조회하도록 제한한다.
    match_conditions.append({"category1": category})

  brand_list = _normalise_list(brands)
  if brand_list:
    # 정리된 브랜드 목록으로 필터링을 적용한다.
    match_conditions.append({"brand": {"$in": brand_list}})

  match_conditions.append(
      # 요청된 가격 구간으로 결과를 항상 제한한다.
      {"numericPrice": {"$gte": minPrice, "$lte": maxPrice}})

  # 가격 정보를 정수로 맞추는 기본 파이프라인을 구성한다.
  base_pipeline: list[dict[str, Any]] = [
      {
          "$addFields": {
              # 정렬/필터에 사용할 numericPrice를 정수로 변환한다.
              "numericPrice": {
                  "$convert": {
                      "input": "$lprice",
                      "to": "int",
                      "onError": 0,
                      "onNull": 0,
                  }
              }
          }
      }
  ]

  if match_conditions:
    if len(match_conditions) == 1:
      # 조건이 하나일 때는 $and 없이 바로 매치한다.
      base_pipeline.append({"$match": match_conditions[0]})
    else:
      # 여러 조건은 $and 로 묶어 하나의 $match 단계로 합친다.
      base_pipeline.append({"$match": {"$and": match_conditions}})

  total_cursor = collection.aggregate(
      [*base_pipeline, {"$count": "total"}])
  total_docs = await total_cursor.to_list(length=1)
  # 결과가 없을 수 있으므로 안전하게 전체 개수를 구한다.
  total = total_docs[0]["total"] if total_docs else 0

  sort_spec = _build_sort(sort)
  # 페이지네이션을 위한 전체 파이프라인을 완성한다.
  result_pipeline = [
      *base_pipeline,
      {"$sort": sort_spec},
      {"$skip": (page - 1) * limit},
      {"$limit": limit},
  ]

  # 현재 페이지에 해당하는 문서를 조회한 뒤 형태를 변환한다.
  docs = await collection.aggregate(result_pipeline).to_list(length=limit)
  items = [_reshape_product(doc) for doc in docs]

  return {
      "items": items,
      "page": page,
      "limit": limit,
      "total": total,
      # 전체 페이지 수는 total과 limit을 기반으로 계산한다.
      "totalPages": math.ceil(total / limit) if limit else 0,
  }
