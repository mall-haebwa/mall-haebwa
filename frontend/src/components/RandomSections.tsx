import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { useAppState } from "../context/app-state";
import type { Product } from "../types";
import { ProductPreviewCard } from "./ProductPreviewCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MOCK_SECTION_PRODUCTS } from "../data/mockProducts";

export function RandomSections() {
  const navigate = useNavigate();
  const { setSelectedCategory, setSearchQuery } = useAppState();
  const [deals, setDeals] = useState<Product[]>([]);
  const [randoms, setRandoms] = useState<Product[]>([]);
  const [notables, setNotables] = useState<Product[]>([]);
  const [risings, setRisings] = useState<Product[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const swiperRefs = useRef<any[]>([]);

  useEffect(() => {
    // 고정 목데이터 사용
    setDeals(MOCK_SECTION_PRODUCTS.deals);
    setRandoms(MOCK_SECTION_PRODUCTS.recommended);
    setNotables(MOCK_SECTION_PRODUCTS.notables);
    setRisings(MOCK_SECTION_PRODUCTS.risings);
  }, []);

  const goAll = () => {
    setSelectedCategory("all");
    setSearchQuery("");
    navigate("/products");
  };

  const handlePrev = (idx: number) => {
    swiperRefs.current[idx]?.slidePrev();
  };

  const handleNext = (idx: number) => {
    swiperRefs.current[idx]?.slideNext();
  };

  const sections: { title: string; items: Product[] }[] = [
    { title: "랜덤 추천 상품들", items: randoms },
    { title: "오늘의 행사 상품들", items: deals },
    { title: "주목할 만한 상품들", items: notables },
    { title: "어제 급상승 상품들", items: risings },
  ];

  return (
    <>
      {sections.map((section, idx) => (
        <div key={idx} className="mx-auto max-w-[1280px] px-6 py-8 md:px-8">
          <button
            type="button"
            onClick={goAll}
            className="mb-6 w-full flex items-center justify-center group text-xl font-semibold text-gray-800 hover:text-gray-900">
            <h2 className="text-xl font-bold">
              {section.title.includes("랜덤") && (
                <>
                  <span className="text-xl font-bold text-brand-sub">추천</span> 상품
                </>
              )}
              {section.title.includes("오늘") && (
                <>
                  <span className="text-xl font-bold text-brand-sub">오늘의 행사</span> 상품
                </>
              )}
              {section.title.includes("주목") && (
                <>
                  <span className="text-xl font-bold text-brand-sub">주목할 만한</span> 상품
                </>
              )}
              {section.title.includes("급상승") && (
                <>
                  <span className="text-xl font-bold text-brand-sub">인기 급상승</span> 상품
                </>
              )}
            </h2>
            <ChevronRight className="h-5 w-5 text-gray-600 group-hover:text-gray-900 transition" />
          </button>
          {/* 🔥 Swiper + 버튼을 하나로 묶음 */}
          <div className="relative">
            {/* 왼쪽 화살표 */}
            <button
              onClick={() => handlePrev(idx)}
              className="custom-prev hover:shadow-lg transition-shadow">
              <ChevronLeft className="h-6 w-6 text-gray-700 hover:text-brand-orange" />
            </button>

            <Swiper
              modules={[Pagination]}
              onSwiper={(swiper) => {
                swiperRefs.current[idx] = swiper;
              }}
              spaceBetween={16}
              slidesPerView={1}
              slidesPerGroup={4}
              breakpoints={{
                640: { slidesPerView: 2.3, spaceBetween: 16 },
                768: { slidesPerView: 3.3, spaceBetween: 16 },
                1024: { slidesPerView: 4.3, spaceBetween: 16 },
              }}
              pagination={{ clickable: true }}
              className="!pb-12">
              {section.items.map((p) => (
                <SwiperSlide key={p.id} className="!h-auto">
                  <ProductPreviewCard
                    product={p}
                    onOpen={(productId) => navigate(`/product/${productId}`)}
                    rating={p.rating}
                    reviewCount={p.reviewCount}
                    originalPrice={p.originalPrice}
                    className="h-full"
                  />
                </SwiperSlide>
              ))}
            </Swiper>

            {/* 오른쪽 화살표 */}
            <button
              onClick={() => handleNext(idx)}
              className="custom-next hover:shadow-lg transition-shadow">
              <ChevronRight className="h-6 w-6 text-gray-700 hover:text-brand-orange" />
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
