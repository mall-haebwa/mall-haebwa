# 상품 데이터 가공 작업

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
