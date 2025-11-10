import { Tag, CreditCard, Package, Sparkles, Edit, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";

export function PromotionTab() {
  return (
    <div className="p-8">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 쿠폰 생성 폼 - 2열 */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-6 text-lg font-semibold text-gray-900">
            쿠폰 생성
          </h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                쿠폰명
              </label>
              <Input placeholder="예) 신규회원 환영 쿠폰" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  할인 방식
                </label>
                <select className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm">
                  <option>정률 할인 (%)</option>
                  <option>정액 할인 (원)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  할인 금액
                </label>
                <Input type="number" placeholder="10" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  최소 주문 금액
                </label>
                <Input type="number" placeholder="50000" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  발급 수량
                </label>
                <Input type="number" placeholder="100" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  시작일
                </label>
                <Input type="date" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  종료일
                </label>
                <Input type="date" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline">취소</Button>
              <Button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600">
                쿠폰 생성
              </Button>
            </div>
          </div>
        </Card>

        {/* AI 프로모션 추천 - 1열 */}
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
            <Sparkles className="h-6 w-6 text-white" />
          </div>

          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            AI 프로모션 전략 추천
          </h3>

          <p className="mb-4 text-sm text-gray-700">
            AI가 판매 데이터를 분석하여 최적의 프로모션 전략을 제안합니다.
          </p>

          <div className="space-y-3">
            <div className="rounded-lg border border-purple-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2">
                <Tag className="h-4 w-4 text-purple-600" />
                <h4 className="font-semibold text-gray-900">
                  주말 특가 세일
                </h4>
              </div>
              <p className="mb-2 text-xs text-gray-600">
                주말 오후 2-4시에 주문이 집중됩니다. 이 시간대에 15% 할인
                프로모션을 진행하면 매출 증대 효과가 있을 것으로
                예상됩니다.
              </p>
              <p className="text-xs font-medium text-purple-600">
                예상 매출 증가: +22%
              </p>
            </div>

            <div className="rounded-lg border border-purple-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-purple-600" />
                <h4 className="font-semibold text-gray-900">
                  재구매 고객 쿠폰
                </h4>
              </div>
              <p className="mb-2 text-xs text-gray-600">
                30일 이내 재구매 고객에게 10,000원 쿠폰을 제공하면 고객
                충성도를 높일 수 있습니다.
              </p>
              <p className="text-xs font-medium text-purple-600">
                예상 재구매율 증가: +18%
              </p>
            </div>

            <div className="rounded-lg border border-purple-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2">
                <Package className="h-4 w-4 text-purple-600" />
                <h4 className="font-semibold text-gray-900">묶음 할인</h4>
              </div>
              <p className="mb-2 text-xs text-gray-600">
                '무선 블루투스 이어폰'과 '스마트워치 밴드'를 함께 구매 시
                20% 할인을 제공하면 객단가를 높일 수 있습니다.
              </p>
              <p className="text-xs font-medium text-purple-600">
                예상 객단가 증가: +35%
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* 활성 쿠폰 목록 */}
      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            활성 쿠폰 목록
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  쿠폰명
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  할인
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  사용/발급
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  기간
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[
                {
                  name: "신규회원 환영 쿠폰",
                  discount: "10%",
                  usage: "23/100",
                  period: "2023-11-01 ~ 2023-11-30",
                  status: "진행중",
                },
                {
                  name: "5만원 이상 무료배송",
                  discount: "배송비",
                  usage: "145/200",
                  period: "2023-11-01 ~ 2023-12-31",
                  status: "진행중",
                },
                {
                  name: "추석 특가 세일",
                  discount: "15%",
                  usage: "200/200",
                  period: "2023-09-20 ~ 2023-09-30",
                  status: "종료",
                },
              ].map((coupon, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">
                      {coupon.name}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {coupon.discount}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {coupon.usage}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600">
                      {coupon.period}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        coupon.status === "진행중"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {coupon.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
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
