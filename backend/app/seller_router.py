from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime, timedelta
from .s3_client import s3_client
from .image_utils import process_image, create_thumbnail, generate_unique_filename
from .bedrock_client import bedrock_client
import logging
import base64
import httpx
import json

from .models import ORDERS_COL
from .database import get_db
from .user_router import get_current_user
from .schemas import (
    SellerProductCreate,
    SellerProductUpdate,
    ProductOut,
    SellerDashboardStats,
    SalesStats,
    OrderStats,
    TopProduct,
    StockAlertItem,
    StockAlerts,
    ChartDataPoint,
    ProductListResponse,
    CategorySalesDataPoint,
    HourlyOrdersDataPoint,
)

router = APIRouter(prefix="/seller", tags=["seller"])
logger = logging.getLogger(__name__)


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

@router.get("/products", response_model=ProductListResponse)
async def get_seller_products(
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    q: str = Query(None, description="Search query for product title"),
    category: str = Query(None, description="Filter by category1"),
    status: str = Query(None, description="Filter by product status (판매중, 품절, 재고부족)"),
):
    """판매자용 상품 목록 조회"""
    
    if not current_user.get("isSeller"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="판매자만 상품 목록을 조회할 수 있습니다.",
        )
        
    seller_id = str(current_user["_id"])
    query_filter = {"sellerId": seller_id}

    if q:
        query_filter["title"] = {"$regex": q, "$options": "i"} # Case-insensitive search

    if category and category != "all":
        query_filter["category1"] = category

    if status and status != "all":
        if status == "품절":
            query_filter["stock"] = 0
        elif status == "재고부족":
            query_filter["stock"] = {"$gt": 0, "$lt": 10}
        elif status == "판매중":
            query_filter["stock"] = {"$gte": 10}

    total_count = await db[PRODUCTS_COL].count_documents(query_filter)

    cursor = db[PRODUCTS_COL].find(query_filter).sort("created_at", -1).skip(skip).limit(limit)
    products = await cursor.to_list(length=limit)

    return {
        "total": total_count,
        "items": [
            ProductOut(
                id=str(p["_id"]),
                **{k: v for k, v in p.items() if k != "_id"}
            )
            for p in products
        ]
    }
    

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


