import {
  Sparkles,
  Star,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
} from "lucide-react";
import { RandomSections } from "./RandomSections";
import { useNavigate } from "react-router-dom";
import { useAppState } from "../context/app-state";
import { useState, useEffect } from "react";
import banner1 from "../assets/banner1.svg";
import banner2 from "../assets/banner2.svg";
import banner3 from "../assets/banner3.svg";
import banner4 from "../assets/banner4.svg";
import banner5 from "../assets/banner5.svg";
import banner7 from "../assets/banner7.svg";
import banner8 from "../assets/banner8.svg";
import banner9 from "../assets/banner9.svg";
// Reverted: directly render RandomSections without in-view lazy mount

const promoBanners = [
  {
    id: 1,
    imageUrl: banner2,
  },
  {
    id: 2,
    imageUrl: banner4,
  },
  {
    id: 3,
    imageUrl: banner7,
  },
  {
    id: 4,
    imageUrl: banner9,
  },
  {
    id: 5,
    imageUrl: banner8,
  },
  {
    id: 6,
    imageUrl: banner1,
  },
  {
    id: 7,
    imageUrl: banner3,
  },
  {
    id: 8,
    imageUrl: banner5,
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const { setSelectedCategory, setSearchQuery } = useAppState();
  const [currentBanner, setCurrentBanner] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  useEffect(() => {
    if (!isAutoPlay) return;

    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % promoBanners.length);
    }, 30000);
    return () => clearInterval(interval);
  }, [isAutoPlay]);

  const goToPrevBanner = () => {
    setCurrentBanner(
      (prev) => (prev - 1 + promoBanners.length) % promoBanners.length
    );
  };

  const goToNextBanner = () => {
    setCurrentBanner((prev) => (prev + 1) % promoBanners.length);
  };

  const goToAllProducts = () => {
    setSelectedCategory("all");
    setSearchQuery("");
    navigate("/products");
  };

  const goToProduct = (productId: string) => {
    navigate(`/product/${productId}`);
  };

  return (
    <div>
      {/* 프로모션 배너 캐러셀 */}
      <div className="relative overflow-hidden bg-white w-full">
        {/* 슬라이드 */}
        <div className="relative aspect-[9/2] w-full bg-brand-main">
          {promoBanners.map((banner, index) => {
            const isActive = index === currentBanner;
            return (
              <div
                key={banner.id}
                className={`absolute inset-0 transition-opacity duration-500 ease-in-out w-full ${
                  isActive ? "opacity-100 visible" : "opacity-0 invisible"
                }`}>
                <img
                  src={banner.imageUrl}
                  alt={`프로모션 배너 ${banner.id}`}
                  className="h-full w-full object-contain"
                />
              </div>
            );
          })}
        </div>

        {/* 컨트롤 바 */}
        <div className="flex justify-center items-center gap-8 px-6 py-5 md:px-8 bg-brand-main w-full">
          {/* 좌측 - 이전 버튼 */}
          <button
            onClick={goToPrevBanner}
            className="p-2 hover:bg-gray-100 rounded-full transition-all">
            <ChevronLeft className="h-5 w-5 text-gray-700" />
          </button>

          {/* 중앙 - Play/Pause + 슬라이드 번호 */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsAutoPlay(!isAutoPlay)}
              className="p-2 hover:bg-gray-100 rounded-full transition-all">
              {isAutoPlay ? (
                <Pause className="h-5 w-5 text-gray-700" />
              ) : (
                <Play className="h-5 w-5 text-gray-700" />
              )}
            </button>
            <div className="text-sm font-medium text-gray-700 min-w-[50px] text-center">
              {String(currentBanner + 1).padStart(2, "0")} /{" "}
              {String(promoBanners.length).padStart(2, "0")}
            </div>
          </div>

          {/* 우측 - 다음 버튼 */}
          <button
            onClick={goToNextBanner}
            className="p-2 hover:bg-gray-100 rounded-full transition-all">
            <ChevronRight className="h-5 w-5 text-gray-700" />
          </button>
        </div>
      </div>

      <RandomSections />

      <div className="border-t border-gray-100 py-12">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-6 md:grid-cols-3 md:px-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-sub/10">
              <Sparkles className="h-6 w-6 text-brand-sub" />
            </div>
            <div>
              <h3 className="mb-2">
                <span className="text-brand-sub">AI</span> 자연어 검색
              </h3>
              <p className="text-sm text-gray-600">
                말하듯 자연어로 검색하면 AI가 정확한 상품을 찾아드립니다.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-sub/10">
              <TrendingUp className="h-6 w-6 text-brand-sub" />
            </div>
            <div>
              <h3 className="mb-2">
                <span className="text-brand-sub">취향</span> 맞춤 추천
              </h3>
              <p className="text-sm text-gray-600">
                구매 패턴과 취향을 분석해 딱 맞는 상품을 추천해 드립니다.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-sub/10">
              <Star className="h-6 w-6 text-brand-sub" />
            </div>
            <div>
              <h3 className="mb-2">
                <span className="text-brand-sub">실시간</span> 리뷰
              </h3>
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
