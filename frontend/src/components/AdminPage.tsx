import { useMemo, useState } from "react";
import {
  BarChart3,
  Edit,
  Eye,
  Filter,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Store,
  Tag,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Textarea } from "./ui/textarea";
import { useAppState } from "../context/app-state";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: "판매중" | "품절" | "숨김";
}

const inventory: InventoryItem[] = [
  {
    id: "SKU-001",
    name: "여름 린넨 반팔 셔츠",
    category: "패션의류",
    price: 29900,
    stock: 150,
    status: "판매중",
  },
  {
    id: "SKU-002",
    name: "데일리 클래식 스니커즈",
    category: "패션의류",
    price: 49900,
    stock: 85,
    status: "판매중",
  },
  {
    id: "SKU-003",
    name: "민감성 보습 크림",
    category: "뷰티",
    price: 24900,
    stock: 0,
    status: "품절",
  },
  {
    id: "SKU-004",
    name: "프리미엄 요가 매트",
    category: "스포츠/레저",
    price: 39900,
    stock: 210,
    status: "판매중",
  },
];

const summaryCards = [
  {
    title: "오늘 주문",
    value: "128건",
    icon: ShoppingCart,
    delta: "+18% vs. yesterday",
  },
  {
    title: "매출",
    value: "₩2,450,000",
    icon: TrendingUp,
    delta: "+6.4% vs. last week",
  },
  {
    title: "신규 회원",
    value: "52명",
    icon: Users,
    delta: "+12% vs. last week",
  },
  {
    title: "재고 경고",
    value: "3건",
    icon: Package,
    delta: "Low stock alert",
  },
];

