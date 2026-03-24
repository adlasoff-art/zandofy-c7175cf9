import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Product } from "@/services/api";

interface CompareContextValue {
  items: Product[];
  addToCompare: (product: Product) => void;
  removeFromCompare: (productId: string) => void;
  isInCompare: (productId: string) => boolean;
  clearCompare: () => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Product[]>([]);

  const addToCompare = useCallback((product: Product) => {
    setItems((prev) => {
      if (prev.length >= 4) return prev;
      if (prev.find((p) => p.id === product.id)) return prev;
      return [...prev, product];
    });
  }, []);

  const removeFromCompare = useCallback((productId: string) => {
    setItems((prev) => prev.filter((p) => p.id !== productId));
  }, []);

  const isInCompare = useCallback(
    (productId: string) => items.some((p) => p.id === productId),
    [items]
  );

  const clearCompare = useCallback(() => setItems([]), []);

  return (
    <CompareContext.Provider value={{ items, addToCompare, removeFromCompare, isInCompare, clearCompare }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used within CompareProvider");
  return ctx;
}
