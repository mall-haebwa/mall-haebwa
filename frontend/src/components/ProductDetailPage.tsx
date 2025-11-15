import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Heart,
  Minus,
  Plus,
  RotateCcw,
  Share2,
  Shield,
  Star,
  Truck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAppState } from "../context/app-state";
import type { Product } from "../types";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Separator } from "./ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

const DEFAULT_COLOR = "기본";
const DEFAULT_SIZE = "기본";

const parseAmount = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const numeric = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isNaN(numeric) ? fallback : numeric;
  }
  return fallback;
};
// 숫자는 숫자로 문자도 숫자로 변경 시켜주는데 변경 불가능할 경우 기본값 0으로 반환

const normalizerProdectDtail = (raw: unknown): Product => {
  const candidate = (raw as any)?.product ?? raw ?? {};
  // 원본 데이터 추출

  const images: string[] =
    Array.isArray(candidate.images) && candidate.images.length > 0
      ? candidate.images.map((item: unknown) => String(item))
      : candidate.image
      ? [String(candidate.image)]
      : [];
  // 이미지 배열 처리

  const colors: string[] = Array.isArray(candidate.colors)
    ? candidate.colors.map((item: unknown) => String(item))
    : [];
  // 색상 처리

  const sizes: string[] = Array.isArray(candidate.sizes)
    ? candidate.sizes.map((item: unknown) => String(item))
    : [];
  // 사이즈 처리

  const price = parseAmount(
    candidate.price ?? candidate.numericPrice ?? candidate.lprice,
    0
  );
  // 가격 처리

  const originalPrice = parseAmount(
    candidate.originalPrice ?? candidate.hprice,
    0
  );
  // 가격 처리

  const ratingRaw = candidate.rating ?? candidate.score ?? 0;
  const rating =
    typeof ratingRaw === "number"
      ? ratingRaw
      : parseFloat(String(ratingRaw)) || 0;
  // 평점 처리

  const reviewCountRaw = candidate.reviewCount ?? candidate.commentCount ?? 0;
  const reviewCount =
    typeof reviewCountRaw === "number"
      ? reviewCountRaw
      : parseInt(String(reviewCountRaw).replace(/[^\d]/g, ""), 10) || 0;
  // 리뷰 수 처리

  const stock = parseAmount(candidate.stock, 0);

  return {
    id: String(candidate.id ?? candidate._id ?? ""),
    name: candidate.name ?? candidate.title ?? "",
    price,
    originalPrice: originalPrice > 0 ? originalPrice : undefined,
    image: images[0] ?? "",
    category: candidate.category ?? candidate.category1 ?? "기타",
    brand: candidate.brand ?? candidate.maker ?? "",
    rating,
    reviewCount,
    description: candidate.description ?? candidate.summary ?? "",
    images,
    colors,
    sizes,
    stock,
    createdAt:
      candidate.createdAt ??
      candidate.updated_at ??
      candidate.created_at ??
      undefined,
  };
};
// 데이터를 일관된 형태로 통일(의류의 사이즈는 다른 물품에 해당x)

