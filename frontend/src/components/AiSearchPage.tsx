import { useEffect, useRef, useState, useCallback } from "react";
import {
  Sparkles,
  Search,
  TrendingUp,
  Loader2,
  Package,
  ChevronDown,
  ChevronUp,
  Send,
  X,
  ImagePlus,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useAppState } from "../context/app-state";
import type { Product } from "../types";
import { ProductPreviewCard } from "./ProductPreviewCard";
import { Card } from "./ui/card";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Badge } from "./ui/badge";
import { CartPage } from "./CartPage";
import { WishlistPage } from "./WishlistPage";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  images?: string[];
};

type ContentType =
  | "idle"
  | "products"
  | "orders"
  | "comparison"
  | "cart"
  | "wishlist"
  | "multisearch"
  | "reorder";

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

interface CartItem {
  _id: string;
  id: string;
  productId: string;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
  priceSnapshot?: number;
  nameSnapshot?: string;
  imageSnapshot?: string;
  product?: Product;
}

interface WishlistItem {
  wishlist_id: string;
  product: Product;
  added_at?: string;
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
  const { currentUser, setSearchQuery, refreshCart } = useAppState();
  const [searchInput, setSearchInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [contentType, setContentType] = useState<ContentType>("idle");
  const [conversationId, setConversationId] = useState<string>("");
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const [uploadedImages, setUploadedImages] = useState<
    Array<{
      file: File;
      preview: string;
      base64?: string;
    }>
  >([]);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [isRestoringState, setIsRestoringState] = useState(false);

  // 데이터 관련 상태
  const [currentSearchQuery, setCurrentSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // 다중 검색 관련 상태
  const [multiSearchResults, setMultiSearchResults] = useState<
    Record<string, Product[]>
  >({});
  const [multiSearchQueries, setMultiSearchQueries] = useState<string[]>([]);
  const [selectedMultiCategory, setSelectedMultiCategory] =
    useState<string>("");

  // 이미지 처리 유틸리티 함수
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(",")[1];
        resolve(base64Data);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const getMimeType = (file: File): string => {
    return file.type || "image/jpeg";
  };

  const handleImageAdd = async (file: File) => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      alert("지원하지 않는 이미지 형식입니다. (JPG, PNG, WebP만 가능)");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      alert("이미지 크기는 3MB 이하여야 합니다.");
      return;
    }

    setIsProcessingImages(true);

    try {
      const preview = URL.createObjectURL(file);
      const base64 = await fileToBase64(file);

      setUploadedImages((prev) => [...prev, { file, preview, base64 }]);
    } catch (error) {
      console.error("Image processing error:", error);
      alert("이미지 처리 중 오류가 발생했습니다.");
    } finally {
      setIsProcessingImages(false);
    }
  };

