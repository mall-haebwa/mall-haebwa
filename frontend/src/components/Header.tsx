import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Search, ShoppingCart, Sparkles, User } from "lucide-react";
import { useAppState } from "../context/app-state";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

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

export function Header() {
  const navigate = useNavigate();
  const { currentUser, cart, logout, setSearchQuery, setSelectedCategory } =
    useAppState();
  const [searchQuery, setSearchQueryInput] = useState("");
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchCategories = async () => {
      try {
        const res = await fetch(`/api/products/categories`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];
        const topLevel = items
          .map((n: { name: string }) => n?.name)
          .filter((v: any) => typeof v === "string") as string[];
        if (isMounted) setCategories(topLevel);
      } catch (e) {
        console.error("Failed to load categories:", e);
        if (isMounted) setCategories([]);
      }
    };
    fetchCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    // 폼 제출 시 발생하는 기본 페이지 새로고침을 막는다.
    const trimmed = searchQuery.trim();
    // 입력값(searchQuery)를 trim()해서 공백제거
    if (!trimmed) return;
    setSearchQuery(trimmed);
    // 컨텍스트 저장
    setSelectedCategory("all");
    // 카테고리를 초기화해서 필터 충돌 방지
    navigate("/products");
    // 페이지 이동
  };

  const aihandleSearch = () => {
    setSearchQuery(searchQuery);
    navigate("/aisearch");
  };

  const goTo = (path: string) => {
    if (path === "/") {
      setSearchQueryInput("");
      setSearchQuery("");
    }
    // 홈으로 이동 시 쿼리 제거
    navigate(path);
    setShowMobileMenu(false);
  };

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
    setSearchQuery("");
    navigate("/products");
    setShowCategoryDropdown(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="bg-gray-900 py-1.5 text-white">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 text-xs md:px-8">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden md:inline">
              AI 자연어 검색으로 원하는 상품을 편하게 찾아보세요
            </span>
            <span className="md:hidden">AI 검색 이용해 보세요</span>
          </div>
          <div className="hidden gap-4 md:flex">
            <button
              className="hover:underline"
              onClick={() => goTo("/customer-service")}
            >
              고객센터
            </button>
            <button className="hover:underline" onClick={() => goTo("/admin")}>
              판매자센터
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <div className="mx-auto flex max-w-[1280px] items-center gap-6 px-6 py-4 md:px-8">
          <button onClick={() => goTo("/")}>
            <div className="flex items-center gap-2 px-3 py-1.5">
              <span
                className="text-xl text-gray-900"
                style={{ fontWeight: 700, letterSpacing: "-0.5px" }}
              >
                MALL<span className="text-gray-600">해봐</span>
              </span>
            </div>
          </button>

          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Input
                type="text"
                placeholder="AI 자연어 검색 '여름 원피스', '출근룩 바지' 등으로 검색해 보세요"
                value={searchQuery}
                onChange={(event) => setSearchQueryInput(event.target.value)}
                className="h-12 w-full rounded-sm border-2 border-gray-900 pl-4 pr-24 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <div className="absolute inset-y-0 right-[52px] flex items-center">
                <Badge
                  onClick={() => aihandleSearch()} // 검색어를 누르고 AI 검색을 누를 시 AI 검색 페이지로 이동하도록 추가
                  className="mx-[10px] cursor-pointer bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  AI
                </Badge>
              </div>
              <Button
                type="submit"
                className="absolute right-0 top-0 h-12 w-12 rounded-l-none rounded-r-sm bg-gray-900 p-0 text-white hover:bg-black"
              >
                <Search className="h-5 w-5" />
              </Button>
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goTo("/cart")}
              className="relative h-9"
            >
              <ShoppingCart className="h-5 w-5" />
              {cart.length > 0 && (
                <Badge className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center bg-gray-900 p-0 text-xs text-white">
                  {cart.length}
                </Badge>
              )}
            </Button>

            {currentUser ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => goTo("/mypage")}
                className="hidden h-9 text-sm md:flex"
              >
                <User className="mr-1 h-4 w-4" />
                {currentUser.name}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => goTo("/login")}
                className="hidden h-9 text-sm md:flex"
              >
                로그인
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="h-9 md:hidden"
              onClick={() => setShowMobileMenu((prev) => !prev)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="hidden border-b border-gray-100 bg-white md:block">
        <div className="mx-auto flex max-w-[1280px] items-center gap-6 px-6 py-3 text-sm md:px-8">
          <div
            className="relative"
            onMouseEnter={() => setShowCategoryDropdown(true)}
            onMouseLeave={() => setShowCategoryDropdown(false)}
          >
            <button
              onClick={() => goTo("/products")}
              className="relative cursor-pointer whitespace-nowrap transition-all hover:text-gray-900 after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:scale-x-0 after:bg-gray-900 after:transition-transform after:duration-200 hover:after:scale-x-100"
            >
              전체 카테고리
            </button>

            {showCategoryDropdown && (
              <div className="absolute left-0 top-full z-50 pt-3">
                <div className="min-w-[180px] rounded-sm border border-gray-200 bg-white py-2 shadow-lg">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => handleCategoryClick(category)}
                      className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50"
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {categories.map((category) => (
            <button
              key={category}
              onClick={() => handleCategoryClick(category)}
              className="relative cursor-pointer whitespace-nowrap transition-all hover:text-gray-900 after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:scale-x-0 after:bg-gray-900 after:transition-transform after:duration-200 hover:after:scale-x-100"
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {showMobileMenu && (
        <div className="border-t border-gray-200 bg-white md:hidden">
          <div className="px-6 py-3 md:px-8">
            {currentUser ? (
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  onClick={() => goTo("/mypage")}
                  className="w-full justify-start text-sm"
                >
                  마이페이지
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    logout();
                    setShowMobileMenu(false);
                    navigate("/");
                  }}
                  className="w-full justify-start text-sm"
                >
                  로그아웃
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => goTo("/login")}
                className="w-full bg-gray-900 text-sm text-white hover:bg-black"
              >
                로그인
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
