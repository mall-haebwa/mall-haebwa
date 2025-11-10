import { useState } from "react";
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
  Edit,
  Trash2,
  Eye,
  Calendar,
  CreditCard,
  Bell,
  Truck,
  Check,
  X as XIcon,
  ChevronRight,
  Wand2,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
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

// 목업 데이터
const salesData = {
  today: {
    amount: 2450000,
    change: 18.2,
    orders: 28,
  },
  week: {
    amount: 15240000,
    change: 6.4,
    orders: 156,
  },
  newOrders: 5,
  stockAlerts: 10,
};

const dailySalesChart = [
  { date: "11/02", sales: 1200000 },
  { date: "11/03", sales: 1800000 },
  { date: "11/04", sales: 1600000 },
  { date: "11/05", sales: 2100000 },
  { date: "11/06", sales: 2300000 },
  { date: "11/07", sales: 1900000 },
  { date: "11/08", sales: 2450000 },
];

const weeklySalesChart = [
  { week: "40주", sales: 12000000 },
  { week: "41주", sales: 13500000 },
  { week: "42주", sales: 14200000 },
  { week: "43주", sales: 14300000 },
  { week: "44주", sales: 15240000 },
];

const monthlySalesChart = [
  { month: "6월", sales: 45000000 },
  { month: "7월", sales: 52000000 },
  { month: "8월", sales: 48000000 },
  { month: "9월", sales: 56000000 },
  { month: "10월", sales: 61000000 },
  { month: "11월", sales: 15240000 },
];

const orderStats = {
  pending: 5,
  shipping: 12,
  completed: 143,
};

const orderPieData = [
  { name: "처리대기", value: orderStats.pending, color: "#EF4444" },
  { name: "배송중", value: orderStats.shipping, color: "#F59E0B" },
  { name: "완료", value: orderStats.completed, color: "#10B981" },
];

const topProducts = [
  { rank: 1, name: "여름 린넨 반팔 셔츠", sales: 23, revenue: 687700 },
  { rank: 2, name: "데일리 클래식 스니커즈", sales: 18, revenue: 898200 },
  { rank: 3, name: "민감성 보습 크림", sales: 15, revenue: 373500 },
  { rank: 4, name: "프리미엄 요가 매트", sales: 12, revenue: 478800 },
  { rank: 5, name: "무선 블루투스 이어폰", sales: 11, revenue: 879000 },
  { rank: 6, name: "스마트워치 밴드", sales: 10, revenue: 290000 },
  { rank: 7, name: "휴대용 보조배터리", sales: 9, revenue: 341100 },
  { rank: 8, name: "캠핑 접이식 의자", sales: 8, revenue: 399200 },
  { rank: 9, name: "LED 무드등", sales: 7, revenue: 209300 },
  { rank: 10, name: "실리콘 에어팟 케이스", sales: 7, revenue: 139300 },
];

