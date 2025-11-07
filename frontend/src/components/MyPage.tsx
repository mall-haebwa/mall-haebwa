import {
  ChevronRight,
  Heart,
  LogOut,
  Package,
  Settings,
  Star,
  User as UserIcon,
  TicketPercent as Coupon,
  History as RecentlyViewed,
  MessageSquare as Inquiry,
  Repeat as RepeatPurchase,
  Store as KeepStores,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAppState } from "../context/app-state";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Separator } from "./ui/separator";
import {
  ProductPreviewCard,
  ProductPreviewSkeleton,
} from "./ProductPreviewCard";
import type { RecentlyViewedItem, RepeatPurchaseItem } from "./mypage-types";
import { normalizeProductSummary } from "../utils/product-normalize";
import { Product } from "@/types";

const PREVIEW_COUNT = 4;
const MIN_RANDOM_ITEMS = 4;
const MAX_RANDOM_ITEMS = 10;

const randomBetween = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomPastDate = (maxDaysAgo: number) => {
  const now = new Date();
  const offset = Math.floor(Math.random() * maxDaysAgo);
  const date = new Date(now);
  date.setDate(now.getDate() - offset);
  return date.toISOString();
};

const formatDate = (isoDate: string) => {
  const parsed = new Date(isoDate);
  return Number.isNaN(parsed.getTime())
    ? "알 수 없음"
    : parsed.toLocaleDateString("ko-KR");
};

const AVAILABLE_MENU_PATHS = new Set([
  "/orders",
  "/wishlist",
  "/customer-service",
  "/repeat-purchases",
  "/recently-viewed",
]);

const menuItems = [
  {
    icon: Package,
    title: "주문/배송 조회",
    description: "주문 기록과 배송 상태를 확인하세요.",
    path: "/orders",
  },
  {
    icon: Heart,
    title: "찜한 상품",
    description: "관심 있는 상품을 모아보세요.",
    path: "/wishlist",
  },
  {
    icon: Star,
    title: "상품 리뷰",
    description: "작성한 리뷰와 포인트를 확인하세요.",
    path: "/reviews",
  },
  {
    icon: Settings,
    title: "회원 정보 수정",
    description: "비밀번호, 주소 등 정보를 변경하세요.",
    path: "/settings",
  },
  {
    icon: Coupon,
    title: "보유 쿠폰",
    description: "보유한 쿠폰을 확인하고 사용하세요.",
    path: "/coupons",
  },
  {
    icon: RecentlyViewed,
    title: "최근 본 상품",
    description: "최근에 본 상품을 확인하세요.",
    path: "/recently-viewed",
  },
  {
    icon: Inquiry,
    title: "문의 내역",
    description: "작성한 문의 사항을 확인하세요.",
    path: "/customer-service",
  },
  {
    icon: RepeatPurchase,
    title: "자주 구매한 상품들",
    description: "자주 구매하는 상품을 빠르게 재주문하세요.",
    path: "/repeat-purchases",
  },
  {
    icon: KeepStores,
    title: "관심 스토어",
    description: "좋아하는 스토어를 한눈에 모아보세요.",
    path: "/keep-stores",
  },
];