@router.get("/dashboard", response_model=SellerDashboardStats)
async def get_seller_dashboard(
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    report_period: str = Query("7days", description="Period for reports: today, 7days, 30days"),
):
    """판매자 대시보드 통계 조회"""

    if not current_user.get("isSeller"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="판매자만 접근할 수 있습니다.",
        )

    seller_id = str(current_user["_id"])
    now = datetime.utcnow()
    
    # --- Dynamic Sales Chart Calculation (NEW) ---
    dynamic_chart_start_date = datetime(now.year, now.month, now.day) # Default to today
    if report_period == "7days":
        dynamic_chart_start_date = now - timedelta(days=7)
    elif report_period == "30days":
        dynamic_chart_start_date = now - timedelta(days=30)

    dynamic_sales_pipeline = [
        {"$match": {
            "status": "PAID",
            "created_at": {"$gte": dynamic_chart_start_date, "$lt": now + timedelta(days=1)},
            "items.sellerId": seller_id
        }},
        {"$unwind": "$items"},
        {"$match": {"items.sellerId": seller_id}},
        {"$group": {
            "_id": {
                "year": {"$year": {"date": "$created_at", "timezone": "Asia/Seoul"}},
                "month": {"$month": {"date": "$created_at", "timezone": "Asia/Seoul"}},
                "day": {"$dayOfMonth": {"date": "$created_at", "timezone": "Asia/Seoul"}}
            },
            "total_amount": {"$sum": {"$multiply": ["$items.price", "$items.quantity"]}}
        }},
        {"$sort": {"_id.year": 1, "_id.month": 1, "_id.day": 1}},
        {"$project": {
            "_id": 0,
            "label": {"$dateToString": {"format": "%m/%d", "date": {"$dateFromParts": {"year": "$_id.year", "month": "$_id.month", "day": "$_id.day"}}}},
            "value": "$total_amount"
        }}
    ]
    dynamic_sales_cursor = db[ORDERS_COL].aggregate(dynamic_sales_pipeline)
    dynamic_sales_chart = await dynamic_sales_cursor.to_list(length=None)
    # Pydantic 모델로 명시적 변환
    dynamic_sales_chart_models = [ChartDataPoint(**item) for item in dynamic_sales_chart]
    # Fill in missing dates with 0 sales for dynamic_sales_chart
    all_dates = []
    current_date_iter = dynamic_chart_start_date
    while current_date_iter <= now:
        all_dates.append(current_date_iter.strftime("%m/%d"))
        current_date_iter += timedelta(days=1)

    filled_dynamic_sales_chart: list[ChartDataPoint] = []
    sales_map = {item.label: item.value for item in dynamic_sales_chart_models}
    for date_label in all_dates:
        filled_dynamic_sales_chart.append(ChartDataPoint(label=date_label, value=sales_map.get(date_label, 0)))
    # --- End Dynamic Sales Chart Calculation ---

    today_start = datetime(now.year, now.month, now.day)
    week_start = now - timedelta(days=7)
    
    # 오늘 매출
    today_orders_cursor = db[ORDERS_COL].find({
        "status": "PAID",
        "created_at": {"$gte": today_start},
        "items.sellerId": seller_id
    })
    
    today_orders_list = await today_orders_cursor.to_list(length=1000)
    
    today_amount = 0
    today_order_count = 0
    for order in today_orders_list:
        for item in order.get("items", []):
            if item.get("sellerId") == seller_id:
                today_amount += item.get("price", 0) * item.get("quantity", 1)
                today_order_count += 1
                
    # 이번 주 매출
    week_orders_cursor = db[ORDERS_COL].find({
        "status": "PAID",
        "created_at": {"$gte": week_start},
        "items.sellerId": seller_id
    })
    
    week_orders_list = await week_orders_cursor.to_list(length=1000)
    
    week_amount = 0
    week_order_count = 0
    for order in week_orders_list:
        for item in order.get("items", []):
            if item.get("sellerId") == seller_id:
                week_amount += item.get("price", 0) * item.get("quantity", 1)
                week_order_count += 1
                
    # 신규 주문
    new_orders_count = await db[ORDERS_COL].count_documents({
        "status": {"$in": ["PAID", "READY", "PENDING"]},
        "items.sellerId": seller_id
    })
    
    # 주문 상태별 통계
    pending_count = await db[ORDERS_COL].count_documents({
        "status": {"$in": ["PAID", "PENDING"]},
        "items.sellerId": seller_id
    })

    shipping_count = await db[ORDERS_COL].count_documents({        
        "status": "SHIPPING",
        "items.sellerId": seller_id
    })

    completed_count = await db[ORDERS_COL].count_documents({       
        "status": "COMPLETED",
        "items.sellerId": seller_id
    })

    # 재고 알림
    out_of_stock_count = await db[PRODUCTS_COL].count_documents({
        "sellerId": seller_id,
        "stock": 0
    })

    low_stock_count = await db[PRODUCTS_COL].count_documents({     
        "sellerId": seller_id,
        "stock": {"$gt": 0, "$lt": 10}
    })

    stock_alert_items_cursor = db[PRODUCTS_COL].find({
        "sellerId": seller_id,
        "stock": {"$lt": 10}
    }).sort("stock", 1).limit(3)

    stock_alert_items_list = await stock_alert_items_cursor.to_list(length=3)
    stock_alert_items = [
        StockAlertItem(
            name=item.get("title", ""),
            stock=item.get("stock", 0),
            status="품절" if item.get("stock", 0) == 0 else "부족"
        )
        for item in stock_alert_items_list
    ]

    # 6. 인기 상품 TOP 10 (판매량 기준)
    # MongoDB aggregation으로 집계
    pipeline = [
        {"$match": {"status": "PAID"}},
        {"$unwind": "$items"},
        {"$match": {"items.sellerId": seller_id}},
        {"$group": {
            "_id": "$items.product_id",
            "product_name": {"$first": "$items.product_name"},     
            "total_sales": {"$sum": "$items.quantity"},
            "total_revenue": {
                "$sum": {
                    "$multiply": ["$items.price", "$items.quantity"]
                }
            }
        }},
        {"$sort": {"total_sales": -1}},
        {"$limit": 10}
    ]

    top_products_cursor = db[ORDERS_COL].aggregate(pipeline)       
    top_products_list = await top_products_cursor.to_list(length=10)

    top_products = [
        TopProduct(
            rank=idx + 1,
            name=p.get("product_name", ""),
            sales=p.get("total_sales", 0),
            revenue=p.get("total_revenue", 0)
        )
        for idx, p in enumerate(top_products_list)
    ]
    
    # 카테고리별 매출 집계 (아래는 리포트 용)
    category_pipeline = [
        {"$match": {"status": "PAID", "items.sellerId": seller_id}},
        {"$unwind": "$items"},
        {"$match": {"items.sellerId": seller_id}},
        # product_id를 string에서 ObjectId로 변환
        {"$addFields": {
            "converted_product_id": {"$toObjectId": "$items.product_id"}
        }},
        {
            "$lookup": {
                "from": PRODUCTS_COL,
                # 변환된 ID를 사용하여 lookup
                "localField": "converted_product_id",
                "foreignField": "_id",
                "as": "product_info"
            }
        },
        {"$unwind": "$product_info"},
        {"$group": {
            "_id": "$product_info.category1",
            "value": {"$sum": {"$multiply": ["$items.price", "$items.quantity"]}}
        }},
        {"$project": {
            "_id": 0,
            "name": "$_id",
            "value": "$value"
        }},
        {"$sort": {"value": -1}}
    ]
    category_sales_cursor = db[ORDERS_COL].aggregate(category_pipeline)
    raw_category_sales = await category_sales_cursor.to_list(length=5)
    category_sales_chart = [CategorySalesDataPoint(**item) for item in raw_category_sales]

    # 시간대별 주문 분포 집계
    hourly_pipeline = [
        {"$match": {"status": "PAID", "items.sellerId": seller_id}},
        {"$project": {
            # UTC로 저장된 created_at을 한국 시간(KST)으로 변환하여 시간 추출
            "hour": {"$hour": {"date": "$created_at", "timezone": "Asia/Seoul"}}
        }},
        {"$group": {
            "_id": "$hour",
            "orders": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}},
        {"$project": {
            "_id": 0,
            "time": {
                "$concat": [
                    {"$cond": [{"$lt": ["$_id", 10]}, "0", ""]},
                    {"$toString": "$_id"},
                    ":00"
                ]
            },
            "orders": "$orders"
        }}
    ]
    hourly_orders_cursor = db[ORDERS_COL].aggregate(hourly_pipeline)
    raw_hourly_orders = await hourly_orders_cursor.to_list(length=24)
    hourly_orders_chart = [HourlyOrdersDataPoint(**item) for item in raw_hourly_orders]

    # 고객 재구매율 계산
    re_purchase_pipeline = [
        {"$match": {"items.sellerId": seller_id, "status": "PAID"}},
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
        {"$group": {
            "_id": None,
            "totalCustomers": {"$sum": 1},
            "repeatCustomers": {
                "$sum": {"$cond": [{"$gt": ["$count", 1]}, 1, 0]}
            }
        }}
    ]   
    repurchase_cursor = db[ORDERS_COL].aggregate(re_purchase_pipeline)
    repurchase_data = await repurchase_cursor.to_list(length=1)

    repurchase_rate = 0
    if repurchase_data and repurchase_data[0]["totalCustomers"] > 0:
        repurchase_rate = (repurchase_data[0]["repeatCustomers"] / repurchase_data[0]["totalCustomers"]) * 100

    # TODO: 변화율 계산 (어제/지난주 대비)
    today_change = 0.0
    week_change = 0.0

    # 7. 일별 매출 차트 (최근 7일)
    daily_sales_chart = []
    for i in range(6, -1, -1):  # 7일 전부터 오늘까지
        day_start = datetime(now.year, now.month, now.day) - timedelta(days=i)
        day_end = day_start + timedelta(days=1)

        day_orders_cursor = db[ORDERS_COL].find({
            "status": "PAID",
            "created_at": {"$gte": day_start, "$lt": day_end},
            "items.sellerId": seller_id
        })
        day_orders_list = await day_orders_cursor.to_list(length=1000)

        day_amount = 0
        for order in day_orders_list:
            for item in order.get("items", []):
                if item.get("sellerId") == seller_id:
                    day_amount += item.get("price", 0) * item.get("quantity", 1)

        daily_sales_chart.append(ChartDataPoint(
            label=day_start.strftime("%m/%d"),
            value=day_amount
        ))

    # 8. 주간 매출 차트 (최근 5주)
    weekly_sales_chart = []
    for i in range(4, -1, -1):  # 5주 전부터 이번 주까지
        week_start_date = now - timedelta(days=now.weekday()) - timedelta(weeks=i)
        week_end_date = week_start_date + timedelta(days=7)

        week_orders_cursor = db[ORDERS_COL].find({
            "status": "PAID",
            "created_at": {"$gte": week_start_date, "$lt": week_end_date},
            "items.sellerId": seller_id
        })
        week_orders_list = await week_orders_cursor.to_list(length=1000)

        week_amount = 0
        for order in week_orders_list:
            for item in order.get("items", []):
                if item.get("sellerId") == seller_id:
                    week_amount += item.get("price", 0) * item.get("quantity", 1)

        # 주차 계산
        week_number = week_start_date.isocalendar()[1]
        weekly_sales_chart.append(ChartDataPoint(
            label=f"{week_number}주",
            value=week_amount
        ))

    # 9. 월간 매출 차트 (최근 6개월)
    monthly_sales_chart = []
    for i in range(5, -1, -1):  # 6개월 전부터 이번 달까지
        # 월 계산
        target_year = now.year
        target_month = now.month - i

        if target_month <= 0:
            target_month += 12
            target_year -= 1

        month_start = datetime(target_year, target_month, 1)

        # 다음 달 첫날 (종료일)
        if target_month == 12:
            month_end = datetime(target_year + 1, 1, 1)
        else:
            month_end = datetime(target_year, target_month + 1, 1)

        month_orders_cursor = db[ORDERS_COL].find({
            "status": "PAID",
            "created_at": {"$gte": month_start, "$lt": month_end},
            "items.sellerId": seller_id
        })
        month_orders_list = await month_orders_cursor.to_list(length=1000)

        month_amount = 0
        for order in month_orders_list:
            for item in order.get("items", []):
                if item.get("sellerId") == seller_id:
                    month_amount += item.get("price", 0) * item.get("quantity", 1)

        monthly_sales_chart.append(ChartDataPoint(
            label=f"{target_month}월",
            value=month_amount
        ))

    return SellerDashboardStats(
        today=SalesStats(
            amount=today_amount,
            change=today_change,
            orders=today_order_count
        ),
        week=SalesStats(
            amount=week_amount,
            change=week_change,
            orders=week_order_count
        ),
        newOrders=new_orders_count,
        stockAlertsCount=out_of_stock_count + low_stock_count,
        orderStats=OrderStats(
            pending=pending_count,
            shipping=shipping_count,
            completed=completed_count
        ),
        topProducts=top_products,
        stockAlerts=StockAlerts(
            outOfStock=out_of_stock_count,
            lowStock=low_stock_count,
            items=stock_alert_items
        ),
        dailySalesChart=daily_sales_chart,
        weeklySalesChart=weekly_sales_chart,
        monthlySalesChart=monthly_sales_chart,
        categorySalesChart=category_sales_chart,
        hourlyOrdersChart=hourly_orders_chart,
        repurchaseRate=repurchase_rate,
        dynamicSalesChart=filled_dynamic_sales_chart,
    )


