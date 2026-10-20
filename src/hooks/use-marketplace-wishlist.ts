import { useCallback, useEffect, useState } from "react";

export const MARKETPLACE_WISHLIST_KEY = "shophub-marketplace-wishlist-v1";
const UPDATED_EVENT = "shophub-marketplace-wishlist-updated";

function readIds(): string[] {
  try {
    const value = localStorage.getItem(MARKETPLACE_WISHLIST_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === "string"))] : [];
  } catch {
    return [];
  }
}

export function useMarketplaceWishlist() {
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  const refresh = useCallback(() => setWishlistIds(readIds()), []);

  useEffect(() => {
    refresh();
    window.addEventListener(UPDATED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(UPDATED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  const toggle = useCallback((productId: string) => {
    const current = readIds();
    const next = current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [productId, ...current];
    try {
      localStorage.setItem(MARKETPLACE_WISHLIST_KEY, JSON.stringify(next));
      setWishlistIds(next);
      window.dispatchEvent(new Event(UPDATED_EVENT));
      return !current.includes(productId);
    } catch {
      return false;
    }
  }, []);

  const isInWishlist = useCallback((productId: string) => wishlistIds.includes(productId), [wishlistIds]);

  return { wishlistIds, isLoading: false, toggle, isInWishlist };
}
