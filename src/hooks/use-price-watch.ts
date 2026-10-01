import { useEffect, useState, useCallback } from "react";

export interface PriceWatch {
  productId: string;
  name: string;
  lastPrice: number;
  addedAt: number;
}

const KEY = "shophub_price_watch_v1";

function read(): PriceWatch[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(list: PriceWatch[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
}

export function usePriceWatch() {
  const [list, setList] = useState<PriceWatch[]>(read);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setList(read()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const watch = useCallback((productId: string, name: string, price: number) => {
    const next = [{ productId, name, lastPrice: price, addedAt: Date.now() }, ...list.filter((w) => w.productId !== productId)].slice(0, 50);
    write(next); setList(next);
  }, [list]);

  const unwatch = useCallback((productId: string) => {
    const next = list.filter((w) => w.productId !== productId);
    write(next); setList(next);
  }, [list]);

  const updatePrices = useCallback((updates: { productId: string; price: number }[]) => {
    const map = new Map(updates.map((u) => [u.productId, u.price]));
    const next = list.map((w) => map.has(w.productId) ? { ...w, lastPrice: map.get(w.productId)! } : w);
    write(next); setList(next);
  }, [list]);

  const isWatching = (productId: string) => list.some((w) => w.productId === productId);

  return { list, watch, unwatch, isWatching, updatePrices };
}