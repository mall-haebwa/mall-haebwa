import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { ProductPreviewCard, ProductPreviewSkeleton } from "./ProductPreviewCard";
import type { RecentlyViewedItem } from "./mypage-types";
import { useAppState } from "../context/app-state";
import { User as UserIcon } from "lucide-react";

const MIN_RANDOM_ITEMS = 6;
const MAX_RANDOM_ITEMS = 12;

const randomBetween = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomPastDate = (maxDaysAgo: number) => {
  const now = new Date();
  const offset = Math.floor(Math.random() * maxDaysAgo);
  const date = new Date(now);
  date.setDate(now.getDate() - offset);
  return date.toISOString();
};

const formatDate = (iso: string) => {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? "알 수 없음"
    : parsed.toLocaleDateString("ko-KR");
};

const fetchRandomProducts = async (limit: number) => {
  const params = new URLSearchParams({ limit: String(limit) });
  const response = await fetch(`/api/products/random?${params.toString()}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to load products: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data.items) ? data.items : [];
};

type LocationState = {
  items?: RecentlyViewedItem[];
};

export function RecentlyViewedPage() {
  const navigate = useNavigate();
  const { currentUser } = useAppState();
  const location = useLocation();
  const state = (location.state as LocationState | undefined) ?? {};

  const [items, setItems] = useState<RecentlyViewedItem[]>(state.items ?? []);
  const [loading, setLoading] = useState(items.length === 0);
  const loadItems = useCallback(async () => {
    try {
      const products = await fetchRandomProducts(
        randomBetween(MIN_RANDOM_ITEMS, MAX_RANDOM_ITEMS),
      );
      setItems(
        products.map((product) => ({
          product,
          viewedAt: randomPastDate(21),
        })),
      );
    } catch (error) {
      console.error("Failed to load recently viewed items", error);
      toast.error("최근 본 상품을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (items.length === 0 && currentUser) {
      void loadItems();
    } else {
      setLoading(false);
    }
  }, [currentUser, items.length, loadItems]);

  const handleOpenProduct = useCallback(
    (productId: string) => {
      navigate(`/product/${productId}`);
    },
    [navigate],
  );

  if (!currentUser) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <UserIcon className="h-16 w-16 text-gray-300" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            로그인이 필요합니다
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            최근 본 상품을 확인하려면 로그인해주세요.
          </p>
        </div>
        <Button
          className="h-11 px-8 bg-gray-900 text-white hover:bg-black"
          onClick={() => navigate("/login")}
        >
          로그인하기
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1280px] px-6 py-10 md:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">최근 본 상품</h1>
            <p className="text-sm text-gray-600">
              최근에 살펴본 상품을 다시 확인해 보세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/mypage")}>
              마이페이지로
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toast.info("최근 기록 비우기는 준비 중입니다.")}
            >
              기록 비우기
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <ProductPreviewSkeleton key={`recent-page-${index}`} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card className="border-gray-200 p-12 text-center text-sm text-gray-600">
            아직 열람한 상품이 없어요. 다양한 상품을 둘러보세요!
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
              <ProductPreviewCard
                key={item.product.id}
                product={item.product}
                onOpen={handleOpenProduct}
                meta={formatDate(item.viewedAt) + "에 열람"}
                primaryLabel="보기"
                onPrimaryAction={(product) => {
                  onOpenProduct(product.id);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
