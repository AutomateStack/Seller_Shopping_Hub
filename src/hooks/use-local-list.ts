import { useEffect, useState, useCallback } from "react";

/**
 * Generic localStorage-backed string list with cross-tab sync.
 * Items are deduplicated, FIFO, capped at `max`.
 */
export function useLocalList(key: string, max = 50) {
  const read = useCallback((): string[] => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [key]);

  const [items, setItems] = useState<string[]>(read);

  useEffect(() => {
    setItems(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setItems(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, read]);

  const persist = (next: string[]) => {
    localStorage.setItem(key, JSON.stringify(next));
    setItems(next);
    // Notify same-tab listeners (storage event only fires across tabs)
    window.dispatchEvent(new StorageEvent("storage", { key }));
  };

  const add = (id: string) => {
    const next = [id, ...items.filter((x) => x !== id)].slice(0, max);
    persist(next);
  };
  const remove = (id: string) => persist(items.filter((x) => x !== id));
  const toggle = (id: string) => (items.includes(id) ? remove(id) : add(id));
  const clear = () => persist([]);
  const has = (id: string) => items.includes(id);

  return { items, add, remove, toggle, clear, has };
}