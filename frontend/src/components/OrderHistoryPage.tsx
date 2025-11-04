import { ChevronRight, Package, RotateCcw, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAppState } from "../context/app-state";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Separator } from "./ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useEffect, useState } from "react";
import { DeliveryTrackingModal } from "./DeliveryTrackingModal";

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  image_url?: string;
  selected_color?: string;
  selected_size?: string;
}

interface Order {
  order_id: string;
  amount: number;
  order_name: string;
  customer_name: string;
  items?: OrderItem[];
  status: string;
  payment_method: string;
  approved_at: string;
  created_at: string;
}

export function OrderHistoryPage() {
  const navigate = useNavigate();
  const { currentUser, refreshCart } = useAppState();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // 페이지 마운트 시 장바구니 새로고침
  useEffect(() => {
    if (currentUser) {
      console.log("🔄 주문 내역 페이지 마운트 - 장바구니 새로고침");
      refreshCart();
    }
  }, [currentUser, refreshCart]);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const response = await fetch("/api/orders", {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setOrders(data);
        } else {
          toast.error("주문 내역을 불러오는데 실패했습니다.");
        }
      } catch (error) {
        console.error("주문 내역 조회 실패:", error);
        toast.error("주문 내역을 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    }

    if (currentUser) {
      fetchOrders();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <Package className="h-16 w-16 text-gray-300" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            주문 내역을 확인하려면 로그인하세요
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            주문 상태와 배송 정보를 한 번에 확인할 수 있습니다.
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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">주문 내역 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1100px] px-6 py-10 md:px-8">
        <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">주문/배송 조회</h1>
            <p className="text-sm text-gray-600">
              최근 주문 내역과 배송 현황을 확인하세요.
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2 text-sm"
            onClick={() => toast.info("택배사 연동은 준비 중입니다.")}
          >
            <Truck className="h-4 w-4" />
            운송장 조회
          </Button>
        </div>

        {orders.length === 0 ? (
          <Card className="border-gray-200 p-12 text-center">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              주문 내역이 없습니다
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              첫 주문을 시작해보세요!
            </p>
            <Button
              className="bg-gray-900 text-white hover:bg-black"
              onClick={() => navigate("/products")}
            >
              쇼핑하러 가기
            </Button>
          </Card>
        ) : (
          <Tabs defaultValue="all" className="space-y-6">
            <TabsList>
              <TabsTrigger value="all">전체</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {orders.map((order) => (
                <Card key={order.order_id} className="space-y-4 border-gray-200 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-gray-500">주문번호</p>
                      <p className="font-mono text-sm text-gray-800">{order.order_id}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <RotateCcw className="h-4 w-4" />
                      {new Date(order.approved_at).toLocaleDateString("ko-KR")}
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-600">
                      {order.status === "PAID" ? "결제 완료" : order.status}
                    </Badge>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    {order.items && order.items.length > 0 ? (
                      order.items.map((item, idx) => (
                        <div
                          key={`${order.order_id}-${item.product_id}-${idx}`}
                          className="flex gap-4 border border-gray-100 p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div
                            className="h-20 w-20 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50 cursor-pointer"
                            onClick={() => navigate(`/product/${item.product_id}`)}
                          >
                            <ImageWithFallback
                              src={item.image_url || ""}
                              alt={item.product_name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="flex flex-1 flex-col justify-between">
                            <div>
                              <p
                                className="text-sm font-medium text-gray-900 hover:underline cursor-pointer"
                                onClick={() => navigate(`/product/${item.product_id}`)}
                              >
                                {item.product_name}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {item.selected_color && `색상: ${item.selected_color}`}
                                {item.selected_size && ` · 사이즈: ${item.selected_size}`}
                              </p>
                              <p className="text-xs text-gray-500">
                                수량: {item.quantity}개
                              </p>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-sm font-semibold text-gray-900">
                                {(item.price * item.quantity).toLocaleString()}원
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex gap-4 border border-gray-100 p-4">
                        <div className="flex flex-1 flex-col justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {order.order_name}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              결제방법: {order.payment_method}
                            </p>
                            <p className="text-xs text-gray-500">
                              주문자: {order.customer_name}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div className="text-gray-500">
                        총 결제 금액{" "}
                        <span className="font-semibold text-gray-900">
                          {order.amount.toLocaleString()}원
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedOrder(order);
                          setDeliveryModalOpen(true);
                        }}
                        className="flex items-center gap-1"
                      >
                        <Truck className="h-3 w-3" />
                        배송 현황
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigate("/customer-service");
                          toast.info("환불/반품 문의를 작성해주세요.");
                        }}
                      >
                        환불/반품 문의
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/customer-service")}
                      >
                        문의하기
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (window.confirm("정말로 주문을 취소하시겠습니까?")) {
                            toast.info("주문 취소 기능은 준비 중입니다.");
                          }
                        }}
                      >
                        주문 취소
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* 배송 조회 모달 */}
      {selectedOrder && (
        <DeliveryTrackingModal
          isOpen={deliveryModalOpen}
          onClose={() => setDeliveryModalOpen(false)}
          orderId={selectedOrder.order_id}
          approvedAt={selectedOrder.approved_at}
          orderName={selectedOrder.order_name}
        />
      )}
    </div>
  );
}
