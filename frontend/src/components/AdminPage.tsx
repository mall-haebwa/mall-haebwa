import { useState, useEffect } from "react";
import {
  BarChart3,
  Home,
  Package,
  ShoppingCart,
  Tag,
  Settings,
  Plus,
  Sparkles,
  Wand2,
  TrendingUp,
  AlertTriangle,
  Check,
  Upload,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useAppState } from "../context/app-state";
import { toast } from "sonner";
import { DashboardTab } from "./admin-tabs/DashboardTab";
import { ReportTab } from "./admin-tabs/ReportTab";
import { ProductManagementTab } from "./admin-tabs/ProductManagementTab";
import { OrderManagementTab } from "./admin-tabs/OrderManagementTab";
import { PromotionTab } from "./admin-tabs/PromotionTab";
import { SettingsTab } from "./admin-tabs/SettingsTab";

interface ChartDataPoint {
  label: string;
  value: number;
}

interface DashboardData {
  today: {
    amount: number;
    change: number;
    orders: number;
  };
  week: {
    amount: number;
    change: number;
    orders: number;
  };
  newOrders: number;
  stockAlertsCount: number;
  orderStats: {
    pending: number;
    shipping: number;
    completed: number;
  };
  topProducts: Array<{
    rank: number;
    name: string;
    sales: number;
    revenue: number;
  }>;
  stockAlerts: {
    outOfStock: number;
    lowStock: number;
    items: Array<{
      name: string;
      stock: number;
      status: string;
    }>;
  };
  dailySalesChart: ChartDataPoint[];
  weeklySalesChart: ChartDataPoint[];
  monthlySalesChart: ChartDataPoint[];
  categorySalesChart: Array<{ name: string; value: number }>;
  hourlyOrdersChart: Array<{ time: string; orders: number }>;
  repurchaseRate: number;
  aiInsights: string[];
  dynamicSalesChart: ChartDataPoint[];
}

// AddProductPage.tsx에서 사용되는 카테고리 목록을 가져옵니다.
const categories = [
  "가구/인테리어",
  "디지털/가전",
  "생활/건강",
  "스포츠/레저",
  "식품",
  "여가/생활편의",
  "출산/육아",
  "패션의류",
  "패션잡화",
  "화장품/미용",
];

// 백엔드 ProductOut 스키마에 맞춰 프론트엔드 타입 정의
interface SellerProduct {
  id: string;
  title: string;
  brand: string | null;
  category1: string | null;
  category2: string | null;
  category3: string | null;
  category4: string | null;
  numericPrice: number;
  hprice: number | null;
  image: string | null;
  images: string[];
  colors: string[];
  sizes: string[];
  description: string | null;
  stock: number;
  sellerId: string | null;
  created_at: string | null;
  updated_at: string | null;
}

type MenuItem =
  | "dashboard"
  | "reports"
  | "products"
  | "orders"
  | "promotions"
  | "settings";

