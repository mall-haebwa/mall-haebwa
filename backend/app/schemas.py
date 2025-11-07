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


class UserOut(BaseModel):
    id: str = Field(alias="_id")
    email: EmailStr
    name: str
    phone: str | None = None
    address: str | None = None
    role: str = "user"
    points: int = 0  # 적립금
    recentlyViewed: list[RecentlyViewedEntry] = Field(default_factory=list)


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