const stockAlerts = {
  outOfStock: 3,
  lowStock: 7,
  items: [
    { name: "민감성 보습 크림", stock: 0, status: "품절" },
    { name: "무선 블루투스 이어폰", stock: 3, status: "부족" },
    { name: "캠핑 접이식 의자", stock: 4, status: "부족" },
  ],
};

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

  const finalUser = location.state?.updatedUser ?? currentUser;

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
    switch (salesPeriod) {
      case "daily":
        return dailySalesChart;
      case "weekly":
        return weeklySalesChart;
      case "monthly":
        return monthlySalesChart;
    }
  };

  const getChartLabel = () => {
    switch (salesPeriod) {
      case "daily":
        return "date";
      case "weekly":
        return "week";
      case "monthly":
        return "month";
    }
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
                      ₩{salesData.today.amount.toLocaleString()}
                    </p>
                    <div className="mt-2 flex items-center gap-1 text-sm">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      <span className="font-medium text-emerald-600">
                        +{salesData.today.change}%
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
                      ₩{salesData.week.amount.toLocaleString()}
                    </p>
                    <div className="mt-2 flex items-center gap-1 text-sm">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      <span className="font-medium text-emerald-600">
                        +{salesData.week.change}%
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
                      {salesData.newOrders}건
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
                      {salesData.stockAlerts}건
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
                    <Bar dataKey="sales" fill="#9333ea" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* 주문 현황 - 1열 */}
              <Card className="p-6">
                <h2 className="mb-6 text-lg font-semibold text-gray-900">
                  주문 현황
                </h2>

                <div className="mb-6">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={orderPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {orderPieData.map((entry, index) => (
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
                      {orderStats.pending}건
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
                      {orderStats.shipping}건
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
                      {orderStats.completed}건
                    </span>
                  </div>
                </div>
              </Card>

              {/* 인기 상품 TOP 10 - 2열 */}
              <Card className="p-6 lg:col-span-2">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                  인기 상품 TOP 10
                </h2>

                <div className="space-y-3">
                  {topProducts.map((product) => (
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
                  ))}
                </div>
              </Card>

              {/* 재고 알림 - 1열 */}
              <Card className="p-6">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                  재고 알림
                </h2>

                <div className="mb-4 space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-red-50 p-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">품절</p>
                      <p className="text-2xl font-bold text-red-600">
                        {stockAlerts.outOfStock}건
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
                        {stockAlerts.lowStock}건
                      </p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-orange-500" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-600">최근 알림</p>
                  {stockAlerts.items.map((item, index) => (
                    <div
                      key={index}
                      className="rounded border border-gray-200 p-2 text-xs"
                    >
                      <p className="font-medium text-gray-900">{item.name}</p>
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
                  ))}
                </div>
              </Card>
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
                <Button variant="outline" size="sm">
                  오늘
                </Button>
                <Button variant="outline" size="sm">
                  최근 7일
                </Button>
                <Button variant="outline" size="sm">
                  최근 30일
                </Button>
                <Button variant="outline" size="sm">
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
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>
                      • 이번 주 매출이 지난 주 대비 18.2% 증가했습니다. 주요
                      요인은 '무선 블루투스 이어폰'의 판매량 급증입니다.
                    </p>
                    <p>
                      • 주말 오후 2-4시에 주문이 집중되고 있습니다. 이 시간대에
                      프로모션을 집중하면 효과적일 것으로 예상됩니다.
                    </p>
                    <p>
                      • 재고가 부족한 상품이 10개 있습니다. 특히 '민감성 보습
                      크림'은 품절 상태로 잠재 매출 손실이 발생하고 있습니다.
                    </p>
                  </div>
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
                  <LineChart data={dailySalesChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
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
                      dataKey="sales"
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
                      data={[
                        { name: "패션", value: 35, color: "#9333ea" },
                        { name: "뷰티", value: 25, color: "#ec4899" },
                        { name: "전자기기", value: 20, color: "#3b82f6" },
                        { name: "스포츠", value: 12, color: "#10b981" },
                        { name: "기타", value: 8, color: "#f59e0b" },
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label
                    >
                      {[
                        { name: "패션", value: 35, color: "#9333ea" },
                        { name: "뷰티", value: 25, color: "#ec4899" },
                        { name: "전자기기", value: 20, color: "#3b82f6" },
                        { name: "스포츠", value: 12, color: "#10b981" },
                        { name: "기타", value: 8, color: "#f59e0b" },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
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
                  <BarChart
                    data={[
                      { time: "00-06", orders: 5 },
                      { time: "06-09", orders: 12 },
                      { time: "09-12", orders: 28 },
                      { time: "12-15", orders: 45 },
                      { time: "15-18", orders: 38 },
                      { time: "18-21", orders: 32 },
                      { time: "21-24", orders: 18 },
                    ]}
                  >
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
                  <div className="text-5xl font-bold text-purple-600">68%</div>
                  <p className="mt-2 text-sm text-gray-600">
                    전체 고객 중 재구매 고객 비율
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-600">1회 구매</span>
                      <span className="font-medium text-gray-900">32%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-gray-400"
                        style={{ width: "32%" }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-600">2-3회 구매</span>
                      <span className="font-medium text-gray-900">45%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-purple-400"
                        style={{ width: "45%" }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-600">4회 이상 구매</span>
                      <span className="font-medium text-gray-900">23%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-purple-600"
                        style={{ width: "23%" }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* 다운로드 버튼 */}
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                PDF 다운로드
              </Button>
              <Button variant="outline">
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
            <div className="mb-6 flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <Input placeholder="상품명, SKU로 검색..." className="pl-10" />
              </div>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                필터
              </Button>
              <Button
                variant="outline"
                className="border-purple-200 text-purple-600 hover:bg-purple-50"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                AI 상품 설명 생성
              </Button>
            </div>

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
                    {[
                      {
                        name: "무선 블루투스 이어폰",
                        category: "전자기기",
                        price: 79900,
                        stock: 23,
                        status: "판매중",
                      },
                      {
                        name: "여름 린넨 반팔 셔츠",
                        category: "패션",
                        price: 29900,
                        stock: 156,
                        status: "판매중",
                      },
                      {
                        name: "민감성 보습 크림",
                        category: "뷰티",
                        price: 24900,
                        stock: 0,
                        status: "품절",
                      },
                      {
                        name: "프리미엄 요가 매트",
                        category: "스포츠",
                        price: 39900,
                        stock: 8,
                        status: "판매중",
                      },
                    ].map((product, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <Checkbox />
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">
                            {product.name}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">
                            {product.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-900">
                            ₩{product.price.toLocaleString()}
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
                              product.status === "판매중"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {product.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
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

              {/* 페이지네이션 */}
              <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
                <p className="text-sm text-gray-600">총 4개 상품</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled>
                    이전
                  </Button>
                  <Button variant="outline" size="sm">
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
      </main>
    </div>
  );
}
