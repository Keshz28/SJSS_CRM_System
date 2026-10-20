import { test, expect } from "@playwright/test";
import { buildPeriodBuckets } from "../lib/report-periods";

test("report dates use Malaysia calendar boundaries and count accepted value in cents", () => {
  const now = new Date("2026-10-05T16:30:00Z");
  const points = [
    { createdAt: "2026-09-30T15:59:59Z", totalAmount: "100", status: "ACCEPTED" },
    { createdAt: "2026-09-30T16:00:00Z", totalAmount: "0.10", status: "ACCEPTED" },
    { createdAt: "2026-10-04T15:59:59Z", totalAmount: "0.20", status: "ACCEPTED" },
    { createdAt: "2026-10-04T16:00:00Z", totalAmount: "30", status: "SENT" },
    { createdAt: "2026-10-05T15:59:59Z", totalAmount: "40", status: "REJECTED" },
    { createdAt: "2026-10-06T16:00:00Z", totalAmount: "900", status: "ACCEPTED" },
  ];
  const monthly = buildPeriodBuckets(points, "monthly", now);
  expect(monthly.at(-1)).toMatchObject({ revenue: 0.3, quotes: 4 });
  expect(monthly.at(-2)).toMatchObject({ revenue: 100, quotes: 1 });
  const weekly = buildPeriodBuckets(points, "weekly", now);
  expect(weekly.at(-1)).toMatchObject({ revenue: 0, quotes: 2 });
  expect(weekly.at(-2)).toMatchObject({ revenue: 100.3, quotes: 3 });
  const yearly = buildPeriodBuckets([
    { createdAt: "2025-12-31T15:59:59Z", totalAmount: "10", status: "ACCEPTED" },
    { createdAt: "2025-12-31T16:00:00Z", totalAmount: "20", status: "ACCEPTED" },
  ], "yearly", now);
  expect(yearly.at(-1)).toMatchObject({ label: "2026", revenue: 20 });
  expect(yearly.at(-2)).toMatchObject({ label: "2025", revenue: 10 });
  expect(buildPeriodBuckets([], "monthly", now).every((b) => b.revenue === 0 && b.quotes === 0)).toBeTruthy();
});
