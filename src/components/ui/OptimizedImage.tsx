import { ImgHTMLAttributes, useMemo } from "react";
import { getOptimizedImageUrl, getImageSrcSet, ImageTransformOptions } from "@/lib/image";

interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet"> {
  src: string | null | undefined;
  width?: number;
  height?: number;
  quality?: number;
  /** Widths used for responsive srcset (defaults to [400, 800, 1200]) */
  responsiveWidths?: number[];
  /** Standard <img sizes> attribute, e.g. "(max-width: 768px) 100vw, 33vw" */
  sizes?: string;
  resize?: ImageTransformOptions["resize"];
  /** When true, sets fetchpriority="high" and eager loading (use only for LCP images) */
  priority?: boolean;
}

/**
 * Drop-in <img> replacement that:
 *  - Auto-serves Supabase Storage transforms (WebP/AVIF, resized) when applicable
 *  - Generates responsive srcset for sharp display on all devices
 *  - Defaults to lazy-loading + async decoding for non-LCP images
 *
 * Plain external URLs (non-Supabase) pass through untouched.
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  quality = 80,
  responsiveWidths = [400, 800, 1200],
  sizes,
  resize = "cover",
  priority = false,
  loading,
  decoding,
  fetchPriority,
  className,
  ...rest
}: OptimizedImageProps) {
  const finalSrc = useMemo(
    () => getOptimizedImageUrl(src, { width: width ?? responsiveWidths[responsiveWidths.length - 1], quality, resize }),
    [src, width, quality, resize, responsiveWidths]
  );

  const srcSet = useMemo(
    () => getImageSrcSet(src, responsiveWidths, { quality, resize }),
    [src, responsiveWidths, quality, resize]
  );

  return (
    <img
      {...rest}
      src={finalSrc}
      srcSet={srcSet || undefined}
      sizes={sizes}
      alt={alt ?? ""}
      width={width}
      height={height}
      loading={loading ?? (priority ? "eager" : "lazy")}
      decoding={decoding ?? "async"}
      {...{ fetchpriority: fetchPriority ?? (priority ? "high" : "auto") }}
      className={className}
    />
  );
}
