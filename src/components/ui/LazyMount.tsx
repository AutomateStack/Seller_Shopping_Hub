import { ReactNode, useEffect, useRef, useState } from "react";

interface LazyMountProps {
  children: ReactNode;
  /** Approximate height of the placeholder so layout doesn't shift (default 400px). */
  minHeight?: number;
  /** Distance ahead of the viewport to start mounting (default "300px"). */
  rootMargin?: string;
  /** Optional fallback while not yet mounted. */
  fallback?: ReactNode;
}

/**
 * Defers mounting children until the placeholder is near the viewport.
 * Useful for heavy below-the-fold sections to reduce initial JS work
 * and avoid running their queries/effects until needed.
 */
export function LazyMount({ children, minHeight = 400, rootMargin = "300px", fallback }: LazyMountProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  if (visible) return <>{children}</>;
  return (
    <div ref={ref} style={{ minHeight }} aria-hidden="true">
      {fallback}
    </div>
  );
}