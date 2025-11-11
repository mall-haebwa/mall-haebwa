#!/usr/bin/env python3
"""
검색 결과 관련성 점수 계산 모듈

LLM에게 전달하기 전에 검색 결과를 점수화하여 상위 K개만 선택
- 텍스트 유사도 (30%)
- 벡터 유사도 (40%)
- 리뷰 점수 (10%)
- 재고 가용성 (10%)
- 가격 합리성 (10%)
"""

import math
from typing import List, Dict, Optional, Tuple
import numpy as np
from datetime import datetime


class RelevanceScorer:
    """검색 결과 관련성 점수 계산기"""

    def __init__(
        self,
        text_weight: float = 0.30,
        vector_weight: float = 0.40,
        review_weight: float = 0.10,
        stock_weight: float = 0.10,
        price_weight: float = 0.10
    ):
        """
        가중치 초기화

        Args:
            text_weight: 텍스트 유사도 가중치 (BM25 점수)
            vector_weight: 벡터 유사도 가중치 (코사인 유사도)
            review_weight: 리뷰 점수 가중치
            stock_weight: 재고 가용성 가중치
            price_weight: 가격 합리성 가중치
        """
        self.text_weight = text_weight
        self.vector_weight = vector_weight
        self.review_weight = review_weight
        self.stock_weight = stock_weight
        self.price_weight = price_weight

        # 가중치 합이 1.0인지 확인
        total_weight = sum([text_weight, vector_weight, review_weight, stock_weight, price_weight])
        if not math.isclose(total_weight, 1.0, rel_tol=1e-5):
            raise ValueError(f"가중치 합이 1.0이 아닙니다: {total_weight}")

    def normalize_bm25_score(self, bm25_score: float, max_score: float = 100.0) -> float:
        """
        BM25 점수를 0-1 범위로 정규화

        Args:
            bm25_score: Elasticsearch BM25 점수
            max_score: 최대 점수 (일반적으로 100 정도)

        Returns:
            0-1 범위의 정규화된 점수
        """
        if bm25_score is None or bm25_score <= 0:
            return 0.0

        # Log scaling으로 극단값 완화
        normalized = math.log(1 + bm25_score) / math.log(1 + max_score)
        return min(1.0, normalized)

    def normalize_vector_score(self, vector_score: float) -> float:
        """
        벡터 유사도 점수를 0-1 범위로 정규화

        Args:
            vector_score: 코사인 유사도 (이미 0-1 또는 -1-1 범위)

        Returns:
            0-1 범위의 정규화된 점수
        """
        if vector_score is None:
            return 0.0

        # 코사인 유사도는 -1 ~ 1 범위이므로 0-1로 변환
        # 실제로는 대부분 0 이상이지만 안전하게 처리
        normalized = (vector_score + 1.0) / 2.0
        return max(0.0, min(1.0, normalized))

    def calculate_review_score(self, product: Dict) -> float:
        """
        리뷰 점수 계산 (0-1 범위)

        Args:
            product: 제품 문서

        Returns:
            정규화된 리뷰 점수
        """
        # 평점 (1-5) 및 리뷰 수 고려
        rating = product.get('rating', 0)
        review_count = product.get('reviewCount', 0)

        if rating == 0:
            return 0.0

        # 평점을 0-1로 정규화 (5점 만점)
        rating_score = rating / 5.0

        # 리뷰 수를 신뢰도로 변환 (sigmoid)
        # 리뷰가 50개 이상이면 거의 1.0에 수렴
        review_confidence = 1.0 / (1.0 + math.exp(-review_count / 20.0))

        # 평점과 신뢰도를 결합 (평점 70%, 신뢰도 30%)
        combined_score = (rating_score * 0.7) + (review_confidence * 0.3)

        return combined_score

    def calculate_stock_score(self, product: Dict) -> float:
        """
        재고 가용성 점수 (0-1 범위)

        Args:
            product: 제품 문서

        Returns:
            재고 점수 (재고 있음=1.0, 없음=0.0)
        """
        # inStock 필드 확인
        in_stock = product.get('inStock', True)

        if isinstance(in_stock, bool):
            return 1.0 if in_stock else 0.0
        elif isinstance(in_stock, str):
            return 1.0 if in_stock.lower() in ['true', 'y', 'yes', '1'] else 0.0
        else:
            return 0.5  # 불명확한 경우 중간값

    def calculate_price_score(self, product: Dict, query: str = "") -> float:
        """
        가격 합리성 점수 (0-1 범위)

        Args:
            product: 제품 문서
            query: 검색 쿼리 (가격 관련 키워드 추출용)

        Returns:
            가격 합리성 점수
        """
        price = product.get('lprice') or product.get('price', 0)

        if price == 0:
            return 0.0

        # 카테고리별 평균 가격 범위 (하드코딩, 추후 DB에서 동적으로 계산 가능)
        # 실제로는 카테고리별 중간값을 사용하는 것이 좋음
        category1 = product.get('category1', '')

        # 가격대별 점수 (예시)
        # 너무 싸거나 너무 비싸면 점수 감소
        if price < 10000:
            return 0.6  # 너무 저렴 (품질 우려)
        elif 10000 <= price < 100000:
            return 1.0  # 적정 가격대
        elif 100000 <= price < 500000:
            return 0.9  # 중고가
        elif 500000 <= price < 1000000:
            return 0.7  # 고가
        else:
            return 0.5  # 초고가

    def calculate_relevance_score(
        self,
        product: Dict,
        bm25_score: Optional[float] = None,
        vector_score: Optional[float] = None,
        query: str = ""
    ) -> Tuple[float, Dict[str, float]]:
        """
        제품의 종합 관련성 점수 계산

        Args:
            product: 제품 문서
            bm25_score: BM25 텍스트 유사도 점수 (Elasticsearch)
            vector_score: 벡터 유사도 점수 (코사인 유사도)
            query: 검색 쿼리

        Returns:
            (종합 점수, 세부 점수 딕셔너리)
        """
        # 각 요소 점수 계산
        text_score = self.normalize_bm25_score(bm25_score) if bm25_score is not None else 0.0
        vec_score = self.normalize_vector_score(vector_score) if vector_score is not None else 0.0
        review_score = self.calculate_review_score(product)
        stock_score = self.calculate_stock_score(product)
        price_score = self.calculate_price_score(product, query)

        # 가중 평균 계산
        total_score = (
            text_score * self.text_weight +
            vec_score * self.vector_weight +
            review_score * self.review_weight +
            stock_score * self.stock_weight +
            price_score * self.price_weight
        )

        # 세부 점수 반환 (디버깅 및 설명용)
        details = {
            'text_score': text_score,
            'vector_score': vec_score,
            'review_score': review_score,
            'stock_score': stock_score,
            'price_score': price_score,
            'total_score': total_score
        }

        return total_score, details

    def rank_products(
        self,
        products: List[Dict],
        query: str = "",
        bm25_scores: Optional[Dict[str, float]] = None,
        vector_scores: Optional[Dict[str, float]] = None,
        top_k: int = 50
    ) -> List[Dict]:
        """
        제품 목록을 관련성 점수로 정렬하여 상위 K개 반환

        Args:
            products: 제품 문서 리스트
            query: 검색 쿼리
            bm25_scores: 제품 ID -> BM25 점수 매핑
            vector_scores: 제품 ID -> 벡터 점수 매핑
            top_k: 반환할 최대 개수

        Returns:
            점수순으로 정렬된 상위 K개 제품 (relevance_score 필드 추가)
        """
        bm25_scores = bm25_scores or {}
        vector_scores = vector_scores or {}

        # 각 제품에 점수 계산
        scored_products = []
        for product in products:
            product_id = str(product.get('_id', ''))

            bm25_score = bm25_scores.get(product_id)
            vector_score = vector_scores.get(product_id)

            total_score, details = self.calculate_relevance_score(
                product,
                bm25_score=bm25_score,
                vector_score=vector_score,
                query=query
            )

            # 제품에 점수 정보 추가
            product_copy = product.copy()
            product_copy['relevance_score'] = total_score
            product_copy['score_details'] = details

            scored_products.append(product_copy)

        # 점수순 정렬 (내림차순)
        scored_products.sort(key=lambda p: p['relevance_score'], reverse=True)

        # 상위 K개 반환
        return scored_products[:top_k]


