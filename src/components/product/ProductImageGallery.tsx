import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ZoomIn, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ProductImageGalleryProps {
  mainImage: string;
  productName: string;
  productId: string;
  activeVariant?: string;
}

export function ProductImageGallery({ mainImage, productName, productId, activeVariant }: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
  const [showLightbox, setShowLightbox] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: additionalImages } = useQuery({
    queryKey: ["product-images", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_images")
        .select("*")
        .eq("product_id", productId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Build images array: main image first, then additional images
  const images = [
    mainImage,
    ...(additionalImages?.map((img) => img.image_url) || []),
  ].filter(Boolean);

  // Jump to the image tagged with the selected variant (matched on its label / alt text).
  // Fall back to the main image when no image is tagged for the selected option.
  useEffect(() => {
    if (!activeVariant || !additionalImages?.length) {
      setSelectedIndex(0);
      return;
    }
    const needle = activeVariant.trim().toLowerCase();
    const idx = additionalImages.findIndex((img) =>
      (img.alt_text || "").toLowerCase().includes(needle) ||
      (img.image_url || "").toLowerCase().includes(needle)
    );
    setSelectedIndex(idx >= 0 ? idx + 1 : 0);
  }, [activeVariant, additionalImages]);

  // Lock body scroll while the lightbox is open
  useEffect(() => {
    if (!showLightbox) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowLightbox(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [showLightbox]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPosition({ x, y });
  };

  const currentAlt = additionalImages?.[selectedIndex - 1]?.alt_text || `${productName} - View ${selectedIndex + 1}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Main Image */}
      <motion.div
        ref={containerRef}
        className="relative aspect-square overflow-hidden rounded-2xl bg-muted cursor-zoom-in group border border-border"
        onMouseEnter={() => setIsZoomed(true)}
        onMouseLeave={() => setIsZoomed(false)}
        onMouseMove={handleMouseMove}
        onClick={() => setShowLightbox(true)}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={selectedIndex}
            src={images[selectedIndex]}
            alt={currentAlt}
            className="h-full w-full object-cover"
            style={
              isZoomed
                ? {
                    transform: "scale(2.5)",
                    transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`,
                    transition: "transform 0.1s ease-out",
                  }
                : { transition: "transform 0.3s ease-out" }
            }
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        </AnimatePresence>

        {/* Image counter */}
        {images.length > 1 && (
          <div className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm text-foreground px-3 py-1 rounded-full text-xs font-medium pointer-events-none">
            {selectedIndex + 1} / {images.length}
          </div>
        )}

        {/* Zoom indicator */}
        <motion.div
          className="absolute bottom-4 right-4 bg-background/80 backdrop-blur-sm text-muted-foreground px-3 py-1.5 rounded-full pointer-events-none flex items-center gap-1.5 text-xs font-medium"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: isZoomed ? 0 : 1, y: isZoomed ? 10 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ZoomIn className="h-3.5 w-3.5" />
          Hover to zoom
        </motion.div>

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedIndex(i => (i - 1 + images.length) % images.length); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background shadow-sm"
            >
              <ChevronLeft className="h-4 w-4 text-foreground" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedIndex(i => (i + 1) % images.length); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background shadow-sm"
            >
              <ChevronRight className="h-4 w-4 text-foreground" />
            </button>
          </>
        )}
      </motion.div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <motion.button
              key={i}
              onClick={() => setSelectedIndex(i)}
              className={cn(
                "relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0",
                i === selectedIndex
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-muted-foreground/40"
              )}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <img src={img} alt={`${productName} thumbnail ${i + 1}`} className="h-full w-full object-cover" />
            </motion.button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {createPortal(
        <AnimatePresence>
        {showLightbox && (
          <motion.div
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLightbox(false)}
          >
            <motion.img
              src={images[selectedIndex]}
              alt={productName}
              className="max-h-[85vh] max-w-[85vw] object-contain rounded-2xl"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }}
            />

            {/* Lightbox nav */}
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedIndex(i => (i - 1 + images.length) % images.length); }}
                  className="absolute left-6 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
                >
                  <ChevronLeft className="h-6 w-6 text-foreground" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedIndex(i => (i + 1) % images.length); }}
                  className="absolute right-6 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
                >
                  <ChevronRight className="h-6 w-6 text-foreground" />
                </button>
              </>
            )}

            <button
              onClick={() => setShowLightbox(false)}
              className="absolute top-6 right-6 h-10 w-10 rounded-full bg-muted flex items-center justify-center text-foreground hover:bg-muted-foreground/20 transition-colors"
            >
              ✕
            </button>
          </motion.div>
        )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
