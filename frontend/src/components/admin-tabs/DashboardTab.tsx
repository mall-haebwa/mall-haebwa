import {
  TrendingUp,
  BarChart3,
  ShoppingCart,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import {
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
}

interface DashboardTabProps {
  dashboardData: DashboardData | null;
  isLoading: boolean;
  salesPeriod: "daily" | "weekly" | "monthly";
  setSalesPeriod: (period: "daily" | "weekly" | "monthly") => void;
}

export function DashboardTab({
  dashboardData,
  isLoading,
  salesPeriod,
  setSalesPeriod,
}: DashboardTabProps) {
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
    return "label";
  };

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

  return (
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
  );
}
