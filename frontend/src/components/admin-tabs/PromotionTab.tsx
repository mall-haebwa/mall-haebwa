import { Tag, CreditCard, Package, Sparkles, Edit, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { useState, useEffect } from "react";

type CouponDiscountType = "percentage" | "fixed";

type CouponFormState = {
  name: string;
  code: string;
  discountType: CouponDiscountType;
  discountValue: string;
  minOrderAmount: string;
  maxDiscount: string;
  totalQuantity: string;
  startDate: string;
  endDate: string;
  applicableProducts: string[];
};

const createEmptyCouponForm = (): CouponFormState => ({
  name: "",
  code: "",
  discountType: "percentage",
  discountValue: "",
  minOrderAmount: "",
  maxDiscount: "",
  totalQuantity: "",
  startDate: "",
  endDate: "",
  applicableProducts: [],
});

type SellerProductSummary = {
  id: string;
  title: string;
  numericPrice?: number;
};

const toDateInputValue = (isoString: string | undefined) => {
  if (!isoString) return "";
  return isoString.slice(0, 10);
};

const toMiddayISOString = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(12, 0, 0, 0); // avoid timezone shift
  return date.toISOString();
};

export function PromotionTab() {
  const [couponForm, setCouponForm] = useState<CouponFormState>(
    createEmptyCouponForm()
  );
  const [coupons, setCoupons] = useState<any[]>([]);
  const [isLoadingCoupons, setIsLoadingCoupons] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [sellerProducts, setSellerProducts] = useState<SellerProductSummary[]>([]);
  const [isLoadingSellerProducts, setIsLoadingSellerProducts] = useState(false);

  // 쿠폰 목록 로드
  const loadCoupons = async () => {
    try {
      setIsLoadingCoupons(true);
      const response = await fetch("/api/seller/coupons", {
        credentials: "include",
      });

      if (!response.ok) throw new Error("쿠폰 목록 로드 실패");

      const data = await response.json();
      const normalised = data.map((coupon: any) => ({
        ...coupon,
        id: coupon.id ?? coupon._id,
        applicableProducts: coupon.applicableProducts ?? [],
      }));
      setCoupons(normalised);
    } catch (error) {
      console.error("Error loading coupons:", error);
      alert("쿠폰 목록 로드에 실패했습니다.");
    } finally {
      setIsLoadingCoupons(false);
    }
  };

  // 판매자 상품 목록 로드
  const loadSellerProducts = async () => {
    try {
      setIsLoadingSellerProducts(true);
      const response = await fetch("/api/seller/products?limit=500", {
        credentials: "include",
      });

      if (!response.ok) throw new Error("상품 목록 로드 실패");

      const data = await response.json();
      // API returns {total, items}, so extract items
      setSellerProducts(data.items || data);
    } catch (error) {
      console.error("Error loading seller products:", error);
      alert("상품 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoadingSellerProducts(false);
    }
  };

  // 쿠폰 생성
  const handleCreateCoupon = async () => {
    // 유효성 검사
    if (!couponForm.name || !couponForm.code) {
      alert("쿠폰명과 코드는 필수입니다.");
      return;
    }

    try {
      const startDateIso = toMiddayISOString(couponForm.startDate);
      const endDateIso = toMiddayISOString(couponForm.endDate);
      if (!startDateIso || !endDateIso) {
        alert("시작일/종료일 형식이 올바르지 않습니다.");
        return;
      }

      const payload = {
        name: couponForm.name,
        code: couponForm.code,
        discountType: couponForm.discountType,
        discountValue: parseInt(couponForm.discountValue),
        minOrderAmount: parseInt(couponForm.minOrderAmount) || 0,
        maxDiscount: couponForm.maxDiscount ? parseInt(couponForm.maxDiscount) : null,
        totalQuantity: parseInt(couponForm.totalQuantity),
        startDate: startDateIso,
        endDate: endDateIso,
        applicableProducts: couponForm.applicableProducts,
      };

      const response = await fetch("/api/seller/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "쿠폰 생성 실패");
      }

      alert("쿠폰이 생성되었습니다.");

      // 폼 초기화
      setCouponForm(createEmptyCouponForm());

      // 쿠폰 목록 새로고침
      loadCoupons();
    } catch (error: any) {
      console.error("Error creating coupon:", error);
      alert(error.message || "쿠폰 생성에 실패했습니다.");
    }
  };

  // 쿠폰 수정 시작
  const handleEditCoupon = (coupon: any) => {
    setEditingCouponId(coupon.id);
    setCouponForm({
      name: coupon.name,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue.toString(),
      minOrderAmount: coupon.minOrderAmount.toString(),
      maxDiscount: coupon.maxDiscount ? coupon.maxDiscount.toString() : "",
      totalQuantity: coupon.totalQuantity.toString(),
      startDate: toDateInputValue(coupon.startDate),
      endDate: toDateInputValue(coupon.endDate),
      applicableProducts: coupon.applicableProducts ?? [],
    });
    // 폼으로 스크롤
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 쿠폰 수정
  const handleUpdateCoupon = async () => {
    if (!editingCouponId) return;

    try {
      const startDateIso = toMiddayISOString(couponForm.startDate);
      const endDateIso = toMiddayISOString(couponForm.endDate);
      if (!startDateIso || !endDateIso) {
        alert("시작일/종료일 형식이 올바르지 않습니다.");
        return;
      }

      const payload: any = {
        name: couponForm.name,
        discountType: couponForm.discountType,
        discountValue: parseInt(couponForm.discountValue),
        minOrderAmount: parseInt(couponForm.minOrderAmount) || 0,
        maxDiscount: couponForm.maxDiscount ? parseInt(couponForm.maxDiscount) : null,
        totalQuantity: parseInt(couponForm.totalQuantity),
        startDate: startDateIso,
        endDate: endDateIso,
        applicableProducts: couponForm.applicableProducts,
      };

      const response = await fetch(`/api/seller/coupons/${editingCouponId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "쿠폰 수정 실패");
      }

      alert("쿠폰이 수정되었습니다.");

      // 편집 모드 종료 및 폼 초기화
      setEditingCouponId(null);
      setCouponForm(createEmptyCouponForm());

      // 쿠폰 목록 새로고침
      loadCoupons();
    } catch (error: any) {
      console.error("Error updating coupon:", error);
      alert(error.message || "쿠폰 수정에 실패했습니다.");
    }
  };

  // 수정 취소
  const handleCancelEdit = () => {
    setEditingCouponId(null);
    setCouponForm(createEmptyCouponForm());
  };

  // 쿠폰 삭제
  const handleDeleteCoupon = async (couponId: string) => {
    if (!confirm("쿠폰을 삭제하시겠습니까?")) return;

    try {
      const response = await fetch(`/api/seller/coupons/${couponId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "쿠폰 삭제 실패");
      }

      alert("쿠폰이 삭제되었습니다.");
      loadCoupons();
    } catch (error: any) {
      console.error("Error deleting coupon:", error);
      alert(error.message || "쿠폰 삭제에 실패했습니다.");
    }
  };

  // 적용 상품 토글
  const toggleApplicableProduct = (productId: string) => {
    setCouponForm((prev) => {
      const exists = prev.applicableProducts.includes(productId);
      return {
        ...prev,
        applicableProducts: exists
          ? prev.applicableProducts.filter((id) => id !== productId)
          : [...prev.applicableProducts, productId],
      };
    });
  };

  // 컴포넌트 마운트 시 쿠폰 및 상품 목록 로드
  useEffect(() => {
    loadCoupons();
    loadSellerProducts();
  }, []);

  return (
    <div className="p-8">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 쿠폰 생성/수정 폼 - 2열 */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-6 text-lg font-semibold text-gray-900">
            {editingCouponId ? "쿠폰 수정" : "쿠폰 생성"}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                쿠폰명
              </label>
              <Input
                placeholder="예) 신규회원 환영 쿠폰"
                value={couponForm.name}
                onChange={(e) => setCouponForm({ ...couponForm, name: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                쿠폰 코드
              </label>
              <Input
                placeholder="예) WELCOME2024"
                value={couponForm.code}
                onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })}
                disabled={!!editingCouponId}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  할인 방식
                </label>
                <select
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                  value={couponForm.discountType}
                  onChange={(e) => setCouponForm({ ...couponForm, discountType: e.target.value as CouponDiscountType })}
                >
                  <option value="percentage">정률 할인 (%)</option>
                  <option value="fixed">정액 할인 (원)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  할인 {couponForm.discountType === "percentage" ? "비율 (%)" : "금액 (원)"}
                </label>
                <Input
                  type="number"
                  placeholder={couponForm.discountType === "percentage" ? "10" : "10000"}
                  value={couponForm.discountValue}
                  onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  최소 주문 금액
                </label>
                <Input
                  type="number"
                  placeholder="50000"
                  value={couponForm.minOrderAmount}
                  onChange={(e) => setCouponForm({ ...couponForm, minOrderAmount: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  최대 할인 금액 (선택)
                </label>
                <Input
                  type="number"
                  placeholder="정률 할인 시 최대 금액"
                  value={couponForm.maxDiscount}
                  onChange={(e) => setCouponForm({ ...couponForm, maxDiscount: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                발급 수량
              </label>
              <Input
                type="number"
                placeholder="100"
                value={couponForm.totalQuantity}
                onChange={(e) => setCouponForm({ ...couponForm, totalQuantity: e.target.value })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  시작일
                </label>
                <Input
                  type="date"
                  value={couponForm.startDate}
                  onChange={(e) => setCouponForm({ ...couponForm, startDate: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  종료일
                </label>
                <Input
                  type="date"
                  value={couponForm.endDate}
                  onChange={(e) => setCouponForm({ ...couponForm, endDate: e.target.value })}
                />
              </div>
            </div>

            {/* 적용 상품 선택 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                적용 상품 (선택)
              </label>
              <p className="text-xs text-gray-500">
                선택하지 않으면 판매자의 모든 상품에 쿠폰이 적용됩니다.
              </p>
              <div className="mt-2 rounded-lg border border-gray-200">
                {isLoadingSellerProducts ? (
                  <div className="p-3 text-sm text-gray-500">
                    상품을 불러오는 중입니다...
                  </div>
                ) : sellerProducts.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">
                    아직 등록된 상품이 없습니다.
                  </div>
                ) : (
                  <div className="max-h-52 divide-y divide-gray-100 overflow-y-auto">
                    {sellerProducts.map((product) => {
                      const checked = couponForm.applicableProducts.includes(
                        product.id
                      );
                      return (
                        <label
                          key={product.id}
                          className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300"
                            checked={checked}
                            onChange={() => toggleApplicableProduct(product.id)}
                          />
                          <span className="flex-1">{product.title}</span>
                          {product.numericPrice && (
                            <span className="text-xs text-gray-500">
                              {product.numericPrice.toLocaleString()}원
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              {couponForm.applicableProducts.length > 0 && (
                <p className="mt-2 text-xs text-purple-600">
                  선택된 상품 {couponForm.applicableProducts.length}개
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={editingCouponId ? handleCancelEdit : () => setCouponForm(createEmptyCouponForm())}
              >
                {editingCouponId ? "수정 취소" : "초기화"}
              </Button>
              <Button
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                onClick={editingCouponId ? handleUpdateCoupon : handleCreateCoupon}
              >
                {editingCouponId ? "쿠폰 수정" : "쿠폰 생성"}
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
            쿠폰 목록
          </h2>
        </div>

        <div className="overflow-x-auto">
          {isLoadingCoupons ? (
            <div className="p-6 text-center text-gray-500">
              쿠폰 목록을 불러오는 중...
            </div>
          ) : coupons.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              생성된 쿠폰이 없습니다.
            </div>
          ) : (
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
                {coupons.map((coupon) => {
                  const discountText =
                    coupon.discountType === "percentage"
                      ? `${coupon.discountValue}%`
                      : `${coupon.discountValue.toLocaleString()}원`;

                  const startDate = new Date(coupon.startDate).toLocaleDateString("ko-KR");
                  const endDate = new Date(coupon.endDate).toLocaleDateString("ko-KR");

                  const statusText =
                    coupon.status === "active"
                      ? "진행중"
                      : coupon.status === "inactive"
                      ? "대기중"
                      : "종료";

                  return (
                    <tr key={coupon.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {coupon.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          코드: {coupon.code}
                        </div>
                        <div className="text-xs text-gray-500">
                          적용 대상:&nbsp;
                          {coupon.applicableProducts && coupon.applicableProducts.length > 0
                            ? `${coupon.applicableProducts.length}개 상품`
                            : "전체 상품"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {discountText}
                        </div>
                        {coupon.minOrderAmount > 0 && (
                          <div className="text-xs text-gray-500">
                            {coupon.minOrderAmount.toLocaleString()}원 이상
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {coupon.usedQuantity}/{coupon.totalQuantity}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600">
                          {startDate} ~ {endDate}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            coupon.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : coupon.status === "inactive"
                              ? "bg-gray-100 text-gray-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {statusText}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCoupon(coupon)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCoupon(coupon.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
