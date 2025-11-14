import { Calendar, Download, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
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
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toast } from "sonner";

interface ChartDataPoint {
  label: string;
  value: number;
}

interface CategorySalesChartItem {
  name: string;
  value: number;
}

interface HourlyOrdersChartItem {
  time: string;
  orders: number;
}

interface DashboardData {
  aiInsights?: string[];
  dynamicSalesChart?: ChartDataPoint[];
  categorySalesChart?: CategorySalesChartItem[];
  hourlyOrdersChart?: HourlyOrdersChartItem[];
  repurchaseRate: number;
  topProducts: Array<{
    rank: number;
    name: string;
    sales: number;
    revenue: number;
  }>;
  stockAlerts: {
    items: Array<{
      name: string;
      stock: number;
      status: string;
    }>;
  };
}

interface ReportTabProps {
  dashboardData: DashboardData | null;
  reportPeriod: "today" | "7days" | "30days" | "custom";
  setReportPeriod: (period: "today" | "7days" | "30days" | "custom") => void;
}

export function ReportTab({
  dashboardData,
  reportPeriod,
  setReportPeriod,
}: ReportTabProps) {
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

  return (
    <div className="p-8 bg-brand-main">
      {/* 기간 선택 */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">기간 선택:</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant={reportPeriod === "today" ? "default" : "outline"}
            size="sm"
            onClick={() => setReportPeriod("today")}
            className={
              reportPeriod === "today"
                ? "bg-brand-orange text-brand-main"
                : "bg-brand-main"
            }>
            오늘
          </Button>
          <Button
            variant={reportPeriod === "7days" ? "default" : "outline"}
            size="sm"
            onClick={() => setReportPeriod("7days")}
            className={
              reportPeriod === "7days"
                ? "bg-brand-orange text-brand-main"
                : "bg-brand-main"
            }>
            최근 7일
          </Button>
          <Button
            variant={reportPeriod === "30days" ? "default" : "outline"}
            size="sm"
            onClick={() => setReportPeriod("30days")}
            className={
              reportPeriod === "30days"
                ? "bg-brand-orange text-brand-main"
                : "bg-brand-main"
            }>
            최근 30일
          </Button>
          <Button variant="outline" size="sm" disabled>
            사용자 지정
          </Button>
        </div>
      </div>

      {/* AI 인사이트 카드 */}
      <Card className="mb-6 p-6 bg-brand-main">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-orange">
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
                분석할 데이터가 충분하지 않아 인사이트를 생성할 수 없습니다.
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
              <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 12 }} />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickFormatter={(value) => `₩${(value / 1000000).toFixed(1)}M`}
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
                stroke="#f2641d"
                strokeWidth={2}
                dot={{ fill: "#f2641d", r: 4 }}
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
                label>
                {(dashboardData?.categorySalesChart || []).map(
                  (entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        ["#9333ea", "#ec4899", "#3b82f6", "#10b981", "#f59e0b"][
                          index % 5
                        ]
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
              <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 12 }} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="orders" fill="#ec4899" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* 고객 재구매율 */}
        <Card className="p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            고객 재구매율
          </h3>
          <div className="mb-4 text-center">
            <div className="text-5xl font-bold text-brand-orange">
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
                  {(100 - (dashboardData?.repurchaseRate || 0)).toFixed(0)}%
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
                    width: `${(dashboardData?.repurchaseRate || 0).toFixed(
                      0
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 다운로드 버튼 */}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" onClick={handleDownloadExcel}>
          <Download className="mr-2 h-4 w-4" />
          Excel 다운로드
        </Button>
      </div>
    </div>
  );
}
