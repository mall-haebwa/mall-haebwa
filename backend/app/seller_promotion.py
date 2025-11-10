from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from .database import get_db
from .schemas import (
    BasicResp,
    CouponCreate,
    CouponOut,
    CouponUpdate,
)
from .user_router import get_current_user

router = APIRouter(prefix="/seller/coupons", tags=["seller-coupons"])
COUPONS_COL = "coupons"
PRODUCTS_COL = "products"


async def check_seller(current_user: dict):
    # 판매자 권한 확인
    if not current_user.get("isSeller"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="판매자만 접근할 수 있습니다.",
        )


async def normalize_applicable_products(
    product_ids: list[str] | None,
    seller_id: str,
    db: AsyncIOMotorDatabase,
) -> list[str]:
    """
    선택된 상품 ID가 모두 현재 판매자에게 속하는지 검증하고 정규화
    """
    if not product_ids:
        return []

    normalized: list[str] = []
    object_ids: list[ObjectId] = []
    seen: set[str] = set()

    for product_id in product_ids:
        if not product_id or product_id in seen:
            continue
        try:
            object_ids.append(ObjectId(product_id))
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="유효하지 않은 상품 ID가 포함되어 있습니다.",
            )
        normalized.append(product_id)
        seen.add(product_id)

    if not normalized:
        return []

    count = await db[PRODUCTS_COL].count_documents(
        {"_id": {"$in": object_ids}, "sellerId": seller_id}
    )
    if count != len(normalized):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="선택한 상품 중 판매자의 상품이 아닌 항목이 포함되어 있습니다.",
        )

    return normalized


@router.post("", response_model=CouponOut, status_code=status.HTTP_201_CREATED)
async def create_coupon(
    payload: CouponCreate,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    쿠폰 생성

    판매자가 새로운 쿠폰을 생성합니다.
    """
    await check_seller(current_user)

    seller_id = str(current_user["_id"])
    applicable_products = await normalize_applicable_products(
        payload.applicableProducts,
        seller_id,
        db,
    )

    #같은 판매자가 같은 코드의 쿠폰을 이미 생성했는지 확인
    existing_coupon = await db[COUPONS_COL].find_one({
        "sellerId": seller_id,
        "code": payload.code.upper()
    })

    if existing_coupon:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail=f"쿠폰 코드 '{payload.code}'는 이미 사용 중입니다.",
        )
    
    # 날짜 유효성 검증
    if payload.endDate <= payload.startDate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="종료일은 시작일보다 이후여야 합니다.",
        )
    
    # 쿠폰 데이터 구성
    now = datetime.now(timezone.utc)
    coupon_data = {
        "sellerId": seller_id,
        "name": payload.name,
        "code": payload.code.upper(), # 대문자로 통일
        "discountType": payload.discountType,
        "discountValue": payload.discountValue,
        "minOrderAmount": payload.minOrderAmount,
        "maxDiscount": payload.maxDiscount,
        "totalQuantity": payload.totalQuantity,
        "usedQuantity": 0, # 초기값
        "startDate": payload.startDate,
        "endDate": payload.endDate,
        "status": "active" if payload.startDate <= now <= payload.endDate else "inactive",
        "applicableProducts": applicable_products,
        "created_at": now,
        "updated_at": now,
    }

    # DB에 저장
    result = await db[COUPONS_COL].insert_one(coupon_data)
    created_coupon = await db[COUPONS_COL].find_one({"_id": result.inserted_id})

    # _id를 문자열로 변환
    created_coupon["_id"] = str(created_coupon["_id"])
    created_coupon.setdefault("applicableProducts", [])

    return created_coupon


@router.get("", response_model=list[CouponOut], status_code=status.HTTP_200_OK)
async def get_coupons(
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    status_filter: str | None = None,  # 쿼리 파라미터: ?status=active
):
    """
    쿠폰 목록 조회

    판매자가 생성한 모든 쿠폰을 조회합니다.
    status 파라미터로 필터링 가능 (active, inactive, expired)
    """
    await check_seller(current_user)

    seller_id = str(current_user["_id"])

    # 필터 구성
    query = {"sellerId": seller_id}
    if status_filter:
        query["status"] = status_filter

    # 쿠폰 조회 (최신순)
    coupons_cursor = db[COUPONS_COL].find(query).sort("created_at", -1)
    coupons = await coupons_cursor.to_list(length=None)

    # _id를 문자열로 변환
    for coupon in coupons:
        coupon["_id"] = str(coupon["_id"])
        coupon.setdefault("applicableProducts", [])

    return coupons

@router.get("/{coupon_id}", response_model=CouponOut, status_code=status.HTTP_200_OK)
async def get_coupon(
    coupon_id: str,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    쿠폰 상세 조회

    특정 쿠폰의 상세 정보를 조회합니다.
    """
    await check_seller(current_user)

    seller_id = str(current_user["_id"])

    try:
        coupon = await db[COUPONS_COL].find_one({
            "_id": ObjectId(coupon_id),
            "sellerId": seller_id  # 본인의 쿠폰만 조회
        })
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않은 쿠폰 ID입니다.",
        )

    if not coupon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="쿠폰을 찾을 수 없습니다.",
        )

    # _id를 문자열로 변환
    coupon["_id"] = str(coupon["_id"])
    coupon.setdefault("applicableProducts", [])

    return coupon

