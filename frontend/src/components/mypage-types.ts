import type { Product } from "../types";

export interface RepeatPurchaseItem {
  product: Product;
  lastPurchasedAt: string;
}

export interface RecentlyViewedItem {
  product: Product;
  viewedAt: string;
}
