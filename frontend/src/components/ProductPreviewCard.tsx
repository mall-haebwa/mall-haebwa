import { useState, useEffect } from "react";
import { Star, Heart, Loader2, ShoppingCart } from "lucide-react";
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
  isHomeLarge?: boolean;
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
  isHomeLarge,
}: ProductPreviewCardProps) {
  const {
    addToCart,
    currentUser,
    addToWishlist,
    removeFromWishlist,
    wishlistMap,
  } = useAppState();
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  // ✅ Context의 wishlistMap에서 직접 읽기 (API 호출 없음!)
  const isWishlisted = wishlistMap[product.id] ?? false;

  const imageSrc =
    product.image ||
    (Array.isArray(product.images) && product.images[0]) ||
    "https://via.placeholder.com/400x400?text=No+Image";

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
      // ✅ Context의 wishlistMap이 자동으로 업데이트되므로 setState 불필요
      if (isWishlisted) {
        await removeFromWishlist(product.id);
        toast.success("찜 목록에서 제거되었습니다.");
      } else {
        await addToWishlist(product.id);
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
        "flex flex-col h-full cursor-pointer overflow-hidden rounded text-left transition hover:shadow-lg group bg-white/5 backdrop-blur-sm border border-white/10",
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
        <div
          className={cn(
            "absolute flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
            isHomeLarge ? "bottom-3 right-3" : "bottom-2 right-2"
          )}>
          <button
            type="button"
            disabled={addingToCart}
            className={cn(
              "rounded-full bg-white/30 backdrop-blur-sm text-black font-bold border border-white/40 hover:bg-white/40 transition disabled:opacity-50 flex items-center justify-center",
              isHomeLarge ? "w-11 h-11 text-xs" : "w-8 h-8 text-xs"
            )}
            onClick={handleAddToCart}>
            {addingToCart ? (
              <Loader2
                className={
                  isHomeLarge ? "h-4 w-4 animate-spin" : "h-3 w-3 animate-spin"
                }
              />
            ) : (
              <ShoppingCart className={isHomeLarge ? "h-4 w-4" : "h-3 w-3"} />
            )}
          </button>
          <button
            type="button"
            disabled={wishlistLoading}
            className={cn(
              "rounded-full font-semibold transition disabled:opacity-50 flex items-center justify-center backdrop-blur-sm border ",
              isHomeLarge ? "w-11 h-11 text-xs" : "w-8 h-8 text-xs",
              isWishlisted
                ? "bg-red-500/60 text-white hover:bg-red-500/80 border-red-400/50"
                : "bg-white/30 text-black hover:bg-white/40 border-white/40"
            )}
            onClick={handleToggleWishlist}>
            {wishlistLoading ? (
              <Loader2
                className={
                  isHomeLarge ? "h-4 w-4 animate-spin" : "h-3 w-3 animate-spin"
                }
              />
            ) : (
              <Heart
                className={cn(
                  isHomeLarge ? "h-4 w-4" : "h-3 w-3",
                  isWishlisted ? "fill-white" : ""
                )}
              />
            )}
          </button>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between min-h-[120px] bg-white/5 backdrop-blur-sm border-t border-white/10">
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
          className="mx-4 mb-4 bg-brand-sub text-white"
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
