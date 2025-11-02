from __future__ import annotations

import math
import re
from collections import OrderedDict
from typing import Any

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from .database import get_product_db

router = APIRouter(prefix="/products", tags=["products"])


def _safe_int(value: Any, default: int = 0) -> int:
  try:
    if value is None:
      return default
    if isinstance(value, (int, float)):
      return int(value)
    value_str = str(value).replace(",", "").strip()
    if not value_str:
      return default
    return int(value_str)
  except (TypeError, ValueError):
    return default


def _normalise_list(raw: str | None) -> list[str]:
  if not raw:
    return []
  return [item.strip() for item in raw.split(",") if item.strip()]


def _build_sort(sort: str) -> OrderedDict[str, int]:
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
  price = _safe_int(doc.get("numericPrice", doc.get("lprice")), 0)
  original_price = _safe_int(doc.get("hprice"), 0)
  if original_price <= 0:
    original_price = None

  review_count = _safe_int(
      doc.get("reviewCount", doc.get("review_count", doc.get("comment_count"))), 0)
  rating_value = doc.get("rating", doc.get("score"))
  rating = float(rating_value) if isinstance(
      rating_value, (int, float)) else _safe_int(rating_value, 0)
  try:
    rating = float(rating)
  except (TypeError, ValueError):
    rating = 0.0

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
    q: str | None = Query(None, description="Search keyword"),
    category: str | None = Query(None, description="Category"),
    brands: str | None = Query(None, description="Comma separated brand list"),
    minPrice: int = Query(0, ge=0, alias="minPrice"),
    maxPrice: int = Query(1_000_000_000, ge=0, alias="maxPrice"),
    sort: str = Query("popular"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=60),
    db: AsyncIOMotorDatabase = Depends(get_product_db),
):
  collection = db["products"]

  match_conditions: list[dict[str, Any]] = []

  if q:
    escaped = re.escape(q.strip())
    regex = {"$regex": escaped, "$options": "i"}
    match_conditions.append(
        {"$or": [{"title": regex}, {"description": regex}, {
            "brand": regex}, {"mallName": regex}]})

  if category and category != "all":
    match_conditions.append({"category1": category})

  brand_list = _normalise_list(brands)
  if brand_list:
    match_conditions.append({"brand": {"$in": brand_list}})

  match_conditions.append(
      {"numericPrice": {"$gte": minPrice, "$lte": maxPrice}})

  base_pipeline: list[dict[str, Any]] = [
      {
          "$addFields": {
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
      base_pipeline.append({"$match": match_conditions[0]})
    else:
      base_pipeline.append({"$match": {"$and": match_conditions}})

  total_cursor = collection.aggregate(
      [*base_pipeline, {"$count": "total"}])
  total_docs = await total_cursor.to_list(length=1)
  total = total_docs[0]["total"] if total_docs else 0

  sort_spec = _build_sort(sort)
  result_pipeline = [
      *base_pipeline,
      {"$sort": sort_spec},
      {"$skip": (page - 1) * limit},
      {"$limit": limit},
  ]

  docs = await collection.aggregate(result_pipeline).to_list(length=limit)
  items = [_reshape_product(doc) for doc in docs]

  return {
      "items": items,
      "page": page,
      "limit": limit,
      "total": total,
      "totalPages": math.ceil(total / limit) if limit else 0,
  }
