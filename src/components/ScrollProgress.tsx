import { useEffect, useState } from "react";

/** Slim reading/scroll progress indicator pinned to the top of the viewport. */
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setProgress(max > 0 ? (doc.scrollTop / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-[60] h-0.5 bg-transparent pointer-events-none"
    >
      <div
        className="scroll-progress h-full origin-left transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%`, opacity: progress > 0.5 ? 1 : 0 }}
      />
    </div>
  );
}