  const handleImageRemove = (index: number) => {
    setUploadedImages((prev) => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  // 상태 저장 함수 (상품 페이지로 이동 전)
  const saveSearchState = useCallback(() => {
    const stateToSave = {
      messages,
      products,
      orders,
      cartItems,
      wishlistItems,
      contentType,
      currentSearchQuery,
      conversationId,
      multiSearchResults,
      multiSearchQueries,
      selectedMultiCategory,
    };
    sessionStorage.setItem("aiSearchState", JSON.stringify(stateToSave));
    console.log("[AI Search] State saved to sessionStorage");
  }, [
    messages,
    products,
    orders,
    cartItems,
    wishlistItems,
    contentType,
    currentSearchQuery,
    conversationId,
    multiSearchResults,
    multiSearchQueries,
    selectedMultiCategory,
  ]);

  // 상품 클릭 핸들러
  const handleProductClick = (productId: string) => {
    saveSearchState();
    navigate(`/product/${productId}`);
  };

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

  // 장바구니 API 호출
  const fetchCart = async () => {
    if (!currentUser) {
      setDataError("로그인이 필요합니다.");
      return;
    }

    setIsLoadingData(true);
    setDataError(null);

    try {
      const response = await fetch("/api/cart/", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("장바구니 조회에 실패했습니다.");
      }

      const data = await response.json();
      setCartItems(data.items || []);
    } catch (error) {
      console.error("장바구니 조회 오류:", error);
      setDataError("장바구니를 불러오는데 실패했습니다.");
      setCartItems([]);
    } finally {
      setIsLoadingData(false);
    }
  };

  // 찜 목록 API 호출
  const fetchWishlist = async () => {
    if (!currentUser) {
      setDataError("로그인이 필요합니다.");
      return;
    }

    setIsLoadingData(true);
    setDataError(null);

    try {
      const response = await fetch("/api/wishlist/list", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("찜 목록 조회에 실패했습니다.");
      }

      const data = await response.json();
      setWishlistItems(data.items || []);
    } catch (error) {
      console.error("찜 목록 조회 오류:", error);
      setDataError("찜 목록을 불러오는데 실패했습니다.");
      setWishlistItems([]);
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
        // 상품 검색 - Tool 결과를 직접 활용 (API 재호출 불필요)
        if (action.params?.query) {
          console.log(
            "Processing SEARCH action with query:",
            action.params.query
          );
          setCurrentSearchQuery(action.params.query);
          setContentType("products");
          setSearchQuery(action.params.query);

          // Tool 결과에 products 데이터가 포함되어 있으면 바로 사용
          if (action.params.products && Array.isArray(action.params.products)) {
            console.log(
              "Using products from Tool result:",
              action.params.products.length
            );
            setProducts(action.params.products);
            setIsLoadingData(false);
          } else {
            // 데이터가 없으면 API 호출
            fetchProducts(action.params.query);
          }
        }
        break;
      case "MULTISEARCH":
        // 다중 상품 검색 - 카테고리별 UI
        if (action.params?.queries && Array.isArray(action.params.queries)) {
          console.log(
            "Processing MULTISEARCH action with queries:",
            action.params.queries
          );
          const queries = action.params.queries as string[];
          setCurrentSearchQuery(queries.join(", "));
          setContentType("multisearch");
          setIsLoadingData(true);
          setDataError(null);
          setMultiSearchQueries(queries);
          setMultiSearchResults({});
          setSelectedMultiCategory("");

          // Tool 결과에 이미 데이터가 있으면 바로 사용 (API 재호출 불필요)
          if (
            action.params.results &&
            typeof action.params.results === "object"
          ) {
            console.log(
              "Using multi-search results from Tool:",
              action.params.results
            );
            setMultiSearchResults(action.params.results);
            if (queries.length > 0) {
              setSelectedMultiCategory(queries[0]);
            }
            setIsLoadingData(false);
            break;
          }

          // 데이터가 없으면 API 호출 (기존 방식)
          Promise.all(
            queries.map(async (q) => {
              try {
                const params = new URLSearchParams({
                  q: q,
                  page: "1",
                  limit: "20",
                });
                const response = await fetch(`/api/products/search?${params}`, {
                  credentials: "include",
                });
                if (!response.ok) return { query: q, products: [] };
                const data = await response.json();
                return { query: q, products: data.items || [] };
              } catch (error) {
                console.error(`"${q}" 검색 오류:`, error);
                return { query: q, products: [] };
              }
            })
          )
            .then((results) => {
              const resultsByCategory: Record<string, Product[]> = {};
              results.forEach(({ query, products }) => {
                resultsByCategory[query] = products;
              });
              setMultiSearchResults(resultsByCategory);
              // 첫 번째 카테고리를 기본 선택
              if (queries.length > 0) {
                setSelectedMultiCategory(queries[0]);
              }
              setIsLoadingData(false);
            })
            .catch((error) => {
              console.error("다중 상품 검색 중 오류 발생:", error);
              setDataError("다중 상품 검색 중 오류가 발생했습니다.");
              setIsLoadingData(false);
            });
        }
        break;
      case "VIEW_ORDERS":
        setContentType("orders");
        // Tool 결과에 데이터가 있으면 사용, 없으면 API 호출
        if (action.params?.orders) {
          setOrders(action.params.orders);
          setIsLoadingData(false);
        } else {
          fetchOrders();
        }
        // 에러 처리 (로그인 필요 등)
        if (action.params?.error) {
          setDataError(action.params.error);
          setIsLoadingData(false);
        }
        break;
      case "VIEW_CART":
        setContentType("cart");
        // Tool 결과에 데이터가 있으면 사용, 없으면 API 호출
        if (action.params?.items) {
          setCartItems(action.params.items);
          setIsLoadingData(false);
        } else {
          fetchCart();
        }
        // 에러 처리 (로그인 필요 등)
        if (action.params?.error) {
          setDataError(action.params.error);
          setIsLoadingData(false);
        }
        // 장바구니 카운트 업데이트 (헤더의 장바구니 뱃지)
        refreshCart();
        break;
      case "TRACK_DELIVERY":
        setContentType("orders");
        // 직접 fetchOrders 호출
        fetchOrders();
        break;
      case "VIEW_WISHLIST":
        setContentType("wishlist");
        // Tool 결과에 데이터가 있으면 사용, 없으면 API 호출
        if (action.params?.items) {
          setWishlistItems(action.params.items);
          setIsLoadingData(false);
        } else {
          fetchWishlist();
        }
        // 에러 처리 (로그인 필요 등)
        if (action.params?.error) {
          setDataError(action.params.error);
          setIsLoadingData(false);
        }
        break;
      case "VIEW_REORDER_OPTIONS":
        // 재주문 옵션 표시 - 과거 주문 상품을 상품 카드로 표시
        setContentType("reorder");
        if (action.params?.products && Array.isArray(action.params.products)) {
          console.log(
            "Processing VIEW_REORDER_OPTIONS with products:",
            action.params.products
          );
          setProducts(action.params.products);
          setCurrentSearchQuery(
            action.params.keyword
              ? `재주문: ${action.params.keyword}`
              : "재주문 옵션"
          );
          setIsLoadingData(false);
        }
        // 에러 처리
        if (action.params?.error) {
          setDataError(action.params.error);
          setIsLoadingData(false);
        }
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
    if ((!trimmed && uploadedImages.length === 0) || isLoading) {
      return;
    }
    console.log("AI search query:", trimmed);
    console.log("Images:", uploadedImages.length);

    const userMessage: ChatMessage = {
      role: "user",
      content: trimmed || "[이미지 검색]",
      images:
        uploadedImages.length > 0
          ? uploadedImages.map((img) => img.preview)
          : undefined,
    };
    setMessages((prev) => [...prev, userMessage]);
    setSearchInput("");
    setIsLoading(true);
    setIsLoadingData(true);
    setContentType("idle");

    try {
      // 이미지 데이터 준비
      const imageData = await Promise.all(
        uploadedImages.map(async (img) => ({
          mime_type: getMimeType(img.file),
          data: img.base64 || (await fileToBase64(img.file)),
        }))
      );

      const requestBody: any = {
        message: trimmed || "이 이미지와 비슷한 상품을 찾아줘",
        // user_id는 백엔드가 JWT 쿠키에서 자동 추출
        conversation_id: conversationId || undefined,
      };

      if (imageData.length > 0) {
        requestBody.images = imageData;
      }

      // 백엔드 API 호출
      const response = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("AI 응답 실패");
      }

      const data = await response.json();

      // conversation_id 저장 (localStorage에도 저장)
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
        localStorage.setItem("aiSearchConversationId", data.conversation_id);
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

      // 이미지 정리
      uploadedImages.forEach((img) => URL.revokeObjectURL(img.preview));
      setUploadedImages([]);
    } catch (error) {
      console.error("AI 검색 오류:", error);

      // 백엔드에서 전달한 에러 메시지 또는 기본 메시지
      let errorContent =
        "죄송합니다. AI 응답을 가져오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";

      if (error instanceof Error) {
        // axios 에러의 경우 response에서 메시지 추출
        const axiosError = error as any;
        if (axiosError.response?.data?.reply) {
          errorContent = axiosError.response.data.reply;
        } else if (axiosError.response?.data?.error_detail) {
          // DEBUG_MODE일 때 상세 에러
          errorContent += `\n\n상세 오류: ${axiosError.response.data.error_detail}`;
        }
      }

      const errorMessage: ChatMessage = {
        role: "assistant",
        content: errorContent,
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

  // 채팅 메시지 자동 스크롤
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // 언마운트 시 (홈으로 갈 때 등 또는 뒤로가기) 상태 저장
  useEffect(() => {
    return () => {
      console.log("[AI Search] Component unmounting, saving state");
      saveSearchState();
    };
  }, [saveSearchState]);

  // 상태 복원 (컴포넌트 마운트 시)
  useEffect(() => {
    const restoreState = async () => {
      try {
        setIsRestoringState(true);

        // 1. sessionStorage에서 먼저 복원 시도 (상품 페이지에서 돌아온 경우 또는 뒤로가기)
        const savedState = sessionStorage.getItem("aiSearchState");
        if (savedState) {
          const state = JSON.parse(savedState);

          // 상태 복원
          if (state.messages) setMessages(state.messages);
          if (state.products) setProducts(state.products);
          if (state.orders) setOrders(state.orders);
          if (state.cartItems) setCartItems(state.cartItems);
          if (state.wishlistItems) setWishlistItems(state.wishlistItems);
          if (state.contentType) setContentType(state.contentType);
          if (state.currentSearchQuery)
            setCurrentSearchQuery(state.currentSearchQuery);
          if (state.conversationId) setConversationId(state.conversationId);
          if (state.multiSearchResults)
            setMultiSearchResults(state.multiSearchResults);
          if (state.multiSearchQueries)
            setMultiSearchQueries(state.multiSearchQueries);
          if (state.selectedMultiCategory)
            setSelectedMultiCategory(state.selectedMultiCategory);

          // 복원 후 삭제
          sessionStorage.removeItem("aiSearchState");
          console.log("[AI Search] State restored from sessionStorage");
        }
        // 2. Redis에서 히스토리 복원 (임시 주석 처리)
        // localStorage에서 conversation_id 조회 후 Redis에서 복원
        // else {
        //   const savedConvId = localStorage.getItem('aiSearchConversationId');
        //   if (savedConvId && currentUser?.id) {
        //     setConversationId(savedConvId);
        //
        //     try {
        //       const response = await fetch(
        //         `/api/chat/history/${savedConvId}?user_id=${currentUser.id}`,
        //         { credentials: 'include' }
        //       );
        //
        //       if (response.ok) {
        //         const data = await response.json();
        //         if (data.messages && data.messages.length > 0) {
        //           setMessages(data.messages);
        //           console.log('[AI Search] Conversation history restored from Redis');
        //         }
        //       }
        //     } catch (error) {
        //       console.error('[AI Search] Failed to restore from Redis:', error);
        //     }
        //   }
        // }
      } catch (error) {
        console.error("[AI Search] Failed to restore state:", error);
        sessionStorage.removeItem("aiSearchState");
      } finally {
        // 다음 렌더링에서 플래그 해제
        setTimeout(() => setIsRestoringState(false), 0);
      }
    };

    restoreState();
  }, [currentUser?.id]);

  // 이미지 붙여넣기 이벤트 리스너
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) {
            await handleImageAdd(file);
          }
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  // contentType 변경 시 데이터 로드 (상태 복원 중이 아닐 때만, 그리고 데이터가 없을 때만)
  useEffect(() => {
    if (isRestoringState) return; // 복원 중이면 API 호출 안 함

    // 이미 데이터가 있으면 API 호출 안 함 (중복 로딩 방지)
    if (contentType === "products" && currentSearchQuery && products.length === 0) {
      fetchProducts(currentSearchQuery);
    } else if (contentType === "orders" && orders.length === 0) {
      fetchOrders();
    } else if (contentType === "cart" && cartItems.length === 0) {
      fetchCart();
    } else if (contentType === "wishlist" && wishlistItems.length === 0) {
      fetchWishlist();
    }
  }, [contentType, currentSearchQuery, isRestoringState]);

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
    <div className="flex h-[calc(100vh-138px)] bg-gray-50">
      {/* 좌측 결과 영역 */}
      <div
        ref={resultsContainerRef}
        className="flex-1 overflow-y-auto bg-gradient-to-b from-purple-50 via-pink-50 to-white">
        {contentType === "idle" && (
          <div className="flex h-full flex-col items-center justify-center px-6 py-12 md:px-8">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="mb-4 h-12 w-12 animate-spin text-brand-orange" />
                <span className="text-gray-600">
                  AI가 답변을 준비 중입니다...
                </span>
              </div>
            ) : (
              <>
                {/* <header className="text-center">
                  <h1 className="mb-4 text-3xl font-semibold text-gray-900 md:text-4xl">
                    AI 쇼핑 도우미
                  </h1>
                  <p className="mb-10 text-base text-gray-600 md:text-lg">
                    찾고 싶은 제품이나 고민을 자유롭게 이야기하면 AI가 맞춤
                    추천을 도와드릴게요.
                  </p>
                </header>

                <section className="mx-auto mb-10 w-full max-w-3xl">
                  검색 입력창
                  <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSearch(searchInput);
                }}
                className="mb-8 flex w-full items-center gap-3 rounded-full border-2 border-purple-200 bg-white px-4 py-2 shadow-sm">
                <Input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="h-12 flex-1 border-none bg-transparent text-base focus-visible:ring-0"
                  placeholder="무엇이든 물어보세요"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  disabled={isLoading || !searchInput.trim()}
                  className="h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-6 text-white hover:from-purple-600 hover:to-pink-600 disabled:opacity-50">
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  검색
                </Button>
              </form> */}

                {/* 예시 검색어
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
                          className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs text-gray-700 transition-colors hover:border-purple-300 hover:bg-purple-50 md:text-sm">
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                </section> */}

                {/* <section className="grid w-full max-w-3xl gap-6 text-sm text-gray-600 md:grid-cols-3">
                  <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                      <Sparkles className="h-6 w-6 text-purple-500" />
                    </div>
                    <h3 className="mb-2 text-base font-semibold text-gray-900">
                      맥락 이해 검색
                    </h3>
                    <p>
                      상황과 취향을 함께 알려주면 AI가 의도를 이해하고 맞춤형
                      제품을 찾아드려요.
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
                      지금 인기 있는 제품, 리뷰 키워드, 관련 질문 등 최신
                      데이터를 기반으로 인사이트를 제공합니다.
                    </p>
                  </div>
                </section> */}
              </>
            )}
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
                <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
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
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                {products.map((product) => (
                  <ProductPreviewCard
                    key={product.id}
                    product={product}
                    onOpen={handleProductClick}
                    rating={product.rating}
                    reviewCount={product.reviewCount}
                    originalPrice={product.originalPrice}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 재주문 옵션 */}
        {contentType === "reorder" && (
          <div className="p-6">
            <div className="mb-6">
              <h2 className="mb-2 text-2xl font-semibold text-gray-900">
                재주문 옵션
              </h2>
              {currentSearchQuery && (
                <p className="text-sm text-gray-600">{currentSearchQuery}</p>
              )}
            </div>

            {isLoadingData ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
                <span className="ml-3 text-gray-600">
                  과거 주문을 검색하고 있습니다...
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
                <p className="text-gray-600">과거 주문 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {products.map((product) => (
                  <ProductPreviewCard
                    key={product.id}
                    product={product}
                    onOpen={handleProductClick}
                    rating={product.rating}
                    reviewCount={product.reviewCount}
                    originalPrice={product.originalPrice}
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
                <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
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
                    onClick={() => navigate("/login")}>
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
                        }`}>
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

        {/* 장바구니 */}
        {contentType === "cart" && <CartPage />}

        {/* 다중 검색 결과 */}
        {contentType === "multisearch" && (
          <div className="p-6">
            {isLoadingData ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
                <span className="ml-3 text-gray-600">
                  상품을 검색하고 있습니다...
                </span>
              </div>
            ) : dataError ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Package className="mb-4 h-16 w-16 text-gray-300" />
                <p className="text-gray-600">{dataError}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 대표 상품 - 각 카테고리당 1개씩 */}
                <div className="rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 p-4">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">
                    추천 상품
                  </h3>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-8">
                    {multiSearchQueries.map((query) => {
                      const products = multiSearchResults[query] || [];
                      const representativeProduct = products[0];
                      if (!representativeProduct) return null;

                      return (
                        <ProductPreviewCard
                          key={query}
                          product={representativeProduct}
                          onOpen={handleProductClick}
                          meta={query}
                          rating={representativeProduct.rating}
                          reviewCount={representativeProduct.reviewCount}
                          originalPrice={representativeProduct.originalPrice}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* 카테고리 버튼 */}
                <div className="flex flex-wrap gap-2">
                  {multiSearchQueries.map((query) => {
                    const count = multiSearchResults[query]?.length || 0;
                    return (
                      <button
                        key={query}
                        onClick={() => setSelectedMultiCategory(query)}
                        className={`rounded-full px-5 py-1 font-medium transition-all ${
                          selectedMultiCategory === query
                            ? "bg-brand-orange text-white shadow-md"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}>
                        {query} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* 선택된 카테고리의 상품 목록 */}
                {selectedMultiCategory && (
                  <div>
                    <h3 className="mb-4 text-xl font-semibold text-gray-900">
                      {selectedMultiCategory} 상품 (
                      {multiSearchResults[selectedMultiCategory]?.length || 0}
                      개)
                    </h3>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                      {(multiSearchResults[selectedMultiCategory] || []).map(
                        (product) => (
                          <ProductPreviewCard
                            key={product.id}
                            product={product}
                            onOpen={handleProductClick}
                            rating={product.rating}
                            reviewCount={product.reviewCount}
                            originalPrice={product.originalPrice}
                          />
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* 결과가 없을 때 */}
                {multiSearchQueries.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Package className="mb-4 h-16 w-16 text-gray-300" />
                    <p className="text-gray-600">검색 결과가 없습니다.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 찜 목록 */}
        {contentType === "wishlist" && <WishlistPage />}
      </div>

      {/* 우측 채팅 영역 */}
      <div className="flex w-[400px] flex-col border-l border-gray-200 bg-white">
        {/* 채팅 메시지 영역 */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          ref={chatContainerRef}>
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}>
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    msg.role === "user"
                      ? "text-gray-900"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  style={
                    msg.role === "user"
                      ? { backgroundColor: "#f2641d", color: "#fff" }
                      : {}
                  }>
                  {msg.role === "assistant" && (
                    <div className="mb-2 flex items-center gap-2">
                      <div
                        className="flex h-5 w-5 items-center justify-center rounded-full"
                        style={{
                          background:
                            "linear-gradient(to right, #f2641d, #fff)",
                        }}>
                        <Sparkles className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-xs text-gray-500">
                        AI 어시스턴트
                      </span>
                    </div>
                  )}
                  {msg.images && msg.images.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {msg.images.map((imgUrl, imgIdx) => (
                        <img
                          key={imgIdx}
                          src={imgUrl}
                          alt={`Message image ${imgIdx + 1}`}
                          className="h-20 w-20 rounded object-cover"
                        />
                      ))}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-gray-100 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded-full"
                      style={{
                        background: "linear-gradient(to right, #f2641d, #fff)",
                      }}>
                      <Sparkles className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-xs text-gray-500">AI 어시스턴트</span>
                  </div>
                  <div className="flex gap-1">
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                      style={{ animationDelay: "0ms" }}
                    />
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                      style={{ animationDelay: "150ms" }}
                    />
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 입력창 영역 */}
        <div className="border-t border-gray-200 bg-white p-4">
          {uploadedImages.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {uploadedImages.map((img, index) => (
                <div
                  key={index}
                  className="relative h-16 w-16 rounded-lg overflow-hidden"
                  style={{ border: "2px solid #f2641d" }}>
                  <img
                    src={img.preview}
                    alt={`Upload ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <button
                    onClick={() => handleImageRemove(index)}
                    className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchInput.trim() || uploadedImages.length > 0) {
                handleSearch(searchInput.trim());
              }
            }}
            className="flex flex-col gap-2">
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    files.forEach((file) => handleImageAdd(file));
                    e.target.value = "";
                  }}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-10 p-0"
                  disabled={isLoading || isProcessingImages}
                  asChild>
                  <span>
                    <ImagePlus className="h-4 w-4" />
                  </span>
                </Button>
              </label>

              <Input
                type="text"
                placeholder={
                  uploadedImages.length > 0
                    ? "이미지에 대해 설명해주세요..."
                    : "메시지를 입력하세요..."
                }
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-10 flex-1"
              />
            </div>

            <Button
              type="submit"
              disabled={
                (!searchInput.trim() && uploadedImages.length === 0) ||
                isLoading
              }
              className="h-10 w-full text-gray-900 bg-brand-orange">
              <Send className="mr-2 h-4 w-4" />
              전송
            </Button>
          </form>

          <p className="mt-2 text-xs text-gray-500 text-center">
            Ctrl+V로 이미지 붙여넣기
          </p>
        </div>
      </div>
    </div>
  );
}