@router.patch("/{coupon_id}", response_model=CouponOut, status_code=status.HTTP_200_OK)
async def update_coupon(
    coupon_id: str,
    payload: CouponUpdate,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    쿠폰 수정

    쿠폰 정보를 수정합니다.
    """
    await check_seller(current_user)

    seller_id = str(current_user["_id"])

    # 쿠폰 존재 확인
    try:
        existing_coupon = await db[COUPONS_COL].find_one({
            "_id": ObjectId(coupon_id),
            "sellerId": seller_id
        })
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않은 쿠폰 ID입니다.",
        )

    if not existing_coupon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="쿠폰을 찾을 수 없습니다.",
        )

    # 업데이트할 필드 구성
    update_fields = {}
    if payload.name is not None:
        update_fields["name"] = payload.name
    if payload.discountType is not None:
        update_fields["discountType"] = payload.discountType
    if payload.discountValue is not None:
        update_fields["discountValue"] = payload.discountValue
    if payload.minOrderAmount is not None:
        update_fields["minOrderAmount"] = payload.minOrderAmount
    if payload.maxDiscount is not None:
        update_fields["maxDiscount"] = payload.maxDiscount
    if payload.totalQuantity is not None:
        update_fields["totalQuantity"] = payload.totalQuantity
    if payload.startDate is not None:
        update_fields["startDate"] = payload.startDate
    if payload.endDate is not None:
        update_fields["endDate"] = payload.endDate
    if payload.status is not None:
        update_fields["status"] = payload.status
    if payload.applicableProducts is not None:
        update_fields["applicableProducts"] = await normalize_applicable_products(
            payload.applicableProducts,
            seller_id,
            db,
        )

    if not update_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="수정할 정보가 없습니다.",
        )

    # 날짜 유효성 검증 (둘 다 제공된 경우)
    start_date = payload.startDate or existing_coupon["startDate"]
    end_date = payload.endDate or existing_coupon["endDate"]
    if end_date <= start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="종료일은 시작일보다 이후여야 합니다.",
        )

    update_fields["updated_at"] = datetime.utcnow()

    # DB 업데이트
    result = await db[COUPONS_COL].update_one(
        {"_id": ObjectId(coupon_id)},
        {"$set": update_fields}
    )

    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="쿠폰 수정에 실패했습니다.",
        )

    # 업데이트된 쿠폰 조회
    updated_coupon = await db[COUPONS_COL].find_one({"_id": ObjectId(coupon_id)})
    updated_coupon["_id"] = str(updated_coupon["_id"])
    updated_coupon.setdefault("applicableProducts", [])

    return updated_coupon

@router.delete("/{coupon_id}", response_model=BasicResp, status_code=status.HTTP_200_OK)
async def delete_coupon(
    coupon_id: str,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    쿠폰 삭제

    쿠폰을 삭제합니다.
    """
    await check_seller(current_user)

    seller_id = str(current_user["_id"])

    # 쿠폰 존재 확인
    try:
        existing_coupon = await db[COUPONS_COL].find_one({
            "_id": ObjectId(coupon_id),
            "sellerId": seller_id
        })
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않은 쿠폰 ID입니다.",
        )

    if not existing_coupon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="쿠폰을 찾을 수 없습니다.",
        )

    # 이미 사용된 쿠폰이 있으면 삭제 불가
    if existing_coupon["usedQuantity"] > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 사용된 쿠폰은 삭제할 수 없습니다. 상태를 'inactive'로 변경하세요.",
        )

    # DB에서 삭제
    result = await db[COUPONS_COL].delete_one({"_id": ObjectId(coupon_id)})

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="쿠폰 삭제에 실패했습니다.",
        )

    return BasicResp(message="쿠폰이 성공적으로 삭제되었습니다.")
