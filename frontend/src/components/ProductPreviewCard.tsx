import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import type { Product } from "../types";
import { cn } from "./ui/utils";

interface ProductPreviewCardProps {
  product: Product;
  onOpen: (productId: string) => void;
  primaryLabel?: string;
  onPrimaryAction?: (product: Product) => void;
  meta?: string;
  className?: string;
}

export function ProductPreviewCard({
  product,
  onOpen,
  primaryLabel,
  onPrimaryAction,
  meta,
  className,
}: ProductPreviewCardProps) {
  const imageSrc =
    product.image ||
    (Array.isArray(product.images) && product.images[0]) ||
    "https://via.placeholder.com/400x400?text=No+Image";

  const handleOpen = () => {
    onOpen(product.id);
  };

  return (
    <Card className={cn("flex flex-col justify-between border-gray-200 p-4", className)}>
      <div className="space-y-3">
        <button
          type="button"
          onClick={handleOpen}
          className="block w-full cursor-pointer overflow-hidden rounded bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/40"
        >
          <div className="aspect-square w-full overflow-hidden">
            <ImageWithFallback
              src={imageSrc}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
              loading="lazy"
            />
          </div>
        </button>
        <div className="space-y-1">
          {product.brand && (
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {product.brand}
            </p>
          )}
          <button
            type="button"
            onClick={handleOpen}
            className="line-clamp-2 w-full text-left text-sm font-medium text-gray-900 hover:underline"
          >
            {product.name}
          </button>
          <p className="text-sm font-semibold text-gray-900">
            {(product.price ?? 0).toLocaleString()}원
          </p>
          {meta && <p className="text-xs text-gray-500">{meta}</p>}
        </div>
      </div>
      {primaryLabel && onPrimaryAction && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => onPrimaryAction(product)}
        >
          {primaryLabel}
        </Button>
      )}
    </Card>
  );
}

export function ProductPreviewSkeleton() {
  return (
    <Card className="border-gray-200 p-4">
      <div className="space-y-3">
        <div className="aspect-square w-full rounded bg-gray-100 animate-pulse" />
        <div className="space-y-2">
          <div className="h-3 w-16 rounded bg-gray-100 animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-gray-100 animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-gray-100 animate-pulse" />
        </div>
        <div className="h-8 w-full rounded bg-gray-100 animate-pulse" />
      </div>
    </Card>
  );
}