export function MyPage() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAppState();
  const [repeatItems, setRepeatItems] = useState<RepeatPurchaseItem[]>([]);
  const [recentItems, setRecentItems] = useState<RecentlyViewedItem[]>([]);
  const [repeatLoading, setRepeatLoading] = useState(false);
  const [recentLoading, setRecentLoading] = useState(false);

  const fetchRandomProducts = useCallback(
    async (limit: number, excludeIds: string[] = []) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (excludeIds.length > 0) {
        params.set("exclude", excludeIds.join(","));
      }

      const response = await fetch(
        `/api/products/random?${params.toString()}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to load products: ${response.status}`);
      }

      const data = await response.json();
      return Array.isArray(data.items) ? data.items : [];
    },
    []
  );

  const refreshRepeat = useCallback(async () => {
    if (!currentUser) {
      setRepeatItems([]);
      return;
    }

    setRepeatLoading(true);
    try {
      const products = await fetchRandomProducts(
        randomBetween(MIN_RANDOM_ITEMS, MAX_RANDOM_ITEMS)
      );
      setRepeatItems(
        products.map((product: Product) => ({
          product,
          lastPurchasedAt: randomPastDate(90),
        }))
      );
    } catch (error) {
      console.error("Failed to load repeat items", error);
      toast.error("자주 구매한 상품을 불러오지 못했어요.");
      setRepeatItems([]);
    } finally {
      setRepeatLoading(false);
    }
  }, [currentUser, fetchRandomProducts]);

  const refreshRecent = useCallback(async () => {
    if (!currentUser) {
      setRecentItems([]);
      return;
    }

    setRecentLoading(true);
    try {
      const response = await fetch("/api/users/recently-viewed", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to load recently viewed: ${response.status}`);
      }

      const data = await response.json();
      const items = Array.isArray(data?.items) ? data.items : [];

      setRecentItems(
        items
          .map((item: any) => {
            if (!item?.product) {
              return null;
            }
            const product = normalizeProductSummary(item.product);
            const viewedRaw = item.viewedAt;
            const viewedAt =
              typeof viewedRaw === "string"
                ? viewedRaw
                : new Date(viewedRaw ?? Date.now()).toISOString();
            return {
              product,
              viewedAt,
            } as RecentlyViewedItem;
          })
          .filter(Boolean) as RecentlyViewedItem[]
      );
    } catch (error) {
      console.error("Failed to load recently viewed items", error);
      toast.error("최근 본 상품을 불러오지 못했어요.");
      setRecentItems([]);
    } finally {
      setRecentLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setRepeatItems([]);
      setRecentItems([]);
      return;
    }

    void refreshRepeat();
    void refreshRecent();

    // 주기적으로 sessionStorage 확인 (같은 탭에서의 추가 감지)
    const interval = setInterval(() => {
      const cached = sessionStorage.getItem("recentlyViewed");
      if (cached) {
        try {
          const cachedItems = JSON.parse(cached);
          if (Array.isArray(cachedItems) && cachedItems.length > 0) {
            setRecentItems((prevItems) => {
              // 최신 데이터로 항상 업데이트
              const serializedCached = JSON.stringify(cachedItems);
              const serializedCurrent = JSON.stringify(prevItems);

              // sessionStorage와 현재 상태가 다르면 업데이트
              if (serializedCached !== serializedCurrent) {
                console.log(
                  "[MyPage] 📝 sessionStorage 변경 감지, 최근 본 상품 업데이트",
                  cachedItems.length,
                  "개"
                );
                return cachedItems;
              }
              return prevItems;
            });
          }
        } catch (e) {
          console.error("Failed to parse cached items:", e);
        }
      }
    }, 1000); // 1초마다 확인

    return () => clearInterval(interval);
  }, [currentUser, refreshRecent, refreshRepeat]);

  const handleProductOpen = useCallback(
    (productId: string) => {
      navigate(`/product/${productId}`);
    },
    [navigate]
  );

  const handleSeeAllRepeat = useCallback(() => {
    navigate("/repeat-purchases", {
      state: { items: repeatItems },
    });
  }, [navigate, repeatItems]);

  const handleSeeAllRecent = useCallback(() => {
    navigate("/recently-viewed", {
      state: { items: recentItems },
    });
  }, [navigate, recentItems]);

  if (!currentUser) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <UserIcon className="h-16 w-16 text-gray-300" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            로그인이 필요합니다
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            로그인하고 주문 내역과 맞춤 추천을 확인해 보세요.
          </p>
        </div>
        <Button
          className="h-11 px-8 bg-gray-900 text-white hover:bg-black"
          onClick={() => navigate("/login")}>
          로그인하기
        </Button>
      </div>
    );
  }

  const initials = currentUser.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1280px] px-6 py-10 md:px-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">마이페이지</h1>
            <p className="text-sm text-gray-600">
              주문 내역과 적립금, 배송지 정보를 빠르게 확인하세요.
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2 text-sm"
            onClick={() => {
              logout();
              toast.success("로그아웃되었습니다.");
              navigate("/");
            }}>
            <LogOut className="h-4 w-4" />
            로그아웃
          </Button>
        </div>

        <Card className="border-gray-200 p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border border-gray-200">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-gray-500">환영합니다</p>
                <h2 className="text-xl font-semibold text-gray-900">
                  {currentUser.name}님
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {currentUser.email}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-center text-sm text-gray-700">
              <div>
                <p className="text-xs text-gray-500">적립금</p>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  {(currentUser?.points || 0).toLocaleString()}P
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">쿠폰</p>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  0장
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {menuItems.map(({ icon: Icon, title, description, path }) => (
            <Card
              key={title}
              className="group cursor-pointer border-gray-200 p-5 transition hover:border-gray-300 hover:shadow-md"
              onClick={() => {
                if (AVAILABLE_MENU_PATHS.has(path)) {
                  navigate(path);
                } else {
                  toast.info("해당 메뉴는 추후 제공될 예정입니다.");
                }
              }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {title}
                    </p>
                    <p className="text-xs text-gray-500">{description}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 transition group-hover:text-gray-600" />
              </div>
            </Card>
          ))}
        </div>

        <Separator className="my-8" />
        <div className="space-y-9">
          <RepeatPurchaseSection
            items={repeatItems}
            loading={repeatLoading}
            onSeeAll={handleSeeAllRepeat}
            onOpenProduct={handleProductOpen}
          />
          <RecentlyViewedSection
            items={recentItems}
            loading={recentLoading}
            onSeeAll={handleSeeAllRecent}
            onOpenProduct={handleProductOpen}
          />
        </div>
      </div>
    </div>
  );
}

interface RepeatPurchaseSectionProps {
  items: RepeatPurchaseItem[];
  loading: boolean;
  onSeeAll: () => void;
  onOpenProduct: (productId: string) => void;
}

interface RecentlyViewedSectionProps {
  items: RecentlyViewedItem[];
  loading: boolean;
  onSeeAll: () => void;
  onOpenProduct: (productId: string) => void;
}

const PreviewSkeletonRow = () => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {Array.from({ length: PREVIEW_COUNT }).map((_, index) => (
      <ProductPreviewSkeleton key={"skeleton-" + index} />
    ))}
  </div>
);

function RepeatPurchaseSection({
  items,
  loading,
  onSeeAll,
  onOpenProduct,
}: RepeatPurchaseSectionProps) {
  const previewItems = items.slice(0, PREVIEW_COUNT);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            자주 구매한 상품
          </h2>
          <p className="text-xs text-gray-500">
            최근 구매 기록을 바탕으로 추천된 상품이에요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onSeeAll}>
            전체보기
          </Button>
        </div>
      </div>
      {loading ? (
        <PreviewSkeletonRow />
      ) : previewItems.length === 0 ? (
        <Card className="border-gray-200 p-6 text-center text-sm text-gray-600">
          최근 구매한 상품이 아직 없어요.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {previewItems.map((item) => (
            <ProductPreviewCard
              key={item.product.id}
              product={item.product}
              onOpen={onOpenProduct}
              meta={"마지막 구매일 " + formatDate(item.lastPurchasedAt)}
              primaryLabel="재주문"
              onPrimaryAction={() => {
                toast.info("재주문 기능은 준비 중입니다.");
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RecentlyViewedSection({
  items,
  loading,
  onSeeAll,
  onOpenProduct,
}: RecentlyViewedSectionProps) {
  const previewItems = items.slice(0, PREVIEW_COUNT);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">최근 본 상품</h2>
          <p className="text-xs text-gray-500">
            관심 있게 살펴본 상품을 다시 확인해 보세요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onSeeAll}>
            전체보기
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              toast.info("최근 기록 비우기는 준비 중입니다.");
            }}>
            기록 비우기
          </Button>
        </div>
      </div>
      {loading ? (
        <PreviewSkeletonRow />
      ) : previewItems.length === 0 ? (
        <Card className="border-gray-200 p-6 text-center text-sm text-gray-600">
          최근에 열람한 상품이 아직 없어요.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {previewItems.map((item) => (
            <ProductPreviewCard
              key={item.product.id}
              product={item.product}
              onOpen={onOpenProduct}
              meta={formatDate(item.viewedAt) + "에 열람"}
              primaryLabel="보기"
              onPrimaryAction={(product) => {
                onOpenProduct(product.id);
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
