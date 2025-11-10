# backend/app/schemas.py
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime


class UserIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: str | None = None
    address: str | None = None
    role: str = "user"


class LoginIn(BaseModel):
    email: EmailStr
    password: str
    remember: bool = False


class RecentlyViewedEntry(BaseModel):
    productId: str
    viewedAt: datetime


class ProductSummary(BaseModel):
    id: str
    name: str
    price: int | None = None
    originalPrice: int | None = None
    image: str | None = None
    category: str | None = None
    brand: str | None = None
    rating: float | None = None
    reviewCount: int | None = None
    description: str | None = None
    images: list[str] = Field(default_factory=list)
    colors: list[str] = Field(default_factory=list)
    sizes: list[str] = Field(default_factory=list)
    stock: int | None = None
    createdAt: datetime | None = None


class RecentlyViewedProductOut(BaseModel):
    product: ProductSummary
    viewedAt: datetime


class RecentlyViewedListOut(BaseModel):
    items: list[RecentlyViewedProductOut] = Field(default_factory=list)
    cacheSource: str = "db"  # "redis" 또는 "db"


class RecentlyViewedPayload(BaseModel):
    productId: str = Field(..., min_length=1)


# 정산 계좌 정보
class SettlementAccount(BaseModel):
    bankName: str | None = None
    accountNumber: str | None = None
    accountHolder: str | None = None


# 배송 설정
class DeliverySettings(BaseModel):
    baseDeliveryFee: int = 3000  # 기본 배송비
    freeDeliveryMinAmount: int = 50000  # 무료 배송 최소 금액
    returnExchangeDeliveryFee: int = 6000  # 반품/교환 배송비


# 알림 설정
class NotificationSettings(BaseModel):
    newOrderAlert: bool = True  # 신규 주문 알림
    lowStockAlert: bool = True  # 재고 부족 알림
    settlementAlert: bool = True  # 정산 알림


# AI 자동화 설정
class AIAutomationSettings(BaseModel):
    priceOptimization: bool = False  # AI 가격 자동 최적화
    stockAlert: bool = True  # AI 재고 자동 알림
    promotionRecommendation: bool = True  # AI 프로모션 자동 추천
    fraudDetection: bool = True  # AI 사기 탐지


class SellerInfo(BaseModel):
    businessName: str | None = None
    businessNumber: str | None = None
    registeredAt: datetime | None = None
    # 연락 정보
    contactEmail: str | None = None
    contactPhone: str | None = None
    # 정산 계좌
    settlementAccount: SettlementAccount | None = None
    # 배송 설정
    deliverySettings: DeliverySettings | None = None
    # 알림 설정
    notificationSettings: NotificationSettings | None = None
    # AI 자동화 설정
    aiAutomationSettings: AIAutomationSettings | None = None


class UserOut(BaseModel):
    id: str = Field(alias="_id")
    email: EmailStr
    name: str
    phone: str | None = None
    address: str | None = None
    role: str = "user"
    points: int = 0  # 적립금
    recentlyViewed: list[RecentlyViewedEntry] = Field(default_factory=list)
    isSeller: bool = False  # 판매자 여부
    sellerInfo: SellerInfo | None = None


class BasicResp(BaseModel):
    message: str


class CartItemBase(BaseModel):
    productId: str = Field(..., min_length=1)
    quantity: int = Field(..., ge=1)
    selectedColor: str | None = None
    selectedSize: str | None = None
    priceSnapshot: int | None = Field(default=None, ge=0)
    nameSnapshot: str | None = None
    imageSnapshot: str | None = None


class CartItemIn(CartItemBase):
    pass


class CartItemOut(CartItemBase):
    id: str = Field(alias="_id")


class CartUpsert(BaseModel):
    items: list[CartItemIn] = Field(default_factory=list)


class CartOut(BaseModel):
    id: str = Field(alias="_id")
    userId: str
    items: list[CartItemOut] = Field(default_factory=list)
    updatedAt: datetime | None = None


class CartItemQuantityUpdate(BaseModel):
    quantity: int = Field(..., ge=1)


class CartItemsDeleteRequest(BaseModel):
    item_ids: list[str] = Field(..., min_length=1)


class SellerRegistrationIn(BaseModel):
    businessName: str = Field(..., min_length=1, max_length=100)
    businessNumber: str = Field(..., min_length=10, max_length=12)

# 판매자 상품 등록 스키마
class SellerProductCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    brand: str | None = None
    category1: str
    category2: str | None = None
    category3: str | None = None
    category4: str | None = None
    numericPrice: int = Field(..., gt=0)
    hprice: int | None = None
    image: str | None = None
    images: list[str] = Field(default_factory=list)
    colors: list[str] = Field(default_factory=list)
    sizes: list[str] = Field(default_factory=list)
    description: str | None = None
    stock: int = Field(default=0, ge=0)
    
# 판매자 상품 수정용
class SellerProductUpdate(BaseModel):
    title: str | None = None
    brand: str | None = None
    category1: str | None = None
    category2: str | None = None
    category3: str | None = None
    category4: str | None = None
    numericPrice: int | None = None
    hprice: int | None = None
    image: str | None = None
    images: list[str] | None = None
    colors: list[str] | None = None
    sizes: list[str] | None = None
    description: str | None = None
    stock: int | None = None
    
# 상품 상세 출력용
class ProductOut(BaseModel):
    id: str
    title: str
    brand: str | None = None
    category1: str | None = None
    category2: str | None = None
    category3: str | None = None
    category4: str | None = None
    numericPrice: int
    hprice: int | None = None
    image: str | None = None
    images: list[str] = Field(default_factory=list)
    colors: list[str] = Field(default_factory=list)
    sizes: list[str] = Field(default_factory=list)
    description: str | None = None
    stock: int = 0
    rating: float | None = None
    reviewCount: int | None = None
    link: str | None = None
    maker: str | None = None
    mallName: str | None = None
    sellerId: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ===== 판매자 설정 관련 스키마 =====

# 판매자 정보 수정
class SellerInfoUpdate(BaseModel):
    contactEmail: EmailStr | None = None
    contactPhone: str | None = None


# 정산 계좌 등록/수정
class SettlementAccountUpdate(BaseModel):
    bankName: str = Field(..., min_length=1, max_length=50)
    accountNumber: str = Field(..., min_length=1, max_length=50)
    accountHolder: str = Field(..., min_length=1, max_length=50)


# 배송 설정 수정
class DeliverySettingsUpdate(BaseModel):
    baseDeliveryFee: int = Field(..., ge=0)
    freeDeliveryMinAmount: int = Field(..., ge=0)
    returnExchangeDeliveryFee: int = Field(..., ge=0)


# 알림 설정 수정
class NotificationSettingsUpdate(BaseModel):
    newOrderAlert: bool
    lowStockAlert: bool
    settlementAlert: bool


# AI 자동화 설정 수정
class AIAutomationSettingsUpdate(BaseModel):
    priceOptimization: bool
    stockAlert: bool
    promotionRecommendation: bool
    fraudDetection: bool