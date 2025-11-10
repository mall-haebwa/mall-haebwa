"""
LLM이 가공한 상품 데이터를 MongoDB에 임포트

실행 방법:
    # 전체 디렉토리 처리
    python -m backend.scripts.import_processed_data --input-dir ./data_batches/processed
    
    # 단일 파일 처리
    python -m backend.scripts.import_processed_data --file ./data_batches/processed/processed_0000.json

기능:
    - LLM 가공 데이터 + 원본 데이터 결합
    - Rank 기반 리뷰 자동 생성
    - products_v2 컬렉션에 저장
"""

import os
import json
import sys
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
import random
import argparse


def generate_review_data(rank: int) -> dict:
    """
    Rank 기반 리뷰 데이터 생성
    
    Args:
        rank: 검색 순위 (1이 최상위, 999가 최하위)
    
    Returns:
        {"rating": 4.5, "count": 1240, "isGenerated": True}
    """
    
    if rank <= 10:
        # 상위 10위: 베스트셀러
        rating = round(random.uniform(4.6, 5.0), 1)
        count = random.randint(800, 2500)
        
    elif rank <= 30:
        # 11~30위: 인기 상품
        rating = round(random.uniform(4.3, 4.7), 1)
        count = random.randint(400, 800)
        
    elif rank <= 100:
        # 31~100위: 중상위 상품
        rating = round(random.uniform(4.0, 4.5), 1)
        count = random.randint(150, 400)
        
    elif rank <= 300:
        # 101~300위: 중간 상품
        rating = round(random.uniform(3.8, 4.3), 1)
        count = random.randint(50, 150)
        
    else:
        # 301위 이상: 하위 상품
        rating = round(random.uniform(3.5, 4.0), 1)
        count = random.randint(10, 50)
    
    return {
        "rating": rating,
        "count": count,
        "isGenerated": True
    }


