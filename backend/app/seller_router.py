from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime

from .database import get_db
from .user_router import get_current_user
from .schemas import SellerProductCreate, SellerProductUpdate, ProductOut

router = APIRouter(prefix="/seller", tags=["seller"])

PRODUCTS_COL = "products"

@router.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    product: SellerProductCreate,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    ):
    """판매자용 상품 등록"""
    
    # 판매자 여부 확인
    if not current_user.get("isSeller"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="판매자만 상품을 등록할 수 있습니다.",
        )
        
    seller_id = str(current_user["_id"])
    
    # 상품 데이터 생성
    product_data = product.model_dump()
    product_data["sellerId"] = seller_id
    product_data["created_at"] = datetime.utcnow()
    product_data["updated_at"] = datetime.utcnow()
    product_data["rating"] = None
    product_data["reviewCount"] = 0
    
    # db 저장
    result = await db[PRODUCTS_COL].insert_one(product_data)
    
    # 저장된 상품 조회
    created_product = await db[PRODUCTS_COL].find_one({"_id": result.inserted_id})
    
    return ProductOut(
        id=str(created_product["_id"]),
        **{k: v for k, v in created_product.items() if k != "_id"}
        )

@router.get("/products", response_model=list[ProductOut])
async def get_seller_products(
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """판매자용 상품 목록 조회"""
    
    if not current_user.get("isSeller"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="판매자만 상품 목록을 조회할 수 있습니다.",
        )
        
    seller_id = str(current_user["_id"])
    
      # 판매자의 상품만 조회
    cursor = db[PRODUCTS_COL].find({"sellerId": seller_id}).skip(skip).limit(limit)
    products = await cursor.to_list(length=limit)

    return [
        ProductOut(
            id=str(p["_id"]),
            **{k: v for k, v in p.items() if k != "_id"}
        )
        for p in products
    ]
    

@router.get("/products/{product_id}", response_model=ProductOut)
async def get_seller_product(
    product_id: str,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """판매자 상품 상세 조회"""
    
    if not current_user.get("isSeller"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="판매자만 상품 상세를 조회할 수 있습니다.",
        )
        
    seller_id = str(current_user["_id"])
    
    try:
        product = await db[PRODUCTS_COL].find_one({
            "_id": ObjectId(product_id),
            "sellerId": seller_id
        })
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않은 상품 ID 입니다.",
        )
        
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="상품을 찾을 수 없습니다.",
        )

    return ProductOut(
        id=str(product["_id"]),
        **{k: v for k, v in product.items() if k != "_id"}
    )
    
@router.patch("/products/{product_id}", response_model=ProductOut)
async def update_seller_product(
    product_id: str,
    product_update: SellerProductUpdate,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """판매자 상품 수정"""
    
    if not current_user.get("isSeller"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="판매자만 접근할 수 있습니다.",
        )

    seller_id = str(current_user["_id"])
    
      # 업데이트할 데이터 준비 (None이 아닌 값만)
    update_data = {
          k: v for k, v in product_update.model_dump().items()        
          if v is not None
    }

    if not update_data:
          raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="수정할 내용이 없습니다.",
           )

    update_data["updated_at"] = datetime.utcnow()

    try:
        result = await db[PRODUCTS_COL].update_one(
            {"_id": ObjectId(product_id), "sellerId": seller_id},
            {"$set": update_data}
        )
    except Exception:
          raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="잘못된 상품 ID입니다.",
        )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="상품을 찾을 수 없습니다.",
        )

    # 업데이트된 상품 조회
    updated_product = await db[PRODUCTS_COL].find_one({"_id": ObjectId(product_id)})

    return ProductOut(
        id=str(updated_product["_id"]),
        **{k: v for k, v in updated_product.items() if k != "_id"}
    )
    
@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_seller_product(
    product_id: str,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """판매자 상품 삭제"""

    if not current_user.get("isSeller"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="판매자만 접근할 수 있습니다.",
        )

    seller_id = str(current_user["_id"])

    try:
        result = await db[PRODUCTS_COL].delete_one({
            "_id": ObjectId(product_id),
            "sellerId": seller_id
        })
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="잘못된 상품 ID입니다.",
        )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="상품을 찾을 수 없습니다.",
        )

    return None