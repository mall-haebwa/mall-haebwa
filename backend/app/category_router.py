from __future__ import annotations

from typing import Any
from datetime import datetime, timezone
from asyncio import Lock

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from .database import get_product_db


router = APIRouter(prefix="/products", tags=["products-categories"])

# In-memory cache for category tree
_category_tree_cache: dict[str, Any] | None = None
_category_tree_lock: Lock = Lock()


async def _build_category_tree(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    collection = db["products"]

    pipeline: list[dict[str, Any]] = [
        {
            "$project": {
                "c1": "$category1",
                "c2": "$category2",
                "c3": "$category3",
                "c4": "$category4",
            }
        },
        {"$group": {"_id": {"c1": "$c1", "c2": "$c2", "c3": "$c3", "c4": "$c4"}}},
    ]

    combos = await collection.aggregate(pipeline).to_list(length=200000)

    tree: dict[str, dict] = {}
    for doc in combos:
        key = doc.get("_id", {})
        c1 = key.get("c1")
        c2 = key.get("c2")
        c3 = key.get("c3")
        c4 = key.get("c4")

        if not c1:
            continue
        n1 = tree.setdefault(str(c1), {})
        if c2:
            n2 = n1.setdefault(str(c2), {})
            if c3:
                n3 = n2.setdefault(str(c3), {})
                if c4:
                    n3.setdefault(str(c4), {})

    def dict_to_list(d: dict[str, dict]) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for name in sorted(d.keys(), key=lambda x: x.lower() if isinstance(x, str) else str(x)):
            children = d[name]
            node: dict[str, Any] = {"name": name}
            if children:
                node["children"] = dict_to_list(children)
            items.append(node)
        return items

    return dict_to_list(tree)


@router.get("/categories")
async def list_categories(
    db: AsyncIOMotorDatabase = Depends(get_product_db),
):
    """Return category tree from current DB state.

    Previously this endpoint cached the first computed tree which could
    remain empty if products were loaded after the first call. To avoid
    confusion during setup, we rebuild on every request. If you need
    aggressive caching, use the rebuild endpoint below or add TTL.
    """
    items = await _build_category_tree(db)
    return {
        "items": items,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
@router.post("/categories/rebuild")
async def rebuild_categories(
    db: AsyncIOMotorDatabase = Depends(get_product_db),
):

    global _category_tree_cache
    async with _category_tree_lock:
        items = await _build_category_tree(db)
        _category_tree_cache = {
            "items": items,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }
    return {"message": "reloaded", "count": len(_category_tree_cache["items"])}
