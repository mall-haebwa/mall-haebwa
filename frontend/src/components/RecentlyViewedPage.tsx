import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { ProductPreviewCard, ProductPreviewSkeleton } from "./ProductPreviewCard";
import type { RecentlyViewedItem } from "./mypage-types";
import { useAppState } from "../context/app-state";
import { User as UserIcon } from "lucide-react";
import { normalizeProductSummary } from "../utils/product-normalize";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

const formatDate = (iso: string) => {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? "알 수 없음"
    : parsed.toLocaleDateString("ko-KR");
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
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      // Redis에서 최근 본 상품 조회
      console.log("[Recently Viewed] 📦 Redis에서 조회 중...");

      const response = await fetch("/api/users/recently-viewed", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to load recently viewed: ${response.status}`);
      }

      const data = await response.json();
      const fetched = Array.isArray(data?.items) ? data.items : [];

      const normalized = fetched
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
          return { product, viewedAt } as RecentlyViewedItem;
        })
        .filter(Boolean) as RecentlyViewedItem[];

      console.log(
        "[Recently Viewed] ✅ 로드 완료:",
        normalized.length,
        "개 (캐시출처:",
        data?.cacheSource,
        ")"
      );

      setItems(normalized);
    } catch (error) {
      console.error("Failed to load recently viewed items", error);
      toast.error("최근 본 상품을 불러오지 못했어요.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setItems([]);
      setLoading(false);
      return;
    }

    void loadItems();
  }, [currentUser, loadItems]);

  const handleOpenProduct = useCallback(
    (productId: string) => {
      navigate(`/product/${productId}`);
    },
    [navigate],
  );

  const handleClearHistoryClick = useCallback(() => {
    setShowClearDialog(true);
  }, []);

  const handleConfirmClear = useCallback(async () => {
    setIsClearing(true);
    try {
      const response = await fetch("/api/users/recently-viewed", {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to clear history: ${response.status}`);
      }

      console.log("[Recently Viewed] ✅ 기록 삭제 완료");
      setItems([]);
      setShowClearDialog(false);
      toast.success("최근 본 상품 기록이 모두 삭제되었습니다.");
    } catch (error) {
      console.error("Failed to clear recently viewed history", error);
      toast.error("기록을 삭제하는 데 실패했습니다.");
    } finally {
      setIsClearing(false);
    }
  }, []);

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
              onClick={handleClearHistoryClick}
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
                  handleOpenProduct(product.id);
                }}
              />
            ))}
          </div>
        )}

        <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>최근 본 상품 기록 삭제</DialogTitle>
              <DialogDescription>
                최근 본 상품 기록을 모두 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowClearDialog(false)}
                disabled={isClearing}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmClear}
                disabled={isClearing}
              >
                {isClearing ? "삭제 중..." : "삭제"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
