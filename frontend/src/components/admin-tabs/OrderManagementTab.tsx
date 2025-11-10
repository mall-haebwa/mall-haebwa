import { AlertTriangle, Truck, Check, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

export function OrderManagementTab() {
  return (
    <div className="p-8">
      {/* 상태별 탭 */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        <button className="border-b-2 border-purple-600 px-4 py-2 text-sm font-medium text-purple-600">
          전체 (160)
        </button>
        <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
          처리대기 (5)
        </button>
        <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
          배송중 (12)
        </button>
        <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
          완료 (143)
        </button>
      </div>

      {/* AI 사기 탐지 알림 */}
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
              의심스러운 주문이 2건 발견되었습니다. 확인이 필요합니다.
            </p>
            <div className="space-y-2">
              <div className="rounded-lg border border-red-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      주문번호: ORD-20231108-001
                    </p>
                    <p className="text-xs text-gray-600">
                      의심 요인: 배송지 주소 불일치, 단기간 다중 주문
                    </p>
                  </div>
                  <Button size="sm" variant="outline">
                    상세보기
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 주문 목록 */}
      <Card className="overflow-hidden">
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
              {[
                {
                  orderNumber: "ORD-20231108-005",
                  product: "무선 블루투스 이어폰",
                  customer: "김철수",
                  amount: 79900,
                  status: "처리대기",
                  date: "2023-11-08 14:30",
                },
                {
                  orderNumber: "ORD-20231108-004",
                  product: "여름 린넨 반팔 셔츠",
                  customer: "이영희",
                  amount: 29900,
                  status: "배송중",
                  date: "2023-11-08 12:15",
                },
                {
                  orderNumber: "ORD-20231108-003",
                  product: "프리미엄 요가 매트",
                  customer: "박민수",
                  amount: 39900,
                  status: "완료",
                  date: "2023-11-08 09:45",
                },
              ].map((order, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">
                      {order.orderNumber}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {order.product}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {order.customer}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      ₩{order.amount.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                        order.status === "처리대기"
                          ? "bg-red-100 text-red-700"
                          : order.status === "배송중"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {order.status === "처리대기" && (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {order.status === "배송중" && (
                        <Truck className="h-3 w-3" />
                      )}
                      {order.status === "완료" && (
                        <Check className="h-3 w-3" />
                      )}
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600">
                      {order.date}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Button variant="outline" size="sm">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
