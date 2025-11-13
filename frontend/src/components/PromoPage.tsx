import {
  ChevronLeft,
  ChevronRight,
  Wand2,
  ShoppingBag,
  Palette,
  Zap,
  Rocket,
  Brain,
  Grid3x3,
  Lock,
  Globe,
  TrendingUp,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";

const CAROUSEL_ITEMS = [
  {
    icon: Wand2,
    title: "AI 자연어 검색",
    description:
      '"화이트 톤의 인테리어에 어울리는 가구" 같은 자연어로 검색하세요',
    badge: "실시간 AI 분석",
    iconColor: "bg-gradient-to-br from-purple-500 to-purple-600",
    borderColor: "border-l-4 border-purple-500",
    bgColor: "bg-gradient-to-br from-purple-50 to-purple-100",
  },
  {
    icon: ShoppingBag,
    title: "스타일 맞춤 추천",
    description:
      '"여름 출근 때 입을 바지" - 계절과 상황에 딱 맞는 상품을 추천받으세요',
    badge: "맞춤 추천",
    iconColor: "bg-gradient-to-br from-pink-500 to-rose-600",
    borderColor: "border-l-4 border-pink-500",
    bgColor: "bg-gradient-to-br from-pink-50 to-rose-100",
  },
  {
    icon: Palette,
    title: "컬러 & 톤 검색",
    description:
      "원하는 색상과 분위기를 설명하면 완벽하게 매칭된 제품을 찾아드려요",
    badge: "비주얼 분석",
    iconColor: "bg-gradient-to-br from-amber-500 to-orange-600",
    borderColor: "border-l-4 border-amber-500",
    bgColor: "bg-gradient-to-br from-amber-50 to-orange-100",
  },
  {
    icon: TrendingUp,
    title: "트렌드 기반 추천",
    description:
      "지금 뜨고 있는 트렌드를 반영해 인기 있는 상품들을 먼저 보여드려요",
    badge: "트렌드 분석",
    iconColor: "bg-gradient-to-br from-cyan-500 to-blue-600",
    borderColor: "border-l-4 border-cyan-500",
    bgColor: "bg-gradient-to-br from-cyan-50 to-blue-100",
  },
];

function CarouselSlide({ item }: { item: (typeof CAROUSEL_ITEMS)[0] }) {
  const Icon = item.icon;
  return (
    <div className={`min-w-0 flex-shrink-0 w-full md:w-1/2 lg:w-1/3 px-4`}>
      <div
        className={`group h-full rounded-2xl border ${item.borderColor.replace(
          "border-l-4",
          "border"
        )} backdrop-blur-sm p-8 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 cursor-pointer relative overflow-hidden`}
        style={{ background: "rgba(255,255,255,0.05)" }}>
        {/* Gradient overlay */}
        <div
          className={`absolute inset-0 ${item.bgColor} opacity-5 group-hover:opacity-10 transition-opacity duration-300`}></div>
        <div className="relative z-10">
          <div
            className={`mb-6 flex h-12 w-12 items-center justify-center rounded-lg ${item.iconColor} shadow-lg`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <h3 className="mb-3 text-xl font-bold text-white">{item.title}</h3>
          <p className="mb-4 text-sm leading-relaxed text-white/70">
            {item.description}
          </p>
          <div className="inline-block">
            <Badge
              className={`border ${item.borderColor.split(" ")[0]} ${
                item.bgColor
              } text-white group-hover:shadow-lg`}>
              {item.badge}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PromoPage() {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start", skipSnaps: false },
    []
  );
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      setCanScrollPrev(emblaApi.canScrollPrev());
      setCanScrollNext(emblaApi.canScrollNext());
    };

    emblaApi.on("select", onSelect);
    onSelect();

    const autoScroll = setInterval(() => {
      if (emblaApi.canScrollNext()) {
        emblaApi.scrollNext();
      } else {
        emblaApi.scrollTo(0);
      }
    }, 5000);

    return () => {
      emblaApi.off("select", onSelect);
      clearInterval(autoScroll);
    };
  }, [emblaApi]);

  const scrollPrev = () => {
    if (emblaApi) emblaApi.scrollPrev();
  };

  const scrollNext = () => {
    if (emblaApi) emblaApi.scrollNext();
  };

  return (
    <div className="bg-black text-white overflow-hidden">
      {/* 히어로 섹션 */}
      <div
        className="relative min-h-screen overflow-hidden flex items-center"
        style={{
          background:
            "linear-gradient(135deg, #0a0e27 0%, #1a0b3d 50%, #2d0a4e 100%)",
        }}>
        {/* 네온 배경 효과 */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-1/2 -right-1/2 h-[1000px] w-[1000px] rounded-full blur-3xl opacity-30 animate-pulse"
            style={{ backgroundColor: "#ba49f2" }}></div>
          <div
            className="absolute -bottom-1/2 -left-1/2 h-[1000px] w-[1000px] rounded-full blur-3xl opacity-30"
            style={{ backgroundColor: "#e043b9" }}></div>
          <div
            className="absolute top-1/3 left-1/3 h-96 w-96 rounded-full blur-3xl opacity-20"
            style={{ backgroundColor: "#00f0ff" }}></div>
        </div>

        <div className="relative mx-auto max-w-[1280px] px-6 py-20 md:px-8 md:py-32 w-full">
          <div className="max-w-3xl mb-8">
            <div className="inline-block mb-6">
              <div className="px-4 py-2 rounded-full border border-[#ba49f2]/50 bg-[#ba49f2]/10 backdrop-blur-sm">
                <span className="text-sm font-semibold text-[#ba49f2] flex items-center gap-2">
                  <Zap className="h-4 w-4" /> 2050년의 쇼핑이 시작됩니다
                </span>
              </div>
            </div>
            <h1 className="text-6xl md:text-7xl font-black mb-6 leading-tight">
              <span className="bg-gradient-to-r from-[#ba49f2] via-[#e043b9] to-[#00f0ff] bg-clip-text text-transparent">
                AI가 당신의 스타일을 읽다
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-white/70 mb-8 leading-relaxed max-w-2xl">
              말하는 대로 원하는 상품이 나타나는 경험. 인공지능이 당신의 취향,
              라이프스타일, 꿈을 이해하고 완벽하게 매칭해줍니다.
            </p>
            <div className="flex flex-wrap gap-4">
              <button className="px-8 py-4 rounded-lg bg-gradient-to-r from-[#ba49f2] to-[#e043b9] hover:shadow-[0_0_30px_rgba(186,73,242,0.5)] transition-all duration-300 font-semibold">
                지금 시작하기
              </button>
              {/* <button className="px-8 py-4 rounded-lg border border-[#00f0ff]/30 bg-white/5 hover:bg-white/10 transition-all duration-300 font-semibold">
                둘러보기
              </button> */}
            </div>
          </div>

          {/* 캐러셀 */}
          <div className="relative">
            <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
              <div className="flex">
                {CAROUSEL_ITEMS.map((item, index) => (
                  <CarouselSlide key={index} item={item} />
                ))}
              </div>
            </div>

            {/* 네비게이션 버튼 */}
            <button
              onClick={scrollPrev}
              disabled={!canScrollPrev}
              className="absolute left-0 top-1/2 z-10 -translate-y-1/2 -translate-x-6 rounded-full bg-white/10 backdrop-blur-sm p-3 text-white border border-white/20 transition-all hover:bg-white/20 hover:border-white/40 hover:shadow-[0_0_20px_rgba(186,73,242,0.3)] disabled:opacity-20 disabled:cursor-not-allowed md:-translate-x-8">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={scrollNext}
              disabled={!canScrollNext}
              className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-6 rounded-full bg-white/10 backdrop-blur-sm p-3 text-white border border-white/20 transition-all hover:bg-white/20 hover:border-white/40 hover:shadow-[0_0_20px_rgba(186,73,242,0.3)] disabled:opacity-20 disabled:cursor-not-allowed md:translate-x-8">
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* 점 표시기 */}
            <div className="mt-12 flex justify-center gap-3">
              {CAROUSEL_ITEMS.map((_, index) => (
                <button
                  key={index}
                  onClick={() => emblaApi?.scrollTo(index)}
                  className={`rounded-full transition-all ${
                    index === 0
                      ? "w-8 h-2 bg-gradient-to-r from-[#ba49f2] to-[#e043b9] shadow-[0_0_10px_rgba(186,73,242,0.5)]"
                      : "w-2 h-2 bg-white/30 hover:bg-white/60"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section - 미래형 */}
      <div className="relative py-24 border-t border-white/10">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-0 right-0 h-72 w-72 rounded-full blur-3xl opacity-15"
            style={{ backgroundColor: "#ba49f2" }}></div>
          <div
            className="absolute bottom-0 left-0 h-72 w-72 rounded-full blur-3xl opacity-15"
            style={{ backgroundColor: "#e043b9" }}></div>
        </div>

        <div className="relative mx-auto max-w-[1280px] px-6 md:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              <span className="bg-gradient-to-r from-[#ba49f2] to-[#e043b9] bg-clip-text text-transparent">
                미래의 쇼핑, 지금 시작하세요
              </span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              AI, 블록체인, 메타버스가 만나는 차세대 쇼핑 경험
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="group relative rounded-2xl border border-white/10 p-8 hover:border-[#ba49f2]/50 transition-all duration-300 bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.08] hover:shadow-[0_0_40px_rgba(186,73,242,0.1)]">
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(186,73,242,0.1) 0%, rgba(224,67,185,0.1) 100%)",
                }}></div>
              <div className="relative z-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-[#ba49f2] to-[#e043b9] mb-6 group-hover:shadow-[0_0_20px_rgba(186,73,242,0.4)] transition-all duration-300">
                  <Brain className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  스마트 AI 분석
                </h3>
                <p className="text-white/70 leading-relaxed">
                  당신의 스타일, 라이프스타일, 감정까지 읽고 완벽하게 맞춘
                  상품만 추천합니다.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group relative rounded-2xl border border-white/10 p-8 hover:border-[#00f0ff]/50 transition-all duration-300 bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.08] hover:shadow-[0_0_40px_rgba(0,240,255,0.1)]">
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(0,240,255,0.1) 0%, rgba(100,200,255,0.1) 100%)",
                }}></div>
              <div className="relative z-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-[#00f0ff] to-[#0080ff] mb-6 group-hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all duration-300">
                  <Globe className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  글로벌 네트워크
                </h3>
                <p className="text-white/70 leading-relaxed">
                  전 세계 브랜드와 트렌드를 한 곳에서. 경계 없는 쇼핑 경험을
                  만나세요.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group relative rounded-2xl border border-white/10 p-8 hover:border-[#e043b9]/50 transition-all duration-300 bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.08] hover:shadow-[0_0_40px_rgba(224,67,185,0.1)]">
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(224,67,185,0.1) 0%, rgba(255,100,200,0.1) 100%)",
                }}></div>
              <div className="relative z-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-[#e043b9] to-[#ff4444] mb-6 group-hover:shadow-[0_0_20px_rgba(224,67,185,0.4)] transition-all duration-300">
                  <Rocket className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  초고속 배송
                </h3>
                <p className="text-white/70 leading-relaxed">
                  AI 최적화 로지스틱스. 드론 배송으로 최단시간 배송을
                  경험하세요.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="group relative rounded-2xl border border-white/10 p-8 hover:border-[#ba49f2]/50 transition-all duration-300 bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.08] hover:shadow-[0_0_40px_rgba(186,73,242,0.1)]">
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(186,73,242,0.1) 0%, rgba(224,67,185,0.1) 100%)",
                }}></div>
              <div className="relative z-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-[#ba49f2] to-[#7c3aed] mb-6 group-hover:shadow-[0_0_20px_rgba(186,73,242,0.4)] transition-all duration-300">
                  <Lock className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  블록체인 보안
                </h3>
                <p className="text-white/70 leading-relaxed">
                  모든 거래는 암호화 보호. 당신의 정보는 절대 안전합니다.
                </p>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="group relative rounded-2xl border border-white/10 p-8 hover:border-[#00f0ff]/50 transition-all duration-300 bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.08] hover:shadow-[0_0_40px_rgba(0,240,255,0.1)]">
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(0,240,255,0.1) 0%, rgba(100,200,255,0.1) 100%)",
                }}></div>
              <div className="relative z-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-[#00f0ff] to-[#00cc88] mb-6 group-hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all duration-300">
                  <Zap className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  실시간 감지
                </h3>
                <p className="text-white/70 leading-relaxed">
                  트렌드, 가격, 리뷰가 실시간으로 업데이트됩니다. 항상 최신을
                  먼저.
                </p>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="group relative rounded-2xl border border-white/10 p-8 hover:border-[#e043b9]/50 transition-all duration-300 bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.08] hover:shadow-[0_0_40px_rgba(224,67,185,0.1)]">
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(224,67,185,0.1) 0%, rgba(255,100,200,0.1) 100%)",
                }}></div>
              <div className="relative z-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff44aa] to-[#ff6655] mb-6 group-hover:shadow-[0_0_20px_rgba(224,67,185,0.4)] transition-all duration-300">
                  <Grid3x3 className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  메타버스 쇼핑
                </h3>
                <p className="text-white/70 leading-relaxed">
                  3D 가상공간에서 상품을 직접 체험. 쇼핑의 미래가 여기입니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
