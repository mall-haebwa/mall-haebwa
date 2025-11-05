import { useState } from "react";
import { ArrowLeft, Upload, X } from "lucide-react";
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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!productName || !price || !category || !stock) {
      toast.error("Please fill in all required fields.");
      return;
    }

    toast.success("Product registered successfully.");
    navigate("/admin");
  };

  const handleAddImage = () => {
    toast.info("Image uploads will be connected later.");
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
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
          <h1 className="mb-1 text-2xl font-semibold text-gray-900">
            상품 등록
          </h1>
          <p className="text-sm text-gray-600">
            새로운 상품을 등록하고 판매를 시작하세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900">기본 정보</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="productName">
                  상품명<span className="text-red-500">*</span>
                </Label>
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
                  <Label htmlFor="price">
                    판매가<span className="text-red-500">*</span>
                  </Label>
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
                <Label htmlFor="description">
                  상세 설명<span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="상품의 특징과 장점을 자세히 작성해 주세요."
                  rows={6}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="mt-1.5"
                  required
                />
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
              <h2 className="text-lg font-semibold text-gray-900">상품 이미지</h2>
              <Button type="button" variant="outline" onClick={handleAddImage}>
                <Upload className="mr-2 h-4 w-4" />
                이미지 추가
              </Button>
            </div>
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

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/admin")}
            >
              취소
            </Button>
            <Button type="submit" className="bg-gray-900 text-white hover:bg-black">
              등록하기
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
