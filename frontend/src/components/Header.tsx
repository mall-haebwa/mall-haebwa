import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  Search,
  ShoppingCart,
  Sparkles,
  User,
  Heart,
} from "lucide-react";
import { useAppState } from "../context/app-state";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function Header() {
  const navigate = useNavigate();
  const { currentUser, cart, logout, setSearchQuery, setSelectedCategory } =
    useAppState();
  const [searchQuery, setSearchQueryInput] = useState("");
  const [aiSearchQuery, setAiSearchQuery] = useState(""); // 추가
  const [selectedSearchTab, setSelectedSearchTabState] = useState<
    "rollup" | "ai"
  >(() => {
    // localStorage에서 사용자의 마지막 탭 선택 기억
    const saved = localStorage.getItem("selectedSearchTab");
    return (saved as "rollup" | "ai") || "ai";
  });

  // localStorage에 저장과 상태 업데이트를 한 번에 처리
  const setSelectedSearchTab = (value: "rollup" | "ai") => {
    setSelectedSearchTabState(value);
    localStorage.setItem("selectedSearchTab", value);
  };

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

  const goTo = (path: string) => {
    if (path === "/") {
      setSearchQueryInput("");
      setSearchQuery("");
      setAiSearchQuery(""); // AI 검색 입력창도 초기화
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
              onClick={() => goTo("/customer-service")}>
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
                style={{ fontWeight: 700, letterSpacing: "-0.5px" }}>
                MALL<span className="text-gray-600">해봐</span>
              </span>
            </div>
          </button>

          <div className="flex flex-1 gap-3">
            {/* 검색 탭 */}
            <div className="flex flex-1 gap-3 items-center">
              <div className="flex gap-0 border border-gray-300 rounded-lg  overflow-hidden">
                <button
                  onClick={() => setSelectedSearchTab("rollup")}
                  className={`px-4 py-2 text-sm font-medium transition-all ${
                    selectedSearchTab === "rollup"
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-900 hover:bg-gray-100"
                  }`}>
                  일반검색
                </button>
                <div className="w-px bg-gray-300" />
                <button
                  onClick={() => setSelectedSearchTab("ai")}
                  className={`px-4 py-2 text-sm font-medium transition-all flex items-center gap-1 ${
                    selectedSearchTab === "ai"
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                      : "bg-white text-gray-900 hover:bg-gray-100"
                  }`}>
                  <Sparkles className="h-4 w-4" />
                  AI검색
                </button>
              </div>

              {/* 일반 키워드 검색 */}
              {selectedSearchTab === "rollup" && (
                <form onSubmit={handleSearch} className="flex-1">
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="키워드 검색"
                      value={searchQuery}
                      onChange={(event) =>
                        setSearchQueryInput(event.target.value)
                      }
                      className="h-12 w-full rounded-lg border-2 border-gray-300 pl-4 pr-12 focus-visible:border-gray-900 focus-visible:ring-0"
                    />
                    <Button
                      type="submit"
                      className="absolute right-0 top-0 h-12 w-12 rounded-l-none rounded-r-lg bg-gray-900 p-0 text-white hover:bg-black">
                      <Search className="h-5 w-5" />
                    </Button>
                  </div>
                </form>
              )}

              {/* AI 검색 */}
              {selectedSearchTab === "ai" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (aiSearchQuery.trim()) {
                      setSearchQuery(aiSearchQuery);
                      navigate("/aisearch", {
                        state: { query: aiSearchQuery.trim() },
                      });
                      setAiSearchQuery("");
                    }
                  }}
                  className="relative flex-1">
                  <Input
                    type="text"
                    placeholder="AI 자연어 검색"
                    value={aiSearchQuery}
                    onChange={(event) => setAiSearchQuery(event.target.value)}
                    className="h-12 w-full rounded-lg border-2 border-purple-300 pl-4 pr-32 focus-visible:border-purple-500 focus-visible:ring-0"
                  />
                  <Button
                    type="submit"
                    className="absolute right-0 top-0 h-12 rounded-l-none rounded-r-lg bg-gradient-to-r from-purple-500 to-pink-500 px-6 text-white hover:from-purple-600 hover:to-pink-600">
                    <Sparkles className="mr-2 h-4 w-4" />
                    AI 검색
                  </Button>
                </form>
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goTo("/wishlist")}
              className="relative h-9">
              <Heart className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => goTo("/cart")}
              className="relative h-9">
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
                className="hidden h-9 text-sm md:flex">
                <User className="mr-1 h-4 w-4" />
                {currentUser.name}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => goTo("/login")}
                className="hidden h-9 text-sm md:flex">
                로그인
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="h-9 md:hidden"
              onClick={() => setShowMobileMenu((prev) => !prev)}>
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
            onMouseLeave={() => setShowCategoryDropdown(false)}>
            <button
              onClick={() => goTo("/products")}
              className="relative cursor-pointer whitespace-nowrap transition-all hover:text-gray-900 after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:scale-x-0 after:bg-gray-900 after:transition-transform after:duration-200 hover:after:scale-x-100">
              전체 카테고리
            </button>

            {showCategoryDropdown && (
              <div className="absolute left-0 top-full z-50 pt-3">
                <div className="min-w-[180px] rounded-sm border border-gray-200 bg-white py-2 shadow-lg">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => handleCategoryClick(category)}
                      className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50">
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
              className="relative cursor-pointer whitespace-nowrap transition-all hover:text-gray-900 after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:scale-x-0 after:bg-gray-900 after:transition-transform after:duration-200 hover:after:scale-x-100">
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
                  className="w-full justify-start text-sm">
                  마이페이지
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    logout();
                    setShowMobileMenu(false);
                    navigate("/");
                  }}
                  className="w-full justify-start text-sm">
                  로그아웃
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => goTo("/login")}
                className="w-full bg-gray-900 text-sm text-white hover:bg-black">
                로그인
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
