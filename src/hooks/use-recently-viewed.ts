import { useEffect, useState } from "react";

const STORAGE_KEY = "shophub_recently_viewed";
const MAX_ITEMS = 8;

export function useRecentlyViewed(currentProductId?: string) {
  const [viewedIds, setViewedIds] = useState<string[]>([]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as string[];
    if (currentProductId) {
      const filtered = stored.filter((id) => id !== currentProductId);
      const updated = [currentProductId, ...filtered].slice(0, MAX_ITEMS + 1);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      // Return items excluding the current one
      setViewedIds(updated.filter((id) => id !== currentProductId).slice(0, 4));
    } else {
      setViewedIds(stored.slice(0, 4));
    }
  }, [currentProductId]);

  return viewedIds;
}
