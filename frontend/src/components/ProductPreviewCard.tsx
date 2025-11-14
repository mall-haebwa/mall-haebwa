import { useState, useEffect } from "react";
import { Star, Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import type { Product } from "../types";
import { cn } from "./ui/utils";
import { useAppState } from "../context/app-state";

interface ProductPreviewCardProps {
  product: Product;
  onOpen: (productId: string) => void;
  primaryLabel?: string;
  onPrimaryAction?: (product: Product) => void;
  meta?: string;
  className?: string;
  rating?: number;
  reviewCount?: number;
  originalPrice?: number;
}

export function ProductPreviewCard({
  product,
  onOpen,
  primaryLabel,
  onPrimaryAction,
  meta,
  className,
  rating,
  reviewCount,
  originalPrice,
}: ProductPreviewCardProps) {
  const { addToCart, currentUser, addToWishlist, removeFromWishlist } =
    useAppState();
  const [wishlist, setWishlist] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  const imageSrc =
    product.image ||
    (Array.isArray(product.images) && product.images[0]) ||
    "https://via.placeholder.com/400x400?text=No+Image";

  useEffect(() => {
    if (!currentUser || !product.id) {
      setWishlist(false);
      return;
    }

    const checkWishlist = async () => {
      try {
        const res = await fetch(`/api/wishlist/check/${product.id}`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setWishlist(data.isWishlisted ?? false);
        }
      } catch (error) {
        console.error("Failed to check wishlist:", error);
        setWishlist(false);
      }
    };

    void checkWishlist();
  }, [currentUser, product.id]);

  const handleOpen = () => {
    onOpen(product.id);
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      setAddingToCart(true);
      addToCart({
        productId: product.id,
        product,
        quantity: 1,
        priceSnapshot: product.price,
        nameSnapshot: product.name,
        imageSnapshot: product.image ?? product.images?.[0],
      });
      toast.success("장바구니에 상품이 추가되었습니다.");
    } catch (error) {
      console.error("Failed to add to cart:", error);
      toast.error("장바구니에 추가하지 못했습니다.");
    } finally {
      setAddingToCart(false);
    }
  };

  const handleToggleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!currentUser) {
      toast.error("로그인 후 찜할 수 있습니다.");
      return;
    }

    setWishlistLoading(true);
    try {
      if (wishlist) {
        await removeFromWishlist(product.id);
        setWishlist(false);
        toast.success("찜 목록에서 제거되었습니다.");
      } else {
        await addToWishlist(product.id);
        setWishlist(true);
        toast.success("찜 목록에 추가되었습니다.");
      }
    } catch (error: any) {
      console.error("Failed to toggle wishlist:", error);
      toast.error(error.message || "오류가 발생했습니다.");
    } finally {
      setWishlistLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full cursor-pointer overflow-hidden rounded text-left transition hover:shadow-lg group",
        className
      )}>
      <div
        onClick={handleOpen}
        className="relative aspect-square overflow-hidden bg-gray-50 flex-shrink-0 cursor-pointer focus:outline-none">
        <div className="w-full h-full">
          <ImageWithFallback
            src={imageSrc}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>
        {originalPrice && originalPrice > (product.price ?? 0) && (
          <Badge className="absolute left-2 top-2 border-0 bg-red-500 text-xs text-white z-10">
            {Math.round((1 - (product.price ?? 0) / originalPrice) * 100)}%
          </Badge>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
        <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 flex gap-2 p-3 bg-gradient-to-t from-black/80 to-transparent">
          <button
            type="button"
            disabled={addingToCart}
            className="flex-1 bg-white text-gray-900 text-xs font-semibold py-2 px-2 rounded hover:bg-white/30 transition disabled:opacity-50"
            onClick={handleAddToCart}>
            {addingToCart ? "추가 중..." : "담기"}
          </button>
          <button
            type="button"
            disabled={wishlistLoading}
            className={`flex-1 text-xs font-semibold py-2 px-2 rounded transition disabled:opacity-50 flex items-center justify-center ${
              wishlist
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-white text-black hover:bg-white/50"
            }`}
            onClick={handleToggleWishlist}>
            {wishlistLoading ? (
              <span className="flex items-center justify-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
              </span>
            ) : wishlist ? (
              <Heart className="h-3 w-3 fill-white" />
            ) : (
              "찜"
            )}
          </button>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between min-h-[120px]">
        <div className="space-y-1">
          {product.brand && (
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {product.brand}
            </p>
          )}
          <button
            type="button"
            onClick={handleOpen}
            className="line-clamp-1 w-full text-left text-sm font-medium text-gray-900 hover:underline">
            {product.name}
          </button>
          {meta && <p className="text-xs text-gray-500">{meta}</p>}
        </div>
        <div className="space-y-2">
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-semibold text-gray-900">
              {(product.price ?? 0).toLocaleString()}원
            </span>
          </div>
          {originalPrice && originalPrice > (product.price ?? 0) && (
            <p className="text-xs text-gray-400 line-through">
              {originalPrice.toLocaleString()}원
            </p>
          )}
          {(rating ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <Star className="h-3 w-3 fill-gray-900 text-gray-900" />
              <span>{(rating ?? 0).toFixed(1)}</span>
              {reviewCount !== undefined && (
                <span className="text-gray-400">
                  ({reviewCount.toLocaleString()})
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {primaryLabel && onPrimaryAction && (
        <Button
          variant="outline"
          size="sm"
          className="mx-4 mb-4 bg-brand-main"
          onClick={() => onPrimaryAction(product)}>
          {primaryLabel}
        </Button>
      )}
    </div>
  );
}

export function ProductPreviewSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="aspect-square w-full rounded bg-gray-100 animate-pulse" />
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-2">
          <div className="h-3 w-16 rounded bg-gray-100 animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-gray-100 animate-pulse" />
        </div>
        <div className="h-4 w-1/2 rounded bg-gray-100 animate-pulse" />
      </div>
    </div>
  );
}
