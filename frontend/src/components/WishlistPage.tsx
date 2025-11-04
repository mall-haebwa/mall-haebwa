import { useEffect, useState } from "react";
  import { useNavigate } from "react-router-dom";
  import { Heart, Trash2, Loader2 } from "lucide-react";
  import { toast } from "sonner";
  import type { WishlistItem } from "../types";
  import { Button } from "./ui/button";
  import { Card } from "./ui/card";
  import { ImageWithFallback } from "./figma/ImageWithFallback";

  export function WishlistPage() {
    const [items, setItems] = useState<WishlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
      loadWishlist();
    }, []);

    const loadWishlist = async () => {
      try {
        const res = await fetch("/api/wishlist/list", {
          credentials: "include",
        });

        if (!res.ok) {
          const error = await res.json();
          if (error.detail?.includes("로그인")) {
            toast.error("로그인이 필요합니다.");
            navigate("/login");
            return;
          }
          throw new Error(error.detail || "찜 목록 조회 실패");
        }

        const data = await res.json();
        setItems(data.items || []);
      } catch (error: any) {
        toast.error(error.message || "찜 목록을 불러올 수 없습니다.");
      } finally {
        setLoading(false);
      }
    };

    const handleRemove = async (productId: string) => {
      try {
        const res = await fetch(`/api/wishlist/remove/${productId}`, {
          method: "DELETE",
          credentials: "include",
        });

        if (!res.ok) throw new Error("찜 제거 실패");

        setItems((prev) => prev.filter((item) => item.product.id !== productId));
        toast.success("찜 목록에서 제거되었습니다.");
      } catch (error: any) {
        toast.error(error.message || "오류가 발생했습니다.");
      }
    };

    if (loading) {
      return (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-sm text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>찜 목록을 불러오는 중입니다…</span>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white">
        <div className="mx-auto max-w-[1280px] px-6 py-8 md:px-8">
          <div className="mb-6 flex items-center gap-2">
            <Heart className="h-6 w-6 fill-gray-900 text-gray-900" />
            <h1 className="text-2xl font-semibold text-gray-900">
              찜 목록 ({items.length})
            </h1>
          </div>

          {items.length === 0 ? (
            <Card className="border-gray-200 p-16 text-center">
              <p className="text-sm text-gray-600">찜한 상품이 없습니다.</p>
              <Button
                onClick={() => navigate("/products")}
                className="mt-4 bg-gray-900 text-white hover:bg-black"
              >
                상품 둘러보기
              </Button>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <Card
                  key={item.wishlist_id}
                  className="group overflow-hidden border-gray-200 transition-shadow hover:shadow-lg"
                >
                  <div
                    className="cursor-pointer"
                    onClick={() => navigate(`/product/${item.product.id}`)}
                  >
                    <ImageWithFallback
                      src={item.product.image}
                      alt={item.product.name}
                      className="h-64 w-full object-cover"
                    />
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="text-xs text-gray-500">
                      {item.product.brand}
                    </div>
                    <h3
                      className="cursor-pointer truncate text-sm font-medium text-gray-900 
  transition-colors hover:text-gray-600"
                      onClick={() => navigate(`/product/${item.product.id}`)}
                    >
                      {item.product.name}
                    </h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-semibold text-gray-900">
                        ₩{item.product.price.toLocaleString()}
                      </span>
                      {item.product.originalPrice && (
                        <span className="text-xs text-gray-400 line-through">
                          ₩{item.product.originalPrice.toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => navigate(`/product/${item.product.id}`)}
                        className="h-9 flex-1 bg-gray-900 text-sm text-white hover:bg-black"
                      >
                        상품 보기
                      </Button>
                      <Button
                        onClick={() => handleRemove(item.product.id)}
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }