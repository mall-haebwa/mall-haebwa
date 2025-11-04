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


class UserOut(BaseModel):
    id: str = Field(alias="_id")
    email: EmailStr
    name: str
    phone: str | None = None
    address: str | None = None
    role: str = "user"
    points: int = 0  # 적립금


class BasicResp(BaseModel):
    message: str

class CartItemBase(BaseModel):
    productId: str = Field(..., min_length = 1)
    quantity: int = Field(..., ge = 1)
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