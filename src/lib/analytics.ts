import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight client-side analytics. Writes to the `analytics_events` table
 * (RLS allows guest inserts; only admins can read) and forwards key events to
 * Google Analytics 4 via gtag.js.
 *
 * Performance rules:
 * - Fire-and-forget, never throws into UI code
 * - Events are queued and flushed in batches during idle time (or on page hide),
 *   so tracking never competes with rendering or shopping requests
 * - Auto-attaches user_id (when signed in), session_id, and current path
 */

function gtag(...args: unknown[]) {
  if (typeof window !== "undefined" && "gtag" in window) {
    (window.gtag as (...args: unknown[]) => void)(...args);
  }
}

export type AnalyticsEventName =
  | "page_view"
  | "view_product"
  | "product_dwell"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase"
  | "search"
  | "share"
  | "signup"
  | "login";

const SESSION_KEY = "shophub_session_id";
const MAX_QUEUE = 25;
const FLUSH_DELAY = 4000;

type QueuedEvent = {
  event_name: string;
  user_id: string | null;
  session_id: string;
  path: string;
  metadata: Record<string, unknown>;
};

let queue: QueuedEvent[] = [];
let flushTimer: number | undefined;
let cachedUserId: string | null | undefined;

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

async function currentUserId(): Promise<string | null> {
  if (cachedUserId !== undefined) return cachedUserId;
  try {
    const { data } = await supabase.auth.getSession();
    cachedUserId = data.session?.user?.id ?? null;
  } catch {
    cachedUserId = null;
  }
  return cachedUserId;
}

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((_e, session) => {
    cachedUserId = session?.user?.id ?? null;
  });
}

function flush() {
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  void supabase.from("analytics_events").insert(batch as never).then(
    () => undefined,
    () => undefined,
  );
}

function scheduleFlush() {
  if (queue.length >= MAX_QUEUE) {
    flush();
    return;
  }
  if (flushTimer) return;
  flushTimer = window.setTimeout(() => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
    if (ric) ric(() => flush());
    else flush();
  }, FLUSH_DELAY);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", () => flush());
}

export async function trackEvent(
  event_name: AnalyticsEventName,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    if (typeof window === "undefined") return;

    const path = window.location.pathname + window.location.search;

    if (event_name === "page_view") {
      gtag("event", "page_view", {
        page_path: window.location.pathname,
        page_title: document.title,
        page_location: window.location.href,
        ...metadata,
      });
    } else {
      gtag("event", event_name, { page_path: path, ...metadata });
    }

    queue.push({
      event_name,
      user_id: await currentUserId(),
      session_id: getSessionId(),
      path,
      metadata,
    });
    scheduleFlush();
  } catch {
    /* swallow — analytics must never break the app */
  }
}

/** Convenience helper for page views — call from a route-level effect. */
export function trackPageView(extra: Record<string, unknown> = {}) {
  void trackEvent("page_view", extra);
}

/**
 * Measures active time spent on a product page. Returns a cleanup function
 * that records a `product_dwell` event with the visible duration in ms.
 */
export function startDwellTimer(meta: { product_id: string; product_name?: string }) {
  if (typeof document === "undefined") return () => undefined;
  let total = 0;
  let last = document.visibilityState === "visible" ? Date.now() : 0;

  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      if (last) total += Date.now() - last;
      last = 0;
    } else {
      last = Date.now();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    if (last) total += Date.now() - last;
    if (total < 1000) return; // ignore accidental bounces
    void trackEvent("product_dwell", { ...meta, dwell_ms: Math.min(total, 30 * 60 * 1000) });
  };
}

/** Share / virality tracking helper. */
export function trackShare(channel: string, meta: Record<string, unknown> = {}) {
  void trackEvent("share", { channel, ...meta });
}
