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


class SellerInfo(BaseModel):
    businessName: str | None = None
    businessNumber: str | None = None
    registeredAt: datetime | None = None


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

# 판매자 대시보드 - 매출 통계
class SalesStats(BaseModel):
    amount: int = 0
    change: float = 0.0  # 변화율 (%)
    orders: int = 0

# 판매자 대시보드 - 주문 상태 통계
class OrderStats(BaseModel):
    pending: int = 0      # 처리대기
    shipping: int = 0     # 배송중
    completed: int = 0    # 완료

# 판매자 대시보드 - 인기 상품
class TopProduct(BaseModel):
    rank: int
    name: str
    sales: int        # 판매량
    revenue: int      # 매출

# 판매자 대시보드 - 재고 알림 아이템
class StockAlertItem(BaseModel):
    name: str
    stock: int
    status: str  # "품절" 또는 "부족"

# 판매자 대시보드 - 재고 알림
class StockAlerts(BaseModel):
    outOfStock: int = 0   # 품절 상품 수
    lowStock: int = 0     # 재고 부족 상품 수
    items: list[StockAlertItem] = Field(default_factory=list)

# 판매자 대시보드 - 차트 데이터 포인트
class ChartDataPoint(BaseModel):
    label: str  # 날짜/주/월 레이블
    value: int  # 매출액
    
class CategorySalesDataPoint(BaseModel):
    name: str
    value: int

class HourlyOrdersDataPoint(BaseModel):
    time: str
    orders: int
    
# 판매자 대시보드 - 전체 응답
class SellerDashboardStats(BaseModel):
    today: SalesStats = Field(default_factory=SalesStats)
    week: SalesStats = Field(default_factory=SalesStats)
    newOrders: int = 0
    stockAlertsCount: int = 0
    orderStats: OrderStats = Field(default_factory=OrderStats)
    topProducts: list[TopProduct] = Field(default_factory=list)
    stockAlerts: StockAlerts = Field(default_factory=StockAlerts)
    dailySalesChart: list[ChartDataPoint] = Field(default_factory=list)
    weeklySalesChart: list[ChartDataPoint] = Field(default_factory=list)
    monthlySalesChart: list[ChartDataPoint] = Field(default_factory=list)
    categorySalesChart: list[CategorySalesDataPoint]
    hourlyOrdersChart: list[HourlyOrdersDataPoint]
    repurchaseRate: float
    aiInsights: list[str] = Field(default_factory=list)
    dynamicSalesChart: list[ChartDataPoint] = Field(default_factory=list)



class ProductListResponse(BaseModel):
    total: int
    items: list[ProductOut]



class ProductListResponse(BaseModel):
    total: int
    items: list[ProductOut]