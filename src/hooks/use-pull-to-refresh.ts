import { useEffect, useRef, useState } from "react";

/**
 * Mobile pull-to-refresh. Activates only when scrolled to the very top.
 * Triggers `onRefresh` after the user pulls past `threshold` and releases.
 */
export function usePullToRefresh(
  onRefresh: () => void | Promise<void>,
  options: { threshold?: number; enabled?: boolean } = {}
) {
  const { threshold = 70, enabled = true } = options;
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    // Only attach on touch devices
    if (!("ontouchstart" in window)) return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) { startY.current = null; return; }
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null || isRefreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY === 0) {
        // Dampen so it feels rubber-band
        const damped = Math.min(threshold * 1.6, delta * 0.5);
        setPullDistance(damped);
      }
    };

    const onTouchEnd = async () => {
      if (startY.current === null) return;
      const reached = pullDistance >= threshold;
      startY.current = null;
      if (reached && !isRefreshing) {
        setIsRefreshing(true);
        try { await onRefresh(); } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [enabled, threshold, onRefresh, pullDistance, isRefreshing]);

  return { pullDistance, isRefreshing, threshold };
}