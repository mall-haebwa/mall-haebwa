import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAppState } from "../context/app-state";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { loadTossPayments } from "@tosspayments/payment-sdk"; // 토스페이먼츠 SDK

export function CartPage() {
  const navigate = useNavigate();
  const { cart, updateCartItem, removeFromCart, currentUser } = useAppState();
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [couponCode, setCouponCode] = useState("");

  const [tossPayments, setTossPayments] = useState<any>(null); // 토스페이먼츠 인스턴스 상태

  useEffect(() => {
    setSelectedItems((prev) => {
      const safe = prev.filter((index) => index < cart.length);
      if (safe.length === cart.length) {
        return safe;
      }
      if (cart.length && safe.length === 0) {
        return cart.map((_, index) => index);
      }
      return safe;
    });
  }, [cart]);

  // 토스페이먼츠 초기화
  useEffect(() => {
    async function initializeTossPayments() {
      try {
        const clientKey = "test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq"; // .env에서 불러올 수도 있음
        const payments = await loadTossPayments(clientKey);
        setTossPayments(payments);
        console.log("토스페이먼츠 초기화 완료");
      } catch (error) {
        console.error("토스페이먼츠 초기화 실패:", error);
        toast.error("결제 시스템 초기화에 실패했습니다.");
      }
    }
    initializeTossPayments();
  }, []);

  const totals = useMemo(() => {
    const subtotal = cart
      .filter((_, index) => selectedItems.includes(index))
      .reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const deliveryFee = subtotal >= 30000 || subtotal === 0 ? 0 : 3000;
    return {
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
    };
  }, [cart, selectedItems]);

  const toggleItem = (index: number) => {
    setSelectedItems((prev) =>
      prev.includes(index)
        ? prev.filter((value) => value !== index)
        : [...prev, index]
    );
  };

  const toggleAll = () => {
    if (selectedItems.length === cart.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(cart.map((_, index) => index));
    }
  };

  const handleQuantity = (index: number, next: number) => {
    if (next < 1) return;
    updateCartItem(index, next);
  };

  const handleCheckout = async () => {
    // 1. 선택된 상품 확인
    if (selectedItems.length === 0) {
      toast.error("Choose at least one product before checkout.");
      return;
    }

    // 2. 로그인 확인
    if (!currentUser) {
      toast.error("Please log in to continue.");
      navigate("/login");
      return;
    }

    // 3. 토스페이먼츠 초기화 확인
    if (!tossPayments) {
      toast.error("결제 시스템 초기화 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    try {
      // 4. 선택된 상품들의 정보 수집
      const selectedCartItems = cart.filter((_, index) =>
        selectedItems.includes(index)
      );

      const selectedProducts = selectedCartItems
        .map((item) => item.product.name)
        .join(", ");

      const orderName =
        selectedProducts.length > 50
          ? `${selectedProducts.substring(0, 47)}...`
          : selectedProducts;

      // 주문 상품 목록 생성
      const items = selectedCartItems.map((item) => ({
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
        image_url:
          item.product.image_url ||
          "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100&q=80",
        selected_color: item.selectedColor,
        selected_size: item.selectedSize,
      }));

      console.log("📝 주문 생성 요청...");
      console.log("주문 금액:", totals.total);
      console.log("주문 상품:", orderName);
      console.log("상품 목록:", items);

      // 5. 백엔드에 주문 생성 요청
      const orderResponse = await fetch(
        "http://localhost:8000/api/payment/orders",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: totals.total,
            order_name: orderName,
            customer_name: currentUser.name || currentUser.email || "고객",
            items: items,
          }),
        }
      );

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        throw new Error(errorData.detail || "주문 생성에 실패했습니다");
      }

      const { order } = await orderResponse.json();
      console.log("✅ 주문 생성 완료:", order.order_id);

      // 6. 토스페이먼츠 결제창 호출
      console.log("💳 결제창 호출...");

      await tossPayments.requestPayment("카드", {
        amount: order.amount,
        orderId: order.order_id,
        orderName: order.order_name,
        customerName: order.customer_name,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
      });

      // 여기는 실행되지 않음 (결제창으로 페이지 이동)
    } catch (error: any) {
      console.error("❌ 결제 요청 실패:", error);

      if (error.message.includes("fetch")) {
        toast.error(
          "서버 연결에 실패했습니다. 백엔드가 실행 중인지 확인해주세요."
        );
      } else {
        toast.error(`결제 요청 실패: ${error.message}`);
      }
    }
  };

  const applyCoupon = () => {
    if (couponCode.trim().toLowerCase() === "welcome10") {
      toast.success("10% discount coupon applied.");
    } else {
      toast.error("Invalid coupon code.");
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center px-6 py-20 text-center md:px-8">
          <ShoppingBag className="mb-4 h-16 w-16 text-gray-300" />
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            Your cart is empty
          </h2>
          <p className="mb-6 text-sm text-gray-600">
            Browse featured products and fill your cart.
          </p>
          <Button
            onClick={() => navigate("/")}
            className="h-10 bg-gray-900 text-white hover:bg-black"
          >
            Continue shopping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1280px] px-6 py-6 md:px-8">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">
          Shopping Cart
        </h1>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <Card className="mb-4 border-gray-200 p-4">
              <div className="mb-4 flex items-center gap-2 text-sm text-gray-700">
                <Checkbox
                  checked={selectedItems.length === cart.length}
                  onCheckedChange={toggleAll}
                />
                <span>
                  Select all ({selectedItems.length}/{cart.length})
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-7 text-xs"
                  disabled={selectedItems.length === 0}
                  onClick={() => {
                    const targets = [...selectedItems].sort((a, b) => b - a);
                    targets.forEach((index) => removeFromCart(index));
                    toast.success("Selected items removed.");
                  }}
                >
                  Remove selected
                </Button>
              </div>

              <Separator className="mb-4" />

              <div className="space-y-4">
                {cart.map((item, index) => (
                  <div
                    key={`${item.product.id}-${index}`}
                    className="flex gap-4 border border-gray-200 p-4"
                  >
                    <Checkbox
                      checked={selectedItems.includes(index)}
                      onCheckedChange={() => toggleItem(index)}
                    />
                    <div className="h-20 w-20 shrink-0 overflow-hidden border border-gray-200 bg-gray-50">
                      <ImageWithFallback
                        src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100&q=80"
                        alt={item.product.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">
                          {item.product.name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {item.selectedColor && `Color: ${item.selectedColor}`}
                          {item.selectedSize && ` · Size: ${item.selectedSize}`}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              handleQuantity(index, item.quantity - 1)
                            }
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center text-sm">
                            {item.quantity}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              handleQuantity(index, item.quantity + 1)
                            }
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">
                            ₩
                            {(
                              item.product.price * item.quantity
                            ).toLocaleString()}
                          </p>
                          <button
                            type="button"
                            className="mt-1 flex items-center gap-1 text-xs text-gray-500 hover:text-red-500"
                            onClick={() => removeFromCart(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-gray-200 p-4">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">
                Coupon
              </h2>
              <div className="flex gap-2">
                <Input
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value)}
                  placeholder="Enter coupon code"
                  className="h-10"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10"
                  onClick={applyCoupon}
                >
                  Apply
                </Button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Try <code className="font-mono">WELCOME10</code> for 10% off.
              </p>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-gray-200 p-5">
              <h2 className="mb-4 text-base font-semibold text-gray-900">
                Order summary
              </h2>
              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₩{totals.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery fee</span>
                  <span>
                    {totals.deliveryFee === 0
                      ? "Free"
                      : `₩${totals.deliveryFee.toLocaleString()}`}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-semibold text-gray-900">
                  <span>Total</span>
                  <span>₩{totals.total.toLocaleString()}</span>
                </div>
              </div>
              <Button
                type="button"
                className="mt-6 h-11 w-full bg-gray-900 text-white hover:bg-black"
                onClick={handleCheckout}
              >
                Checkout
              </Button>
            </Card>

            <Card className="border-gray-200 p-5 text-sm text-gray-600">
              <div className="flex items-center gap-2 text-gray-900">
                <ChevronRight className="h-4 w-4" />
                <span>Need help?</span>
              </div>
              <p className="mt-2">
                Contact our support team for payment or delivery enquiries.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