export function AdminPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, setCurrentUser } = useAppState();
  const [activeMenu, setActiveMenu] = useState<MenuItem>("dashboard");
  const [salesPeriod, setSalesPeriod] = useState<
    "daily" | "weekly" | "monthly"
  >("daily");

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<
    "today" | "7days" | "30days" | "custom"
  >("7days");

  const [editingProduct, setEditingProduct] = useState<SellerProduct | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [searchTrigger, setSearchTrigger] = useState(0);

  // 상품 검색 form submit 핸들러
  const handleProductSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault(); // form의 기본 동작(페이지 새로고침) 방지
    setCurrentPage(1); // 검색 시 1페이지부터 보도록 설정
    setSearchTrigger((prev) => prev + 1); // 검색 실행
  };
  // 상품 삭제 핸들러

  // 필터 초기화 핸들러
  const handleResetFilters = () => {
    setProductSearchQuery("");
    setProductCategoryFilter("all");
    setProductStatusFilter("all");
    setCurrentPage(1);
    setSearchTrigger((prev) => prev + 1); // 초기화 후 검색 실행
  };
  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm("정말로 이 상품을 삭제하시겠습니까?")) {
      return;
    }

    try {
      const response = await fetch(`/api/seller/products/${productId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "상품 삭제에 실패했습니다.");
      }

      // 상태 업데이트: 삭제된 상품을 목록에서 제거
      setSellerProducts((prev) => prev.filter((p) => p.id !== productId));
      setTotalProducts((prev) => prev - 1); // 전체 개수 감소

      toast.success("상품이 삭제되었습니다.");
    } catch (error) {
      console.error("상품 삭제 오류:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "상품 삭제 중 오류가 발생했습니다."
      );
    }
  };

  // 상품 수정 핸들러
  const handleUpdateProduct = async () => {
    if (!editingProduct) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/seller/products/${editingProduct.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editingProduct.title,
            numericPrice: editingProduct.numericPrice,
            stock: editingProduct.stock,
            description: editingProduct.description,
            brand: editingProduct.brand,
            category1: editingProduct.category1,
            hprice: editingProduct.hprice,
            // 문자열을 배열로 변환하여 전송
            colors: editingProduct.colors.map((c) => c.trim()).filter(Boolean),
            sizes: editingProduct.sizes.map((s) => s.trim()).filter(Boolean),
            images: editingProduct.images
              .map((img) => img.trim())
              .filter(Boolean),
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "상품 수정에 실패했습니다.");
      }

      const updatedProduct = await response.json();

      // 상태 업데이트: 수정된 상품 정보로 목록 업데이트
      setSellerProducts((prev) =>
        prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
      );

      setEditingProduct(null); // 모달 닫기
      toast.success("상품 정보가 수정되었습니다.");
    } catch (error) {
      console.error("상품 수정 오류:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "상품 수정 중 오류가 발생했습니다."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // 상품 편집 모달에서 이미지 업로드
  const handleEditModalImageUpload = async () => {
    if (!editingProduct) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;

    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      toast.info(`${files.length}개의 이미지를 업로드 중...`);

      try {
        const uploadedUrls: string[] = [];

        for (const file of Array.from(files)) {
          const formData = new FormData();
          formData.append("file", file);

          const response = await fetch("/api/seller/upload-image", {
            method: "POST",
            credentials: "include",
            body: formData,
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || "이미지 업로드 실패");
          }

          const data = await response.json();
          uploadedUrls.push(data.image_url);
        }

        // 기존 이미지 배열에 새로운 URL 추가
        setEditingProduct({
          ...editingProduct,
          images: [...editingProduct.images, ...uploadedUrls],
        });

        toast.success("이미지 업로드 완료!");
      } catch (error) {
        console.error("이미지 업로드 오류:", error);
        toast.error(
          error instanceof Error ? error.message : "이미지 업로드 실패"
        );
      }
    };

    input.click();
  };

  // 상품 편집 모달에서 이미지 삭제
  const handleEditModalImageRemove = (index: number) => {
    if (!editingProduct) return;

    setEditingProduct({
      ...editingProduct,
      images: editingProduct.images.filter((_, i) => i !== index),
    });
  };

  // 상품 관리 페이지 상태
  const [sellerProducts, setSellerProducts] = useState<SellerProduct[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [productStatusFilter, setProductStatusFilter] = useState("all"); // 판매중, 품절, 재고부족
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  const finalUser = location.state?.updatedUser ?? currentUser;

  // 대시보드 데이터 불러오기
  useEffect(() => {
    if (!finalUser?.isSeller) return;

    const fetchDashboard = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/seller/dashboard?report_period=${reportPeriod}`,
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error("대시보드 데이터를 불러오지 못했습니다.");
        }

        const data = await response.json();
        setDashboardData(data);
      } catch (error) {
        console.error("대시보드 데이터 로드 오류:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, [finalUser, reportPeriod]);

  // 상품 관리 데이터 불러오기
  useEffect(() => {
    if (activeMenu !== "products" || !finalUser?.isSeller) {
      return;
    }

    const fetchSellerProducts = async () => {
      setIsProductsLoading(true);
      setProductsError(null);
      try {
        const params = new URLSearchParams({
          skip: String((currentPage - 1) * 10), // 페이지당 10개
          limit: String(10),
        });

        if (productSearchQuery) params.set("q", productSearchQuery);
        if (productCategoryFilter !== "all")
          params.set("category", productCategoryFilter);
        if (productStatusFilter !== "all")
          params.set("status", productStatusFilter);

        const response = await fetch(
          `/api/seller/products?${params.toString()}`,
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error("상품 목록을 불러오지 못했습니다.");
        }

        const data = await response.json();
        setSellerProducts(data.items || []);
        setTotalProducts(data.total || 0);
      } catch (error) {
        console.error("상품 목록 로드 오류:", error);
        setProductsError("상품 목록을 불러오는 데 실패했습니다.");
      } finally {
        setIsProductsLoading(false);
      }
    };

    fetchSellerProducts();
  }, [
    activeMenu,
    finalUser,
    currentPage,
    searchTrigger, // 검색 버튼 클릭 시에만 API 호출
  ]);

  // orderPieData 동적 생성

  // 판매자가 아닌 경우 판매자 등록 UI 표시
  if (!finalUser?.isSeller) {
    return (
      <div className="h-[calc(100vh-154px)] bg-brand-main py-8 flex items-center justify-center">
        <div className="mx-auto max-w-[1200px] px-6">
          {/* 상단 헤더 */}
          <div className="mb-8 text-center">
            {/* <div className="mb-4 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-orange-white">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
            </div> */}
            <h1 className="mb-2 text-3xl font-bold text-gray-900">
              AI 기반 스마트 판매 시스템
            </h1>
            <p className="mb-4 text-lg text-gray-600">
              인공지능이 당신의 판매를 도와 매출을 극대화합니다
            </p>
            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="transition-all duration-200 hover:shadow-lg hover:scale-105">
                홈으로 돌아가기
              </Button>
              <Button
                size="lg"
                className="bg-white text-gray-900 transition-all duration-200 hover:shadow-lg hover:scale-105"
                onClick={() => navigate("/become-seller")}>
                <Package className="mr-2 h-5 w-5" />
                판매자 등록하기
              </Button>
            </div>
          </div>

          {/* AI 기능 그리드 */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* AI 자동 상품 등록 */}
            <Card className="p-5 transition-shadow hover:shadow-lg">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full  bg-white">
                  <Wand2 className="h-6 w-6  text-purple-600" />
                </div>
                <div>
                  <h4 className="mt-3 font-semibold text-gray-900">
                    AI 자동 상품 등록
                  </h4>
                  <p className="text-sm text-gray-600">
                    이미지만 업로드하면 AI가 상품명, 설명, 가격까지 자동 생성
                  </p>
                </div>
              </div>
            </Card>

            {/* AI 가격 최적화 */}
            <Card className="p-5 transition-shadow hover:shadow-lg">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white">
                  <TrendingUp className="h-6 w-6 text-pink-600" />
                </div>
                <div>
                  <h4 className="mt-3 font-semibold text-gray-900">
                    AI 가격 최적화
                  </h4>
                  <p className="text-sm text-gray-600">
                    시장 동향을 실시간 분석하여 최적의 판매 가격 추천
                  </p>
                </div>
              </div>
            </Card>

            {/* AI 판매 인사이트 */}
            <Card className="p-5 transition-shadow hover:shadow-lg">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="mt-3 font-semibold text-gray-900">
                    AI 판매 인사이트
                  </h4>
                  <p className="text-sm text-gray-600">
                    매출 데이터를 분석하여 판매 전략과 개선점 제안
                  </p>
                </div>
              </div>
            </Card>

            {/* AI 프로모션 전략 */}
            <Card className="p-5 transition-shadow hover:shadow-lg">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white">
                  <Tag className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h4 className="mt-3 font-semibold text-gray-900">
                    AI 프로모션 전략
                  </h4>
                  <p className="text-sm text-gray-600">
                    고객 구매 패턴 분석으로 효과적인 프로모션 시기 추천
                  </p>
                </div>
              </div>
            </Card>

            {/* AI 재고 예측 */}
            <Card className="p-5 transition-shadow hover:shadow-lg">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white">
                  <Package className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h4 className="mt-3 font-semibold text-gray-900">
                    AI 재고 예측
                  </h4>
                  <p className="text-sm text-gray-600">
                    판매 추이 분석으로 최적의 재고 수량과 발주 시점 알림
                  </p>
                </div>
              </div>
            </Card>

            {/* AI 사기 탐지 */}
            <Card className="p-5 transition-shadow hover:shadow-lg">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h4 className="mt-3 font-semibold text-gray-900">
                    AI 사기 탐지
                  </h4>
                  <p className="text-sm text-gray-600">
                    의심스러운 주문 자동 감지로 안전한 거래 보장
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* 하단 추가 정보 */}
          <Card className="mt-6 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
                  <Check className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    무료 스토어 개설 • 투명한 정산 • AI 솔루션 지원
                  </p>
                  <p className="text-sm text-gray-600">
                    별도 비용 없이 AI와 함께 편하게 온라인 판매를 시작하고
                    성장하세요
                  </p>
                </div>
              </div>
              <Button
                className="bg-orange-primary text-white"
                onClick={() => navigate("/become-seller")}>
                <Sparkles className="mr-2 h-4 w-4" />
                시작하기
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const getCurrentChart = () => {
    if (!dashboardData) return [];

    switch (salesPeriod) {
      case "daily":
        return dashboardData.dailySalesChart;
      case "weekly":
        return dashboardData.weeklySalesChart;
      case "monthly":
        return dashboardData.monthlySalesChart;
    }
  };

  const getChartLabel = () => {
    return "label"; // 백엔드에서 모두 "label" 필드로 통일
  };

  // 판매자인 경우 대시보드 표시
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* 좌측 사이드바 */}
      <aside className="w-64 border-r border-gray-200 bg-white">
        <div className="flex h-16 items-center border-b border-gray-200 px-6">
          <Package className="mr-2 h-6 w-6 text-purple-600" />
          <span className="text-lg font-semibold text-gray-900">
            판매자 센터
          </span>
        </div>

        <nav className="space-y-1 p-4">
          <button
            onClick={() => setActiveMenu("dashboard")}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
              activeMenu === "dashboard"
                ? "bg-purple-50 text-purple-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}>
            <Home className="h-5 w-5" />
            대시보드
          </button>

          <button
            onClick={() => setActiveMenu("reports")}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
              activeMenu === "reports"
                ? "bg-purple-50 text-purple-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}>
            <BarChart3 className="h-5 w-5" />
            리포트
          </button>

          <button
            onClick={() => setActiveMenu("products")}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
              activeMenu === "products"
                ? "bg-purple-50 text-purple-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}>
            <Package className="h-5 w-5" />
            상품 관리
          </button>

          <button
            onClick={() => setActiveMenu("orders")}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
              activeMenu === "orders"
                ? "bg-purple-50 text-purple-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}>
            <ShoppingCart className="h-5 w-5" />
            주문 관리
          </button>

          <button
            onClick={() => setActiveMenu("promotions")}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
              activeMenu === "promotions"
                ? "bg-purple-50 text-purple-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}>
            <Tag className="h-5 w-5" />
            프로모션
          </button>

          <button
            onClick={() => setActiveMenu("settings")}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
              activeMenu === "settings"
                ? "bg-purple-50 text-purple-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}>
            <Settings className="h-5 w-5" />
            설정
          </button>
        </nav>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1">
        {/* 헤더 */}
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-8">
          <h1 className="text-xl font-semibold text-gray-900">
            {activeMenu === "dashboard" && "대시보드"}
            {activeMenu === "reports" && "리포트"}
            {activeMenu === "products" && "상품 관리"}
            {activeMenu === "orders" && "주문 관리"}
            {activeMenu === "promotions" && "프로모션"}
            {activeMenu === "settings" && "설정"}
          </h1>

          <Button
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
            onClick={() => navigate("/add-product")}>
            <Plus className="mr-2 h-4 w-4" />
            상품 등록
          </Button>
        </header>

        {/* 탭 콘텐츠 */}
        {activeMenu === "dashboard" && (
          <DashboardTab
            dashboardData={dashboardData}
            isLoading={isLoading}
            salesPeriod={salesPeriod}
            setSalesPeriod={setSalesPeriod}
          />
        )}

        {activeMenu === "reports" && (
          <ReportTab
            dashboardData={dashboardData}
            reportPeriod={reportPeriod}
            setReportPeriod={setReportPeriod}
          />
        )}

        {activeMenu === "products" && (
          <ProductManagementTab
            sellerProducts={sellerProducts}
            isProductsLoading={isProductsLoading}
            productsError={productsError}
            productSearchQuery={productSearchQuery}
            setProductSearchQuery={setProductSearchQuery}
            productCategoryFilter={productCategoryFilter}
            setProductCategoryFilter={setProductCategoryFilter}
            productStatusFilter={productStatusFilter}
            setProductStatusFilter={setProductStatusFilter}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalProducts={totalProducts}
            handleProductSearchSubmit={handleProductSearchSubmit}
            handleResetFilters={handleResetFilters}
            handleDeleteProduct={handleDeleteProduct}
            setEditingProduct={setEditingProduct}
          />
        )}

        {activeMenu === "orders" && <OrderManagementTab />}

        {activeMenu === "promotions" && <PromotionTab />}

        {activeMenu === "settings" && (
          <SettingsTab finalUser={finalUser} setCurrentUser={setCurrentUser} />
        )}

        {editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <Card className="w-full max-w-2xl bg-white">
              <div className="border-b p-4">
                <h2 className="text-lg font-semibold">상품 수정</h2>
              </div>
              <div className="max-h-[70vh] overflow-y-auto p-6 space-y-4">
                {/* 상품명 */}
                <div>
                  <label className="text-sm font-medium">상품명</label>
                  <Input
                    value={editingProduct.title}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        title: e.target.value,
                      })
                    }
                    className="mt-1"
                  />
                </div>

                {/* 브랜드 */}
                <div>
                  <label className="text-sm font-medium">브랜드</label>
                  <Input
                    value={editingProduct.brand || ""}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        brand: e.target.value,
                      })
                    }
                    className="mt-1"
                  />
                </div>

                {/* 카테고리 */}
                <div>
                  <label className="text-sm font-medium">카테고리</label>
                  <Select
                    value={editingProduct.category1 || ""}
                    onValueChange={(value) =>
                      setEditingProduct({
                        ...editingProduct,
                        category1: value,
                      })
                    }>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="카테고리 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 판매가, 정가, 재고 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">판매가</label>
                    <Input
                      type="number"
                      min={0}
                      value={editingProduct.numericPrice}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          numericPrice: parseInt(e.target.value) || 0,
                        })
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">재고</label>
                    <Input
                      type="number"
                      min={0}
                      value={editingProduct.stock}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          stock: parseInt(e.target.value) || 0,
                        })
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      정가 (할인가 적용 전)
                    </label>
                    <Input
                      type="number"
                      value={editingProduct.stock}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          stock: parseInt(e.target.value) || 0,
                        })
                      }
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* 컬러 옵션 */}
                <div>
                  <label className="text-sm font-medium">
                    컬러 옵션 (쉼표로 구분)
                  </label>
                  <Input
                    value={editingProduct.colors.join(", ")}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        colors: e.target.value.split(",").map((c) => c.trim()),
                      })
                    }
                    className="mt-1"
                    placeholder="예: 화이트, 블랙, 블루"
                  />
                </div>

                {/* 사이즈 옵션 */}
                <div>
                  <label className="text-sm font-medium">
                    사이즈 옵션 (쉼표로 구분)
                  </label>
                  <Input
                    value={editingProduct.sizes.join(", ")}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        sizes: e.target.value.split(",").map((s) => s.trim()),
                      })
                    }
                    className="mt-1"
                    placeholder="예: S, M, L, XL"
                  />
                </div>

                {/* 상품 이미지 */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium">상품 이미지</label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleEditModalImageUpload}>
                      <Upload className="mr-2 h-4 w-4" />
                      이미지 추가
                    </Button>
                  </div>

                  {editingProduct.images.length === 0 ? (
                    <div className="flex h-32 items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
                      이미지 추가 버튼을 클릭하여 이미지를 업로드하세요
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-3">
                      {editingProduct.images.map((image, index) => (
                        <div
                          key={index}
                          className="relative overflow-hidden rounded border border-gray-200">
                          <img
                            src={image}
                            alt={`상품 이미지 ${index + 1}`}
                            className="h-32 w-full object-cover"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1 h-6 w-6 bg-white/90 hover:bg-white"
                            onClick={() => handleEditModalImageRemove(index)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* URL 직접 입력 (옵션) */}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-gray-600 hover:text-gray-900">
                      URL로 직접 추가하기
                    </summary>
                    <Textarea
                      value={editingProduct.images.join("\n")}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          images: e.target.value
                            .split(/[\n,]/)
                            .map((img) => img.trim())
                            .filter(Boolean),
                        })
                      }
                      className="mt-2"
                      rows={3}
                      placeholder="각 줄에 하나씩 URL 입력"
                    />
                  </details>
                </div>

                {/* 상세 설명 */}
                <div>
                  <label className="text-sm font-medium">상세 설명</label>
                  <Textarea
                    value={editingProduct.description || ""}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        description: e.target.value,
                      })
                    }
                    className="mt-1"
                    rows={5}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t p-4">
                <Button
                  variant="outline"
                  onClick={() => setEditingProduct(null)}>
                  취소
                </Button>
                <Button
                  onClick={() => handleUpdateProduct()}
                  disabled={isSaving}>
                  {isSaving ? "저장 중..." : "저장"}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
