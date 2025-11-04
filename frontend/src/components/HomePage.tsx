import { Sparkles, Star, TrendingUp } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "../context/app-state";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { RandomSections } from "./RandomSections";

// Reverted: directly render RandomSections without in-view lazy mount

export function HomePage() {
  const navigate = useNavigate();
  const { setSelectedCategory, setSearchQuery } = useAppState();

  const goToAllProducts = () => {
    setSelectedCategory("all");
    setSearchQuery("");
    navigate("/products");
  };

  const goToProduct = (productId: string) => {
    navigate(`/product/${productId}`);
  };

  

  return (
    <div className="bg-white">
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="mx-auto flex max-w-[1280px] justify-between px-6 py-8 md:px-8 md:py-10">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-6 w-6" />
              <h1 className="text-xl md:text-2xl">AI 자연어 검색</h1>
            </div>
            <p className="mb-3 text-sm opacity-90 md:text-base">
              &quot;여름 원피스&quot;, &quot;출근룩 바지&quot; 같은 자연어로
              검색하세요.
            </p>
            <div className="flex gap-2 text-xs">
              <Badge className="border-0 bg-white/15 text-white backdrop-blur-sm">
                실시간 AI 분석
              </Badge>
              <Badge className="border-0 bg-white/15 text-white backdrop-blur-sm">
                맞춤 추천
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-100">
        <div className="mx-auto max-w-[1280px] px-6 py-8 md:px-8">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gray-900" />
            <h2 className="text-lg">AI 검색 활용 예시</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded border border-purple-100 bg-purple-50 p-4">
              <p className="mb-1 text-sm text-gray-600">예시:</p>
              <p className="mb-1">&quot;30대 여성 데일리룩&quot;</p>
              <p className="text-xs text-gray-500">
                계절과 연령을 고려한 상품 추천
              </p>
            </div>
            <div className="rounded border border-pink-100 bg-pink-50 p-4">
              <p className="mb-1 text-sm text-gray-600">예시:</p>
              <p className="mb-1">&quot;민감성 피부에 좋은 화장품&quot;</p>
              <p className="text-xs text-gray-500">
                피부 타입에 맞는 제품 추천
              </p>
            </div>
          </div>
        </div>
      </div>

      <RandomSections />

      {/* <div className="mx-auto max-w-[1280px] px-6 py-8 md:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl">베스트 상품</h2>
          </div>
          <Button
            variant="ghost"
            onClick={goToAllProducts}
            className="text-sm text-gray-600 hover:text-gray-900">
            전체보기
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {mockProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              className="group cursor-pointer text-left"
              onClick={() => goToProduct(product.id)}>
              <div className="relative mb-2 aspect-square overflow-hidden bg-gray-50">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80"
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {product.originalPrice && (
                  <Badge className="absolute left-2 top-2 border-0 bg-red-500 text-xs text-white">
                    {Math.round(
                      (1 - product.price / product.originalPrice) * 100
                    )}
                    %
                  </Badge>
                )}
              </div>
              <div>
                <p className="mb-1 line-clamp-2 h-10 text-sm">{product.name}</p>
                <div className="mb-1 flex items-center gap-1">
                  <span className="text-lg">
                    {product.price.toLocaleString()}
                  </span>
                  <span className="text-sm">원</span>
                </div>
                {product.originalPrice && (
                  <p className="mb-1 text-xs text-gray-400 line-through">
                    {product.originalPrice.toLocaleString()}원
                  </p>
                )}
                <div className="mb-1 flex items-center gap-1">
                  <Star className="h-3 w-3 fill-gray-900 text-gray-900" />
                  <span className="text-xs text-gray-600">
                    {product.rating}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({product.reviewCount.toLocaleString()})
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Truck className="h-3 w-3" />
                  <span>{product.delivery}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div> */}

      <div className="border-t border-gray-100 bg-gray-50 py-12">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-6 md:grid-cols-3 md:px-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-900/10">
              <Sparkles className="h-6 w-6 text-gray-900" />
            </div>
            <div>
              <h3 className="mb-2">AI 자연어 검색</h3>
              <p className="text-sm text-gray-600">
                말하듯 자연어로 검색하면 AI가 정확한 상품을 찾아드립니다.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-900/10">
              <TrendingUp className="h-6 w-6 text-gray-900" />
            </div>
            <div>
              <h3 className="mb-2">취향 맞춤 추천</h3>
              <p className="text-sm text-gray-600">
                구매 패턴과 취향을 분석해 딱 맞는 상품을 추천해 드립니다.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-900/10">
              <Star className="h-6 w-6 text-gray-900" />
            </div>
            <div>
              <h3 className="mb-2">실시간 리뷰</h3>
              <p className="text-sm text-gray-600">
                실제 구매자들의 생생한 후기를 확인할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
