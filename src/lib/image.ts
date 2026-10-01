/**
 * Returns an optimized image URL using Supabase Storage's render/image transform endpoint
 * when the source is a Supabase storage public URL. Falls back to the original URL otherwise.
 *
 * Docs: https://supabase.com/docs/guides/storage/serving/image-transformations
 */
export interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number; // 20–100
  resize?: "cover" | "contain" | "fill";
}

const SUPABASE_PUBLIC_PATH = "/storage/v1/object/public/";
const SUPABASE_RENDER_PATH = "/storage/v1/render/image/public/";

export function getOptimizedImageUrl(url: string | null | undefined, opts: ImageTransformOptions = {}): string {
  if (!url) return "/placeholder.svg";
  if (!url.includes(SUPABASE_PUBLIC_PATH)) return url; // external URL — leave alone

  const transformed = url.replace(SUPABASE_PUBLIC_PATH, SUPABASE_RENDER_PATH);
  const params = new URLSearchParams();
  if (opts.width) params.set("width", String(opts.width));
  if (opts.height) params.set("height", String(opts.height));
  if (opts.quality) params.set("quality", String(opts.quality));
  if (opts.resize) params.set("resize", opts.resize);
  // Supabase auto-serves WebP/AVIF based on Accept header
  const qs = params.toString();
  return qs ? `${transformed}?${qs}` : transformed;
}

/**
 * Build a srcset string for responsive images.
 * Sizes are widths in CSS pixels; transform output uses 1x = width.
 */
export function getImageSrcSet(url: string | null | undefined, widths: number[], opts: Omit<ImageTransformOptions, "width"> = {}): string {
  if (!url || !url.includes(SUPABASE_PUBLIC_PATH)) return "";
  return widths
    .map((w) => `${getOptimizedImageUrl(url, { ...opts, width: w })} ${w}w`)
    .join(", ");
}
