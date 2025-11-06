import { useEffect, useRef, useState } from "react";
import { Sparkles, Search, TrendingUp, Loader2, Package } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useAppState } from "../context/app-state";
import type { Product } from "../types";
import { ProductPreviewCard } from "./ProductPreviewCard";
import { Card } from "./ui/card";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Badge } from "./ui/badge";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ContentType = "idle" | "products" | "orders" | "comparison";

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  image_url?: string;
  selected_color?: string;
  selected_size?: string;
}

interface Order {
  order_id: string;
  amount: number;
  order_name: string;
  customer_name: string;
  items?: OrderItem[];
  status: string;
  payment_method: string;
  approved_at: string;
  created_at: string;
}

const EXAMPLE_SEARCHES = [
  "다가오는 휴가를 위한 수영복 추천",
  "홈 오피스를 감각 있게 꾸미고 싶어요",
  "부모님 선물로 좋은 건강식품 알려줘",
  "최신 게임용 노트북 뭐가 좋아?",
  "겨울 아우터 트렌드가 궁금해",
  "마라톤 입문자를 위한 러닝화 찾아줘",
];

export function AISearchPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, setSearchQuery } = useAppState();
  const [searchInput, setSearchInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [contentType, setContentType] = useState<ContentType>("idle");
  const [conversationId, setConversationId] = useState<string>("");
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 데이터 관련 상태
  const [currentSearchQuery, setCurrentSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const isChatting = messages.length > 0;

  // 상품 검색 API 호출
  const fetchProducts = async (query: string) => {
    if (!query.trim()) return;

    setIsLoadingData(true);
    setDataError(null);

    try {
      const params = new URLSearchParams({
        q: query,
        page: "1",
        limit: "20",
      });

      const response = await fetch(`/api/products/search?${params}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("상품 검색에 실패했습니다.");
      }

      const data = await response.json();
      setProducts(data.items || []); // data.products 대신 data.items를 사용하도록 수정
    } catch (error) {
      console.error("상품 검색 오류:", error);
      setDataError("상품을 불러오는데 실패했습니다.");
      setProducts([]);
    } finally {
      setIsLoadingData(false);
    }
  };

  // 주문 내역 API 호출
  const fetchOrders = async () => {
    if (!currentUser) {
      setDataError("로그인이 필요합니다.");
      return;
    }

    setIsLoadingData(true);
    setDataError(null);

    try {
      const response = await fetch("/api/orders", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("주문 내역 조회에 실패했습니다.");
      }

      const data = await response.json();
      setOrders(data || []);
    } catch (error) {
      console.error("주문 내역 조회 오류:", error);
      setDataError("주문 내역을 불러오는데 실패했습니다.");
      setOrders([]);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Action 처리 함수
  const handleAction = (action: any) => {
    if (!action || !action.type) return;

    console.log("Action received:", action);

    switch (action.type) {
      case "SEARCH":
        // 상품 검색
        if (action.params?.query) {
          console.log(
            "Processing SEARCH action with query:",
            action.params.query
          );
          setCurrentSearchQuery(action.params.query);
          setContentType("products");
          setSearchQuery(action.params.query);
          // 직접 fetchProducts 호출 (useEffect 의존성 이슈 방지)
          fetchProducts(action.params.query);
        }
        break;
      case "VIEW_ORDERS":
        setContentType("orders");
        // 직접 fetchOrders 호출
        fetchOrders();
        break;
      case "VIEW_CART":
        navigate("/cart");
        break;
      case "TRACK_DELIVERY":
        setContentType("orders");
        // 직접 fetchOrders 호출
        fetchOrders();
        break;
      case "VIEW_WISHLIST":
        navigate("/wishlist");
        break;
      case "CHAT":
      case "ERROR":
      default:
        // 기본적으로는 idle 상태 유지
        break;
    }
  };

  const handleSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || isLoading) {
      return;
    }
    console.log("AI search query:", trimmed);

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setSearchInput("");
    setIsLoading(true);

    try {
      // 백엔드 API 호출
      const response = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          user_id: currentUser?.id,
          conversation_id: conversationId || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("AI 응답 실패");
      }

      const data = await response.json();

      // conversation_id 저장
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      const assistantReply: ChatMessage = {
        role: "assistant",
        content: data.reply || "응답을 받지 못했습니다.",
      };
      setMessages((prev) => [...prev, assistantReply]);

      // Action 처리
      if (data.action) {
        handleAction(data.action);
      }
    } catch (error) {
      console.error("AI 검색 오류:", error);
      const errorMessage: ChatMessage = {
        role: "assistant",
        content:
          "죄송합니다. AI 응답을 가져오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setSearchInput(example);
    handleSearch(example);
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  // contentType 변경 시 데이터 로드
  useEffect(() => {
    if (contentType === "products" && currentSearchQuery) {
      fetchProducts(currentSearchQuery);
    } else if (contentType === "orders") {
      fetchOrders();
    }
  }, [contentType, currentSearchQuery]);

  // Header에서 전달된 검색어 자동 실행
  useEffect(() => {
    const state = location.state as { query?: string } | null;
    if (state?.query) {
      // location.state에서 전달된 검색어로 AI 챗 실행
      handleSearch(state.query);
      // state 초기화 (뒤로가기 시 중복 실행 방지)
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location]);

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col bg-gray-50 md:flex-row">
      {/* 좌측 메인 컨텐츠 영역 - 모바일에서는 메시지가 없을 때만 표시 */}
      <div
        className={`flex-1 overflow-y-auto bg-gradient-to-b from-purple-50 via-pink-50 to-white ${
          messages.length > 0 ? "hidden md:block" : "block md:block"
        }`}
      >
        {contentType === "idle" && (
          <div className="flex h-full flex-col items-center justify-center px-6 py-12 md:px-8">
            <header className="text-center">
              <h1 className="mb-4 text-3xl font-semibold text-gray-900 md:text-4xl">
                AI 쇼핑 도우미
              </h1>
              <p className="mb-10 text-base text-gray-600 md:text-lg">
                찾고 싶은 제품이나 고민을 자유롭게 이야기하면 AI가 맞춤 추천을
                도와드릴게요.
              </p>
            </header>

            <section className="mx-auto mb-10 w-full max-w-3xl">
              {/* 검색 입력창 */}
              <div className="mb-8 flex w-full items-center gap-3 rounded-full border-2 border-purple-200 bg-white px-4 py-2 shadow-sm">
                <Input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSearch(searchInput);
                    }
                  }}
                  className="h-12 flex-1 border-none bg-transparent text-base focus-visible:ring-0"
                  placeholder="무엇이든 물어보세요"
                  disabled={isLoading}
                />
                <Button
                  onClick={() => handleSearch(searchInput)}
                  disabled={isLoading || !searchInput.trim()}
                  className="h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-6 text-white hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  검색
                </Button>
              </div>

              {/* 예시 검색어 */}
              <div>
                <div className="mb-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                  <TrendingUp className="h-4 w-4" />
                  <span>요즘 이런 질문이 많아요</span>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {EXAMPLE_SEARCHES.map((example) => (
                    <button
                      key={example}
                      onClick={() => handleExampleClick(example)}
                      className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs text-gray-700 transition-colors hover:border-purple-300 hover:bg-purple-50 md:text-sm"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid w-full max-w-3xl gap-6 text-sm text-gray-600 md:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                  <Sparkles className="h-6 w-6 text-purple-500" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-gray-900">
                  맥락 이해 검색
                </h3>
                <p>
                  상황과 취향을 함께 알려주면 AI가 의도를 이해하고 맞춤형 제품을
                  찾아드려요.
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-pink-100">
                  <Search className="h-6 w-6 text-pink-500" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-gray-900">
                  섬세한 추천
                </h3>
                <p>
                  가격대, 취향, 선호 브랜드 등 원하는 조건을 조합해 세밀한
                  추천을 받아보세요.
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                  <TrendingUp className="h-6 w-6 text-purple-500" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-gray-900">
                  트렌드 분석
                </h3>
                <p>
                  지금 인기 있는 제품, 리뷰 키워드, 관련 질문 등 최신 데이터를
                  기반으로 인사이트를 제공합니다.
                </p>
              </div>
            </section>
          </div>
        )}

        {contentType === "products" && (
          <div className="p-6">
            <div className="mb-6">
              <h2 className="mb-2 text-2xl font-semibold text-gray-900">
                검색 결과
              </h2>
              {currentSearchQuery && (
                <p className="text-sm text-gray-600">
                  &quot;{currentSearchQuery}&quot;에 대한 검색 결과
                </p>
              )}
            </div>

            {isLoadingData ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                <span className="ml-3 text-gray-600">
                  상품을 검색하고 있습니다...
                </span>
              </div>
            ) : dataError ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Package className="mb-4 h-16 w-16 text-gray-300" />
                <p className="text-gray-600">{dataError}</p>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Package className="mb-4 h-16 w-16 text-gray-300" />
                <p className="text-gray-600">검색 결과가 없습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {products.map((product) => (
                  <ProductPreviewCard
                    key={product.id}
                    product={product}
                    onOpen={(productId) => navigate(`/product/${productId}`)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {contentType === "orders" && (
          <div className="p-6">
            <h2 className="mb-6 text-2xl font-semibold text-gray-900">
              주문 내역
            </h2>

            {isLoadingData ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                <span className="ml-3 text-gray-600">
                  주문 내역을 불러오고 있습니다...
                </span>
              </div>
            ) : dataError ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Package className="mb-4 h-16 w-16 text-gray-300" />
                <p className="text-gray-600">{dataError}</p>
                {!currentUser && (
                  <Button
                    className="mt-4 bg-gray-900 text-white hover:bg-black"
                    onClick={() => navigate("/login")}
                  >
                    로그인하기
                  </Button>
                )}
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Package className="mb-4 h-16 w-16 text-gray-300" />
                <p className="text-gray-600">주문 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.order_id} className="p-6">
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {order.order_name}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                          주문일:{" "}
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge
                        className={`${
                          order.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : order.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {order.status}
                      </Badge>
                    </div>

                    {order.items && order.items.length > 0 && (
                      <div className="space-y-3 border-t pt-4">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex gap-3">
                            {item.image_url && (
                              <ImageWithFallback
                                src={item.image_url}
                                alt={item.product_name}
                                className="h-16 w-16 rounded object-cover"
                              />
                            )}
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {item.product_name}
                              </p>
                              <p className="mt-1 text-xs text-gray-500">
                                {item.quantity}개 ·{" "}
                                {item.price.toLocaleString()}원
                              </p>
                              {(item.selected_color || item.selected_size) && (
                                <p className="mt-1 text-xs text-gray-500">
                                  {item.selected_color &&
                                    `색상: ${item.selected_color}`}
                                  {item.selected_color &&
                                    item.selected_size &&
                                    " · "}
                                  {item.selected_size &&
                                    `사이즈: ${item.selected_size}`}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between border-t pt-4">
                      <span className="text-sm text-gray-600">총 결제금액</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {order.amount.toLocaleString()}원
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {contentType === "comparison" && (
          <div className="p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">
              상품 비교
            </h2>
            <div className="flex flex-col items-center justify-center py-20">
              <Package className="mb-4 h-16 w-16 text-gray-300" />
              <p className="text-gray-600">상품 비교 기능은 준비 중입니다.</p>
            </div>
          </div>
        )}
      </div>

      {/* 우측 AI 채팅 사이드바 - 모바일에서는 메시지가 있을 때만 표시 */}
      <div
        className={`flex h-[calc(100vh-80px)] w-full flex-col border-gray-200 bg-white shadow-lg md:w-[400px] md:border-l ${
          messages.length === 0 ? "hidden md:flex" : "flex"
        }`}
      >
        {/* 채팅 헤더 */}
        <div className="border-b border-gray-200 bg-gradient-to-r from-purple-500 to-pink-500 p-4">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5" />
            <h2 className="text-lg font-semibold">AI 어시스턴트</h2>
          </div>
          <p className="mt-1 text-sm text-purple-100">무엇이든 물어보세요</p>
        </div>

        {/* 채팅 메시지 영역 */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-gray-500">
              <Sparkles className="mb-3 h-12 w-12 text-gray-300" />
              <p className="text-sm">
                채팅을 시작하려면
                <br />
                아래에 메시지를 입력하세요
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      message.role === "user"
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl bg-gray-100 px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>AI가 답변을 생성하고 있습니다...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 채팅 입력 영역 */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSearch(searchInput);
                }
              }}
              className="h-10 rounded-full border-gray-300 text-sm focus-visible:ring-purple-500"
              placeholder="메시지를 입력하세요..."
              disabled={isLoading}
            />
            <Button
              onClick={() => handleSearch(searchInput)}
              disabled={isLoading || !searchInput.trim()}
              className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 p-0 text-white hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
