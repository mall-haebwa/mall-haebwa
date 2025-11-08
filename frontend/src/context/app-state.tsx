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
  removeItemsById: (ids: string[]) => Promise<void>;
  refreshCart: () => Promise<void>;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

type ServerCartItem = {
  id?: string;
  _id?: string;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const API_URL = ((import.meta as any).env?.VITE_API_URL as string | undefined) || "";

const cartKey = (item: Keyable) =>
  `${item.productId}|${item.selectedColor ?? ""}|${item.selectedSize ?? ""}`;

const withBase = (path: string) => (API_URL ? `${API_URL}${path}` : path);

const serializeCartForComparison = (items: CartItem[]) =>
  JSON.stringify(
    [...items]
      .map((item) => ({
        key: cartKey(item),
        quantity: item.quantity,
        priceSnapshot: item.priceSnapshot ?? null,
        nameSnapshot: item.nameSnapshot ?? null,
        imageSnapshot: item.imageSnapshot ?? null,
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  );

const cartsEqual = (a: CartItem[], b: CartItem[]) =>
  serializeCartForComparison(a) === serializeCartForComparison(b);

const cloneProduct = (product?: Product) =>
  product ? { ...product, images: [...product.images] } : undefined;

const cloneCart = (items: CartItem[]) =>
  items.map((item) => ({
    ...item,
    product: cloneProduct(item.product),
  }));

const mergeCartEntries = (base: CartItem[], extras: CartItem[]): CartItem[] => {
  const map = new Map<string, CartItem>();

  base.forEach((item) => {
    map.set(cartKey(item), {
      ...item,
      product: cloneProduct(item.product),
    });
  });

  extras.forEach((item) => {
    const key = cartKey(item);
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      if (item.priceSnapshot !== undefined && item.priceSnapshot !== null) {
        existing.priceSnapshot = item.priceSnapshot;
      }
      if (item.nameSnapshot) {
        existing.nameSnapshot = item.nameSnapshot;
      }
      if (item.imageSnapshot) {
        existing.imageSnapshot = item.imageSnapshot;
      }
      if (!existing.product && item.product) {
        existing.product = cloneProduct(item.product);
      }
    } else {
      map.set(key, {
        ...item,
        product: cloneProduct(item.product),
      });
    }
  });

  return Array.from(map.values());
};

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
      id: item.id ?? item._id,
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
        const response = await axios.get(withBase("/api/auth/me"), {
          withCredentials: true,
        });

        const user = response.data;
        setCurrentUser({
          id: user._id,
          email: user.email,
          name: user.name,
          phone: user.phone || "",
          address: user.address || "",
          points: typeof user.points === "number" ? user.points : 0,
          recentlyViewed: Array.isArray(user.recentlyViewed)
            ? user.recentlyViewed
            : [],
        });

        // 로그인 후 최근 본 상품 데이터는 백엔드에서 Redis 사전 로드됨
        // (auth_router.py의 login 엔드포인트에서 처리)
        // 프론트엔드는 필요할 때만 API 호출하면 Redis 캐시에서 빠르게 조회됨
        console.log("[App State] 🔄 로그인 완료 - 최근 본 상품은 백엔드 Redis에서 관리됨");
      } catch {
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
        withBase("/api/cart/"),
        { withCredentials: true },
      );
      setCart(() => mapServerCart(response.data, cartRef.current));
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
        const response = await axios.get<ServerCartResponse>(
          withBase("/api/cart/"),
          { withCredentials: true },
        );

        const serverCart = mapServerCart(response.data, cartRef.current);
        let mergedCart = serverCart;

        if (pendingUpload.length) {
          mergedCart = mergeCartEntries(serverCart, pendingUpload);
          const needsUpdate = !cartsEqual(serverCart, mergedCart);

          if (needsUpdate) {
            await axios.put(
              withBase("/api/cart/"),
              {
                items: mergedCart.map(buildCartItemPayload),
              },
              { withCredentials: true },
            );
            const refreshed = await axios.get<ServerCartResponse>(
              withBase("/api/cart/"),
              { withCredentials: true },
            );
            mergedCart = mapServerCart(refreshed.data, cartRef.current);
          }

          guestCartRef.current = [];
        }

        if (!cancelled) {
          setCart(mergedCart);
        }
      } catch (error) {
        console.error("Failed to sync cart:", error);
        if (!cancelled) {
          toast.error("장바구니를 불러오지 못했어요.");
          if (pendingUpload.length) {
            setCart(cloneCart(pendingUpload));
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
          withBase("/api/cart/items"),
          buildCartItemPayload(normalized),
          { withCredentials: true },
        )
        .then((response) => {
          setCart(() => mapServerCart(response.data, cartRef.current));
        })
        .catch((error) => {
          console.error("Failed to add cart item:", error);
          setCart(rollback);
          toast.error("장바구니에 상품을 추가하지 못했어요.");
        });
    },
    [currentUser],
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
          withBase(`/api/cart/items/${itemId}`),
          { withCredentials: true },
        )
        .then((response) => {
          setCart(() => mapServerCart(response.data, cartRef.current));
        })
        .catch((error) => {
          console.error("Failed to remove cart item:", error);
          setCart(rollback);
          toast.error("장바구니에서 상품을 삭제하지 못했어요.");
        });
    },
    [currentUser, fetchCartFromServer],
  );

  const removeItemsById = useCallback(
    async (ids: string[]) => {
      console.log("🗑️ removeItemsById 호출됨, IDs:", ids);

      if (!ids.length) {
        console.log("⚠️ 삭제할 ID가 없습니다");
        return;
      }

      let rollback: CartItem[] = [];
      setCart((prev) => {
        console.log("�� 현재 장바구니:", prev.map(item => ({ id: item.id, productId: item.productId })));
        rollback = cloneCart(prev);
        const filtered = prev.filter((item) => !item.id || !ids.includes(item.id));
        console.log("🔄 필터링 후 장바구니:", filtered.map(item => ({ id: item.id, productId: item.productId })));
        return filtered;
      });

      if (!currentUser) {
        console.log("⚠️ 로그인되지 않음, 서버 삭제 건너뜀");
        return;
      }

      try {
        console.log("🌐 서버에 일괄 삭제 요청 중...");
        // 일괄 삭제 API 사용
        const response = await axios.post<ServerCartResponse>(
          withBase("/api/cart/items/delete-batch"),
          { item_ids: ids },
          { withCredentials: true },
        );
        console.log("✅ 서버 삭제 완료");
        // 응답으로 받은 업데이트된 장바구니 상태로 직접 업데이트
        setCart(() => mapServerCart(response.data, cartRef.current));
        console.log("✅ 장바구니 업데이트 완료");
      } catch (error) {
        console.error("❌ 장바구니 항목 삭제 실패:", error);
        setCart(rollback);
        toast.error("결제 후 장바구니 정리에 실패했습니다.");
      }
    },
    [currentUser],
  );

  const updateCartItem = useCallback(
    (index: number, quantity: number) => {
      if (quantity < 1) {
        removeFromCart(index);
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
          withBase(`/api/cart/items/${itemId}`),
          { quantity },
          { withCredentials: true },
        )
        .then((response) => {
          setCart(() => mapServerCart(response.data, cartRef.current));
        })
        .catch((error) => {
          console.error("Failed to update cart item:", error);
          setCart(rollback);
          toast.error("수량을 변경하지 못했어요.");
        });
    },
    [currentUser, fetchCartFromServer, removeFromCart],
  );

  const login = useCallback((user: User) => {
    setCurrentUser(user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await axios.post(
        withBase("/api/auth/logout"),
        {},
        { withCredentials: true },
      );
    } catch (error) {
      console.error("Failed to logout:", error);
    }
    setCurrentUser(null);
    guestCartRef.current = [];
    setCart([]);

    // AI 검색 관련 localStorage 정리
    localStorage.removeItem("aiSearchConversationId");
    sessionStorage.removeItem("aiSearchState");
    console.log("[Logout] AI 검색 데이터 정리 완료 (localStorage/sessionStorage)");
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
      removeItemsById,
      refreshCart: fetchCartFromServer,
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
      removeItemsById,
      fetchCartFromServer,
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
