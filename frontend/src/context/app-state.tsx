import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CartItem, Product, User } from "../types";
import axios from "axios";
import { toast } from "sonner";


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

type ServerCartItem = {
  id: string;
  productId: string;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
  priceSnapshot?: number;
  nameSnapshot?: string;
  imageSnapshot?: string;
};

type ServerCartResponse = {
  id: string;
  userId: string;
  items: ServerCartItem[];
  updatedAt?: string;
};

type Keyable = {
  productId: string;
  selectedColor?: string | null;
  selectedSize?: string | null;
};

const AppStateContext = createContext<AppStateValue | undefined>(undefined);

const cartKey = (item: Keyable) =>
  `${item.productId}|${item.selectedColor ?? ""}|${item.selectedSize ?? ""}`;

const cloneProduct = (product?: Product) =>
  product ? { ...product, images: [...product.images] } : undefined;

const cloneCart = (items: CartItem[]) =>
  items.map((item) => ({
    ...item,
    product: cloneProduct(item.product),
  }));

const normalizeForState = (item: CartItem): CartItem => ({
  ...item,
  product: cloneProduct(item.product),
  priceSnapshot: item.priceSnapshot ?? item.product?.price,
  nameSnapshot: item.nameSnapshot ?? item.product?.name,
  imageSnapshot:
    item.imageSnapshot ??
    item.product?.image ??
    item.product?.images?.[0],
});

const buildCartItemPayload = (item: CartItem) => ({
  productId: item.productId,
  quantity: item.quantity,
  selectedColor: item.selectedColor,
  selectedSize: item.selectedSize,
  priceSnapshot: item.priceSnapshot ?? item.product?.price,
  nameSnapshot: item.nameSnapshot ?? item.product?.name,
  imageSnapshot:
    item.imageSnapshot ??
    item.product?.image ??
    item.product?.images?.[0] ??
    undefined,
});

