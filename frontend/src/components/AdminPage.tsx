import { useState, useEffect } from "react";
import {
  BarChart3,
  Home,
  Package,
  ShoppingCart,
  Tag,
  Settings,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plus,
  ArrowRight,
  FileText,
  Download,
  Sparkles,
  Search,
  Filter,
  Loader2,
  Edit,
  Trash2,
  Eye,
  Calendar,
  CreditCard,
  Bell,
  Truck,
  Check,
  ChevronRight,
  Wand2,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { useAppState } from "../context/app-state";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import * as XLSX from "xlsx"; // XLSX 라이브러리 임포트
import { saveAs } from "file-saver"; // file-saver 라이브러리 임포트
import { toast } from "sonner";

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
  "패션의류",
  "뷰티",
  "식품",
  "생활/주방",
  "가전디지털",
  "스포츠/레저",
  "출산/육아",
  "도서",
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
  const { currentUser } = useAppState();
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
  const dynamicOrderPieData = dashboardData
    ? [
        {
          name: "처리대기",
          value: dashboardData.orderStats.pending,
          color: "#EF4444",
        },
        {
          name: "배송중",
          value: dashboardData.orderStats.shipping,
          color: "#F59E0B",
        },
        {
          name: "완료",
          value: dashboardData.orderStats.completed,
          color: "#10B981",
        },
      ]
    : [
        { name: "처리대기", value: 0, color: "#EF4444" },
        { name: "배송중", value: 0, color: "#F59E0B" },
        { name: "완료", value: 0, color: "#10B981" },
      ];

  // --- Excel Download Handler (NEW) ---
  const handleDownloadExcel = () => {
    if (!dashboardData) {
      toast.info("다운로드할 데이터가 없습니다.");
      return;
    }

    const workbook = XLSX.utils.book_new();

    // 1. 일별 매출 추이 시트
    if (
      dashboardData.dynamicSalesChart &&
      dashboardData.dynamicSalesChart.length > 0
    ) {
      const dailySalesData = [
        ["날짜", "매출"],
        ...dashboardData.dynamicSalesChart.map((item) => [
          item.label,
          item.value,
        ]),
      ];
      const dailySalesSheet = XLSX.utils.aoa_to_sheet(dailySalesData);
      XLSX.utils.book_append_sheet(workbook, dailySalesSheet, "일별 매출 추이");
    }

    // 2. 카테고리별 매출 비중 시트
    if (
      dashboardData.categorySalesChart &&
      dashboardData.categorySalesChart.length > 0
    ) {
      const categorySalesData = [
        ["카테고리", "매출"],
        ...dashboardData.categorySalesChart.map((item) => [
          item.name,
          item.value,
        ]),
      ];
      const categorySalesSheet = XLSX.utils.aoa_to_sheet(categorySalesData);
      XLSX.utils.book_append_sheet(
        workbook,
        categorySalesSheet,
        "카테고리별 매출 비중"
      );
    }

    // 3. 시간대별 주문 분포 시트
    if (
      dashboardData.hourlyOrdersChart &&
      dashboardData.hourlyOrdersChart.length > 0
    ) {
      const hourlyOrdersData = [
        ["시간대", "주문건수"],
        ...dashboardData.hourlyOrdersChart.map((item) => [
          item.time,
          item.orders,
        ]),
      ];
      const hourlyOrdersSheet = XLSX.utils.aoa_to_sheet(hourlyOrdersData);
      XLSX.utils.book_append_sheet(
        workbook,
        hourlyOrdersSheet,
        "시간대별 주문 분포"
      );
    }

    // 4. 고객 재구매율 시트
    if (
      dashboardData.repurchaseRate !== undefined &&
      dashboardData.repurchaseRate !== null
    ) {
      const repurchaseData = [
        ["항목", "비율"],
        ["재구매율", `${dashboardData.repurchaseRate.toFixed(2)}%`],
        [
          "1회 구매 고객",
          `${(100 - dashboardData.repurchaseRate).toFixed(2)}%`,
        ],
        ["2회 이상 구매 고객", `${dashboardData.repurchaseRate.toFixed(2)}%`],
      ];
      const repurchaseSheet = XLSX.utils.aoa_to_sheet(repurchaseData);
      XLSX.utils.book_append_sheet(workbook, repurchaseSheet, "고객 재구매율");
    }

    // 5. 인기 상품 TOP 10 시트
    if (dashboardData.topProducts && dashboardData.topProducts.length > 0) {
      const topProductsData = [
        ["순위", "상품명", "판매량", "매출액"],
        ...dashboardData.topProducts.map((item) => [
          item.rank,
          item.name,
          item.sales,
          item.revenue,
        ]),
      ];
      const topProductsSheet = XLSX.utils.aoa_to_sheet(topProductsData);
      XLSX.utils.book_append_sheet(
        workbook,
        topProductsSheet,
        "인기 상품 TOP 10"
      );
    }

    // 6. 재고 알림 상품 시트
    if (
      dashboardData.stockAlerts.items &&
      dashboardData.stockAlerts.items.length > 0
    ) {
      const stockAlertsData = [
        ["상품명", "현재 재고", "상태"],
        ...dashboardData.stockAlerts.items.map((item) => [
          item.name,
          item.stock,
          item.status,
        ]),
      ];
      const stockAlertsSheet = XLSX.utils.aoa_to_sheet(stockAlertsData);
      XLSX.utils.book_append_sheet(
        workbook,
        stockAlertsSheet,
        "재고 알림 상품"
      );
    }

    // 워크북을 바이너리 데이터로 변환
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const data = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });
    saveAs(
      data,
      `판매자_리포트_${new Date().toLocaleDateString("ko-KR")}.xlsx`
    );
    toast.success("Excel 파일 다운로드 완료!");
  };
  // --- End Download Handlers ---

  // 판매자가 아닌 경우 판매자 등록 UI 표시
  if (!finalUser?.isSeller) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-[1200px] px-6">
          {/* 상단 헤더 */}
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
            </div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">
              AI 기반 스마트 판매 시스템
            </h1>
            <p className="mb-4 text-lg text-gray-600">
              인공지능이 당신의 판매를 도와 매출을 극대화합니다
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => navigate("/")}>
                홈으로 돌아가기
              </Button>
              <Button
                size="lg"
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                onClick={() => navigate("/become-seller")}
              >
                <Package className="mr-2 h-5 w-5" />
                판매자 등록하기
              </Button>
            </div>
          </div>

          {/* AI 기능 그리드 */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* AI 자동 상품 등록 */}
            <Card className="border-purple-200 p-5 transition-shadow hover:shadow-lg">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-100">
                  <Wand2 className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h4 className="mb-2 font-semibold text-gray-900">
                    AI 자동 상품 등록
                  </h4>
                  <p className="text-sm text-gray-600">
                    이미지만 업로드하면 AI가 상품명, 설명, 가격까지 자동 생성
                  </p>
                </div>
              </div>
            </Card>

            {/* AI 가격 최적화 */}
            <Card className="border-pink-200 p-5 transition-shadow hover:shadow-lg">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pink-100">
                  <TrendingUp className="h-6 w-6 text-pink-600" />
                </div>
                <div>
                  <h4 className="mb-2 font-semibold text-gray-900">
                    AI 가격 최적화
                  </h4>
                  <p className="text-sm text-gray-600">
                    시장 동향을 실시간 분석하여 최적의 판매 가격 추천
                  </p>
                </div>
              </div>
            </Card>

            {/* AI 판매 인사이트 */}
            <Card className="border-blue-200 p-5 transition-shadow hover:shadow-lg">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="mb-2 font-semibold text-gray-900">
                    AI 판매 인사이트
                  </h4>
                  <p className="text-sm text-gray-600">
                    매출 데이터를 분석하여 판매 전략과 개선점 제안
                  </p>
                </div>
              </div>
            </Card>

            {/* AI 프로모션 전략 */}
            <Card className="border-emerald-200 p-5 transition-shadow hover:shadow-lg">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <Tag className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h4 className="mb-2 font-semibold text-gray-900">
                    AI 프로모션 전략
                  </h4>
                  <p className="text-sm text-gray-600">
                    고객 구매 패턴 분석으로 효과적인 프로모션 시기 추천
                  </p>
                </div>
              </div>
            </Card>

            {/* AI 재고 예측 */}
            <Card className="border-orange-200 p-5 transition-shadow hover:shadow-lg">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100">
                  <Package className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h4 className="mb-2 font-semibold text-gray-900">
                    AI 재고 예측
                  </h4>
                  <p className="text-sm text-gray-600">
                    판매 추이 분석으로 최적의 재고 수량과 발주 시점 알림
                  </p>
                </div>
              </div>
            </Card>

            {/* AI 사기 탐지 */}
            <Card className="border-red-200 p-5 transition-shadow hover:shadow-lg">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h4 className="mb-2 font-semibold text-gray-900">
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
          <Card className="mt-6 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 p-6">
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
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                onClick={() => navigate("/become-seller")}
              >
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
            }`}
          >
            <Home className="h-5 w-5" />
            대시보드
          </button>

          <button
            onClick={() => setActiveMenu("reports")}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
              activeMenu === "reports"
                ? "bg-purple-50 text-purple-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <BarChart3 className="h-5 w-5" />
            리포트
          </button>

          <button
            onClick={() => setActiveMenu("products")}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
              activeMenu === "products"
                ? "bg-purple-50 text-purple-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Package className="h-5 w-5" />
            상품 관리
          </button>

          <button
            onClick={() => setActiveMenu("orders")}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
              activeMenu === "orders"
                ? "bg-purple-50 text-purple-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <ShoppingCart className="h-5 w-5" />
            주문 관리
          </button>

          <button
            onClick={() => setActiveMenu("promotions")}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
              activeMenu === "promotions"
                ? "bg-purple-50 text-purple-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Tag className="h-5 w-5" />
            프로모션
          </button>

          <button
            onClick={() => setActiveMenu("settings")}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
              activeMenu === "settings"
                ? "bg-purple-50 text-purple-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
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
            onClick={() => navigate("/add-product")}
          >
            <Plus className="mr-2 h-4 w-4" />
            상품 등록
          </Button>
        </header>

        {/* 대시보드 콘텐츠 */}
        {activeMenu === "dashboard" && (
          <div className="p-8">
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="text-gray-500">로딩 중...</div>
              </div>
            ) : dashboardData ? (
              <>
                {/* 요약 카드 */}
                <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  {/* 오늘 매출 */}
                  <Card className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          오늘 매출
                        </p>
                        <p className="mt-2 text-2xl font-bold text-gray-900">
                          ₩{dashboardData.today.amount.toLocaleString()}
                        </p>
                        <div className="mt-2 flex items-center gap-1 text-sm">
                          <TrendingUp className="h-4 w-4 text-emerald-600" />
                          <span className="font-medium text-emerald-600">
                            +{dashboardData.today.change}%
                          </span>
                          <span className="text-gray-500">vs 어제</span>
                        </div>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                        <TrendingUp className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </Card>

                  {/* 이번 주 매출 */}
                  <Card className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          이번 주 매출
                        </p>
                        <p className="mt-2 text-2xl font-bold text-gray-900">
                          ₩{dashboardData.week.amount.toLocaleString()}
                        </p>
                        <div className="mt-2 flex items-center gap-1 text-sm">
                          <TrendingUp className="h-4 w-4 text-emerald-600" />
                          <span className="font-medium text-emerald-600">
                            +{dashboardData.week.change}%
                          </span>
                          <span className="text-gray-500">vs 지난 주</span>
                        </div>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                        <BarChart3 className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </Card>

                  {/* 신규 주문 */}
                  <Card className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          신규 주문
                        </p>
                        <p className="mt-2 text-2xl font-bold text-gray-900">
                          {dashboardData.newOrders}건
                        </p>
                        <div className="mt-2 flex items-center gap-1 text-sm">
                          <span className="font-medium text-orange-600">
                            처리 필요
                          </span>
                          <ArrowRight className="h-3 w-3 text-gray-400" />
                        </div>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                        <ShoppingCart className="h-6 w-6 text-orange-600" />
                      </div>
                    </div>
                  </Card>

                  {/* 재고 알림 */}
                  <Card className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          재고 부족
                        </p>
                        <p className="mt-2 text-2xl font-bold text-gray-900">
                          {dashboardData.stockAlertsCount}건
                        </p>
                        <div className="mt-2 flex items-center gap-1 text-sm">
                          <span className="font-medium text-red-600">
                            확인 필요
                          </span>
                          <ArrowRight className="h-3 w-3 text-gray-400" />
                        </div>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                      </div>
                    </div>
                  </Card>
                </div>
              </>
            ) : (
              <div className="flex justify-center items-center py-12">
                <div className="text-gray-500">
                  데이터를 불러올 수 없습니다.
                </div>
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
              {/* 매출 추이 차트 - 2열 */}
              <Card className="p-6 lg:col-span-2">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    매출 추이
                  </h2>
                  <div className="flex gap-2">
                    <Button
                      variant={salesPeriod === "daily" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSalesPeriod("daily")}
                      className={
                        salesPeriod === "daily"
                          ? "bg-purple-600 text-white"
                          : ""
                      }
                    >
                      일간
                    </Button>
                    <Button
                      variant={salesPeriod === "weekly" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSalesPeriod("weekly")}
                      className={
                        salesPeriod === "weekly"
                          ? "bg-purple-600 text-white"
                          : ""
                      }
                    >
                      주간
                    </Button>
                    <Button
                      variant={
                        salesPeriod === "monthly" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setSalesPeriod("monthly")}
                      className={
                        salesPeriod === "monthly"
                          ? "bg-purple-600 text-white"
                          : ""
                      }
                    >
                      월간
                    </Button>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getCurrentChart()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey={getChartLabel()}
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                    />
                    <YAxis
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      tickFormatter={(value) =>
                        `₩${(value / 1000000).toFixed(0)}M`
                      }
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        `₩${value.toLocaleString()}`,
                        "매출",
                      ]}
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="value" fill="#9333ea" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* 주문 현황 - 1열 */}
              {dashboardData && (
                <Card className="p-6">
                  <h2 className="mb-6 text-lg font-semibold text-gray-900">
                    주문 현황
                  </h2>

                  <div className="mb-6">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={dynamicOrderPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {dynamicOrderPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-red-50 p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-red-500" />
                        <span className="text-sm font-medium text-gray-700">
                          처리대기
                        </span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        {dashboardData.orderStats.pending}건
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-orange-50 p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-orange-500" />
                        <span className="text-sm font-medium text-gray-700">
                          배송중
                        </span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        {dashboardData.orderStats.shipping}건
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-emerald-500" />
                        <span className="text-sm font-medium text-gray-700">
                          완료
                        </span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        {dashboardData.orderStats.completed}건
                      </span>
                    </div>
                  </div>
                </Card>
              )}

              {/* 인기 상품 TOP 10 - 2열 */}
              {dashboardData && (
                <Card className="p-6 lg:col-span-2">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">
                    인기 상품 TOP 10
                  </h2>

                  <div className="space-y-3">
                    {dashboardData.topProducts.length > 0 ? (
                      dashboardData.topProducts.map((product) => (
                        <div
                          key={product.rank}
                          className="flex items-center justify-between rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                                product.rank === 1
                                  ? "bg-yellow-100 text-yellow-700"
                                  : product.rank === 2
                                  ? "bg-gray-100 text-gray-700"
                                  : product.rank === 3
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-gray-50 text-gray-600"
                              }`}
                            >
                              {product.rank}
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              {product.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-6">
                            <span className="text-sm text-gray-600">
                              {product.sales}개 판매
                            </span>
                            <span className="text-sm font-semibold text-gray-900">
                              ₩{product.revenue.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-sm text-gray-500">
                        판매 데이터가 없습니다.
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* 재고 알림 - 1열 */}
              {dashboardData && (
                <Card className="p-6">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">
                    재고 알림
                  </h2>

                  <div className="mb-4 space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-red-50 p-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          품절
                        </p>
                        <p className="text-2xl font-bold text-red-600">
                          {dashboardData.stockAlerts.outOfStock}건
                        </p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-orange-50 p-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          재고 부족
                        </p>
                        <p className="text-2xl font-bold text-orange-600">
                          {dashboardData.stockAlerts.lowStock}건
                        </p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-orange-500" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600">
                      최근 알림
                    </p>
                    {dashboardData.stockAlerts.items.length > 0 ? (
                      dashboardData.stockAlerts.items.map((item, index) => (
                        <div
                          key={index}
                          className="rounded border border-gray-200 p-2 text-xs"
                        >
                          <p className="font-medium text-gray-900">
                            {item.name}
                          </p>
                          <p
                            className={`mt-1 ${
                              item.status === "품절"
                                ? "text-red-600"
                                : "text-orange-600"
                            }`}
                          >
                            {item.status === "품절"
                              ? "품절"
                              : `재고 ${item.stock}개`}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-center text-xs text-gray-500">
                        재고 알림이 없습니다.
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* 리포트 페이지 */}
        {activeMenu === "reports" && (
          <div className="p-8">
            {/* 기간 선택 */}
            <div className="mb-6 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  기간 선택:
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={reportPeriod === "today" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReportPeriod("today")}
                  className={
                    reportPeriod === "today" ? "bg-purple-600 text-white" : ""
                  }
                >
                  오늘
                </Button>
                <Button
                  variant={reportPeriod === "7days" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReportPeriod("7days")}
                  className={
                    reportPeriod === "7days" ? "bg-purple-600 text-white" : ""
                  }
                >
                  최근 7일
                </Button>
                <Button
                  variant={reportPeriod === "30days" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReportPeriod("30days")}
                  className={
                    reportPeriod === "30days" ? "bg-purple-600 text-white" : ""
                  }
                >
                  최근 30일
                </Button>
                <Button variant="outline" size="sm" disabled>
                  사용자 지정
                </Button>
              </div>
            </div>

            {/* AI 인사이트 카드 */}
            <Card className="mb-6 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">
                    AI 인사이트
                  </h3>
                  {dashboardData?.aiInsights &&
                  dashboardData.aiInsights.length > 0 ? (
                    <div className="space-y-2 text-sm text-gray-700">
                      {dashboardData.aiInsights.map((insight, index) => (
                        <p key={index}>• {insight}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      분석할 데이터가 충분하지 않아 인사이트를 생성할 수
                      없습니다.
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* 상세 차트 그리드 */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* 매출 상세 차트 */}
              <Card className="p-6">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">
                  일별 매출 추이
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={dashboardData?.dynamicSalesChart || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                    />
                    <YAxis
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      tickFormatter={(value) =>
                        `₩${(value / 1000000).toFixed(1)}M`
                      }
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        `₩${value.toLocaleString()}`,
                        "매출",
                      ]}
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#9333ea"
                      strokeWidth={2}
                      dot={{ fill: "#9333ea", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* 카테고리별 매출 */}
              <Card className="p-6">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">
                  카테고리별 매출 비중
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={dashboardData?.categorySalesChart || []}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label
                    >
                      {(dashboardData?.categorySalesChart || []).map(
                        (entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              [
                                "#9333ea",
                                "#ec4899",
                                "#3b82f6",
                                "#10b981",
                                "#f59e0b",
                              ][index % 5]
                            }
                          />
                        )
                      )}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              {/* 시간대별 주문 */}
              <Card className="p-6">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">
                  시간대별 주문 분포
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dashboardData?.hourlyOrdersChart || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                    />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar
                      dataKey="orders"
                      fill="#ec4899"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* 고객 재구매율 */}
              <Card className="p-6">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">
                  고객 재구매율
                </h3>
                <div className="mb-4 text-center">
                  <div className="text-5xl font-bold text-purple-600">
                    {dashboardData?.repurchaseRate.toFixed(0)}%
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    전체 고객 중 재구매 고객 비율
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-600">1회 구매</span>
                      <span className="font-medium text-gray-900">
                        {(100 - (dashboardData?.repurchaseRate || 0)).toFixed(
                          0
                        )}
                        %
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-gray-400"
                        style={{
                          width: `${(
                            100 - (dashboardData?.repurchaseRate || 0)
                          ).toFixed(0)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-600">2회 이상 구매</span>
                      <span className="font-medium text-gray-900">
                        {(dashboardData?.repurchaseRate || 0).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-purple-600"
                        style={{
                          width: `${(
                            dashboardData?.repurchaseRate || 0
                          ).toFixed(0)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* 다운로드 버튼 */}
            <div className="mt-6 flex justify-end gap-3">
              {/* PDF 다운로드 버튼 제거 */}
              {/* <Button
                variant="outline"
                onClick={() => toast.info("PDF 다운로드 기능은 준비 중입니다.")}
              >
                <Download className="mr-2 h-4 w-4" />
                PDF 다운로드
              </Button> */}
              <Button variant="outline" onClick={handleDownloadExcel}>
                <Download className="mr-2 h-4 w-4" />
                Excel 다운로드
              </Button>
            </div>
          </div>
        )}

        {/* 상품 관리 페이지 */}
        {activeMenu === "products" && (
          <div className="p-8">
            {/* 검색 및 필터 */}
            <form
              onSubmit={handleProductSearchSubmit}
              className="mb-6 flex flex-wrap items-center gap-4"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="상품명으로 검색..."
                  className="pl-10"
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                />
              </div>
              {/* 카테고리 필터 */}
              <Select
                value={productCategoryFilter}
                onValueChange={setProductCategoryFilter}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="카테고리 필터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 카테고리</SelectItem>
                  <SelectItem value="패션의류">패션의류</SelectItem>
                  <SelectItem value="뷰티">뷰티</SelectItem>
                  <SelectItem value="식품">식품</SelectItem>
                  <SelectItem value="생활/주방">생활/주방</SelectItem>
                  <SelectItem value="가전디지털">가전디지털</SelectItem>
                  <SelectItem value="스포츠/레저">스포츠/레저</SelectItem>
                  <SelectItem value="출산/육아">출산/육아</SelectItem>
                  <SelectItem value="도서">도서</SelectItem>
                </SelectContent>
              </Select>
              {/* 상태 필터 */}
              <Select
                value={productStatusFilter}
                onValueChange={setProductStatusFilter}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="상태 필터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 상태</SelectItem>
                  <SelectItem value="판매중">판매중</SelectItem>
                  <SelectItem value="재고부족">재고 부족</SelectItem>
                  <SelectItem value="품절">품절</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit">
                <Search className="mr-2 h-4 w-4" />
                검색
              </Button>
              <Button
                type="button" // form 제출 방지
                variant="outline"
                onClick={handleResetFilters}
              >
                초기화
              </Button>
              <Button
                variant="outline"
                className="border-purple-200 text-purple-600 hover:bg-purple-50"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                AI 상품 설명 생성
              </Button>
            </form>

            {/* AI 가격 추천 카드 */}
            <Card className="mb-6 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">
                    AI 가격 최적화 추천
                  </h3>
                  <p className="mb-4 text-sm text-gray-700">
                    시장 동향과 경쟁사 가격을 분석하여 최적의 가격을 추천합니다.
                  </p>
                  <div className="flex gap-3">
                    <div className="rounded-lg border border-purple-200 bg-white p-3">
                      <p className="text-xs text-gray-600">
                        무선 블루투스 이어폰
                      </p>
                      <p className="mt-1 text-sm">
                        <span className="font-medium text-gray-900">
                          현재가: ₩79,900
                        </span>
                        <span className="mx-2 text-gray-400">→</span>
                        <span className="font-bold text-purple-600">
                          추천가: ₩74,900
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        예상 판매량 증가: +15%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* 상품 목록 테이블 */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <Checkbox />
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        상품명
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        카테고리
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        가격
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        재고
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
                    {isProductsLoading ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-gray-500"
                        >
                          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                          <p className="mt-2">상품 목록을 불러오는 중...</p>
                        </td>
                      </tr>
                    ) : productsError ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-red-500"
                        >
                          {productsError}
                        </td>
                      </tr>
                    ) : sellerProducts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-gray-500"
                        >
                          등록된 상품이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      sellerProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <Checkbox />
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">
                              {product.title}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-600">
                              {product.category1}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium text-gray-900">
                              ₩{product.numericPrice.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`text-sm font-medium ${
                                product.stock === 0
                                  ? "text-red-600"
                                  : product.stock < 10
                                  ? "text-orange-600"
                                  : "text-gray-900"
                              }`}
                            >
                              {product.stock}개
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                product.stock === 0
                                  ? "bg-red-100 text-red-700"
                                  : product.stock < 10
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {product.stock === 0
                                ? "품절"
                                : product.stock < 10
                                ? "재고 부족"
                                : "판매중"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingProduct(product)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteProduct(product.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* 페이지네이션 */}
              <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
                <p className="text-sm text-gray-600">
                  총 {totalProducts}개 상품
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1 || isProductsLoading}
                  >
                    이전
                  </Button>
                  <span className="flex items-center text-sm font-medium text-gray-700">
                    {currentPage} / {Math.ceil(totalProducts / 10)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => prev + 1)}
                    disabled={
                      currentPage * 10 >= totalProducts || isProductsLoading
                    }
                  >
                    다음
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* 주문 관리 페이지 */}
        {activeMenu === "orders" && (
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
        )}

        {/* 프로모션 페이지 */}
        {activeMenu === "promotions" && (
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
        )}

        {/* 설정 페이지 */}
        {activeMenu === "settings" && (
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
                    }
                  >
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

                {/* 이미지 URL */}
                <div>
                  <label className="text-sm font-medium">
                    이미지 URL (각 줄에 하나씩 또는 쉼표로 구분)
                  </label>
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
                    className="mt-1"
                    rows={4}
                    placeholder="예: https://example.com/image1.jpg\nhttps://example.com/image2.jpg"
                  />
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
                  onClick={() => setEditingProduct(null)}
                >
                  취소
                </Button>
                <Button
                  onClick={() => handleUpdateProduct()}
                  disabled={isSaving}
                >
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