def hybrid_search_score(
    bm25_score: float,
    vector_score: float,
    alpha: float = 0.5
) -> float:
    """
    하이브리드 검색 점수 계산 (BM25 + Vector)

    Args:
        bm25_score: 정규화된 BM25 점수 (0-1)
        vector_score: 정규화된 벡터 점수 (0-1)
        alpha: BM25 가중치 (1-alpha가 벡터 가중치)
               - alpha=0.0: 벡터 검색만
               - alpha=0.5: 50:50
               - alpha=1.0: BM25만

    Returns:
        하이브리드 점수 (0-1)
    """
    return alpha * bm25_score + (1 - alpha) * vector_score


# 전역 Scorer 인스턴스
default_scorer = RelevanceScorer()


def score_and_rank(
    products: List[Dict],
    query: str = "",
    bm25_scores: Optional[Dict[str, float]] = None,
    vector_scores: Optional[Dict[str, float]] = None,
    top_k: int = 50,
    scorer: Optional[RelevanceScorer] = None
) -> List[Dict]:
    """
    편의 함수: 제품 점수화 및 랭킹

    Args:
        products: 제품 리스트
        query: 검색 쿼리
        bm25_scores: BM25 점수 딕셔너리
        vector_scores: 벡터 점수 딕셔너리
        top_k: 반환할 최대 개수
        scorer: 사용할 Scorer (None이면 default 사용)

    Returns:
        점수순 정렬된 상위 K개 제품
    """
    if scorer is None:
        scorer = default_scorer

    return scorer.rank_products(
        products=products,
        query=query,
        bm25_scores=bm25_scores,
        vector_scores=vector_scores,
        top_k=top_k
    )


