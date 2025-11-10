from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from .database import get_db
from .models import USERS_COL
from .schemas import (
    AIAutomationSettingsUpdate,
    DeliverySettingsUpdate,
    NotificationSettingsUpdate,
    SellerInfoUpdate,
    SettlementAccountUpdate,
    UserOut,
)
from .user_router import get_current_user

router = APIRouter(prefix="/seller/settings", tags=["seller-settings"])


async def check_seller(current_user: dict):
    """판매자 권한 확인"""
    if not current_user.get("isSeller"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="판매자만 접근할 수 있습니다.",
        )


@router.get("", response_model=UserOut, status_code=status.HTTP_200_OK)
async def get_seller_settings(
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    판매자 설정 전체 조회

    현재 로그인한 판매자의 모든 설정을 조회합니다.
    """
    await check_seller(current_user)

    # 사용자 정보 조회
    user_id = current_user["_id"]
    user = await db[USERS_COL].find_one({"_id": ObjectId(user_id)})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다.",
        )

    # _id를 문자열로 변환
    user["_id"] = str(user["_id"])

    return user


@router.patch("/info", response_model=UserOut, status_code=status.HTTP_200_OK)
async def update_seller_info(
    payload: SellerInfoUpdate,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    판매자 정보 수정

    판매자의 연락처 정보를 수정합니다.
    """
    await check_seller(current_user)

    user_id = current_user["_id"]

    # 업데이트할 필드 구성
    update_fields = {}
    if payload.contactEmail is not None:
        update_fields["sellerInfo.contactEmail"] = payload.contactEmail
    if payload.contactPhone is not None:
        update_fields["sellerInfo.contactPhone"] = payload.contactPhone

    if not update_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="수정할 정보가 없습니다.",
        )

    # DB 업데이트
    result = await db[USERS_COL].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_fields}
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다.",
        )

    # 업데이트된 사용자 정보 조회
    updated_user = await db[USERS_COL].find_one({"_id": ObjectId(user_id)})
    updated_user["_id"] = str(updated_user["_id"])

    return updated_user


@router.patch("/account", response_model=UserOut, status_code=status.HTTP_200_OK)
async def update_settlement_account(
    payload: SettlementAccountUpdate,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    정산 계좌 등록/수정

    판매자의 정산 계좌 정보를 등록하거나 수정합니다.
    """
    await check_seller(current_user)

    user_id = current_user["_id"]

    # 정산 계좌 정보 구성
    settlement_account = {
        "bankName": payload.bankName,
        "accountNumber": payload.accountNumber,
        "accountHolder": payload.accountHolder,
    }

    # DB 업데이트
    result = await db[USERS_COL].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"sellerInfo.settlementAccount": settlement_account}}
    )

    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="정산 계좌 등록에 실패했습니다.",
        )

    # 업데이트된 사용자 정보 조회
    updated_user = await db[USERS_COL].find_one({"_id": ObjectId(user_id)})
    updated_user["_id"] = str(updated_user["_id"])

    return updated_user


@router.patch("/delivery", response_model=UserOut, status_code=status.HTTP_200_OK)
async def update_delivery_settings(
    payload: DeliverySettingsUpdate,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    배송 설정 수정

    판매자의 배송 관련 설정을 수정합니다.
    """
    await check_seller(current_user)

    user_id = current_user["_id"]

    # 배송 설정 정보 구성
    delivery_settings = {
        "baseDeliveryFee": payload.baseDeliveryFee,
        "freeDeliveryMinAmount": payload.freeDeliveryMinAmount,
        "returnExchangeDeliveryFee": payload.returnExchangeDeliveryFee,
    }

    # DB 업데이트
    result = await db[USERS_COL].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"sellerInfo.deliverySettings": delivery_settings}}
    )

    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="배송 설정 수정에 실패했습니다.",
        )

    # 업데이트된 사용자 정보 조회
    updated_user = await db[USERS_COL].find_one({"_id": ObjectId(user_id)})
    updated_user["_id"] = str(updated_user["_id"])

    return updated_user


@router.patch("/notifications", response_model=UserOut, status_code=status.HTTP_200_OK)
async def update_notification_settings(
    payload: NotificationSettingsUpdate,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    알림 설정 수정

    판매자의 알림 설정을 수정합니다.
    """
    await check_seller(current_user)

    user_id = current_user["_id"]

    # 알림 설정 정보 구성
    notification_settings = {
        "newOrderAlert": payload.newOrderAlert,
        "lowStockAlert": payload.lowStockAlert,
        "settlementAlert": payload.settlementAlert,
    }

    # DB 업데이트
    result = await db[USERS_COL].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"sellerInfo.notificationSettings": notification_settings}}
    )

    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="알림 설정 수정에 실패했습니다.",
        )

    # 업데이트된 사용자 정보 조회
    updated_user = await db[USERS_COL].find_one({"_id": ObjectId(user_id)})
    updated_user["_id"] = str(updated_user["_id"])

    return updated_user


@router.patch("/ai-automation", response_model=UserOut, status_code=status.HTTP_200_OK)
async def update_ai_automation_settings(
    payload: AIAutomationSettingsUpdate,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    AI 자동화 설정 수정

    판매자의 AI 자동화 설정을 수정합니다.
    """
    await check_seller(current_user)

    user_id = current_user["_id"]

    # AI 자동화 설정 정보 구성
    ai_automation_settings = {
        "priceOptimization": payload.priceOptimization,
        "stockAlert": payload.stockAlert,
        "promotionRecommendation": payload.promotionRecommendation,
        "fraudDetection": payload.fraudDetection,
    }

    # DB 업데이트
    result = await db[USERS_COL].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"sellerInfo.aiAutomationSettings": ai_automation_settings}}
    )

    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI 자동화 설정 수정에 실패했습니다.",
        )

    # 업데이트된 사용자 정보 조회
    updated_user = await db[USERS_COL].find_one({"_id": ObjectId(user_id)})
    updated_user["_id"] = str(updated_user["_id"])

    return updated_user
