import { Bell, AlertTriangle, CreditCard, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";

interface User {
  email: string;
  phone?: string;
  sellerInfo?: {
    businessName?: string;
    businessNumber?: string;
  };
}

interface SettingsTabProps {
  finalUser: User;
}

export function SettingsTab({ finalUser }: SettingsTabProps) {
  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* 판매자 정보 */}
        <Card className="p-6">
          <h2 className="mb-6 text-lg font-semibold text-gray-900">
            판매자 정보
          </h2>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  사업자명
                </label>
                <Input
                  value={finalUser.sellerInfo?.businessName || ""}
                  disabled
                  className="bg-gray-50"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  사업자 등록번호
                </label>
                <Input
                  value={finalUser.sellerInfo?.businessNumber || ""}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                대표 이메일
              </label>
              <Input value={finalUser.email} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                연락처
              </label>
              <Input value={finalUser.phone || ""} />
            </div>

            <div className="flex justify-end">
              <Button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600">
                정보 수정
              </Button>
            </div>
          </div>
        </Card>

        {/* 정산 계좌 */}
        <Card className="p-6">
          <h2 className="mb-6 text-lg font-semibold text-gray-900">
            정산 계좌
          </h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                은행
              </label>
              <select className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm">
                <option>은행 선택</option>
                <option>국민은행</option>
                <option>신한은행</option>
                <option>우리은행</option>
                <option>하나은행</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                계좌번호
              </label>
              <Input placeholder="계좌번호를 입력하세요" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                예금주
              </label>
              <Input placeholder="예금주명을 입력하세요" />
            </div>

            <div className="flex justify-end">
              <Button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600">
                계좌 등록
              </Button>
            </div>
          </div>
        </Card>

        {/* 배송 설정 */}
        <Card className="p-6">
          <h2 className="mb-6 text-lg font-semibold text-gray-900">
            배송 설정
          </h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                기본 배송비
              </label>
              <Input type="number" placeholder="3000" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                무료 배송 최소 금액
              </label>
              <Input type="number" placeholder="50000" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                반품/교환 배송비
              </label>
              <Input type="number" placeholder="6000" />
            </div>

            <div className="flex justify-end">
              <Button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600">
                저장
              </Button>
            </div>
          </div>
        </Card>

        {/* 알림 설정 */}
        <Card className="p-6">
          <h2 className="mb-6 text-lg font-semibold text-gray-900">
            알림 설정
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900">
                    신규 주문 알림
                  </p>
                  <p className="text-sm text-gray-600">
                    새로운 주문이 들어오면 알림을 받습니다
                  </p>
                </div>
              </div>
              <Checkbox defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900">
                    재고 부족 알림
                  </p>
                  <p className="text-sm text-gray-600">
                    상품 재고가 부족하면 알림을 받습니다
                  </p>
                </div>
              </div>
              <Checkbox defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900">정산 알림</p>
                  <p className="text-sm text-gray-600">
                    정산 내역이 생성되면 알림을 받습니다
                  </p>
                </div>
              </div>
              <Checkbox defaultChecked />
            </div>
          </div>
        </Card>

        {/* AI 자동화 설정 */}
        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              AI 자동화 설정
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-white p-4">
              <div>
                <p className="font-medium text-gray-900">
                  AI 가격 자동 최적화
                </p>
                <p className="text-sm text-gray-600">
                  시장 동향에 따라 자동으로 가격을 조정합니다
                </p>
              </div>
              <Checkbox />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-white p-4">
              <div>
                <p className="font-medium text-gray-900">
                  AI 재고 자동 알림
                </p>
                <p className="text-sm text-gray-600">
                  판매 추이를 분석하여 발주 시점을 추천합니다
                </p>
              </div>
              <Checkbox defaultChecked />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-white p-4">
              <div>
                <p className="font-medium text-gray-900">
                  AI 프로모션 자동 추천
                </p>
                <p className="text-sm text-gray-600">
                  매출 데이터를 분석하여 효과적인 프로모션을 제안합니다
                </p>
              </div>
              <Checkbox defaultChecked />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-white p-4">
              <div>
                <p className="font-medium text-gray-900">AI 사기 탐지</p>
                <p className="text-sm text-gray-600">
                  의심스러운 주문을 자동으로 탐지하고 알립니다
                </p>
              </div>
              <Checkbox defaultChecked />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