@router.post("/upload-image")
async def upload_product_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    상품 이미지 업로드
    - 이미지를 S3에 업로드하고 URL 반환
    - 원본 이미지: 1200px로 리사이즈 + 압축
    - 썸네일: 200x200px
    """
    
    #판매자 권한 확인
    if not current_user.get("isSeller"):
        raise HTTPException(status_code=403, detail="판매자 권한이 필요합니다")
    
    #파일 타입 검증
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일이 아닙니다")
    
    #파일 크기 제한(10MB)
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="파일 크기가 10MB를 초과합니다")
    
    try:
        #고유 파일명 생성
        filename = generate_unique_filename(file.filename or "image.jpg")
        
        #이미지 처리
        processed_image, content_type = process_image(contents)
        thumbnail_image, _ = create_thumbnail(contents)
        
        #S3에 업로드
        seller_id = current_user.get("user_id")
        main_key = f"products/{seller_id}/{filename}"
        thumb_key = f"products/{seller_id}/thumbnails/{filename}"
        
        main_url = s3_client.upload_file(processed_image, main_key, content_type)
        thumb_url = s3_client.upload_file(thumbnail_image, thumb_key, content_type)
        
        return {
            "success": True,
            "image_url": main_url,
            "thumbnail_url": thumb_url
        }
        
    except Exception as e:
        logger.error(f"이미지 업로드 실패: {e}")
        raise HTTPException(status_code=500, detail=f"이미지 업로드에 실패했습니다:{str(e)}")
    
@router.post("/ai/generate-description")
async def generate_product_description(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    AI 상품 설명 자동 생성
    - 이미지 URL들을 분석하여 상품 정보 생성
    """
    
    # 판매자 권한 확인
    if not current_user.get("isSeller"):
        raise HTTPException(status_code=403, detail="판매자 권한이 필요합니다.")
    
    image_urls = request.get("image_urls", [])
    if not image_urls:
        raise HTTPException(status_code=400, detail="이미지 URL이 필요합니다.")
    
    # Bedrock 클라이언트 확인
    if bedrock_client is None:
        raise HTTPException(status_code=503, detail="AI 서비스를 사용할 수 없습니다")
    
    try:
        # 이미지 다운로드 및 base64 인코딩
        image_contents = []
        async with httpx.AsyncClient(timeout=30.0) as client:
            for url in image_urls[:3]:
                try:
                    response = await client.get(url)
                    if response.status_code == 200:
                        image_base64 = base64.b64encode(response.content).decode('utf-8')
                        image_contents.append({
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_base64
                            }
                        })
                except Exception as e:
                    logger.error(f"이미지 다운로드 실패 {url}: {e}")
                    continue
                
        if not image_contents:
            raise HTTPException(status_code=400, detail="이미지를 불러올 수 없습니다.")
        
        # LLM 요청
        messages = [{
            "role": "user",
            "content": [
                *image_contents,
                {
                "type": "text",
                "text": """이 상품 이미지를 분석하여 다음 정보를 JSON 형식으로 생성해주세요:

{
  "title": "상품명 (한국어, 간결하고 매력적으로)",
  "category": "카테고리 (반드시 다음 중 정확히 하나: 가구/인테리어, 디지털/가전, 생활/건강, 스포츠/레저, 식품, 여가/생활편의, 출산/육아, 패션의류, 패션잡화, 화장품/미용)",
  "brand": "브랜드명 (보이면 작성, 없으면 null)",
  "description": "상세 설명 (200자 이상, 특징과 장점 포함)",
  "colors": ["색상1", "색상2"] 또는 null,
  "sizes": ["S", "M", "L"] 또는 null,
  "suggested_price": 예상가격 (숫자만, 예: 29900)
}

중요: category는 반드시 위 10개 카테고리 중 정확히 하나여야 합니다. 슬래시(/)를 포함한 정확한 표기를 사용하세요. JSON 외의 다른 텍스트는 출력하지 마세요."""
                                }
                            ]
                        }]
        # Bedrock API 호출
        response = bedrock_client.client.invoke_model(
            modelId=bedrock_client.model_id,
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 2000,
                "messages": messages,
                "temperature": 0.7
            })
        )

        response_body = json.loads(response['body'].read())
        ai_text = response_body['content'][0]['text']

        # JSON 추출 (마크다운 코드 블록 제거)
        ai_text = ai_text.strip()
        if ai_text.startswith("```"):
            ai_text = ai_text.split("```")[1]
            if ai_text.startswith("json"):
                ai_text = ai_text[4:]

        result = json.loads(ai_text.strip())

        logger.info(f"AI 상품 설명 생성 완료: {result.get('title')}")
        return {
            "success": True,
            "data": result
        }

    except json.JSONDecodeError as e:
        logger.error(f"AI 응답 JSON 파싱 실패: {e}, 응답: {ai_text}")
        raise HTTPException(status_code=500, detail="AI 응답을 처리할 수 없습니다")
    except Exception as e:
        logger.error(f"AI 상품 설명 생성 실패: {e}")
        raise HTTPException(status_code=500, detail=f"AI 생성 실패: {str(e)}")