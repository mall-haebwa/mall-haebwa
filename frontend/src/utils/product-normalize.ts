import type { Product } from "../types";

export const normalizeProductSummary = (raw: any): Product => {
  const images = Array.isArray(raw?.images)
    ? raw.images.map((item: unknown) => String(item))
    : [];
  const colors = Array.isArray(raw?.colors)
    ? raw.colors.map((item: unknown) => String(item))
    : [];
  const sizes = Array.isArray(raw?.sizes)
    ? raw.sizes.map((item: unknown) => String(item))
    : [];

  const priceValue = raw?.price;
  const price =
    typeof priceValue === "number"
      ? priceValue
      : Number.parseInt(String(priceValue ?? 0), 10) || 0;

  const originalRaw =
    raw?.originalPrice ?? raw?.original_price ?? raw?.hprice ?? 0;
  const originalPrice =
    typeof originalRaw === "number"
      ? originalRaw
      : Number.parseInt(String(originalRaw), 10) || 0;

  const ratingValue =
    typeof raw?.rating === "number"
      ? raw.rating
      : Number.parseFloat(String(raw?.rating ?? 0)) || 0;

  const reviewValue =
    typeof raw?.reviewCount === "number"
      ? raw.reviewCount
      : Number.parseInt(String(raw?.reviewCount ?? 0), 10) || 0;

  const stockValue =
    typeof raw?.stock === "number"
      ? raw.stock
      : Number.parseInt(String(raw?.stock ?? 0), 10) || 0;

  return {
    id: String(raw?.id ?? raw?._id ?? ""),
    name: String(raw?.name ?? ""),
    price,
    originalPrice: originalPrice > 0 ? originalPrice : undefined,
    image: String(raw?.image ?? images[0] ?? ""),
    category: String(raw?.category ?? "기타"),
    brand: String(raw?.brand ?? ""),
    rating: ratingValue,
    reviewCount: reviewValue,
    description: String(raw?.description ?? ""),
    images,
    colors,
    sizes,
    stock: stockValue,
    createdAt: raw?.createdAt ? String(raw.createdAt) : undefined,
  };
};
