import {
  startOfWeek,
  startOfMonth,
  startOfYear,
  subWeeks,
  subMonths,
  subYears,
  format,
} from "date-fns";

export type ReportPeriod = "weekly" | "monthly" | "yearly";

export const REPORT_PERIODS: ReportPeriod[] = ["weekly", "monthly", "yearly"];

export interface PeriodBucket {
  label: string;
  revenue: number;
  quotes: number;
}

export interface QuotationPoint {
  createdAt: string | Date;
  totalAmount: number | string;
  status: string;
}

const CONFIG: Record<
  ReportPeriod,
  {
    count: number;
    start: (d: Date) => Date;
    sub: (d: Date, n: number) => Date;
    fmt: (d: Date) => string;
    noun: string;
  }
> = {
  weekly: {
    count: 12,
    start: (d) => startOfWeek(d, { weekStartsOn: 1 }),
    sub: subWeeks,
    fmt: (d) => format(d, "d MMM"),
    noun: "Weekly",
  },
  monthly: {
    count: 12,
    start: startOfMonth,
    sub: subMonths,
    fmt: (d) => format(d, "MMM yy"),
    noun: "Monthly",
  },
  yearly: {
    count: 5,
    start: startOfYear,
    sub: subYears,
    fmt: (d) => format(d, "yyyy"),
    noun: "Yearly",
  },
};

export function periodNoun(period: ReportPeriod) {
  return CONFIG[period].noun;
}

/**
 * Group quotations into a fixed window of time buckets for the given period.
 * Revenue counts ACCEPTED quotes only; quote volume counts every quote.
 */
export function buildPeriodBuckets(
  quotations: QuotationPoint[],
  period: ReportPeriod
): PeriodBucket[] {
  const cfg = CONFIG[period];
  const now = new Date();

  const buckets = Array.from({ length: cfg.count }, (_, i) => {
    const d = cfg.start(cfg.sub(now, cfg.count - 1 - i));
    return { key: d.getTime(), label: cfg.fmt(d), revenue: 0, quotes: 0 };
  });

  const index = new Map(buckets.map((b, i) => [b.key, i]));

  for (const q of quotations) {
    const bucketStart = cfg.start(new Date(q.createdAt)).getTime();
    const idx = index.get(bucketStart);
    if (idx === undefined) continue;
    buckets[idx].quotes += 1;
    if (q.status === "ACCEPTED") {
      buckets[idx].revenue += Number(q.totalAmount);
    }
  }

  return buckets.map(({ label, revenue, quotes }) => ({ label, revenue, quotes }));
}
