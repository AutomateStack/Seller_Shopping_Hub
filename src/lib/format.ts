/**
 * Locale & currency helpers.
 * Centralizes formatting so the app can later switch locale/currency in one place.
 */

const DEFAULT_LOCALE = "en-IN";
const DEFAULT_CURRENCY = "INR";

const inrFormatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
  style: "currency",
  currency: DEFAULT_CURRENCY,
  maximumFractionDigits: 2,
});

const inrFormatterCompact = new Intl.NumberFormat(DEFAULT_LOCALE, {
  style: "currency",
  currency: DEFAULT_CURRENCY,
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat(DEFAULT_LOCALE);

export function formatINR(value: number | string | null | undefined, opts: { compact?: boolean } = {}): string {
  const n = Number(value ?? 0);
  if (!isFinite(n)) return opts.compact ? "₹0" : "₹0.00";
  return opts.compact ? inrFormatterCompact.format(n) : inrFormatter.format(n);
}

export function formatNumber(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return isFinite(n) ? numberFormatter.format(n) : "0";
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(DEFAULT_LOCALE, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
  } catch {
    return "";
  }
}

export interface VolumeTier {
  min_qty: number;
  discount_percent: number;
}

export function getApplicableTier(quantity: number, tiers?: VolumeTier[] | null): VolumeTier | null {
  if (!Array.isArray(tiers) || tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => b.min_qty - a.min_qty);
  return sorted.find((t) => quantity >= t.min_qty) || null;
}

export function calculateVolumeDiscount(
  items: { quantity: number; price: number; volume_tiers?: VolumeTier[] | null }[]
): number {
  let discount = 0;
  for (const item of items) {
    const tier = getApplicableTier(item.quantity, item.volume_tiers);
    if (tier) {
      discount += item.price * item.quantity * (tier.discount_percent / 100);
    }
  }
  return discount;
}
