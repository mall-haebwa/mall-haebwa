"""
MongoDB 상품 데이터를 LLM 가공용 JSON 파일로 추출

실행 방법:
    python -m backend.scripts.export_for_processing --batch-size 1000 --output-dir ./data_batches

기능:
    - lprice만 있는 상품 필터링 (hprice 제외)
    - 배치별 JSON 파일 생성
    - LLM 프롬프트 템플릿 생성
"""

import os
import json
import sys
from pymongo import MongoClient
from bson import ObjectId
import argparse


def export_products_for_llm(batch_size=1000, output_dir="./data_batches"):
    """
    MongoDB에서 상품 데이터를 추출하여 배치 파일로 저장
    
    Args:
        batch_size: 한 파일당 상품 개수
        output_dir: 출력 디렉토리
    """
    
    # MongoDB 연결
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DB_NAME", "ecommerce_ai")
    
    client = MongoClient(mongodb_url)
    db = client[db_name]
    products = db["products"]
    
    # 출력 디렉토리 생성
    os.makedirs(output_dir, exist_ok=True)
    
    print("=" * 60)
    print("📊 MongoDB 상품 데이터 추출 시작")
    print("=" * 60)
    
    # lprice만 있는 상품 필터링 쿼리
    query = {
        "lprice": {"$exists": True, "$ne": None, "$gt": 0},
        "$or": [
            {"hprice": {"$exists": False}},
            {"hprice": None},
            {"hprice": 0}
        ]
    }
    
    # 전체 상품 수 확인
    total = products.count_documents(query)
    total_all = products.count_documents({})
    
    print(f"\n📈 데이터베이스 통계:")
    print(f"   전체 상품: {total_all:,}개")
    print(f"   lprice만 있는 상품: {total:,}개")
    print(f"   제외될 상품 (hprice 있음): {total_all - total:,}개")
    print(f"\n📦 배치 설정:")
    print(f"   배치 크기: {batch_size}개")
    print(f"   총 파일 수: {(total // batch_size) + 1}개")
    print(f"   출력 경로: {output_dir}/")
    print("\n" + "=" * 60)
    
    # 사용자 확인
    response = input("\n계속 진행하시겠습니까? (y/n): ")
    if response.lower() != 'y':
        print("❌ 취소되었습니다.")
        return
    
    print("\n🚀 추출 시작...\n")
    
    # 배치별로 처리
    batch_num = 0
    skip = 0
    
    while skip < total:
        # MongoDB에서 배치 데이터 가져오기
        batch = list(products.find(query).skip(skip).limit(batch_size))
        
        if not batch:
            break
        
        # 간소화된 데이터 구조로 변환
        simplified_batch = []
        for product in batch:
            simplified_batch.append({
                "id": str(product["_id"]),
                "title": product.get("title", ""),
                "brand": product.get("brand", ""),
                "category1": product.get("category1", ""),
                "category2": product.get("category2", ""),
                "category3": product.get("category3", ""),
                "category4": product.get("category4", ""),
                "lprice": product.get("lprice", 0),
                "mallName": product.get("mallName", ""),
                "rank": product.get("rank", 999),
                "image": product.get("image", ""),
                "link": product.get("link", ""),
                "productId": product.get("productId", "")
            })
        
        # JSON 파일로 저장
        output_file = f"{output_dir}/batch_{batch_num:04d}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({
                "batch_number": batch_num,
                "count": len(simplified_batch),
                "products": simplified_batch
            }, f, ensure_ascii=False, indent=2)
        
        print(f"✅ Batch {batch_num:04d}: {len(simplified_batch):,}개 상품 → {output_file}")
        
        batch_num += 1
        skip += batch_size
    
    print("\n" + "=" * 60)
    print(f"🎉 완료! 총 {batch_num}개 배치 파일 생성")
    print("=" * 60)
    
    # 프롬프트 템플릿 파일 생성
    create_prompt_template(output_dir)
    
    print(f"\n📝 다음 단계:")
    print(f"   1. {output_dir}/PROMPT_TEMPLATE.md 파일 확인")
    print(f"   2. {output_dir}/batch_0000.json 파일과 함께 Claude에 입력")
    print(f"   3. 결과를 {output_dir}/processed/processed_0000.json으로 저장")
    print(f"   4. 모든 배치 처리 후 import 스크립트 실행\n")


