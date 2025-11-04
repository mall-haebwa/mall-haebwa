# backend/app/admin_router.py
from fastapi import APIRouter, Depends, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from .database import get_db
from .security import decode_token
from bson import ObjectId
router = APIRouter(prefix="/admin", tags=["admin"])


# ✅ 공통 관리자 인증 함수
async def verify_admin(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    try:
        payload = decode_token(token)
        if payload.get("scope") != "access":
            raise HTTPException(status_code=401, detail="access 토큰이 아닙니다.")
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="관리자만 접근 가능합니다.")
    except Exception:
        raise HTTPException(status_code=401, detail="토큰이 유효하지 않습니다.")

# ✅ 관리자 인증 테스트용


@router.get("/check")
async def check_admin(request: Request):
    await verify_admin(request)
    return {"message": "관리자 인증 성공 ✅"}


# ✅ 실제 상품 목록 불러오기
@router.get("/products")
async def get_products(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    # await verify_admin(request)  # 먼저 관리자 인증

    products = await db["products"].find().limit(50).to_list(length=None)

    return [
        {
            "id": str(p["_id"]),
            "title": p.get("title", ""),             # 상품명
            "link": p.get("link", ""),               # 상품 링크
            "image": p.get("image", ""),             # 이미지 URL
            "lprice": p.get("lprice", ""),           # 최저가 (lowest price)
            "mallName": p.get("mallName", ""),       # 쇼핑몰 이름
            "maker": p.get("maker", ""),             # 제조사
            "brand": p.get("brand", ""),             # 브랜드명
            "category1": p.get("category1", ""),     # 1차 카테고리
            "category2": p.get("category2", ""),     # 2차 카테고리
            "category3": p.get("category3", ""),     # 3차 카테고리
            "category4": p.get("category4", ""),     # 4차 카테고리
            "productid": p.get("productid", ""),     # 네이버 상품 ID
            "created_at": p.get("created_at", ""),   # 등록일
            "updated_at": p.get("updated_at", ""),   # 수정일
        }
        for p in products
    ]


@router.get("/public/products")
async def get_public_products(db: AsyncIOMotorDatabase = Depends(get_db)):
    """일반 사용자용 상품 리스트 (관리자 인증 없음)"""
    products = await db["products"].find().limit(50).to_list(length=None)
    return [
        {
            "id": str(p["_id"]),
            "title": p.get("title", ""),
            "link": p.get("link", ""),
            "image": p.get("image", ""),
            "lprice": p.get("lprice", ""),
            "mallName": p.get("mallName", ""),
            "maker": p.get("maker", ""),
            "brand": p.get("brand", ""),
            "category1": p.get("category1", ""),
            "category2": p.get("category2", ""),
            "category3": p.get("category3", ""),
            "category4": p.get("category4", ""),
            "productid": p.get("productid", ""),
            "created_at": p.get("created_at", ""),
            "updated_at": p.get("updated_at", ""),
        }
        for p in products
    ]


@router.get("/public/products/{product_id}")
async def get_public_product_detail(
    product_id: str, db: AsyncIOMotorDatabase = Depends(get_db)
):
    """일반 사용자용 단일 상품 상세 (관리자 인증 없음)"""
    try:
        obj_id = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="유효하지 않은 상품 ID 입니다.")
    product = await db["products"].find_one({"_id": obj_id})
    if not product:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다.")
    return {
        "id": str(product["_id"]),
        "title": product.get("title", ""),
        "link": product.get("link", ""),
        "image": product.get("image", ""),
        "lprice": product.get("lprice", ""),
        "mallName": product.get("mallName", ""),
        "maker": product.get("maker", ""),
        "brand": product.get("brand", ""),
        "category1": product.get("category1", ""),
        "category2": product.get("category2", ""),
        "category3": product.get("category3", ""),
        "category4": product.get("category4", ""),
        "productid": product.get("productid", ""),
        "created_at": product.get("created_at", ""),
        "updated_at": product.get("updated_at", ""),
        "description": product.get("description", ""),
    }


@router.get("/products/{product_id}")
async def get_product_detail(
    product_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    await verify_admin(request)  # 관리자 인증

    product = await db["products"].find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다.")

    return {
        "id": str(product["_id"]),
        "title": product.get("title", ""),
        "link": product.get("link", ""),
        "image": product.get("image", ""),
        "lprice": product.get("lprice", ""),
        "mallName": product.get("mallName", ""),
        "maker": product.get("maker", ""),
        "brand": product.get("brand", ""),
        "category1": product.get("category1", ""),
        "category2": product.get("category2", ""),
        "category3": product.get("category3", ""),
        "category4": product.get("category4", ""),
        "productid": product.get("productid", ""),
        "created_at": product.get("created_at", ""),
        "updated_at": product.get("updated_at", ""),
        "description": product.get("description", ""),
    }