def import_processed_batch(processed_file: str, db, dry_run=False):
    """
    가공된 JSON 파일을 MongoDB에 저장
    
    Args:
        processed_file: LLM이 가공한 JSON 파일 경로
        db: MongoDB database 객체
        dry_run: True면 실제 저장하지 않고 출력만
    """
    
    products_original = db["products"]
    products_processed = db["products_v2"]
    
    # 가공된 데이터 로드
    print(f"\n📂 파일 로드: {processed_file}")
    
    with open(processed_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if "products" not in data:
        print(f"❌ 오류: 'products' 키가 없습니다. JSON 형식을 확인하세요.")
        return
    
    success_count = 0
    error_count = 0
    
    total = len(data["products"])
    print(f"📊 처리할 상품: {total}개\n")
    
    for idx, item in enumerate(data["products"], 1):
        try:
            # ID 확인
            if "id" not in item:
                print(f"⚠️  [{idx}/{total}] ID 없음 - 건너뜀")
                error_count += 1
                continue
            
            product_id = ObjectId(item["id"])
            processed_data = item.get("processed", {})
            
            # 원본 데이터 가져오기
            original = products_original.find_one({"_id": product_id})
            
            if not original:
                print(f"⚠️  [{idx}/{total}] 원본 데이터 없음: {product_id}")
                error_count += 1
                continue
            
            # 리뷰 데이터 생성 (rank 기반)
            rank = original.get("rank", 999)
            reviews = generate_review_data(rank)
            
            # 가격 정보 구성
            current_price = original.get("lprice", 0)
            discount_data = processed_data.get("discount")
            
            price_info = {
                "current": current_price,
                "currency": "KRW"
            }
            
            # 할인 정보 추가 (제목에서 추출된 경우만)
            if discount_data and discount_data.get("fromTitle"):
                price_info["discount"] = {
                    "fromTitle": True,
                    "type": discount_data.get("type"),
                    "rate": discount_data.get("rate"),
                    "amount": discount_data.get("amount"),
                    "originalText": discount_data.get("originalText")
                }
                
                # 원가 역산 (할인율 있는 경우)
                if discount_data.get("type") == "rate" and discount_data.get("rate"):
                    rate = discount_data["rate"]
                    if rate > 0 and rate < 100:  # 유효성 검사
                        estimated_original = int(current_price / (1 - rate / 100))
                        price_info["discount"]["estimatedOriginal"] = estimated_original
                
                # 할인 금액 있는 경우
                elif discount_data.get("type") == "amount" and discount_data.get("amount"):
                    estimated_original = current_price + discount_data["amount"]
                    price_info["discount"]["estimatedOriginal"] = estimated_original
            
            # 새 문서 생성
            new_doc = {
                "_id": product_id,
                
                # 상품명 (원본 그대로!)
                "name": original.get("title", ""),
                
                # 가격 (할인 정보 포함)
                "price": price_info,
                
                # 판매자
                "seller": {
                    "name": original.get("mallName", ""),
                    "type": processed_data.get("sellerType", "general")
                },
                
                # 브랜드 (LLM 표준화)
                "brand": processed_data.get("brand", original.get("brand", "")),
                
                # 이미지 (네이버 URL 그대로)
                "images": {
                    "thumbnail": original.get("image", ""),
                    "detail": []
                },
                
                # 옵션 (비워둠)
                "options": [],
                
                # 카테고리
                "category": {
                    "path": processed_data.get("categoryPath", []),
                    "original": {
                        "category1": original.get("category1"),
                        "category2": original.get("category2"),
                        "category3": original.get("category3"),
                        "category4": original.get("category4")
                    }
                },
                
                # 설명
                "description": {
                    "summary": processed_data.get("summary", ""),
                    "detail": ""
                },
                
                # 검색 메타데이터
                "searchKeywords": processed_data.get("searchKeywords", {
                    "tags": [],
                    "targetAudience": [],
                    "useCase": [],
                    "seasonality": [],
                    "features": []
                }),
                
                # 재고 (기본 true)
                "stock": {
                    "available": True
                },
                
                # 리뷰 (rank 기반 생성!)
                "reviews": reviews,
                
                # 원본 데이터 보존
                "source": {
                    "provider": "naver",
                    "productId": original.get("productId"),
                    "rank": rank,
                    "searchKeyword": original.get("search_keyword"),
                    "originalTitle": original.get("title"),
                    "link": original.get("link")
                },
                
                # 상태
                "status": {
                    "processed": True,
                    "published": True
                },
                
                # 타임스탬프
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            }
            
            # Dry run 모드
            if dry_run:
                print(f"✓ [{idx}/{total}] {original.get('title', '')[:50]}...")
                if idx == 1:  # 첫 번째 상품만 자세히 출력
                    print(f"  → 샘플 데이터:")
                    print(f"     name: {new_doc['name'][:50]}...")
                    print(f"     price: {new_doc['price']}")
                    print(f"     reviews: {new_doc['reviews']}")
                    print(f"     category: {new_doc['category']['path']}")
            else:
                # 실제 저장
                products_processed.replace_one(
                    {"_id": product_id},
                    new_doc,
                    upsert=True
                )
                
                if idx % 100 == 0:
                    print(f"✓ [{idx}/{total}] 처리 중...")
            
            success_count += 1
            
        except Exception as e:
            print(f"❌ [{idx}/{total}] 오류 ({item.get('id', 'unknown')}): {e}")
            error_count += 1
    
    print(f"\n{'=' * 60}")
    print(f"{'[DRY RUN] ' if dry_run else ''}완료!")
    print(f"✅ 성공: {success_count}개")
    print(f"❌ 실패: {error_count}개")
    print(f"{'=' * 60}\n")


def import_all_processed_batches(input_dir: str, db, dry_run=False):
    """processed 디렉토리의 모든 JSON 파일 처리"""
    
    if not os.path.exists(input_dir):
        print(f"❌ 디렉토리 없음: {input_dir}")
        return
    
    # JSON 파일 목록
    files = sorted([
        f for f in os.listdir(input_dir) 
        if f.endswith('.json')
    ])
    
    if not files:
        print(f"❌ JSON 파일이 없습니다: {input_dir}")
        return
    
    print("=" * 60)
    print(f"📁 처리할 파일: {len(files)}개")
    print("=" * 60)
    
    # 사용자 확인
    if not dry_run:
        response = input(f"\nproducts_v2 컬렉션에 저장하시겠습니까? (y/n): ")
        if response.lower() != 'y':
            print("❌ 취소되었습니다.")
            return
    
    total_success = 0
    total_error = 0
    
    for idx, filename in enumerate(files, 1):
        print(f"\n{'=' * 60}")
        print(f"[{idx}/{len(files)}] {filename}")
        print(f"{'=' * 60}")
        
        file_path = os.path.join(input_dir, filename)
        import_processed_batch(file_path, db, dry_run)
    
    print(f"\n{'🎉 ' * 20}")
    print(f"전체 작업 완료!")
    print(f"{'🎉 ' * 20}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LLM 가공 데이터 MongoDB 임포트")
    parser.add_argument("--input-dir", type=str, default="./data_batches/processed", 
                        help="processed 디렉토리 경로")
    parser.add_argument("--file", type=str, help="단일 파일 처리")
    parser.add_argument("--dry-run", action="store_true", 
                        help="실제 저장하지 않고 테스트만")
    
    args = parser.parse_args()
    
    # MongoDB 연결
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DB_NAME", "ecommerce_ai")
    
    client = MongoClient(mongodb_url)
    db = client[db_name]
    
    if args.file:
        # 단일 파일 처리
        import_processed_batch(args.file, db, args.dry_run)
    else:
        # 전체 디렉토리 처리
        import_all_processed_batches(args.input_dir, db, args.dry_run)
