// Simple in-memory sliding-window rate limiter. Persists across warm invocations
// of the same edge function isolate. Not a substitute for a global limiter but
// meaningfully raises the cost of scripted abuse against public endpoints.
const buckets = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - arr[0])) / 1000));
    buckets.set(key, arr);
    return { allowed: false, retryAfterSec };
  }
  arr.push(now);
  buckets.set(key, arr);
  return { allowed: true, retryAfterSec: 0 };
}

export function clientKey(req: Request, scope: string): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
  return `${scope}:${ip}`;
}