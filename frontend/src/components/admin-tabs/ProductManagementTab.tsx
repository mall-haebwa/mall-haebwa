import { Search, Sparkles, Eye, Edit, Trash2, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface SellerProduct {
  id: number;
  title: string;
  category1: string;
  numericPrice: number;
  stock: number;
}

interface ProductManagementTabProps {
  sellerProducts: SellerProduct[];
  isProductsLoading: boolean;
  productsError: string | null;
  productSearchQuery: string;
  setProductSearchQuery: (query: string) => void;
  productCategoryFilter: string;
  setProductCategoryFilter: (category: string) => void;
  productStatusFilter: string;
  setProductStatusFilter: (status: string) => void;
  currentPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
  totalProducts: number;
  handleProductSearchSubmit: (e: React.FormEvent) => void;
  handleResetFilters: () => void;
  handleDeleteProduct: (id: number) => void;
  setEditingProduct: (product: SellerProduct) => void;
}

export function ProductManagementTab({
  sellerProducts,
  isProductsLoading,
  productsError,
  productSearchQuery,
  setProductSearchQuery,
  productCategoryFilter,
  setProductCategoryFilter,
  productStatusFilter,
  setProductStatusFilter,
  currentPage,
  setCurrentPage,
  totalProducts,
  handleProductSearchSubmit,
  handleResetFilters,
  handleDeleteProduct,
  setEditingProduct,
}: ProductManagementTabProps) {
  return (
    <div className="p-8">
      {/* 검색 및 필터 */}
      <form
        onSubmit={handleProductSearchSubmit}
        className="mb-6 flex flex-wrap items-center gap-4">
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
          onValueChange={setProductCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="카테고리 필터" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">모든 카테고리</SelectItem>
            <SelectItem value="가구/인테리어">가구/인테리어</SelectItem>
            <SelectItem value="디지털/가전">디지털/가전</SelectItem>
            <SelectItem value="생활/건강">생활/건강</SelectItem>
            <SelectItem value="스포츠/레저">스포츠/레저</SelectItem>
            <SelectItem value="식품">식품</SelectItem>
            <SelectItem value="여가/생활편의">여가/생활편의</SelectItem>
            <SelectItem value="출산/육아">출산/육아</SelectItem>
            <SelectItem value="패션의류">패션의류</SelectItem>
            <SelectItem value="패션잡화">패션잡화</SelectItem>
            <SelectItem value="화장품/미용">화장품/미용</SelectItem>
          </SelectContent>
        </Select>
        {/* 상태 필터 */}
        <Select
          value={productStatusFilter}
          onValueChange={setProductStatusFilter}>
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
        <Button type="button" variant="outline" onClick={handleResetFilters}>
          초기화
        </Button>
        <Button
          variant="outline"
          className="border-purple-200 text-brand-orange hover:bg-orange-50">
          <Sparkles className="mr-2 h-4 w-4" />
          AI 상품 설명 생성
        </Button>
      </form>

      {/* AI 가격 추천 카드 */}
      <Card className="mb-6 border-gray-200 bg-brand-main p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-orange">
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
              <div className="rounded-lg border border-purple-200 bg-brand-main p-3">
                <p className="text-xs text-gray-600">무선 블루투스 이어폰</p>
                <p className="mt-1 text-sm">
                  <span className="font-medium text-gray-900">
                    현재가: ₩79,900
                  </span>
                  <span className="mx-2 text-gray-400">→</span>
                  <span className="font-bold text-brand-orange">
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
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    <p className="mt-2">상품 목록을 불러오는 중...</p>
                  </td>
                </tr>
              ) : productsError ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-red-500">
                    {productsError}
                  </td>
                </tr>
              ) : sellerProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
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
                        }`}>
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
                        }`}>
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
                          onClick={() => setEditingProduct(product)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProduct(product.id)}>
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
          <p className="text-sm text-gray-600">총 {totalProducts}개 상품</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || isProductsLoading}>
              이전
            </Button>
            <span className="flex items-center text-sm font-medium text-gray-700">
              {currentPage} / {Math.ceil(totalProducts / 10)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => prev + 1)}
              disabled={currentPage * 10 >= totalProducts || isProductsLoading}>
              다음
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
