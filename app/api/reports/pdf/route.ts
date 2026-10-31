import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRequestedCompany } from "@/lib/company-scope";
import { getReportData } from "@/lib/report-data";
import { renderToBuffer } from "@react-pdf/renderer";
import { ReportsPDF } from "@/lib/reports-pdf-document";
import {
  buildPeriodBuckets,
  periodNoun,
  REPORT_PERIODS,
  type ReportPeriod,
} from "@/lib/report-periods";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const periodParam = req.nextUrl.searchParams.get(
    "period",
  ) as ReportPeriod | null;
  const period: ReportPeriod =
    periodParam && REPORT_PERIODS.includes(periodParam)
      ? periodParam
      : "monthly";

  const companyId = await getRequestedCompany(req);
  const [report, company] = await Promise.all([
    getReportData(companyId),
    companyId ? prisma.company.findUnique({ where: { id: companyId } }) : null,
  ]);
  if (companyId && !company)
    return NextResponse.json({ error: "Company not found" }, { status: 400 });
  const { totalRevenue, totalQuotes, acceptedCount, rejectedCount, draftCount, sentCount, topCustomers } = report;
  const acceptanceRate = totalQuotes > 0 ? Math.round((acceptedCount / totalQuotes) * 100) : 0;
  const periodData = buildPeriodBuckets(report.series, period);

  const data = {
    company: {
      name: company?.name ?? "All companies",
      registrationNo: company?.registrationNo ?? null,
      address: company?.address ?? null,
      city: company?.city ?? null,
      phone: company?.phone ?? null,
      email: company?.email ?? null,
    },
    periodLabel: periodNoun(period),
    generatedAt: new Date().toLocaleDateString("en-MY", {
      timeZone: "Asia/Kuala_Lumpur",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    totalRevenue,
    totalQuotes,
    acceptanceRate,
    acceptedCount,
    rejectedCount,
    draftCount,
    sentCount,
    periodData,
    topCustomers,
  };

  const element = ReportsPDF({ data });
  const buffer = await renderToBuffer(element);
  const uint8 = new Uint8Array(buffer);

  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
  const filename = `${company?.prefix || "All-Companies"}-Report-${period}-${stamp}.pdf`;

  return new NextResponse(uint8, {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(uint8.length),
    },
  });
}
