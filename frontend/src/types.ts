export interface RecentlyViewedEntry {
  productId: string;
  viewedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  address: string;
  points?: number; // 적립금
  recentlyViewed?: RecentlyViewedEntry[];
  isSeller?: boolean; // 판매자 여부
  sellerInfo?: {
    businessName?: string; // 사업자명
    businessNumber?: string; // 사업자 등록번호
    registeredAt?: string; // 판매자 등록일
    contactEmail?: string;
    contactPhone?: string;
    settlementAccount?: {
      bankName?: string;
      accountNumber?: string;
      accountHolder?: string;
    };
    deliverySettings?: {
      baseDeliveryFee?: number;
      freeDeliveryMinAmount?: number;
      returnExchangeDeliveryFee?: number;
    };
    notificationSettings?: {
      newOrderAlert?: boolean;
      lowStockAlert?: boolean;
      settlementAlert?: boolean;
    };
    aiAutomationSettings?: {
      priceOptimization?: boolean;
      stockAlert?: boolean;
      promotionRecommendation?: boolean;
      fraudDetection?: boolean;
    };
  };
}

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  brand: string;
  rating: number;
  reviewCount: number;
  description: string;
  images: string[];
  colors?: string[];
  sizes?: string[];
  stock: number;
  createdAt?: string;
}

export interface CartItem {
  id?: string;
  productId: string;
  product?: Product;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
  priceSnapshot?: number;
  nameSnapshot?: string;
  imageSnapshot?: string;
}

export interface Order {
  id: string;
  date: string;
  items: CartItem[];
  total: number;
  status: "배송 준비중" | "배송 중" | "배송 완료";
  address: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  content: string;
  images?: string[];
  date: string;
  helpful: number;
}

export interface WishlistItem {
  wishlist_id: string;
  product: Product;
  added_at: string | null;
}

export interface PaymentResult {
  orderId: string;
  totalAmount: number;
  method: string;
  approvedAt: string;
  status?: string;
}
