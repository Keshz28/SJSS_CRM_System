export type ReportPeriod = "weekly" | "monthly" | "yearly";
export const REPORT_PERIODS: ReportPeriod[] = ["weekly", "monthly", "yearly"];
export interface PeriodBucket { label: string; revenue: number; quotes: number }
export interface QuotationPoint { createdAt: string | Date; totalAmount: number | string; status: string }
const CONFIG = {
  weekly: { count: 12, noun: "Weekly" },
  monthly: { count: 12, noun: "Monthly" },
  yearly: { count: 5, noun: "Yearly" },
};
const businessDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
});
function start(date: Date, period: ReportPeriod) {
  const parts = Object.fromEntries(businessDate.formatToParts(date).map((p) => [p.type, p.value]));
  const value = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  if (period === "weekly") value.setUTCDate(value.getUTCDate() - (value.getUTCDay() + 6) % 7);
  else { value.setUTCDate(1); if (period === "yearly") value.setUTCMonth(0); }
  return value;
}
function shift(value: Date, n: number, period: ReportPeriod) {
  const date = new Date(value);
  if (period === "weekly") date.setUTCDate(date.getUTCDate() - n * 7);
  else if (period === "monthly") date.setUTCMonth(date.getUTCMonth() - n);
  else date.setUTCFullYear(date.getUTCFullYear() - n);
  return date;
}
function label(date: Date, period: ReportPeriod) {
  const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(date);
  if (period === "weekly") return fmt({ day: "numeric", month: "short" });
  if (period === "monthly") return fmt({ month: "short", year: "2-digit" });
  return fmt({ year: "numeric" });
}
export function periodNoun(period: ReportPeriod) { return CONFIG[period].noun; }
/** Calendar boundaries are fixed to Malaysia, independent of server/device time zones. */
export function buildPeriodBuckets(quotations: QuotationPoint[], period: ReportPeriod, now = new Date()): PeriodBucket[] {
  const cfg = CONFIG[period];
  const current = start(now, period);
  const buckets = Array.from({ length: cfg.count }, (_, i) => {
    const d = shift(current, cfg.count - 1 - i, period);
    return { key: d.getTime(), label: label(d, period), cents: 0, quotes: 0 };
  });
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const q of quotations) {
    const date = new Date(q.createdAt);
    if (!Number.isFinite(date.getTime()) || date > now) continue;
    const idx = index.get(start(date, period).getTime());
    if (idx === undefined) continue;
    buckets[idx].quotes++;
    if (q.status === "ACCEPTED") buckets[idx].cents += Math.round(Number(q.totalAmount) * 100);
  }
  return buckets.map((b) => ({ label: b.label, revenue: b.cents / 100, quotes: b.quotes }));
}
