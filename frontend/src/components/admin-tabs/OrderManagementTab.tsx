import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Truck, Check, X as XIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

type OrderStatus = "pending" | "shipping" | "completed" | "canceled";

type SellerOrder = {
  _id: string;
  order_id: string;
  productName: string;
  customerName: string;
  amount: number;
  status: OrderStatus;
  created_at: string;
  itemCount: number;
  products: Array<{
    productName?: string;
    quantity?: number;
    price?: number;
    imageUrl?: string;
  }>;
};

type SuspiciousOrder = {
  _id: string;
  order_id: string;
  fraudReasons?: string[];
  created_at: string;
};

type OrderDashboard = {
  statusCounts: Record<string, number>;
  suspiciousOrders: SuspiciousOrder[];
};

const ORDER_TABS: Array<{ label: string; value: OrderStatus | null }> = [
  { label: "전체", value: null },
  { label: "처리대기", value: "pending" },
  { label: "배송중", value: "shipping" },
  { label: "완료", value: "completed" },
];

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "처리대기",
  shipping: "배송중",
  completed: "완료",
  canceled: "취소",
};

const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  pending: "bg-red-100 text-red-700",
  shipping: "bg-orange-100 text-orange-700",
  completed: "bg-emerald-100 text-emerald-700",
  canceled: "bg-gray-200 text-gray-700",
};

const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  "pending",
  "shipping",
  "completed",
  "canceled",
];

const formatDateTime = (isoString?: string) => {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
};

