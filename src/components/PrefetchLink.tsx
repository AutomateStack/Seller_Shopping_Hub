import { ComponentProps, MouseEvent, useCallback, useRef } from "react";
import { Link } from "react-router-dom";

/**
 * Maps route paths to their lazy chunk import.
 * Triggering the import on hover/focus warms the cache so click-to-render is near-instant.
 */
const routeLoaders: Record<string, () => Promise<unknown>> = {
  "/": () => import("@/pages/Home"),
  "/products": () => import("@/pages/Products"),
  "/products/": () => import("@/pages/ProductDetail"),
  "/cart": () => import("@/pages/Cart"),
  "/checkout": () => import("@/pages/Checkout"),
  "/auth": () => import("@/pages/Auth"),
  "/profile": () => import("@/pages/Profile"),
  "/orders": () => import("@/pages/Orders"),
  "/blog": () => import("@/pages/Blog"),
  "/wishlist": () => import("@/pages/Wishlist"),
  "/contact": () => import("@/pages/ContactUs"),
  "/lucky-draw": () => import("@/pages/LuckyDraw"),
  "/wallet": () => import("@/pages/Wallet"),
  "/quiz": () => import("@/pages/Quiz"),
};

const prefetched = new Set<string>();

function prefetchRoute(path: string) {
  // Strip query/hash and dynamic segments for matching
  const base = path.split(/[?#]/)[0];
  // Prefer longer keys first so "/products/" beats "/products"
  const matchKey = Object.keys(routeLoaders)
    .sort((a, b) => b.length - a.length)
    .find((k) => base === k || base.startsWith(k));
  if (!matchKey || prefetched.has(matchKey)) return;
  prefetched.add(matchKey);
  routeLoaders[matchKey]().catch(() => prefetched.delete(matchKey));
}

type PrefetchLinkProps = ComponentProps<typeof Link>;

/**
 * Drop-in <Link> replacement that prefetches the destination route's chunk
 * on first mouseenter / focus / touchstart. Idempotent and bandwidth-cheap.
 */
export function PrefetchLink({ to, onMouseEnter, onFocus, onTouchStart, ...rest }: PrefetchLinkProps) {
  const triggered = useRef(false);

  const trigger = useCallback(() => {
    if (triggered.current) return;
    triggered.current = true;
    if (typeof to === "string") prefetchRoute(to);
  }, [to]);

  const handleEnter = (e: MouseEvent<HTMLAnchorElement>) => { trigger(); onMouseEnter?.(e); };
  const handleFocus = (e: React.FocusEvent<HTMLAnchorElement>) => { trigger(); onFocus?.(e); };
  const handleTouch = (e: React.TouchEvent<HTMLAnchorElement>) => { trigger(); onTouchStart?.(e); };

  return <Link to={to} onMouseEnter={handleEnter} onFocus={handleFocus} onTouchStart={handleTouch} {...rest} />;
}