export function AdminPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAppState();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // location.state에 최신 사용자 정보가 있으면 그것을 사용하고,
  // 없으면 AppState의 currentUser를 사용합니다.
  // currentUser가 null일 수 있는 경우를 대비하여 location.state를 우선 확인합니다.
  const finalUser = location.state?.updatedUser ?? currentUser;

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        return item.name
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase());
      }
      return true;
    });
  }, [categoryFilter, searchQuery, statusFilter]);

  const handleDelete = (id: string) => {
    toast.info(`상품 ${id} 삭제는 아직 구현되지 않았습니다.`);
  };

  // 판매자가 아닌 경우 판매자 등록 UI 표시
  if (!finalUser?.isSeller) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-[800px] px-6 py-12 md:px-8">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-8 text-white">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
                  <Store className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">판매자 센터</h1>
                  <p className="mt-1 text-purple-100">
                    상품을 판매하고 비즈니스를 성장시켜보세요
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8">
              <div className="mb-6">
                <h2 className="mb-2 text-xl font-semibold text-gray-900">
                  판매자 등록이 필요합니다
                </h2>
                <p className="text-gray-600">
                  판매자 센터를 이용하려면 먼저 판매자로 등록해야 합니다. 사업자
                  정보를 입력하고 판매를 시작하세요.
                </p>
              </div>

              <div className="mb-8 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                    <Store className="h-5 w-5 text-purple-600" />
                  </div>
                  <h3 className="mb-1 font-semibold text-gray-900">
                    무료 스토어 개설
                  </h3>
                  <p className="text-sm text-gray-600">
                    별도 비용 없이 온라인 스토어를 시작할 수 있습니다.
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-pink-100">
                    <BarChart3 className="h-5 w-5 text-pink-600" />
                  </div>
                  <h3 className="mb-1 font-semibold text-gray-900">
                    판매 관리 도구
                  </h3>
                  <p className="text-sm text-gray-600">
                    상품 관리, 주문 처리, 통계 등 다양한 도구를 제공합니다.
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="mb-1 font-semibold text-gray-900">
                    마케팅 지원
                  </h3>
                  <p className="text-sm text-gray-600">
                    프로모션, 쿠폰 등 마케팅 기능을 활용하세요.
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <Package className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="mb-1 font-semibold text-gray-900">
                    정산 시스템
                  </h3>
                  <p className="text-sm text-gray-600">
                    투명하고 안전한 정산 시스템을 제공합니다.
                  </p>
                </div>
              </div>

              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={() => navigate("/")}>
                  홈으로 돌아가기
                </Button>
                <Button
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                  onClick={() => navigate("/become-seller")}
                >
                  <Store className="mr-2 h-4 w-4" />
                  판매자 등록하기
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // 판매자인 경우 기존 대시보드 표시
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1280px] px-6 py-8 md:px-8">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              관리자 대시보드
            </h1>
            <p className="text-sm text-gray-600">
              판매 현황과 재고를 한눈에 확인하고 상품을 관리하세요.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2 text-sm">
              <BarChart3 className="h-4 w-4" />
              레포트 다운로드
            </Button>
            <Button
              className="gap-2 bg-gray-900 text-white hover:bg-black"
              onClick={() => navigate("/add-product")}
            >
              <Plus className="h-4 w-4" />
              상품 등록
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map(({ title, value, icon: Icon, delta }) => (
            <Card key={title} className="space-y-3 border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">
                  {title}
                </span>
                <Icon className="h-4 w-4 text-gray-400" />
              </div>
              <p className="text-2xl font-semibold text-gray-900">{value}</p>
              <span className="text-xs text-emerald-600">{delta}</span>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="inventory" className="mt-8">
          <TabsList className="bg-white">
            <TabsTrigger value="inventory">재고 관리</TabsTrigger>
            <TabsTrigger value="orders">주문 현황</TabsTrigger>
            <TabsTrigger value="coupons">쿠폰/프로모션</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="mt-6 space-y-4">
            <Card className="border-gray-200 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex w-full flex-col gap-2 text-sm text-gray-600 md:w-auto">
                  <span>
                    총 {filteredInventory.length}개의 상품이 검색되었습니다.
                  </span>
                </div>
                <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
                  <div className="flex items-center gap-2">
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="상품명을 검색하세요"
                      className="h-10 md:w-[220px]"
                    />
                    <Button variant="outline" className="h-10 gap-2 text-sm">
                      <Search className="h-4 w-4" />
                      검색
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={categoryFilter}
                      onValueChange={setCategoryFilter}
                    >
                      <SelectTrigger className="h-10 w-[150px]">
                        <SelectValue placeholder="카테고리" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체</SelectItem>
                        {Array.from(
                          new Set(inventory.map((item) => item.category))
                        ).map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={statusFilter}
                      onValueChange={setStatusFilter}
                    >
                      <SelectTrigger className="h-10 w-[150px]">
                        <SelectValue placeholder="상태" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체</SelectItem>
                        <SelectItem value="판매중">판매중</SelectItem>
                        <SelectItem value="품절">품절</SelectItem>
                        <SelectItem value="숨김">숨김</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" className="h-10 gap-2">
                      <Filter className="h-4 w-4" />
                      필터
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">SKU</TableHead>
                    <TableHead>상품명</TableHead>
                    <TableHead className="w-[120px]">카테고리</TableHead>
                    <TableHead className="w-[100px] text-right">가격</TableHead>
                    <TableHead className="w-[80px] text-right">재고</TableHead>
                    <TableHead className="w-[80px] text-center">상태</TableHead>
                    <TableHead className="w-[130px] text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs text-gray-500">
                        {item.id}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">
                        {item.name}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {item.category}
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-900">
                        ₩{item.price.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-900">
                        {item.stock}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        <span
                          className="inline-flex rounded-full px-2 py-1 text-xs"
                          data-status={item.status}
                        >
                          {item.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              toast.info("미리보기 준비 중입니다.")
                            }
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => navigate("/add-product")}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="mt-6">
            <Card className="border-gray-200 p-6">
              <div className="mb-6 flex items-center gap-2">
                <Tag className="h-4 w-4 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900">
                  최근 주문 요약
                </h2>
              </div>
              <p className="text-sm text-gray-600">
                주문 상세 페이지는 API 연동 이후 제공될 예정입니다.
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="coupons" className="mt-6">
            <Card className="border-gray-200 p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  새로운 쿠폰 생성
                </h2>
                <p className="text-sm text-gray-600">
                  프로모션 쿠폰을 발급하여 고객에게 혜택을 제공하세요.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="couponName">쿠폰명</Label>
                  <Input
                    id="couponName"
                    placeholder="예) 신규 회원 10% 할인"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="couponDiscount">할인율</Label>
                  <Input
                    id="couponDiscount"
                    type="number"
                    min={0}
                    max={100}
                    placeholder="예) 10"
                    className="mt-1.5"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="couponDescription">쿠폰 설명</Label>
                <Textarea id="couponDescription" rows={4} className="mt-1.5" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline">초기화</Button>
                <Button className="bg-gray-900 text-white hover:bg-black">
                  쿠폰 생성
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
