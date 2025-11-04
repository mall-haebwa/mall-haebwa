import { useEffect } from "react";
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
import { AISearchPage } from "./components/AiSearchPage";
import PaymentSuccess from "./components/PaymentSuccess"; // 결제 성공 컴포넌트
import PaymentFail from "./components/PaymentFail"; // 결제 실패 컴포넌트
import { RepeatPurchasePage } from "./components/RepeatPurchasePage";
import { RecentlyViewedPage } from "./components/RecentlyViewedPage";

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return null;
}

function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Header />
      <main>
        <Routes>
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
      <AppRoutes />
    </AppStateProvider>
  );
}
