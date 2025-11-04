import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartItem, User } from "../types";
import axios from "axios";

interface AppStateValue {
  currentUser: User | null;
  login: (user: User) => void;
  logout: () => void;
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  updateCartItem: (index: number, quantity: number) => void;
  removeFromCart: (index: number) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const AppStateContext = createContext<AppStateValue | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // 앱 시작 시 로그인 상태 복구
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await axios.get(`${API_URL}/api/auth/me`, {
          withCredentials: true,
        });

        const user = response.data;
        setCurrentUser({
          id: user._id,
          email: user.email,
          name: user.name,
          phone: user.phone || "",
          address: user.address || "",
        });
      } catch (error) {
        // 로그인 안 되어 있으면 그냥 무시
        console.log("Not logged in");
      }
    }

    checkAuth();
  }, []);

  const addToCart = useCallback((item: CartItem) => {
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (ci) =>
          ci.product.id === item.product.id &&
          ci.selectedColor === item.selectedColor &&
          ci.selectedSize === item.selectedSize
      );

      if (existingIndex >= 0) {
        const next = [...prevCart];
        next[existingIndex].quantity += item.quantity;
        return next;
      }

      return [...prevCart, item];
    });
  }, []);

  const updateCartItem = useCallback((index: number, quantity: number) => {
    setCart((prevCart) => {
      const next = [...prevCart];
      if (next[index]) {
        next[index] = { ...next[index], quantity };
      }
      return next;
    });
  }, []);

  const removeFromCart = useCallback((index: number) => {
    setCart((prevCart) => prevCart.filter((_, i) => i !== index));
  }, []);

  const login = useCallback((user: User) => {
    setCurrentUser(user);
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({
      currentUser,
      login,
      logout,
      cart,
      addToCart,
      updateCartItem,
      removeFromCart,
      selectedCategory,
      setSelectedCategory,
      searchQuery,
      setSearchQuery,
    }),
    [
      currentUser,
      login,
      logout,
      cart,
      addToCart,
      updateCartItem,
      removeFromCart,
      selectedCategory,
      searchQuery,
    ]
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return ctx;
}
