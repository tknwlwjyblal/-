"use client";

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
import { getProduct, type Product } from "@/data/products";

export interface CartItem {
  id: string;
  qty: number;
}

export interface CartDetailed {
  product: Product;
  qty: number;
}

export interface Toast {
  id: number;
  message: string;
}

interface StoreValue {
  cart: CartItem[];
  cartDetailed: CartDetailed[];
  cartCount: number;
  cartTotal: number;
  addToCart: (id: string, qty?: number) => void;
  removeFromCart: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clearCart: () => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  toasts: Toast[];
  pushToast: (message: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loaded, setLoaded] = useState(false);
  const toastId = useRef(0);

  // تحميل البيانات المحفوظة بعد أول render لتفادي تعارض الـ SSR
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem("souqna-cart") || "[]");
      if (Array.isArray(c)) setCart(c.filter((x) => x && typeof x.id === "string"));
      const f = JSON.parse(localStorage.getItem("souqna-fav") || "[]");
      if (Array.isArray(f)) setFavorites(f.filter((x) => typeof x === "string"));
    } catch {
      /* تجاهل */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem("souqna-cart", JSON.stringify(cart));
  }, [cart, loaded]);

  useEffect(() => {
    if (loaded) localStorage.setItem("souqna-fav", JSON.stringify(favorites));
  }, [favorites, loaded]);

  const pushToast = useCallback((message: string) => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((prev) => [...prev.slice(-2), { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  const addToCart = useCallback((id: string, qty = 1) => {
    setCart((prev) => {
      const found = prev.find((x) => x.id === id);
      if (found) {
        return prev.map((x) => (x.id === id ? { ...x, qty: x.qty + qty } : x));
      }
      return [...prev, { id, qty }];
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((x) => x.id !== id)
        : prev.map((x) => (x.id === id ? { ...x, qty } : x)),
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const isFavorite = useCallback(
    (id: string) => favorites.includes(id),
    [favorites],
  );

  const cartDetailed = useMemo<CartDetailed[]>(
    () =>
      cart
        .map((x) => {
          const product = getProduct(x.id);
          return product ? { product, qty: x.qty } : null;
        })
        .filter((x): x is CartDetailed => x !== null),
    [cart],
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, x) => sum + x.qty, 0),
    [cart],
  );

  const cartTotal = useMemo(
    () =>
      cartDetailed.reduce((sum, x) => sum + x.product.price * x.qty, 0),
    [cartDetailed],
  );

  const value = useMemo<StoreValue>(
    () => ({
      cart,
      cartDetailed,
      cartCount,
      cartTotal,
      addToCart,
      removeFromCart,
      setQty,
      clearCart,
      favorites,
      toggleFavorite,
      isFavorite,
      toasts,
      pushToast,
    }),
    [
      cart,
      cartDetailed,
      cartCount,
      cartTotal,
      addToCart,
      removeFromCart,
      setQty,
      clearCart,
      favorites,
      toggleFavorite,
      isFavorite,
      toasts,
      pushToast,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
