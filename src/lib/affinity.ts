/**
 * Lightweight client-side category affinity tracker.
 * Stores per-category view counts in localStorage with exponential decay
 * so recent interest dominates over historical noise.
 */
const KEY = "shophub_category_affinity";
const DECAY = 0.95; // applied at every increment
const MAX_CATEGORIES = 12;

type Affinity = Record<string, number>;

function read(): Affinity {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function write(a: Affinity) {
  // Trim to top N to avoid unbounded growth
  const trimmed = Object.fromEntries(
    Object.entries(a)
      .sort((x, y) => y[1] - x[1])
      .slice(0, MAX_CATEGORIES),
  );
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* quota — ignore */
  }
}

export function recordCategoryView(category?: string | null) {
  if (!category) return;
  const cur = read();
  for (const k of Object.keys(cur)) cur[k] *= DECAY;
  cur[category] = (cur[category] || 0) + 1;
  write(cur);
}

export function getTopCategories(limit = 3): string[] {
  const cur = read();
  return Object.entries(cur)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}