export function ProductDetailPage() {
  const navigate = useNavigate();
  const { productId } = useParams<{ productId: string }>();
  const { addToCart, currentUser, setSelectedCategory, setSearchQuery, wishlistMap, addToWishlist, removeFromWishlist } = useAppState();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLOR);
  const [selectedSize, setSelectedSize] = useState(DEFAULT_SIZE);
  const [activeImage, setActiveImage] = useState(0);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  // ✅ Context의 wishlistMap에서 직접 읽기
  const isWishlisted = productId ? (wishlistMap[productId] ?? false) : false;

  useEffect(() => {
    const controller = new AbortController();

    if (!productId) {
      setProduct(null);
      setError("잘못된 상품 주소입니다.");
      setLoading(false);
      return () => controller.abort();
    }

    setLoading(true);
    setError(null);
    setProduct(null);

    const loadProduct = async () => {
      try {
        const response = await fetch(`/api/products/${productId}`, {
          signal: controller.signal,
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(
            `상품을 불러오지 못했습니다. (HTTP ${response.status})`
          );
        }

        const data = await response.json();
        const normalized = normalizerProdectDtail(data);

        if (!normalized.id) {
          throw new Error("상품 ID가 없는 응답입니다.");
        }

        setProduct(normalized);
        // ✅ wishlist는 Context의 wishlistMap에서 자동으로 관리됨
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          err instanceof Error
            ? err.message
            : "알 수 없는 오류가 발생했습니다.";
        setError(message);
        setProduct(null);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadProduct();

    return () => controller.abort();
  }, [productId]);

  useEffect(() => {
    if (!product) {
      return;
    }
    setQuantity(1);
    setActiveImage(0);
    setSelectedColor(product.colors?.[0] ?? DEFAULT_COLOR);
    setSelectedSize(product.sizes?.[0] ?? DEFAULT_SIZE);
  }, [product]);

  useEffect(() => {
    if (!product?.id || !currentUser) {
      return;
    }

    const controller = new AbortController();

    const updateRecentlyViewed = async () => {
      try {
        // Redis에 상품 ID 저장 (최대 10개는 백엔드에서 관리)
        await fetch("/api/users/recently-viewed", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ productId: product.id }),
          signal: controller.signal,
        });

        console.log(
          "[Recently Viewed] 🔄 Redis에 저장됨:",
          product.name
        );
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Failed to update recently viewed:", error);
      }
    };

    void updateRecentlyViewed();

    return () => {
      controller.abort();
    };
  }, [product?.id, currentUser, product]);

  const handleCategoryClick = () => {
    if (product?.category) {
      setSelectedCategory(product.category);
      setSearchQuery("");
      navigate("/products");
    }
  };

  const handleAddToCart = () => {
    if (!product) {
      toast.error("상품 정보를 불러오지 못했어요.");
      return;
    }

    addToCart({
      productId: product.id,
      product,
      quantity,
      selectedColor: product.colors?.length ? selectedColor : undefined,
      selectedSize: product.sizes?.length ? selectedSize : undefined,
      priceSnapshot: product.price,
      nameSnapshot: product.name,
      imageSnapshot: product.image ?? product.images?.[0],
    });

    toast.success("장바구니에 상품이 추가되었습니다.", {
      action: {
        label: "장바구니 보기",
        onClick: () => navigate("/cart"),
      },
    });
  };

  const handleBuyNow = () => {
    if (!product) {
      toast.error("상품 정보를 불러오지 못했어요.");
      return;
    }

    if (!currentUser) {
      toast.error("로그인 후 구매하실 수 있어요.");
      navigate("/login");
      return;
    }

    handleAddToCart();
    navigate("/cart");
  };

  let content: JSX.Element;

  if (!productId) {
    content = (
      <Card className="border-gray-200 p-8 text-center text-sm text-gray-600">
        잘못된 상품 주소입니다. 목록으로 돌아가 주세요.
      </Card>
    );
  } else if (loading) {
    content = (
      <div className="flex h-[420px] flex-col items-center justify-center gap-3 text-sm text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>상품 정보를 불러오는 중입니다…</span>
      </div>
    );
  } else if (error) {
    content = (
      <Card className="border-gray-200 p-8 text-center text-sm text-red-500">
        상품 정보를 불러오지 못했어요.
        <br />
        {error}
      </Card>
    );
  } else if (!product) {
    content = (
      <Card className="border-gray-200 p-8 text-center text-sm text-gray-600">
        상품 정보를 찾을 수 없습니다.
      </Card>
    );
  } else {
    content = (
      <>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <button type="button" onClick={() => navigate("/")}>
            홈
          </button>
          <span>/</span>
          <button type="button" onClick={handleCategoryClick}>
            {product.category}
          </button>
          <span>/</span>
          <span className="text-gray-900">{product.name}</span>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <div className="overflow-hidden border border-gray-200">
              <ImageWithFallback
                src={product.images?.[activeImage] ?? ""}
                alt={product.name}
                className="h-[420px] w-full object-cover"
              />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {product.images?.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className={`border ${
                    activeImage === index
                      ? "border-gray-900"
                      : "border-gray-200"
                  }`}
                >
                  <ImageWithFallback
                    src={image}
                    alt={`${product.name} ${index + 1}`}
                    className="h-20 w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          <Card className="space-y-6 border-gray-200 p-6">
            <div className="space-y-3">
              <Badge className="bg-gray-100 text-gray-700">
                {product.brand}
              </Badge>
              <h1 className="text-2xl font-semibold text-gray-900">
                {product.name}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Star className="h-4 w-4 fill-gray-900 text-gray-900" />
                <span>{product.rating.toFixed(1)}</span>
                <span className="text-gray-400">
                  ({product.reviewCount.toLocaleString()} reviews)
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-3xl font-semibold text-gray-900">
                ₩{product.price.toLocaleString()}
              </div>
              {product.originalPrice && (
                <div className="text-sm text-gray-400 line-through">
                  ₩{product.originalPrice.toLocaleString()}
                </div>
              )}
            </div>

            <p className="text-sm text-gray-600">{product.description}</p>

            {product.colors && product.colors.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">색상</div>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((color) => (
                    <Button
                      key={color}
                      type="button"
                      variant={selectedColor === color ? "default" : "outline"}
                      onClick={() => setSelectedColor(color)}
                      className="h-9"
                    >
                      {color}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {product.sizes && product.sizes.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">사이즈</div>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <Button
                      key={size}
                      type="button"
                      variant={selectedSize === size ? "default" : "outline"}
                      onClick={() => setSelectedSize(size)}
                      className="h-9"
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className="flex items-center rounded border border-gray-200">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-10 text-center">{quantity}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity((prev) => prev + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  if (!currentUser) {
                    toast.error("로그인 후 이용하실 수 있어요.");
                    navigate("/login");
                    return;
                  }

                  if (!product) return;

                  setWishlistLoading(true);
                  try {
                    // ✅ Context 함수 사용 (wishlistMap 자동 업데이트)
                    if (isWishlisted) {
                      await removeFromWishlist(product.id);
                      toast.success("찜 목록에서 제거되었습니다.");
                    } else {
                      await addToWishlist(product.id);
                      toast.success("찜 목록에 추가되었습니다.");
                    }
                  } catch (error: any) {
                    toast.error(error.message || "오류가 발생했습니다.");
                  } finally {
                    setWishlistLoading(false);
                  }
                }}
                disabled={wishlistLoading}
                className="gap-2"
              >
                <Heart
                  className={`h-4 w-4 ${
                    isWishlisted ? "fill-gray-900 text-gray-900" : ""
                  }`}
                />
                {isWishlisted ? "찜 완료" : "찜하기"}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={() => toast.info("공유 기능을 준비 중입니다.")}
                className="gap-2"
              >
                <Share2 className="h-4 w-4" />
                공유
              </Button>
            </div>

            <div className="space-y-3">
              <Button
                type="button"
                className="h-11 w-full bg-gray-900 text-white hover:bg-black"
                onClick={handleAddToCart}
              >
                장바구니에 담기
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                onClick={handleBuyNow}
              >
                바로 구매하기
              </Button>
            </div>

            <div className="grid gap-3 rounded border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-gray-400" />
                <span>무료 배송 (₩50,000 이상 구매 시)</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-gray-400" />
                <span>보증 서비스를 통해 안심하고 구매하세요.</span>
              </div>
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-gray-400" />
                <span>수령 후 7일 이내 무료 반품 가능합니다.</span>
              </div>
            </div>
          </Card>
        </div>

        <Tabs defaultValue="description" className="mt-10">
          <TabsList>
            <TabsTrigger value="description">상세 정보</TabsTrigger>
            <TabsTrigger value="reviews">리뷰</TabsTrigger>
            <TabsTrigger value="shipping">배송/반품 안내</TabsTrigger>
          </TabsList>
          <TabsContent
            value="description"
            className="mt-6 space-y-4 text-sm text-gray-600"
          >
            <p>{product.description}</p>
            <p>
              린넨과 코튼 혼방 소재로 제작되어 통기성이 좋고 가볍습니다. 손세탁
              또는 드라이클리닝을 권장합니다.
            </p>
          </TabsContent>
          <TabsContent value="reviews" className="mt-6">
            <Card className="border-gray-200 p-6 text-sm text-gray-600">
              리뷰 기능을 준비 중입니다. 구매 후 리뷰를 작성해 주세요.
            </Card>
          </TabsContent>
          <TabsContent value="shipping" className="mt-6 text-sm text-gray-600">
            <Card className="space-y-3 border-gray-200 p-6">
              <p>오후 2시 이전 결제 건은 당일 출고됩니다.</p>
              <Separator />
              <p>도서 산간 지역은 추가 배송비가 발생할 수 있습니다.</p>
            </Card>
          </TabsContent>
        </Tabs>
      </>
    );
  }

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-[1100px] px-6 py-8 md:px-8">{content}</div>
    </div>
  );
}
