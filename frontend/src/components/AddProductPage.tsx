import { useState } from "react";
import { ArrowLeft, Upload, X, Sparkles, Loader2, Wand2, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import { parse } from "path";

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

export function AddProductPage() {
  const navigate = useNavigate();
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [stock, setStock] = useState("");
  const [description, setDescription] = useState("");
  const [colors, setColors] = useState("");
  const [sizes, setSizes] = useState("");
  const [images, setImages] = useState<string[]>([]);

  // AI 기능 관련 상태
  const [aiMode, setAiMode] = useState(false);
  const [generatingField, setGeneratingField] = useState<string | null>(null);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!productName || !price || !category || !stock) {
      toast.error("필수 항목을 입력해주세요.");
      return;
    }

    try {
      const reponse = await fetch("/api/seller/products", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: productName,
          brand: brand || null,
          category1: category,
          numericPrice: parseInt(price),
          hprice: originalPrice ? parseInt(originalPrice) : null,
          description: description || null,
          stock: parseInt(stock),
          colors: colors ? colors.split(",").map((c) => c.trim()) : [],
          sizes: sizes ? sizes.split(",").map((s) => s.trim()) : [],
          images: images,
        }),
      });

      if (!reponse.ok) {
        const error = await reponse.json();
        throw new Error(error.detail || "상품 등록에 실패했습니다.");
      }

      const createdProduct = await reponse.json();
      console.log("등록된 상품:", createdProduct);

      toast.success("상품이 성공적으로 등록되었습니다!");
      navigate("/admin");
    } catch (error) {
      console.error("상품 등록 오류:", error);
      toast.error(
        error instanceof Error ? error.message : "상품 등록에 실패했습니다."
      );
    }
  };

  const handleAddImage = async () => {
    // 파일 선택 input 생성
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;

    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      toast.info(`${files.length}개의 이미지를 업로드 중...`);

      try {
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
          setImages((prev) => [...prev, data.image_url]);
        }

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

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // AI 자동 생성 함수들
  const generateProductName = async () => {
    setGeneratingField("productName");
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const suggestions = [
      "프리미엄 여름 린넨 반팔 셔츠 - 시원하고 편안한",
      "데일리 베이직 린넨 반팔 티셔츠",
      "여름 필수템 시원한 린넨 반팔",
    ];
    const selected = suggestions[0];
    setProductName(selected);
    setGeneratingField(null);
    toast.success("AI가 상품명을 생성했습니다!");
  };

  const generateDescription = async () => {
    setGeneratingField("description");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const generatedDesc = `${
      productName || "이 상품"
    }은 고품질 소재로 제작되어 뛰어난 내구성과 편안함을 자랑합니다.

주요 특징:
• 프리미엄 소재 사용으로 오래 사용 가능
• 세련된 디자인으로 다양한 스타일 연출
• 편안한 착용감으로 일상생활에 최적
• 세탁이 간편하고 관리가 쉬움

${
  category ? `${category} 카테고리의 베스트셀러 아이템으로, ` : ""
}언제 어디서나 스타일리시한 룩을 완성할 수 있습니다.`;

    setDescription(generatedDesc);
    setGeneratingField(null);
    toast.success("AI가 상세 설명을 생성했습니다!");
  };

  const recommendPrice = async () => {
    setGeneratingField("price");
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 카테고리별 가격 추천 (목업)
    const priceMap: Record<string, { price: number; original: number }> = {
      패션의류: { price: 29900, original: 45000 },
      뷰티: { price: 24900, original: 35000 },
      식품: { price: 15900, original: 19900 },
      "생활/주방": { price: 19900, original: 29900 },
      가전디지털: { price: 89900, original: 129000 },
      "스포츠/레저": { price: 39900, original: 59000 },
    };

    const recommended = priceMap[category] || { price: 29900, original: 39900 };
    setPrice(recommended.price.toString());
    setOriginalPrice(recommended.original.toString());
    setGeneratingField(null);
    toast.success("AI가 최적 가격을 추천했습니다!");
  };

  const analyzeImageAndFill = async () => {
    if (images.length === 0) {
      toast.error("먼저 이미지를 업로드해주세요.");
      return;
    }

    setGeneratingField("imageAnalysis");

    try {
      const response = await fetch("/api/seller/ai/generate-description", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_urls: images,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "AI 분석 실패");
      }

      const result = await response.json();
      const data = result.data;

      // AI가 생성한 데이터로 폼 채우기
      if (data.title) setProductName(data.title);
      if (data.category) setCategory(data.category);
      if (data.brand) setBrand(data.brand);
      if (data.suggested_price) setPrice(data.suggested_price.toString());
      if (data.description) setDescription(data.description);
      if (data.colors && data.colors.length > 0) {
        setColors(data.colors.join(", "));
      }
      if (data.sizes && data.sizes.length > 0) {
        setSizes(data.sizes.join(", "));
      }

      setGeneratingField(null);
      setShowAiSuggestions(true);
      toast.success("이미지를 분석하여 상품 정보를 자동으로 채웠습니다!");
    } catch (error) {
      console.error("AI 분석 오류:", error);
      setGeneratingField(null);
      toast.error(
        error instanceof Error ? error.message : "AI 분석에 실패했습니다"
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1000px] px-6 py-6 md:px-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin")}
            className="mb-4 -ml-2 flex items-center gap-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            돌아가기
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="mb-1 text-2xl font-semibold text-gray-900">
                상품 등록
              </h1>
              <p className="text-sm text-gray-600">
                새로운 상품을 편하게 등록하고 판매를 시작하세요.
              </p>
            </div>
            {/* AI 모드 토글 */}
            <div className="flex items-center gap-3 rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 px-4 py-3">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-900">
                  AI 자동 완성 모드
                </span>
                <span className="text-xs text-gray-600">
                  {aiMode ? "AI가 자동으로 채워줍니다" : "수동으로 입력합니다"}
                </span>
              </div>
              <Switch checked={aiMode} onCheckedChange={setAiMode} />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900">기본 정보</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="productName">
                    상품명<span className="text-red-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={generateProductName}
                    disabled={generatingField === "productName"}
                    className="h-8 gap-2 text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                  >
                    {generatingField === "productName" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        생성 중...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        AI 생성
                      </>
                    )}
                  </Button>
                </div>
                <Input
                  id="productName"
                  placeholder="예) 여름 린넨 반팔 셔츠"
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                  className="mt-1.5"
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="category">
                    카테고리<span className="text-red-500">*</span>
                  </Label>
                  <Select value={category} onValueChange={setCategory} required>
                    <SelectTrigger id="category" className="mt-1.5">
                      <SelectValue placeholder="선택해 주세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="brand">브랜드</Label>
                  <Input
                    id="brand"
                    placeholder="예) 베이직코드"
                    value={brand}
                    onChange={(event) => setBrand(event.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="price">
                      판매가<span className="text-red-500">*</span>
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={recommendPrice}
                      disabled={!category || generatingField === "price"}
                      className="h-8 gap-2 text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                    >
                      {generatingField === "price" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          추천 중...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          AI 추천
                        </>
                      )}
                    </Button>
                  </div>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    placeholder="예) 29000"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    className="mt-1.5"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="originalPrice">정가</Label>
                  <Input
                    id="originalPrice"
                    type="number"
                    min={0}
                    placeholder="예) 45000"
                    value={originalPrice}
                    onChange={(event) => setOriginalPrice(event.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="stock">
                    재고<span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="stock"
                    type="number"
                    min={0}
                    placeholder="예) 150"
                    value={stock}
                    onChange={(event) => setStock(event.target.value)}
                    className="mt-1.5"
                    required
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900">상품 설명</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="description">
                    상세 설명<span className="text-red-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={generateDescription}
                    disabled={generatingField === "description"}
                    className="h-8 gap-2 text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                  >
                    {generatingField === "description" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        생성 중...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        AI 생성
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  id="description"
                  placeholder="상품의 특징과 장점을 자세히 작성해 주세요."
                  rows={8}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="mt-1.5"
                  required
                />
                {description && (
                  <p className="mt-1 text-xs text-gray-500">
                    {description.length}자 / AI가 생성한 내용은 자유롭게 수정
                    가능합니다
                  </p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="colors">컬러 옵션</Label>
                  <Input
                    id="colors"
                    placeholder="예) 화이트, 블랙, 블루"
                    value={colors}
                    onChange={(event) => setColors(event.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="sizes">사이즈</Label>
                  <Input
                    id="sizes"
                    placeholder="예) S, M, L, XL"
                    value={sizes}
                    onChange={(event) => setSizes(event.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                상품 이미지
              </h2>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={analyzeImageAndFill}
                  disabled={
                    images.length === 0 || generatingField === "imageAnalysis"
                  }
                  className="gap-2 border-purple-200 text-purple-600 hover:bg-purple-50"
                >
                  {generatingField === "imageAnalysis" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      분석 중...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      이미지로 전체 자동 분석
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddImage}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  이미지 추가
                </Button>
              </div>
            </div>

            {/* AI 분석 안내 */}
            {images.length === 0 && (
              <div className="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 shrink-0 text-purple-600" />
                  <div>
                    <p className="mb-1 text-sm font-semibold text-gray-900">
                      AI 이미지 분석 기능
                    </p>
                    <p className="text-xs text-gray-700">
                      상품 이미지를 업로드하면 AI가 이미지를 분석하여 상품명,
                      카테고리, 색상, 설명 등을 자동으로 채워드립니다. 생성된
                      내용은 언제든지 수정 가능합니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {images.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
                이미지 업로드 기능은 추후 연동 예정입니다.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {images.map((image, index) => (
                  <div
                    key={image}
                    className="relative overflow-hidden rounded border border-gray-200"
                  >
                    <img
                      src={image}
                      alt={`상품 이미지 ${index + 1}`}
                      className="h-40 w-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-7 w-7 bg-white/80"
                      onClick={() => handleRemoveImage(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* AI 제안 사이드 패널 */}
          {showAiSuggestions && (
            <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    AI 추천 사항
                  </h3>
                  <p className="text-sm text-gray-600">
                    AI가 분석한 내용을 확인하고 필요시 수정하세요
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAiSuggestions(false)}
                  className="ml-auto"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border border-purple-200 bg-white p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-gray-900">
                      이미지 분석 완료
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    상품 이미지를 분석하여 자동으로 정보를 채웠습니다. 각 필드를
                    확인하고 필요한 부분을 수정해주세요.
                  </p>
                </div>

                <div className="rounded-lg border border-purple-200 bg-white p-4">
                  <p className="mb-2 text-xs font-semibold text-gray-900">
                    추가 제안
                  </p>
                  <ul className="space-y-1 text-xs text-gray-600">
                    <li>
                      • 상품 설명에 소재 정보를 추가하면 고객 신뢰도가
                      높아집니다
                    </li>
                    <li>
                      • 사이즈 가이드를 상세히 작성하면 반품률이 감소합니다
                    </li>
                    <li>• 추천 가격은 시장 평균 대비 적정한 수준입니다</li>
                  </ul>
                </div>
              </div>
            </Card>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/admin")}
            >
              취소
            </Button>
            <Button
              type="submit"
              className="bg-gray-900 text-white hover:bg-black"
            >
              등록하기
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
