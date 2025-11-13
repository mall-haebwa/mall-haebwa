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
import mallLogo from "../assets/mall5.svg";

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
    <header
      className="sticky top-0 z-50 shadow-sm"
      style={{ backgroundColor: "#f5f6fa" }}>
      <div
        className="py-1.5 text-gray-900 font-semibold"
        style={{ backgroundColor: "#f5f6fa" }}>
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

      <div className="border-b border-gray-100">
        <div className="mx-auto flex max-w-[1280px] items-center gap-8 px-6 py-3.5 md:px-8">
          {/* 동그라미 없는 버전 */}
          <button
            onClick={() => goTo("/")}
            className="transition-all hover:opacity-80 flex-shrink-0 ">
            <img
              src={mallLogo}
              style={{ width: "120px", height: "60px" }}
              alt="MALL AI 해봐"
            />
          </button>

          <div className="flex flex-1 gap-3">
            {/* 검색 탭 */}
            <div className="flex flex-1 gap-3 items-center">
              <div className="flex gap-6">
                <button
                  onClick={() => setSelectedSearchTab("rollup")}
                  className={`px-2 py-2 text-sm font-bold transition-all border-b-2 ${
                    selectedSearchTab === "rollup"
                      ? "border-blue-500 text-gray-900"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}>
                  일반검색
                </button>
                <button
                  onClick={() => setSelectedSearchTab("ai")}
                  className={`px-2 py-2 text-sm font-bold transition-all flex items-center gap-1.5 border-b-2 ${
                    selectedSearchTab === "ai"
                      ? "border-purple-600 text-gray-900"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}>
                  <Sparkles className="h-3.5 w-3.5" />
                  AI검색
                </button>
              </div>

              {/* 일반 키워드 검색 */}
              {selectedSearchTab === "rollup" && (
                <form onSubmit={handleSearch} className="flex-1">
                  <div className="relative flex items-center">
                    <Input
                      type="text"
                      placeholder="상품명, 카테고리로 검색"
                      value={searchQuery}
                      onChange={(event) =>
                        setSearchQueryInput(event.target.value)
                      }
                      className="h-11 w-full rounded-full border border-blue-500 pl-5 pr-14 bg-white focus-visible:border-cyan-500 focus-visible:ring-0 transition-all"
                    />
                    <Button
                      type="submit"
                      className="absolute right-2 h-8 w-8 rounded-full bg-gray-900 p-0 text-white hover:bg-black transition-all flex items-center justify-center">
                      <Search className="h-4 w-4" />
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
                  className="relative flex-1 flex items-center">
                  <Input
                    type="text"
                    placeholder="예: 겨울에 따뜻한 코트"
                    value={aiSearchQuery}
                    onChange={(event) => setAiSearchQuery(event.target.value)}
                    className="h-11 w-full rounded-full border border-purple-300 pl-5 pr-14 bg-white focus-visible:border-purple-500 focus-visible:ring-0 transition-all"
                  />
                  <Button
                    type="submit"
                    className="absolute right-2 h-8 w-8 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all p-0 flex items-center justify-center shadow-md shadow-purple-500/30">
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </form>
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goTo("/wishlist")}
              className="relative h-10 w-10 rounded-full hover:bg-gray-100 transition-all flex items-center justify-center">
              <Heart className="h-5 w-5 text-gray-600 hover:text-red-500" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => goTo("/cart")}
              className="relative h-10 w-10 rounded-full hover:bg-gray-100 transition-all flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-gray-600" />
              {cart.length > 0 && (
                <Badge className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center bg-gradient-to-r from-purple-600 to-pink-600 p-0 text-xs text-white font-bold shadow-lg">
                  {cart.length}
                </Badge>
              )}
            </Button>

            {currentUser ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => goTo("/mypage")}
                className="hidden h-10 px-4 text-sm md:flex items-center gap-2 rounded-full hover:bg-gray-100 transition-all">
                <User className="h-4 w-4 text-gray-600" />
                <span className="font-medium text-gray-700">
                  {currentUser.name}
                </span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => goTo("/login")}
                className="hidden h-10 px-4 text-sm md:flex rounded-full hover:bg-gray-100 transition-all font-medium text-gray-700">
                로그인
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 rounded-full md:hidden hover:bg-gray-100 transition-all flex items-center justify-center"
              onClick={() => setShowMobileMenu((prev) => !prev)}>
              <Menu className="h-5 w-5 text-gray-600" />
            </Button>
          </div>
        </div>
      </div>

      <div
        className="hidden border-b border-gray-100 md:block"
        style={{ backgroundColor: "#f5f6fa" }}>
        <div className="mx-auto flex max-w-[1280px] items-center gap-2 px-6 py-3 md:px-8">
          <div className="flex items-center gap-2 overflow-x-auto">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => handleCategoryClick(category)}
                className="px-5 py-2.5 font-semibold text-sm text-gray-700 transition-all hover:text-gray-900 border-b border-transparent hover:border-purple-600 whitespace-nowrap flex-shrink-0">
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showMobileMenu && (
        <div className="border-t border-gray-100 bg-white md:hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-6 py-5 md:px-8 space-y-3">
            {currentUser ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => goTo("/mypage")}
                  className="w-full justify-start text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-all">
                  마이페이지
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    logout();
                    setShowMobileMenu(false);
                    navigate("/");
                  }}
                  className="w-full justify-start text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-all">
                  로그아웃
                </Button>
              </>
            ) : (
              <Button
                onClick={() => goTo("/login")}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-sm font-bold text-white hover:from-purple-700 hover:to-pink-700 rounded-full transition-all py-2.5">
                로그인
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
