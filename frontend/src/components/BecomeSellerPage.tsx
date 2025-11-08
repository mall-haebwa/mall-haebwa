import { useState } from "react";
import { ArrowLeft, Store } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useAppState } from "../context/app-state";

export function BecomeSellerPage() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser } = useAppState();
  const [businessName, setBusinessName] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!businessName.trim() || !businessNumber.trim()) {
      toast.error("모든 필드를 입력해주세요.");
      return;
    }

    // 사업자 등록번호 유효성 검사 (10자리 숫자)
    const cleanedNumber = businessNumber.replace(/[^0-9]/g, "");
    if (cleanedNumber.length !== 10) {
      toast.error("사업자 등록번호는 10자리 숫자여야 합니다.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/users/seller/register", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessName: businessName.trim(),
          businessNumber: cleanedNumber,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "판매자 등록에 실패했습니다.");
      }

      const updatedUser = await response.json();

      const newCurrentUser = {
        ...currentUser!,
        isSeller: updatedUser.isSeller,
        sellerInfo: updatedUser.sellerInfo,
      };
      // 사용자 정보 업데이트
      setCurrentUser(newCurrentUser);

      toast.success("판매자 등록이 완료되었습니다!");
      navigate("/admin", { state: { updatedUser: newCurrentUser } });
    } catch (error) {
      console.error("판매자 등록 오류:", error);
      toast.error(
        error instanceof Error ? error.message : "판매자 등록에 실패했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[600px] px-6 py-6 md:px-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin")}
            className="mb-4 -ml-2 flex items-center gap-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            돌아가기
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
              <Store className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">
              판매자 등록
            </h1>
          </div>
          <p className="text-sm text-gray-600">
            판매자로 등록하여 상품을 판매하고 비즈니스를 성장시켜보세요.
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="businessName">
                  사업자명(상호)<span className="text-red-500">*</span>
                </Label>
                <Input
                  id="businessName"
                  placeholder="예) 홍길동 쇼핑몰"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  className="mt-1.5"
                  required
                  disabled={isSubmitting}
                />
                <p className="mt-1 text-xs text-gray-500">
                  사업자 등록증에 기재된 상호명을 입력해주세요.
                </p>
              </div>

              <div>
                <Label htmlFor="businessNumber">
                  사업자 등록번호<span className="text-red-500">*</span>
                </Label>
                <Input
                  id="businessNumber"
                  placeholder="예) 123-45-67890 또는 1234567890"
                  value={businessNumber}
                  onChange={(event) => setBusinessNumber(event.target.value)}
                  className="mt-1.5"
                  required
                  disabled={isSubmitting}
                />
                <p className="mt-1 text-xs text-gray-500">
                  10자리 숫자로 입력해주세요. (하이픈 자동 제거)
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-blue-900">
                판매자 등록 안내
              </h3>
              <ul className="space-y-1 text-xs text-blue-800">
                <li>• 판매자 등록 후 상품 등록 및 판매가 가능합니다.</li>
                <li>• 사업자 등록번호는 중복 등록이 불가능합니다.</li>
                <li>• 등록된 정보는 관리자 대시보드에서 확인 가능합니다.</li>
                <li>• 허위 정보 등록 시 서비스 이용이 제한될 수 있습니다.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/admin")}
                disabled={isSubmitting}
              >
                취소
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                disabled={isSubmitting}
              >
                {isSubmitting ? "등록 중..." : "판매자 등록하기"}
              </Button>
            </div>
          </form>
        </Card>

        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            판매자 혜택
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100">
                <Store className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">무료 스토어 개설</h4>
                <p className="text-sm text-gray-600">
                  별도 비용 없이 온라인 스토어를 개설할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100">
                <Store className="h-5 w-5 text-pink-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">판매 관리 도구</h4>
                <p className="text-sm text-gray-600">
                  AI를 이용한 상품 관리, 주문 처리, 통계 등 다양한 도구를
                  제공합니다.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
                <Store className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">마케팅 지원</h4>
                <p className="text-sm text-gray-600">
                  프로모션, 쿠폰 등 다양한 마케팅 기능을 활용하세요.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100">
                <Store className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">정산 시스템</h4>
                <p className="text-sm text-gray-600">
                  투명하고 안전한 정산 시스템을 제공합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
