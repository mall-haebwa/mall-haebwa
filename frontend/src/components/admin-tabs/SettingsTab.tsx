import { useState, useEffect } from "react";
import { Bell, AlertTriangle, CreditCard, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import type { User } from "../../types";

interface SettingsTabProps {
  finalUser: User;
  setCurrentUser: (user: User | null) => void;
}

export function SettingsTab({ finalUser, setCurrentUser }: SettingsTabProps) {
  // 설정 폼 상태
  const [sellerInfoForm, setSellerInfoForm] = useState({
    contactEmail: finalUser?.sellerInfo?.contactEmail || finalUser?.email || "",
    contactPhone: finalUser?.sellerInfo?.contactPhone || finalUser?.phone || "",
  });

  const [settlementAccountForm, setSettlementAccountForm] = useState({
    bankName: finalUser?.sellerInfo?.settlementAccount?.bankName || "",
    accountNumber:
      finalUser?.sellerInfo?.settlementAccount?.accountNumber || "",
    accountHolder:
      finalUser?.sellerInfo?.settlementAccount?.accountHolder || "",
  });

  const [deliverySettingsForm, setDeliverySettingsForm] = useState({
    baseDeliveryFee:
      finalUser?.sellerInfo?.deliverySettings?.baseDeliveryFee || 3000,
    freeDeliveryMinAmount:
      finalUser?.sellerInfo?.deliverySettings?.freeDeliveryMinAmount || 50000,
    returnExchangeDeliveryFee:
      finalUser?.sellerInfo?.deliverySettings?.returnExchangeDeliveryFee ||
      6000,
  });

  const [notificationSettings, setNotificationSettings] = useState({
    newOrderAlert:
      finalUser?.sellerInfo?.notificationSettings?.newOrderAlert ?? true,
    lowStockAlert:
      finalUser?.sellerInfo?.notificationSettings?.lowStockAlert ?? true,
    settlementAlert:
      finalUser?.sellerInfo?.notificationSettings?.settlementAlert ?? true,
  });

  const [aiAutomationSettings, setAiAutomationSettings] = useState({
    priceOptimization:
      finalUser?.sellerInfo?.aiAutomationSettings?.priceOptimization ?? false,
    stockAlert: finalUser?.sellerInfo?.aiAutomationSettings?.stockAlert ?? true,
    promotionRecommendation:
      finalUser?.sellerInfo?.aiAutomationSettings?.promotionRecommendation ??
      true,
    fraudDetection:
      finalUser?.sellerInfo?.aiAutomationSettings?.fraudDetection ?? true,
  });

  // currentUser가 로드될 때 폼 상태 업데이트 (새로고침 대응)
  useEffect(() => {
    if (finalUser) {
      setSellerInfoForm({
        contactEmail:
          finalUser.sellerInfo?.contactEmail || finalUser.email || "",
        contactPhone:
          finalUser.sellerInfo?.contactPhone || finalUser.phone || "",
      });

      setSettlementAccountForm({
        bankName: finalUser.sellerInfo?.settlementAccount?.bankName || "",
        accountNumber:
          finalUser.sellerInfo?.settlementAccount?.accountNumber || "",
        accountHolder:
          finalUser.sellerInfo?.settlementAccount?.accountHolder || "",
      });

      setDeliverySettingsForm({
        baseDeliveryFee:
          finalUser.sellerInfo?.deliverySettings?.baseDeliveryFee || 3000,
        freeDeliveryMinAmount:
          finalUser.sellerInfo?.deliverySettings?.freeDeliveryMinAmount ||
          50000,
        returnExchangeDeliveryFee:
          finalUser.sellerInfo?.deliverySettings?.returnExchangeDeliveryFee ||
          6000,
      });

      setNotificationSettings({
        newOrderAlert:
          finalUser.sellerInfo?.notificationSettings?.newOrderAlert ?? true,
        lowStockAlert:
          finalUser.sellerInfo?.notificationSettings?.lowStockAlert ?? true,
        settlementAlert:
          finalUser.sellerInfo?.notificationSettings?.settlementAlert ?? true,
      });

      setAiAutomationSettings({
        priceOptimization:
          finalUser.sellerInfo?.aiAutomationSettings?.priceOptimization ??
          false,
        stockAlert:
          finalUser.sellerInfo?.aiAutomationSettings?.stockAlert ?? true,
        promotionRecommendation:
          finalUser.sellerInfo?.aiAutomationSettings?.promotionRecommendation ??
          true,
        fraudDetection:
          finalUser.sellerInfo?.aiAutomationSettings?.fraudDetection ?? true,
      });
    }
  }, [finalUser]);

  // API 호출 함수들
  const handleUpdateSellerInfo = async () => {
    try {
      const response = await fetch("/api/seller/settings/info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(sellerInfoForm),
      });

      if (!response.ok) throw new Error("정보 수정 실패");

      const updatedUser = await response.json();

      // context 업데이트
      setCurrentUser(updatedUser);

      // 폼 상태 업데이트
      setSellerInfoForm({
        contactEmail: updatedUser.sellerInfo?.contactEmail || updatedUser.email,
        contactPhone: updatedUser.sellerInfo?.contactPhone || updatedUser.phone,
      });

      alert("판매자 정보가 수정되었습니다.");
    } catch (error) {
      console.error("Error updating seller info:", error);
      alert("정보 수정에 실패했습니다.");
    }
  };

  const handleUpdateSettlementAccount = async () => {
    if (
      !settlementAccountForm.bankName ||
      !settlementAccountForm.accountNumber ||
      !settlementAccountForm.accountHolder
    ) {
      alert("모든 필드를 입력해주세요.");
      return;
    }

    try {
      const response = await fetch("/api/seller/settings/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settlementAccountForm),
      });

      if (!response.ok) throw new Error("정산 계좌 등록 실패");

      const updatedUser = await response.json();

      // context 업데이트
      setCurrentUser(updatedUser);

      // 폼 상태 업데이트
      setSettlementAccountForm({
        bankName: updatedUser.sellerInfo?.settlementAccount?.bankName || "",
        accountNumber:
          updatedUser.sellerInfo?.settlementAccount?.accountNumber || "",
        accountHolder:
          updatedUser.sellerInfo?.settlementAccount?.accountHolder || "",
      });

      alert("정산 계좌가 등록되었습니다.");
    } catch (error) {
      console.error("Error updating settlement account:", error);
      alert("정산 계좌 등록에 실패했습니다.");
    }
  };

  const handleUpdateDeliverySettings = async () => {
    try {
      const response = await fetch("/api/seller/settings/delivery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(deliverySettingsForm),
      });

      if (!response.ok) throw new Error("배송 설정 수정 실패");

      const updatedUser = await response.json();

      // context 업데이트
      setCurrentUser(updatedUser);

      // 폼 상태 업데이트
      setDeliverySettingsForm({
        baseDeliveryFee:
          updatedUser.sellerInfo?.deliverySettings?.baseDeliveryFee || 3000,
        freeDeliveryMinAmount:
          updatedUser.sellerInfo?.deliverySettings?.freeDeliveryMinAmount ||
          50000,
        returnExchangeDeliveryFee:
          updatedUser.sellerInfo?.deliverySettings?.returnExchangeDeliveryFee ||
          6000,
      });

      alert("배송 설정이 저장되었습니다.");
    } catch (error) {
      console.error("Error updating delivery settings:", error);
      alert("배송 설정 저장에 실패했습니다.");
    }
  };

  const handleUpdateNotifications = async () => {
    try {
      const response = await fetch("/api/seller/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(notificationSettings),
      });

      if (!response.ok) throw new Error("알림 설정 수정 실패");

      const updatedUser = await response.json();

      // context 업데이트
      setCurrentUser(updatedUser);

      // 폼 상태 업데이트
      setNotificationSettings({
        newOrderAlert:
          updatedUser.sellerInfo?.notificationSettings?.newOrderAlert ?? true,
        lowStockAlert:
          updatedUser.sellerInfo?.notificationSettings?.lowStockAlert ?? true,
        settlementAlert:
          updatedUser.sellerInfo?.notificationSettings?.settlementAlert ?? true,
      });

      alert("알림 설정이 저장되었습니다.");
    } catch (error) {
      console.error("Error updating notifications:", error);
      alert("알림 설정 저장에 실패했습니다.");
    }
  };

  const handleUpdateAiAutomation = async () => {
    try {
      const response = await fetch("/api/seller/settings/ai-automation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(aiAutomationSettings),
      });

      if (!response.ok) throw new Error("AI 자동화 설정 수정 실패");

      const updatedUser = await response.json();

      // context 업데이트
      setCurrentUser(updatedUser);

      // 폼 상태 업데이트
      setAiAutomationSettings({
        priceOptimization:
          updatedUser.sellerInfo?.aiAutomationSettings?.priceOptimization ??
          false,
        stockAlert:
          updatedUser.sellerInfo?.aiAutomationSettings?.stockAlert ?? true,
        promotionRecommendation:
          updatedUser.sellerInfo?.aiAutomationSettings
            ?.promotionRecommendation ?? true,
        fraudDetection:
          updatedUser.sellerInfo?.aiAutomationSettings?.fraudDetection ?? true,
      });

      alert("AI 자동화 설정이 저장되었습니다.");
    } catch (error) {
      console.error("Error updating AI automation:", error);
      alert("AI 자동화 설정 저장에 실패했습니다.");
    }
  };

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
                  className="bg-brand-main"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  사업자 등록번호
                </label>
                <Input
                  value={finalUser.sellerInfo?.businessNumber || ""}
                  disabled
                  className="bg-brand-main"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                대표 이메일
              </label>
              <Input
                type="email"
                value={sellerInfoForm.contactEmail}
                onChange={(e) =>
                  setSellerInfoForm({
                    ...sellerInfoForm,
                    contactEmail: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                연락처
              </label>
              <Input
                type="tel"
                value={sellerInfoForm.contactPhone}
                onChange={(e) =>
                  setSellerInfoForm({
                    ...sellerInfoForm,
                    contactPhone: e.target.value,
                  })
                }
              />
            </div>

            <div className="flex justify-end">
              <Button
                className="bg-brand-orange text-white hover:bg-orange-400"
                onClick={handleUpdateSellerInfo}>
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
              <select
                className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                value={settlementAccountForm.bankName}
                onChange={(e) =>
                  setSettlementAccountForm({
                    ...settlementAccountForm,
                    bankName: e.target.value,
                  })
                }>
                <option value="">은행 선택</option>
                <option value="국민은행">국민은행</option>
                <option value="신한은행">신한은행</option>
                <option value="우리은행">우리은행</option>
                <option value="하나은행">하나은행</option>
                <option value="농협은행">농협은행</option>
                <option value="기업은행">기업은행</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                계좌번호
              </label>
              <Input
                placeholder="계좌번호를 입력하세요"
                value={settlementAccountForm.accountNumber}
                onChange={(e) =>
                  setSettlementAccountForm({
                    ...settlementAccountForm,
                    accountNumber: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                예금주
              </label>
              <Input
                placeholder="예금주명을 입력하세요"
                value={settlementAccountForm.accountHolder}
                onChange={(e) =>
                  setSettlementAccountForm({
                    ...settlementAccountForm,
                    accountHolder: e.target.value,
                  })
                }
              />
            </div>

            <div className="flex justify-end">
              <Button
                className="bg-brand-orange text-white hover:bg-orange-400"
                onClick={handleUpdateSettlementAccount}>
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
              <Input
                type="number"
                placeholder="3000"
                value={deliverySettingsForm.baseDeliveryFee}
                onChange={(e) =>
                  setDeliverySettingsForm({
                    ...deliverySettingsForm,
                    baseDeliveryFee: Number(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                무료 배송 최소 금액
              </label>
              <Input
                type="number"
                placeholder="50000"
                value={deliverySettingsForm.freeDeliveryMinAmount}
                onChange={(e) =>
                  setDeliverySettingsForm({
                    ...deliverySettingsForm,
                    freeDeliveryMinAmount: Number(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                반품/교환 배송비
              </label>
              <Input
                type="number"
                placeholder="6000"
                value={deliverySettingsForm.returnExchangeDeliveryFee}
                onChange={(e) =>
                  setDeliverySettingsForm({
                    ...deliverySettingsForm,
                    returnExchangeDeliveryFee: Number(e.target.value),
                  })
                }
              />
            </div>

            <div className="flex justify-end">
              <Button
                className="bg-brand-orange text-white hover:bg-orange-400"
                onClick={handleUpdateDeliverySettings}>
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
                  <p className="font-medium text-gray-900">신규 주문 알림</p>
                  <p className="text-sm text-gray-600">
                    새로운 주문이 들어오면 알림을 받습니다
                  </p>
                </div>
              </div>
              <Checkbox
                checked={notificationSettings.newOrderAlert}
                onCheckedChange={(checked) =>
                  setNotificationSettings({
                    ...notificationSettings,
                    newOrderAlert: checked as boolean,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900">재고 부족 알림</p>
                  <p className="text-sm text-gray-600">
                    상품 재고가 부족하면 알림을 받습니다
                  </p>
                </div>
              </div>
              <Checkbox
                checked={notificationSettings.lowStockAlert}
                onCheckedChange={(checked) =>
                  setNotificationSettings({
                    ...notificationSettings,
                    lowStockAlert: checked as boolean,
                  })
                }
              />
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
              <Checkbox
                checked={notificationSettings.settlementAlert}
                onCheckedChange={(checked) =>
                  setNotificationSettings({
                    ...notificationSettings,
                    settlementAlert: checked as boolean,
                  })
                }
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button
                className="bg-brand-orange text-white hover:bg-orange-400"
                onClick={handleUpdateNotifications}>
                저장
              </Button>
            </div>
          </div>
        </Card>

        {/* AI 자동화 설정 */}
        <Card className="border-brand-orange bg-brand-main p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-orange">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              AI 자동화 설정
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-brand-orange bg-brand-main p-4">
              <div>
                <p className="font-medium text-gray-900">AI 가격 자동 최적화</p>
                <p className="text-sm text-gray-600">
                  시장 동향에 따라 자동으로 가격을 조정합니다
                </p>
              </div>
              <Checkbox
                checked={aiAutomationSettings.priceOptimization}
                onCheckedChange={(checked) =>
                  setAiAutomationSettings({
                    ...aiAutomationSettings,
                    priceOptimization: checked as boolean,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-brand-orange bg-brand-main p-4">
              <div>
                <p className="font-medium text-gray-900">AI 재고 자동 알림</p>
                <p className="text-sm text-gray-600">
                  판매 추이를 분석하여 발주 시점을 추천합니다
                </p>
              </div>
              <Checkbox
                checked={aiAutomationSettings.stockAlert}
                onCheckedChange={(checked) =>
                  setAiAutomationSettings({
                    ...aiAutomationSettings,
                    stockAlert: checked as boolean,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-brand-orange bg-brand-main p-4">
              <div>
                <p className="font-medium text-gray-900">
                  AI 프로모션 자동 추천
                </p>
                <p className="text-sm text-gray-600">
                  매출 데이터를 분석하여 효과적인 프로모션을 제안합니다
                </p>
              </div>
              <Checkbox
                checked={aiAutomationSettings.promotionRecommendation}
                onCheckedChange={(checked) =>
                  setAiAutomationSettings({
                    ...aiAutomationSettings,
                    promotionRecommendation: checked as boolean,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-brand-orange bg-brand-main p-4">
              <div>
                <p className="font-medium text-gray-900">AI 사기 탐지</p>
                <p className="text-sm text-gray-600">
                  의심스러운 주문을 자동으로 탐지하고 알립니다
                </p>
              </div>
              <Checkbox
                checked={aiAutomationSettings.fraudDetection}
                onCheckedChange={(checked) =>
                  setAiAutomationSettings({
                    ...aiAutomationSettings,
                    fraudDetection: checked as boolean,
                  })
                }
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button
                className="bg-brand-orange text-white hover:bg-orange-400"
                onClick={handleUpdateAiAutomation}>
                저장
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
