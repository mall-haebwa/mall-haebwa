import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { useAppState } from "../context/app-state";
import type { Product } from "../types";
import { ProductPreviewCard } from "./ProductPreviewCard";

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
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const s1 = await fetchRandom(24, []);
      setDeals(s1);
      s1.forEach((p) => seenRef.current.add(p.id));
      const s2 = await fetchRandom(24, Array.from(seenRef.current));
      setRandoms(s2);
      s2.forEach((p) => seenRef.current.add(p.id));
      const s3 = await fetchRandom(24, Array.from(seenRef.current));
      setNotables(s3);
      s3.forEach((p) => seenRef.current.add(p.id));
      const s4 = await fetchRandom(24, Array.from(seenRef.current));
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
          <Swiper
            modules={[Navigation, Pagination]}
            spaceBetween={16}
            slidesPerView={1}
            breakpoints={{
              640: { slidesPerView: 2, spaceBetween: 16 },
              768: { slidesPerView: 3, spaceBetween: 16 },
              1024: { slidesPerView: 4, spaceBetween: 16 },
            }}
            navigation
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
        </div>
      ))}
    </>
  );
}
