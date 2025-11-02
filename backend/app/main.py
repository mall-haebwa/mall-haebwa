# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import get_db
from .auth_router import router as auth_router
from .models import ensure_indexes
import os
from .admin_router import router as admin_router
from .product_router import router as product_router
app = FastAPI(title="AI Shop API")

origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173")
origins = [origin.strip() for origin in origins_str.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,  # 쿠키 허용 중요!
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    db = get_db()
    await ensure_indexes(db)

app.include_router(auth_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(product_router, prefix="/api")