export function OrderManagementTab() {
  const [orderTab, setOrderTab] = useState<OrderStatus | null>(null);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderPage, setOrderPage] = useState(1);
  const [orderLimit] = useState(20);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [orderDashboard, setOrderDashboard] = useState<OrderDashboard | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<SellerOrder | null>(null);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);

  // 주문 대시보드 로드
  const loadOrderDashboard = useCallback(async () => {
    try {
      const response = await fetch("/api/seller/orders/dashboard", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("주문 대시보드 조회 실패");
      const data = await response.json();
      const counts = data.statusCounts || {};
      const totalFromCounts = Object.values(counts).reduce(
        (sum: number, value) => sum + (typeof value === "number" ? value : 0),
        0
      );
      setOrderDashboard({
        ...data,
        statusCounts: {
          ...counts,
          total: counts.total ?? totalFromCounts,
        },
      });
    } catch (error) {
      console.error("Error loading order dashboard:", error);
      alert("주문 대시보드를 불러오지 못했습니다.");
    }
  }, []);

  // 주문 목록 로드
  const loadOrders = useCallback(async () => {
    try {
      setIsLoadingOrders(true);
      const params = new URLSearchParams({
        page: String(orderPage),
        limit: String(orderLimit),
      });
      if (orderTab) {
        params.set("status_filter", orderTab);
      }

      const response = await fetch(`/api/seller/orders?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("주문 목록 조회 실패");
      const data = await response.json();
      setOrders(data.items || []);
      setOrderTotal(data.total || 0);
    } catch (error) {
      console.error("Error loading orders:", error);
      alert("주문 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoadingOrders(false);
    }
  }, [orderLimit, orderPage, orderTab]);

  // 주문 상태 변경
  const handleChangeOrderStatus = async (
    orderId: string,
    nextStatus: OrderStatus
  ) => {
    if (!orderId) return;
    try {
      setIsUpdatingOrder(true);
      const response = await fetch(`/api/seller/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ new_status: nextStatus }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "주문 상태 변경 실패");
      }
      await loadOrders();
      loadOrderDashboard();
      alert("주문 상태를 변경했습니다.");
      setSelectedOrder(null);
    } catch (error) {
      console.error("Error updating order status:", error);
      alert(
        error instanceof Error
          ? error.message
          : "주문 상태 변경 중 오류가 발생했습니다."
      );
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadOrderDashboard();
    loadOrders();
  }, [loadOrderDashboard, loadOrders]);

  return (
    <div className="p-8">
      {/* 상태별 탭 */}
      <div className="mb-6 flex gap-2 overflow-x-auto border-b border-gray-200">
        {ORDER_TABS.map((tab) => {
          const isActive = orderTab === tab.value;
          const count =
            tab.value === null
              ? orderDashboard?.statusCounts?.total ?? orderTotal
              : orderDashboard?.statusCounts?.[tab.value] ?? 0;
          return (
            <button
              key={tab.label}
              className={`px-4 py-2 text-sm font-medium ${
                isActive
                  ? "border-b-2 border-purple-600 text-purple-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              onClick={() => {
                setOrderTab(tab.value);
                setOrderPage(1);
              }}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* AI 사기 탐지 알림 */}
      {orderDashboard?.suspiciousOrders?.length ? (
        <Card className="mb-6 border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="mb-2 text-lg font-semibold text-gray-900">
                AI 사기 탐지 알림
              </h3>
              <p className="mb-3 text-sm text-gray-700">
                의심스러운 주문이 {orderDashboard.suspiciousOrders.length}
                건 발견되었습니다.
              </p>
              <div className="space-y-2">
                {orderDashboard.suspiciousOrders.map((order) => (
                  <div
                    key={order._id}
                    className="rounded-lg border border-red-200 bg-white p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          주문번호: {order.order_id}
                        </p>
                        <p className="text-xs text-gray-600">
                          의심 요인:{" "}
                          {order.fraudReasons?.join(", ") || "알 수 없음"}
                        </p>
                      </div>
                      <Button size="sm" variant="outline">
                        상세보기
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {/* 주문 목록 */}
      <Card className="overflow-hidden">
        {isLoadingOrders ? (
          <div className="p-6 text-center text-gray-500">
            주문 목록을 불러오는 중...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            주문이 없습니다.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      주문번호
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      상품
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      고객
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      금액
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      일시
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      관리
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {order.order_id}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {order.productName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {order.customerName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          ₩{order.amount?.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDateTime(order.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedOrder(order)}
                        >
                          상세
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <Button
                variant="outline"
                size="sm"
                disabled={orderPage === 1}
                onClick={() =>
                  setOrderPage((prev) => Math.max(1, prev - 1))
                }
              >
                이전
              </Button>
              <span className="text-sm text-gray-600">
                {orderPage} / {Math.ceil(orderTotal / orderLimit) || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={orderPage * orderLimit >= orderTotal}
                onClick={() => {
                  setOrderPage((prev) =>
                    prev * orderLimit >= orderTotal ? prev : prev + 1
                  );
                }}
              >
                다음
              </Button>
            </div>
          </>
        )}
      </Card>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          isUpdating={isUpdatingOrder}
          onClose={() => setSelectedOrder(null)}
          onChangeStatus={handleChangeOrderStatus}
        />
      )}
    </div>
  );
}

const StatusBadge = ({ status }: { status: OrderStatus }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${ORDER_STATUS_CLASS[status]}`}
  >
    {status === "pending" && <AlertTriangle className="h-3 w-3" />}
    {status === "shipping" && <Truck className="h-3 w-3" />}
    {status === "completed" && <Check className="h-3 w-3" />}
    {ORDER_STATUS_LABEL[status]}
  </span>
);

type OrderDetailModalProps = {
  order: SellerOrder;
  isUpdating: boolean;
  onClose: () => void;
  onChangeStatus: (orderId: string, nextStatus: OrderStatus) => void;
};

const OrderDetailModal = ({
  order,
  isUpdating,
  onClose,
  onChangeStatus,
}: OrderDetailModalProps) => {
  const [nextStatus, setNextStatus] = useState<OrderStatus>(order.status);

  useEffect(() => {
    setNextStatus(order.status);
  }, [order.status]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <Card className="w-full max-w-lg p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">주문번호</p>
            <h2 className="text-lg font-semibold text-gray-900">
              {order.order_id}
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <XIcon className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="grid gap-2 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="flex justify-between text-sm text-gray-600">
              <span>대표 상품</span>
              <span className="font-medium text-gray-900">
                {order.productName}
              </span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>구매자</span>
              <span className="font-medium text-gray-900">
                {order.customerName}
              </span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>주문 금액</span>
              <span className="font-semibold text-gray-900">
                ₩{order.amount?.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>주문일</span>
              <span className="font-medium text-gray-900">
                {formatDateTime(order.created_at)}
              </span>
            </div>
          </div>

          {order.products?.length ? (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">
                포함 상품 ({order.itemCount || order.products.length}개)
              </p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-500">
                        상품명
                      </th>
                      <th className="px-3 py-2 text-left text-gray-500">
                        수량
                      </th>
                      <th className="px-3 py-2 text-left text-gray-500">
                        금액
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {order.products.map((item, idx) => (
                      <tr key={`${item.productName}-${idx}`}>
                        <td className="px-3 py-2 text-gray-900">
                          {item.productName || "-"}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {item.quantity ?? 0}개
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          ₩{Number(item.price ?? 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              주문 상태
            </label>
            <select
              className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as OrderStatus)}
            >
              {ORDER_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {ORDER_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isUpdating}>
            닫기
          </Button>
          <Button
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
            onClick={() => onChangeStatus(order._id, nextStatus)}
            disabled={isUpdating || nextStatus === order.status}
          >
            {isUpdating ? "저장 중..." : "상태 업데이트"}
          </Button>
        </div>
      </Card>
    </div>
  );
};
