#!/usr/bin/env python3
"""
쇼핑몰 데이터 가공 스크립트
네이버 쇼핑 상품 데이터를 정제하고 가공하여 정확하고 일관된 JSON 형식으로 출력합니다.
"""

import json
import re
import os
from pathlib import Path
from typing import Dict, List, Optional, Any


class ShoppingDataProcessor:
    """쇼핑몰 데이터 가공기"""

    # 브랜드명 표준화 매핑
    BRAND_STANDARDIZATION = {
        'NIKE': 'NIKE',
        'nike': 'NIKE',
        'ADIDAS': 'ADIDAS',
        'adidas': 'ADIDAS',
        'APPLE': 'APPLE',
        'apple': 'APPLE',
        'Apple': 'APPLE',
        'SAMSUNG': 'SAMSUNG',
        'samsung': 'SAMSUNG',
        '삼성': 'SAMSUNG',
        'LG': 'LG',
        'lg': 'LG',
    }

    def extract_discount(self, title: str) -> Optional[Dict[str, Any]]:
        """
        제목에서 할인 정보를 추출합니다.

        Args:
            title: 상품 제목

        Returns:
            할인 정보 딕셔너리 또는 None
        """
        # 퍼센트 할인 패턴
        percent_patterns = [
            r'(\d+)%\s*할인',
            r'(\d+)%\s*OFF',
            r'(\d+)%\s*세일',
            r'(\d+)%',
        ]

        for pattern in percent_patterns:
            match = re.search(pattern, title, re.IGNORECASE)
            if match:
                rate = int(match.group(1))
                return {"type": "rate", "rate": rate}

        # 금액 할인 패턴
        amount_patterns = [
            r'(\d+)만원\s*할인',
            r'(\d+)만원\s*OFF',
            r'(\d+)천원\s*할인',
            r'(\d+)천원\s*OFF',
        ]

        for pattern in amount_patterns:
            match = re.search(pattern, title)
            if match:
                value = int(match.group(1))
                if '만원' in pattern:
                    amount = value * 10000
                else:  # 천원
                    amount = value * 1000
                return {"type": "amount", "amount": amount}

        return None

    def standardize_brand(self, brand: str) -> str:
        """
        브랜드명을 표준화합니다.

        Args:
            brand: 원본 브랜드명

        Returns:
            표준화된 브랜드명
        """
        if not brand:
            return brand

        # 매핑 테이블에서 찾기
        if brand in self.BRAND_STANDARDIZATION:
            return self.BRAND_STANDARDIZATION[brand]

        # 영문인 경우 대문자로
        if re.match(r'^[A-Za-z\s&\-]+$', brand):
            return brand.upper()

        # 한글+영문 혼합인 경우 원본 유지
        return brand

    def infer_seller_type(self, mall_name: str) -> str:
        """
        판매처 이름으로부터 판매자 유형을 추론합니다.

        Args:
            mall_name: 판매처 이름

        Returns:
            판매자 유형 ('official', 'verified', 'general')
        """
        if not mall_name:
            return 'general'

        mall_lower = mall_name.lower()

        # 공식몰 체크
        official_keywords = ['공식몰', '공식스토어', 'official']
        if any(keyword in mall_lower for keyword in official_keywords):
            return 'official'

        # 인증 판매자 체크
        verified_keywords = ['인증', 'verified']
        if any(keyword in mall_lower for keyword in verified_keywords):
            return 'verified'

        return 'general'

    def create_category_path(self, category1: Optional[str], category2: Optional[str],
                            category3: Optional[str], category4: Optional[str]) -> List[str]:
        """
        카테고리 경로를 4단계 배열로 생성합니다.

        Args:
            category1-4: 카테고리 단계

        Returns:
            4개 요소로 이루어진 카테고리 경로 배열
        """
        categories = [category1, category2, category3, category4]
        path = []

        for cat in categories:
            if cat:
                path.append(cat.strip())
            else:
                break

        # 4개가 안 되면 마지막 카테고리로 채우기
        while len(path) < 4:
            if path:
                path.append(path[-1])
            else:
                path.append('기타')

        return path

    def generate_summary(self, product: Dict[str, Any]) -> str:
        """
        상품의 핵심 특징을 요약한 설명을 생성합니다.

        Args:
            product: 상품 데이터

        Returns:
            50자 이내의 요약 설명
        """
        brand = product.get('brand', '')
        title = product.get('title', '')

        # 제목에서 핵심 키워드 추출
        # 브랜드명 제거
        clean_title = title.replace(brand, '').strip()

        # 특수문자 및 불필요한 단어 제거
        clean_title = re.sub(r'\[.*?\]', '', clean_title)
        clean_title = re.sub(r'\(.*?\)', '', clean_title)
        clean_title = re.sub(r'[\+\/\-\*\=]', ' ', clean_title)
        clean_title = ' '.join(clean_title.split())

        # 50자 이내로 요약
        if len(clean_title) > 50:
            summary = clean_title[:47] + '...'
        else:
            summary = clean_title

        if not summary:
            summary = f"{brand} 제품"

        return summary

    def extract_metadata(self, product: Dict[str, Any]) -> Dict[str, List[str]]:
        """
        검색용 메타데이터를 추출합니다.

        Args:
            product: 상품 데이터

        Returns:
            메타데이터 딕셔너리 (tags, targetAudience, useCase, seasonality, features)
        """
        title = product.get('title', '')
        brand = product.get('brand', '')
        category1 = product.get('category1', '')
        category2 = product.get('category2', '')

        # Tags 추출 (핵심 명사형 키워드)
        tags = []
        if brand:
            tags.append(brand)

        # 카테고리 기반 태그
        if category2:
            tags.append(category2)

        # 제목에서 주요 키워드 추출
        title_lower = title.lower()

        # 일반적인 키워드
        common_keywords = ['프로', '미니', '플러스', '맥스', '울트라', '에어', '라이트']
        for keyword in common_keywords:
            if keyword in title:
                tags.append(keyword)

        # 숫자+단위 패턴 (예: 128GB, 256GB)
        capacity_match = re.findall(r'(\d+(?:GB|TB|ml|L|인치))', title, re.IGNORECASE)
        tags.extend(capacity_match[:2])

        # 5-8개로 제한
        tags = tags[:8]
        while len(tags) < 5 and category1:
            if category1 not in tags:
                tags.append(category1)
                break
            tags.append('인기상품')
            break

        # Target Audience 추론
        target_audience = []
        if '남성' in title or '남자' in title or '맨즈' in title_lower:
            target_audience.append('남성')
        if '여성' in title or '여자' in title or '우먼' in title_lower or '레이디' in title_lower:
            target_audience.append('여성')
        if '키즈' in title or '아동' in title or '어린이' in title:
            target_audience.append('아동')

        # 나이대 추론
        if '10대' in title:
            target_audience.append('10대')
        elif '20대' in title:
            target_audience.append('20대')
        elif '30대' in title:
            target_audience.append('30대')

        if not target_audience:
            target_audience = ['전연령']

        # Use Case 추론
        use_case = []
        use_case_keywords = {
            '일상': ['일상', '데일리', '캐주얼'],
            '운동': ['운동', '스포츠', '러닝', '트레이닝', '헬스'],
            '비즈니스': ['비즈니스', '오피스', '업무'],
            '여행': ['여행', '트래블', '캠핑'],
            '아웃도어': ['아웃도어', '등산', '트레킹'],
        }

        for use, keywords in use_case_keywords.items():
            if any(keyword in title for keyword in keywords):
                use_case.append(use)

        if not use_case:
            use_case = ['일상']

        # Seasonality 추론
        seasonality = []
        season_keywords = {
            '봄': ['봄', '스프링'],
            '여름': ['여름', '썸머', '쿨'],
            '가을': ['가을', '가을'],
            '겨울': ['겨울', '윈터', '방한', '패딩'],
        }

        for season, keywords in season_keywords.items():
            if any(keyword in title for keyword in keywords):
                seasonality.append(season)

        if not seasonality:
            seasonality = ['사계절']

        # Features 추론
        features = []
        feature_keywords = {
            '경량': ['경량', '라이트', '가벼운'],
            '방수': ['방수', '워터프루프'],
            '통기성': ['통기성', '메쉬', '에어'],
            '쿠션': ['쿠션', '푹신', '편안한'],
            '내구성': ['내구성', '튼튼', '강화'],
            '프리미엄': ['프리미엄', '럭셔리', '고급'],
            '슬림': ['슬림', '얇은', '컴팩트'],
            '대용량': ['대용량', '빅사이즈'],
        }

        for feature, keywords in feature_keywords.items():
            if any(keyword in title for keyword in keywords):
                features.append(feature)

        if not features:
            features = ['실용성']

        return {
            'tags': tags,
            'targetAudience': target_audience,
            'useCase': use_case,
            'seasonality': seasonality,
            'features': features,
        }

    def process_product(self, product: Dict[str, Any]) -> Dict[str, Any]:
        """
        단일 상품 데이터를 가공합니다.

        Args:
            product: 원본 상품 데이터

        Returns:
            가공된 상품 데이터
        """
        # 원본 데이터 복사
        processed_product = product.copy()

        # 가공 데이터 생성
        processed = {
            'discount': self.extract_discount(product.get('title', '')),
            'standardizedBrand': self.standardize_brand(product.get('brand', '')),
            'sellerType': self.infer_seller_type(product.get('mallName', '')),
            'categoryPath': self.create_category_path(
                product.get('category1'),
                product.get('category2'),
                product.get('category3'),
                product.get('category4')
            ),
            'summary': self.generate_summary(product),
        }

        # 메타데이터 추가
        metadata = self.extract_metadata(product)
        processed.update(metadata)

        # processed 필드에 추가
        processed_product['processed'] = processed

        return processed_product

    def process_batch_file(self, input_path: str, output_path: str) -> None:
        """
        배치 파일을 읽어서 가공하고 저장합니다.

        Args:
            input_path: 입력 JSON 파일 경로
            output_path: 출력 JSON 파일 경로
        """
        print(f"Processing: {input_path}")

        # JSON 파일 읽기
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 각 상품 가공
        processed_products = []
        for product in data.get('products', []):
            processed_product = self.process_product(product)
            processed_products.append(processed_product)

        # 결과 저장
        data['products'] = processed_products

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"Saved: {output_path}")


def main():
    """메인 함수"""
    # 현재 스크립트 디렉토리
    script_dir = Path(__file__).parent

    # 입력/출력 디렉토리
    input_dir = script_dir
    output_dir = script_dir / 'processed'

    # 출력 디렉토리 생성
    output_dir.mkdir(exist_ok=True)

    # 프로세서 생성
    processor = ShoppingDataProcessor()

    # 모든 배치 파일 찾기
    batch_files = sorted(input_dir.glob('batch_*.json'))

    print(f"Found {len(batch_files)} batch files")

    # 각 배치 파일 처리
    for i, batch_file in enumerate(batch_files, 1):
        output_file = output_dir / batch_file.name
        try:
            processor.process_batch_file(str(batch_file), str(output_file))
            print(f"Progress: {i}/{len(batch_files)}")
        except Exception as e:
            print(f"Error processing {batch_file}: {e}")
            continue

    print("Processing complete!")


if __name__ == '__main__':
    main()