if __name__ == '__main__':
    # 테스트 코드
    print("=== Relevance Scorer 테스트 ===")

    # 샘플 제품 데이터
    test_products = [
        {
            '_id': 'p1',
            'title': '나이키 에어맥스',
            'rating': 4.5,
            'reviewCount': 120,
            'inStock': True,
            'lprice': 89000,
            'category1': '신발'
        },
        {
            '_id': 'p2',
            'title': '아디다스 운동화',
            'rating': 4.0,
            'reviewCount': 50,
            'inStock': True,
            'lprice': 75000,
            'category1': '신발'
        },
        {
            '_id': 'p3',
            'title': '저렴한 운동화',
            'rating': 3.0,
            'reviewCount': 5,
            'inStock': False,
            'lprice': 9000,
            'category1': '신발'
        }
    ]

    # BM25 및 벡터 점수 (예시)
    bm25_scores = {'p1': 85.5, 'p2': 72.3, 'p3': 45.0}
    vector_scores = {'p1': 0.92, 'p2': 0.85, 'p3': 0.60}

    # 점수 계산 및 랭킹
    ranked = score_and_rank(
        products=test_products,
        query="나이키 운동화",
        bm25_scores=bm25_scores,
        vector_scores=vector_scores,
        top_k=10
    )

    print(f"\n검색어: '나이키 운동화'")
    print(f"총 {len(ranked)}개 제품 (상위 순)")
    print("=" * 80)

    for i, product in enumerate(ranked, 1):
        print(f"\n{i}. {product['title']} (ID: {product['_id']})")
        print(f"   종합 점수: {product['relevance_score']:.4f}")
        print(f"   세부 점수:")
        for key, value in product['score_details'].items():
            if key != 'total_score':
                print(f"     - {key}: {value:.4f}")
        print(f"   평점: {product['rating']}/5.0 ({product['reviewCount']}개 리뷰)")
        print(f"   재고: {'있음' if product['inStock'] else '없음'}")
        print(f"   가격: {product['lprice']:,}원")
