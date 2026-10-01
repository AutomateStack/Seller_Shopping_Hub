import { useState, useRef } from "react";

interface ImageZoomProps {
  src: string;
  alt: string;
}

export function ImageZoom({ src, alt }: ImageZoomProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPosition({ x, y });
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-square overflow-hidden rounded-lg bg-muted cursor-zoom-in group"
      onMouseEnter={() => setIsZoomed(true)}
      onMouseLeave={() => setIsZoomed(false)}
      onMouseMove={handleMouseMove}
    >
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition-transform duration-200"
        style={
          isZoomed
            ? {
                transform: "scale(2.5)",
                transformOrigin: `${position.x}% ${position.y}%`,
              }
            : undefined
        }
      />
      {!isZoomed && (
        <div className="absolute bottom-3 right-3 bg-background/80 backdrop-blur-sm text-xs text-muted-foreground px-2.5 py-1 rounded-md pointer-events-none">
          Hover to zoom
        </div>
      )}
    </div>
  );
}