def create_prompt_template(output_dir):
    """LLM에게 전달할 프롬프트 템플릿 생성"""
    
    prompt = """# 상품 데이터 가공 작업

다음 네이버 쇼핑 상품 데이터를 가공해주세요.

## 작업 내용:

### 1. 할인 정보 추출
제목에서 할인 관련 정보를 찾아 추출:

**패턴 예시:**
- "30% 할인" → type: "rate", rate: 30
- "50% OFF" → type: "rate", rate: 50
- "5만원 할인" → type: "amount", amount: 50000
- "특가", "세일" (구체적 숫자 없음) → null

**없으면:** discount: null

### 2. 브랜드명 표준화
- 영문/한글 통일 (예: "Nike" → "NIKE", "나이키" → "NIKE")
- 오타 수정
- 일관된 형식 유지

### 3. 판매자 유형 추론
mallName을 보고 판매자 타입 추론:
- "공식몰", "공식스토어", "official" → "official"
- "인증", "verified" → "verified"  
- 그 외 → "general"

### 4. 카테고리 경로 생성 (4단계)
원본 category1~4를 정제하여 깔끔한 경로로:
- 예: ["패션의류", "신발", "운동화", "런닝화"]
- 4개가 모두 있어야 함

### 5. 간단한 설명 생성
- 50자 이내로 상품의 핵심 특징 요약
- 자연스러운 한국어 문장

### 6. 검색용 메타데이터 추출
- **tags**: 5-8개 (명사형만, 실제 검색에 사용될 키워드)
- **targetAudience**: 타겟 고객층 (예: ["20대", "남성"])
- **useCase**: 사용 상황 (예: ["일상", "운동"])
- **seasonality**: 계절성 (예: ["사계절"], ["여름"])
- **features**: 상품 특징 (예: ["쿠션", "경량", "통기성"])

---

## 입력 데이터 형식:

```json
{
  "batch_number": 0,
  "count": 1000,
  "products": [
    {
      "id": "MongoDB ObjectId",
      "title": "원본 제목 (그대로)",
      "brand": "브랜드",
      "category1-4": "카테고리",
      "lprice": 가격,
      "mallName": "판매자",
      "rank": 15
    }
  ]
}
```

---

## 출력 형식 (JSON):

**중요: 반드시 id를 그대로 포함해주세요!**

```json
{
  "products": [
    {
      "id": "MongoDB ObjectId (입력과 동일)",
      "processed": {
        // 할인 정보 (제목에서 추출)
        "discount": {
          "fromTitle": true,
          "type": "rate",
          "rate": 30,
          "originalText": "30% 할인"
        },
        // 또는 할인 없으면
        // "discount": null,
        
        // 브랜드 표준화
        "brand": "NIKE",
        
        // 판매자 유형
        "sellerType": "official",
        
        // 카테고리 경로 (4단계)
        "categoryPath": ["패션의류", "신발", "운동화", "런닝화"],
        
        // 상품 설명 (50자 이내)
        "summary": "쿠션감이 뛰어난 에어맥스 기술 적용 런닝화",
        
        // 검색 메타데이터
        "searchKeywords": {
          "tags": ["운동화", "런닝화", "나이키", "에어맥스", "쿠션", "스니커즈"],
          "targetAudience": ["20대", "30대", "남성"],
          "useCase": ["러닝", "조깅", "일상"],
          "seasonality": ["사계절"],
          "features": ["쿠션", "경량", "통기성"]
        }
      }
    }
  ]
}
```

---

## 할인 추출 예시:

**예시 1:**
- 입력: "[특가] 나이키 에어포스 50% 할인 무료배송"
- 출력: `{"fromTitle": true, "type": "rate", "rate": 50, "originalText": "50% 할인"}`

**예시 2:**
- 입력: "삼성 갤럭시 S24 30만원 할인"
- 출력: `{"fromTitle": true, "type": "amount", "amount": 300000, "originalText": "30만원 할인"}`

**예시 3:**
- 입력: "애플 에어팟 프로 2세대"
- 출력: `null`

**예시 4:**
- 입력: "반값 특가! 아이패드 70% OFF"
- 출력: `{"fromTitle": true, "type": "rate", "rate": 70, "originalText": "70% OFF"}`

---

## 주의사항:

1. **ID 보존**: 반드시 입력받은 id를 그대로 출력에 포함
2. **제목은 그대로**: 상품명(name)은 원본 title 그대로 사용 (정제 불필요)
3. **모든 상품 처리**: 빠짐없이 모든 상품 처리
4. **JSON 형식**: 정확한 JSON 형식 유지
5. **한국어**: 자연스러운 한국어로 작성
"""
    
    template_file = f"{output_dir}/PROMPT_TEMPLATE.md"
    with open(template_file, 'w', encoding='utf-8') as f:
        f.write(prompt)
    
    print(f"\n📝 프롬프트 템플릿 생성: {template_file}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MongoDB 상품 데이터 추출")
    parser.add_argument("--batch-size", type=int, default=1000, help="배치 크기 (기본: 1000)")
    parser.add_argument("--output-dir", type=str, default="./data_batches", help="출력 디렉토리")
    
    args = parser.parse_args()
    
    export_products_for_llm(args.batch_size, args.output_dir)
