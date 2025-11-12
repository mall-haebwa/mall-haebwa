import { ChevronRight, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "../context/app-state";
import type { Product } from "../types";
import { Button } from "./ui/button";

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
    { title: "랜덤 추천 상품", items: randoms },
    { title: "오늘의 행사 상품", items: deals },
    { title: "주목할 만한 상품들", items: notables },
    { title: "어제 급상승 쇼핑", items: risings },
  ];

  return (
    <>
      {sections.map((section, idx) => (
        <div key={idx} className="mx-auto max-w-[1280px] px-6 py-8 md:px-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gray-900" />
              <h2 className="text-3xl font-semibold">
                {section.title.includes("랜덤") && (
                  <>
                    <span className="text-blue-600 font-nanum text-4xl">
                      랜덤 추천
                    </span>{" "}
                    상품
                  </>
                )}
                {section.title.includes("오늘") && (
                  <>
                    <span className="text-rose-600 font-nanum text-4xl">
                      오늘의 행사
                    </span>{" "}
                    상품
                  </>
                )}
                {section.title.includes("주목") && (
                  <>
                    <span className="text-emerald-600 font-nanum text-4xl">
                      주목할 만한
                    </span>{" "}
                    상품들
                  </>
                )}
                {section.title.includes("급상승") && (
                  <>
                    <span className="text-amber-600 font-nanum text-4xl">
                      인기 급상승
                    </span>{" "}
                    쇼핑
                  </>
                )}
              </h2>
            </div>
            <Button
              variant="ghost"
              onClick={goAll}
              className="text-sm text-gray-600 hover:text-gray-900">
              전체보기
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {section.items.map((p) => {
              const imageSrc =
                p.image ||
                (Array.isArray(p.images) && p.images[0]) ||
                "https://via.placeholder.com/400x400?text=No+Image";
              return (
                <button
                  key={p.id}
                  type="button"
                  className="group cursor-pointer overflow-hidden rounded border border-gray-200 text-left transition hover:shadow-lg"
                  onClick={() => navigate(`/product/${p.id}`)}>
                  <div className="relative aspect-square overflow-hidden bg-gray-50">
                    <img
                      src={imageSrc}
                      alt={p.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="space-y-2 p-4">
                    <p className="text-xs text-gray-500">{p.brand || ""}</p>
                    <p className="line-clamp-2 h-10 text-sm text-gray-900">
                      {p.name}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-semibold text-gray-900">
                        {(p.price ?? 0).toLocaleString()}원
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