const mapServerCart = (
  data: ServerCartResponse,
  prev: CartItem[],
): CartItem[] => {
  const productMap = new Map(
    prev.map((item) => [cartKey(item), cloneProduct(item.product)]),
  );

  return data.items.map((item) => {
    const key = cartKey(item);
    return {
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      selectedColor: item.selectedColor,
      selectedSize: item.selectedSize,
      priceSnapshot: item.priceSnapshot,
      nameSnapshot: item.nameSnapshot,
      imageSnapshot: item.imageSnapshot,
      product: productMap.get(key),
    };
  });
};

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // 앱 시작 시 로그인 상태 복구
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await axios.get("/api/auth/me", {
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

  const cartRef = useRef<CartItem[]>([]);
  const guestCartRef = useRef<CartItem[]>([]);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    if (!currentUser) {
      guestCartRef.current = cloneCart(cart);
    }
  }, [currentUser, cart]);


  const fetchCartFromServer = useCallback(async () => {
    if (!currentUser) {
      return;
    }
    try {
      const response = await axios.get<ServerCartResponse>(
        "/api/cart",
        { withCredentials: true },
      );
      setCart((prev) => mapServerCart(response.data, prev));
    } catch (error) {
      console.error("Failed to fetch cart:", error);
      toast.error("장바구니를 불러오지 못했어요.");
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;
    const pendingUpload = cloneCart(guestCartRef.current);

    const syncCart = async () => {
      try {
        if (pendingUpload.length) {
          await axios.put(
            "/api/cart",
            {
              items: pendingUpload.map(buildCartItemPayload),
            },
            { withCredentials: true },
          );
          guestCartRef.current = [];
        }

        const response = await axios.get<ServerCartResponse>(
          "/api/cart",
          { withCredentials: true },
        );

        if (!cancelled) {
          setCart((prev) =>
            mapServerCart(
              response.data,
              pendingUpload.length ? pendingUpload : prev,
            ),
          );
        }
      } catch (error) {
        console.error("Failed to sync cart:", error);
        if (!cancelled) {
          toast.error("장바구니를 불러오지 못했어요.");
          if (pendingUpload.length) {
            setCart(pendingUpload);
          }
        }
      }
    };

    void syncCart();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);


  const addToCart = useCallback(
    (rawItem: CartItem) => {
      const normalized = normalizeForState(rawItem);
      let rollback: CartItem[] = [];

      setCart((prev) => {
        rollback = cloneCart(prev);
        const index = prev.findIndex(
          (ci) => cartKey(ci) === cartKey(normalized),
        );

        if (index >= 0) {
          const next = [...prev];
          next[index] = {
            ...next[index],
            quantity: next[index].quantity + normalized.quantity,
            product: normalized.product ?? next[index].product,
            priceSnapshot:
              normalized.priceSnapshot ?? next[index].priceSnapshot,
            nameSnapshot: normalized.nameSnapshot ?? next[index].nameSnapshot,
            imageSnapshot:
              normalized.imageSnapshot ?? next[index].imageSnapshot,
          };
          return next;
        }

        return [...prev, normalized];
      });

      if (!currentUser) {
        return;
      }

      axios
        .post<ServerCartResponse>(
          "/api/cart/items",
          buildCartItemPayload(normalized),
          { withCredentials: true },
        )
        .then((response) => {
          setCart((prev) => mapServerCart(response.data, prev));
        })
        .catch((error) => {
          console.error("Failed to add cart item:", error);
          setCart(rollback);
          toast.error("장바구니에 상품을 추가하지 못했어요.");
        });
    },
    [currentUser],
  );

  const updateCartItem = useCallback(
    (index: number, quantity: number) => {
      if (quantity < 1) {
        return;
      }

      let rollback: CartItem[] = [];
      let itemId: string | undefined;

      setCart((prev) => {
        const target = prev[index];
        if (!target) {
          return prev;
        }
        rollback = cloneCart(prev);
        itemId = target.id;
        const next = [...prev];
        next[index] = { ...next[index], quantity };
        return next;
      });

      if (!currentUser) {
        return;
      }

      if (!itemId) {
        void fetchCartFromServer();
        return;
      }

      axios
        .patch<ServerCartResponse>(
          `/api/cart/items/${itemId}`,
          { quantity },
          { withCredentials: true },
        )
        .then((response) => {
          setCart((prev) => mapServerCart(response.data, prev));
        })
        .catch((error) => {
          console.error("Failed to update cart item:", error);
          setCart(rollback);
          toast.error("수량을 변경하지 못했어요.");
        });
    },
    [currentUser, fetchCartFromServer],
  );

  const removeFromCart = useCallback(
    (index: number) => {
      let rollback: CartItem[] = [];
      let itemId: string | undefined;

      setCart((prev) => {
        const target = prev[index];
        if (!target) {
          return prev;
        }
        rollback = cloneCart(prev);
        itemId = target.id;
        return prev.filter((_, i) => i !== index);
      });

      if (!currentUser) {
        return;
      }

      if (!itemId) {
        void fetchCartFromServer();
        return;
      }

      axios
        .delete<ServerCartResponse>(
          `/api/cart/items/${itemId}`,
          { withCredentials: true },
        )
        .then((response) => {
          setCart((prev) => mapServerCart(response.data, prev));
        })
        .catch((error) => {
          console.error("Failed to remove cart item:", error);
          setCart(rollback);
          toast.error("장바구니에서 상품을 삭제하지 못했어요.");
        });
    },
    [currentUser, fetchCartFromServer],
  );

  const login = useCallback((user: User) => {
    setCurrentUser(user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await axios.post(
        "/api/auth/logout",
        {},
        { withCredentials: true },
      );
    } catch (error) {
      console.error("Failed to logout:", error);
    }
    setCurrentUser(null);
    setCart([]);
    guestCartRef.current = cloneCart(cartRef.current);
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
