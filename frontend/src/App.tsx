import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Header } from "./components/Header";
import { HomePage } from "./components/HomePage";
import { ProductListPage } from "./components/ProductListPage";
import { ProductDetailPage } from "./components/ProductDetailPage";
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
          <Route path="/cart" element={<CartPage />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/orders" element={<OrderHistoryPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/add-product" element={<AddProductPage />} />
          <Route path="/customer-service" element={<CustomerServicePage />} />
          <Route path="/aisearch" element={<AISearchPage />} />
        </Routes>
      </main>
      <Toaster />
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
