import { useRef, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Header } from "./components/Header";
import { HomePage } from "./components/HomePage";
import { ProductListPage } from "./components/ProductListPage";
import { ProductDetailPage } from "./components/ProductDetailPage";
import { WishlistPage } from "./components/WishlistPage";
import { CartPage } from "./components/CartPage";
import { MyPage } from "./components/MyPage";
import { LoginPage } from "./components/LoginPage";
import { SignupPage } from "./components/SignupPage";
import { OrderHistoryPage } from "./components/OrderHistoryPage";
import { AdminPage } from "./components/AdminPage";
import { AddProductPage } from "./components/AddProductPage";
import { CustomerServicePage } from "./components/CustomerServicePage";
import { Toaster } from "./components/ui/sonner";
import { AppStateProvider } from "./context/app-state";
import { HeaderVisibilityProvider, useHeaderVisibility } from "./context/header-visibility";
import { AISearchPage } from "./components/AiSearchPage";
import PaymentSuccess from "./components/PaymentSuccess"; // 결제 성공 컴포넌트
import PaymentFail from "./components/PaymentFail"; // 결제 실패 컴포넌트
import { RepeatPurchasePage } from "./components/RepeatPurchasePage";
import { RecentlyViewedPage } from "./components/RecentlyViewedPage";
import { BecomeSellerPage } from "./components/BecomeSellerPage";
import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { useAppState } from "./context/app-state";
import { PromoPage } from "./components/PromoPage";
function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return null;
}

function HeaderVisibilityManager() {
  const location = useLocation();
  const { setHideHeader } = useHeaderVisibility();

  useEffect(() => {
    // AI Search 페이지에서는 헤더 숨김, 다른 페이지에서는 표시
    const isAiSearchPage = location.pathname === "/aisearch";
    setHideHeader(isAiSearchPage);
  }, [location.pathname, setHideHeader]);

  return null;
}

type RetriableConfig = AxiosRequestConfig & {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
};

// API URL 설정 (app-state.tsx와 동일)
const API_URL =
  ((import.meta as any).env?.VITE_API_URL as string | undefined) || "";
const withBase = (path: string) => (API_URL ? `${API_URL}${path}` : path);

function useJwtRefreshInterceptor() {
  const refreshPromiseRef = useRef<Promise<unknown> | null>(null);
  const { logout } = useAppState();

  useEffect(() => {
    // axios 전역 설정: 모든 요청에 쿠키 포함
    axios.defaults.withCredentials = true;

    const client = axios;
    const interceptorId = client.interceptors.response.use(
      (res) => res,
      async (error: AxiosError) => {
        const { response } = error;
        const config = error.config as RetriableConfig | undefined;

        // 로그인/회원가입 등 인증 관련 요청은 인터셉터 건너뛰기
        if (
          !response ||
          response.status !== 401 ||
          !config ||
          config._retry ||
          config.skipAuthRefresh
        ) {
          return Promise.reject(error);
        }

        config._retry = true;

        if (!refreshPromiseRef.current) {
          refreshPromiseRef.current = client.post(
            withBase("/api/auth/refresh"),
            {},
            { withCredentials: true }
          );
        }

        try {
          await refreshPromiseRef.current;
          refreshPromiseRef.current = null;

          config.withCredentials = true;
          return client(config); //access 갱신 후 원요청 재시도
        } catch (refreshErr) {
          refreshPromiseRef.current = null;

          // refresh 실패 시 로그아웃 처리
          console.error("토큰 갱신 실패:", refreshErr);

          // Context 상태 정리 후 리다이렉트
          logout();

          // 현재 페이지가 로그인 페이지가 아닐 때만 리다이렉트
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }

          return Promise.reject(refreshErr);
        }
      }
    );

    return () => {
      client.interceptors.response.eject(interceptorId);
    };
  }, [logout]);
}

function AppRoutes() {
  useJwtRefreshInterceptor();
  const location = useLocation();

  // AI Search 페이지에서는 Header를 렌더링하지 않음 (AISearchPage에서 직접 렌더링)
  const isAiSearchPage = location.pathname === "/aisearch";
  const shouldShowHeader = !isAiSearchPage;

  return (
    <>
      <ScrollToTop />
      <HeaderVisibilityManager />
      {shouldShowHeader && <Header />}
      <main style={{ backgroundColor: "#f5f6fa" }}>
        <Routes>
          <Route path="/virus" element={<PromoPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/products" element={<ProductListPage />} />
          <Route path="/product/:productId" element={<ProductDetailPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/orders" element={<OrderHistoryPage />} />
          {/* 마이페이지용 라우트  추가 */}
          <Route path="/repeat-purchases" element={<RepeatPurchasePage />} />
          <Route path="/recently-viewed" element={<RecentlyViewedPage />} />
          {/* 마이페이지용 라우트  추가 */}
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/become-seller" element={<BecomeSellerPage />} />
          <Route path="/add-product" element={<AddProductPage />} />
          <Route path="/customer-service" element={<CustomerServicePage />} />
          <Route path="/aisearch" element={<AISearchPage />} />
          {/* 결제 성공, 실패 라우터 추가 */}
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/fail" element={<PaymentFail />} />
        </Routes>
      </main>
      <Toaster
        position="top-center"
        expand
        duration={1500}
        toastOptions={{
          style: {
            background: "#1e1e25",
            color: "#fff",
          },
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <HeaderVisibilityProvider>
        <AppRoutes />
      </HeaderVisibilityProvider>
    </AppStateProvider>
  );
}
