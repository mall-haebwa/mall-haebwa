import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { useAppState } from "../context/app-state";
import type { Product } from "../types";
import { ProductPreviewCard } from "./ProductPreviewCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
async function fetchRandom(
  limit: number,
  excludeIds: string[]
): Promise<Product[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (excludeIds.length > 0) params.set("exclude", excludeIds.join(","));
  const resp = await fetch(`/api/products/random?${params.toString()}`, {
    credentials: "include",
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return Array.isArray(data.items) ? data.items : [];
}

export function RandomSections() {
  const navigate = useNavigate();
  const { setSelectedCategory, setSearchQuery } = useAppState();
  const [deals, setDeals] = useState<Product[]>([]);
  const [randoms, setRandoms] = useState<Product[]>([]);
  const [notables, setNotables] = useState<Product[]>([]);
  const [risings, setRisings] = useState<Product[]>([]);

  useEffect(() => {
    (async () => {
      // 병렬 실행으로 변경 (순차 대기 제거)
      const [s1, s2, s3, s4] = await Promise.all([
        fetchRandom(24, []),
        fetchRandom(24, []),
        fetchRandom(24, []),
        fetchRandom(24, [])
      ]);

      setDeals(s1);
      setRandoms(s2);
      setNotables(s3);
      setRisings(s4);
    })();
  }, []);

  const goAll = () => {
    setSelectedCategory("all");
    setSearchQuery("");
    navigate("/products");
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
                  <span className=" text-xl font-bold">추천</span> 상품
                </>
              )}
              {section.title.includes("오늘") && (
                <>
                  <span className=" text-xl font-bold">오늘의 행사</span> 상품
                </>
              )}
              {section.title.includes("주목") && (
                <>
                  <span className=" text-xl font-bold">주목할 만한</span> 상품
                </>
              )}
              {section.title.includes("급상승") && (
                <>
                  <span className=" text-xl font-bold">인기 급상승</span> 상품
                </>
              )}
            </h2>
            <ChevronRight className="h-5 w-5 text-gray-600 group-hover:text-gray-900 transition" />
          </button>
          {/* 🔥 Swiper + 버튼을 하나로 묶음 */}
          <div className="relative">
            {/* 왼쪽 화살표 */}
            <button className="custom-prev hover:shadow-lg transition-shadow">
              <ChevronLeft className="h-10 w-10 stroke-1 text-gray-700 hover:text-[rgb(242,100,29)]" />
            </button>

            <Swiper
              modules={[Pagination, Navigation]}
              navigation={{
                nextEl: ".custom-next",
                prevEl: ".custom-prev",
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
            <button className="custom-next absolute top-1/2 -right-4 z-20 -translate-y-1/2 hover:shadow-lg transition-shadow">
              <ChevronRight className="h-10 w-10 stroke-1 text-gray-700 hover:text-[rgb(242,100,29)]" />
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
