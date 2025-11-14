import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Filter, Loader2, RefreshCw, Sparkles } from "lucide-react";

import { useAppState } from "../context/app-state";
import type { Product } from "../types";
import { ProductPreviewCard } from "./ProductPreviewCard";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Slider } from "./ui/slider";
import { cn } from "./ui/utils";

type FetchStatus = "idle" | "loading" | "error";

const PAGE_SIZE = 20;

export function ProductListPage() {
  const navigate = useNavigate();
  const { selectedCategory, setSelectedCategory, searchQuery, setSearchQuery } =
    useAppState();

  // 기본 정렬은 관련 높은순으로 설정.
  const [sortBy, setSortBy] = useState("relevance");
  // 가격 필터 범위를 전역 상태로 보관.
  const [priceRange, setPriceRange] = useState<[number, number]>([
    0, 2_000_000_000,
  ]);
  // 선택된 브랜드 목록을 기억.
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  // 모바일에서 필터 패널 노출 여부를 제어.
  const [showFilters, setShowFilters] = useState(false);

  // 불러온 상품 목록과 UI 관련 상태들.
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 현재까지 불러온 페이지 번호(초기 0으로 두고 첫 로딩 때 1로 갱신).
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // 비동기 진행 여부와 더 불러올 수 있는지 여부를 ref로도 보관해 중복 요청을 방지.
  const isLoadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  // 무한 스크롤을 트리거할 sentinel 요소 참조.
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // 상품 목록을 페이지 단위로 불러오는 공용 함수.
  const loadProducts = useCallback(
    async (targetPage: number, options: { reset?: boolean } = {}) => {
      const { reset = false } = options;

      if (isLoadingRef.current) {
        // 이미 호출 중이면 추가 요청을 막는다.
        return;
      }
      if (!reset && !hasMoreRef.current) {
        // 더 불러올 데이터가 없으면 중단.
        return;
      }

      if (reset) {
        // 필터가 바뀐 경우 이전 목록과 페이지 정보를 초기화.
        setProducts([]);
        setPage(0);
        hasMoreRef.current = true;
        setHasMore(true);
        setStatus("loading");
        setErrorMessage(null);
      }

      isLoadingRef.current = true;
      setIsLoading(true);

      try {
        // 백엔드에 전달할 쿼리 파라미터 구성.
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: String(PAGE_SIZE),
          sort: sortBy,
          minPrice: String(priceRange[0]),
          maxPrice: String(priceRange[1]),
        });

        const trimmedQuery = searchQuery.trim();
        if (trimmedQuery) {
          params.set("q", trimmedQuery);
        }
        if (selectedCategory && selectedCategory !== "all") {
          params.set("category", selectedCategory);
        }
        if (selectedBrands.length > 0) {
          params.set("brands", selectedBrands.join(","));
        }

        const response = await fetch(
          `/api/products/search?${params.toString()}`,
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch products: ${response.status}`);
        }

        const data = await response.json();
        const items: Product[] = Array.isArray(data.items) ? data.items : [];

        // reset 여부에 따라 목록을 초기화하거나 이어붙인다.
        setProducts((prev) => (reset ? items : [...prev, ...items]));
        setPage(targetPage);

        const total = typeof data.total === "number" ? data.total : 0;
        const reachedEnd =
          targetPage * PAGE_SIZE >= total || items.length < PAGE_SIZE;

        hasMoreRef.current = !reachedEnd;
        setHasMore(hasMoreRef.current);
        setStatus("idle");
      } catch (error) {
        console.error(error);
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Unexpected error occurred."
        );
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    },
    [priceRange, searchQuery, selectedBrands, selectedCategory, sortBy]
  );

  // 필터나 정렬이 바뀔 때마다 첫 페이지부터 다시 불러온다.
  useEffect(() => {
    loadProducts(1, { reset: true });
  }, [loadProducts]);

  // 스크롤 하단에 도달하면 다음 페이지를 자동으로 요청한다.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    if (!hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          loadProducts(page + 1);
        }
      },
      {
        threshold: 1,
      }
    );

    observer.observe(sentinel);
    return () => {
      observer.unobserve(sentinel);
      observer.disconnect();
    };
  }, [hasMore, loadProducts, page, products.length]);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    products.forEach((product) => {
      if (product.category) {
        unique.add(product.category);
      }
    });
    return Array.from(unique).sort();
  }, [products]);

  const brands = useMemo(() => {
    const unique = new Set<string>();
    products.forEach((product) => {
      if (product.brand) {
        unique.add(product.brand);
      }
    });
    return Array.from(unique).sort();
  }, [products]);

  const sortedProducts = useMemo(() => {
    if (status !== "idle") return [];
    const next = [...products];
    switch (sortBy) {
      case "relevance":
        // 백엔드에서 이미 정렬된 결과를 그대로 사용
        return next;
      case "latest":
        return next.sort((a, b) =>
          (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
        );
      case "price-low":
        return next.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
      case "price-high":
        return next.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      case "rating":
        return next.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      default:
        return next.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    }
  }, [products, sortBy, status]);

  // 브랜드 체크박스를 토글할 때 배열을 업데이트.
  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand)
        ? prev.filter((item) => item !== brand)
        : [...prev, brand]
    );
  };

  // 모든 필터를 초기 상태로 되돌리는 핸들러.
  const handleResetFilters = () => {
    setSelectedCategory("all");
    setSearchQuery("");
    setSelectedBrands([]);
    setPriceRange([0, 2000000000]);
    setPage(0);
    hasMoreRef.current = true;
    setHasMore(true);
  };

  const handleProductClick = (productId: string) => {
    navigate(`/product/${productId}`);
  };

  return (
    <div className="border-t border-gray-100 bg-brand-main">
      <div className="mx-auto max-w-[1280px] px-6 py-8 md:px-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-gray-500">
              {searchQuery ? (
                <>
                  <span className="font-semibold text-gray-900">
                    "{searchQuery}"
                  </span>{" "}
                  검색 결과
                </>
              ) : (
                "추천 상품을 확인해보세요."
              )}
            </p>
            {selectedCategory !== "all" && selectedCategory && (
              <p className="text-xs text-gray-400">
                현재 카테고리: {selectedCategory}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((prev) => !prev)}
              className="h-9 w-[120px] md:hidden">
              <Filter className="mr-2 h-4 w-4" />
              필터
            </Button>
            <Select
              value={sortBy}
              onValueChange={(value) => {
                setSortBy(value);
              }}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder="정렬" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular" disabled>
                  리뷰 많은순 (준비 중)
                </SelectItem>
                <SelectItem value="latest" disabled>
                  신상품순 (준비 중)
                </SelectItem>
                <SelectItem value="price-low">낮은 가격순</SelectItem>
                <SelectItem value="price-high">높은 가격순</SelectItem>
                <SelectItem value="relevance">관련 높은순</SelectItem>
                <SelectItem value="rating" disabled>
                  판매 많은 순 (준비 중)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[280px_1fr] lg:gap-12">
          <Card
            className={cn(
              "w-full md:w-64 shrink-0 border-gray-200 bg-brand-main",
              showFilters ? "block" : "hidden md:block"
            )}>
            <div className="flex items-center justify-between border-b px-5 py-4 ">
              <h3 className="text-sm font-semibold text-gray-900">필터</h3>
              <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                초기화
              </Button>
            </div>

            <div className="space-y-6 px-5 py-5">
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-900">
                  <Sparkles className="h-4 w-4" />
                  카테고리
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="all-category"
                      checked={selectedCategory === "all"}
                      onCheckedChange={() => setSelectedCategory("all")}
                    />
                    <label
                      htmlFor="all-category"
                      className="cursor-pointer text-sm">
                      전체
                    </label>
                  </div>
                  {categories.length > 0 ? (
                    categories.map((category) => (
                      <div key={category} className="flex items-center">
                        <Checkbox
                          id={`cat-${category}`}
                          checked={selectedCategory === category}
                          onCheckedChange={() => setSelectedCategory(category)}
                        />
                        <label
                          htmlFor={`cat-${category}`}
                          className="ml-2 cursor-pointer text-sm">
                          {category}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400">
                      사용 가능한 카테고리가 없습니다.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-medium text-gray-900">
                  브랜드
                </h4>
                <div className="space-y-2">
                  {brands.length > 0 ? (
                    brands.map((brand) => (
                      <div key={brand} className="flex items-center">
                        <Checkbox
                          id={`brand-${brand}`}
                          checked={selectedBrands.includes(brand)}
                          onCheckedChange={() => toggleBrand(brand)}
                        />
                        <label
                          htmlFor={`brand-${brand}`}
                          className="ml-2 cursor-pointer text-sm">
                          {brand}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400">
                      사용 가능한 브랜드가 없습니다.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-medium text-gray-900">가격</h4>
                <Slider
                  value={priceRange}
                  onValueChange={(next) => {
                    setPriceRange(next as [number, number]);
                  }}
                  min={0}
                  max={2000000000}
                  step={10000}
                  className="mb-3"
                />
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{priceRange[0].toLocaleString()}원</span>
                  <span>{priceRange[1].toLocaleString()}원</span>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex-1">
            {status === "loading" ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin" />
                상품을 불러오는 중입니다...
              </div>
            ) : status === "error" ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-500">
                <p>상품을 불러올 수 없습니다.</p>
                {errorMessage && (
                  <p className="text-xs text-red-400">{errorMessage}</p>
                )}
                <Button
                  variant="outline"
                  onClick={() => loadProducts(1, { reset: true })}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  다시 시도
                </Button>
              </div>
            ) : sortedProducts.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-gray-400">상품을 찾을 수 없습니다.</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate("/")}>
                  홈으로 가기
                </Button>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {sortedProducts.map((product) => (
                    <ProductPreviewCard
                      key={product.id}
                      product={product}
                      onOpen={handleProductClick}
                      rating={product.rating}
                      reviewCount={product.reviewCount}
                      originalPrice={product.originalPrice}
                    />
                  ))}
                </div>

                {/* 스크롤 감지를 위한 sentinel 요소 */}
                <div ref={sentinelRef} className="h-2" />

                {/* 추가 데이터를 불러오는 중이면 하단에 로딩 표시 */}
                {isLoading && hasMore && (
                  <div className="flex items-center justify-center gap-2 py-6 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin" />더 많은 상품을
                    불러오는 중입니다...
                  </div>
                )}

                {/* 마지막 페이지까지 불러온 경우 안내 문구 표시 */}
                {!isLoading && !hasMore && (
                  <p className="py-6 text-center text-xs text-gray-400">
                    더 이상 불러올 상품이 없습니다.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
