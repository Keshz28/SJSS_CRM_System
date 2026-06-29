import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompanyScope, scopeWhere } from "@/lib/company-scope";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { ReportsPDF } from "@/lib/reports-pdf-document";
import {
  buildPeriodBuckets,
  periodNoun,
  REPORT_PERIODS,
  type ReportPeriod,
} from "@/lib/report-periods";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const periodParam = req.nextUrl.searchParams.get("period") as ReportPeriod | null;
  const period: ReportPeriod =
    periodParam && REPORT_PERIODS.includes(periodParam) ? periodParam : "monthly";

  // Honour the global company scope so the exported PDF matches what's on screen.
  const { companyId } = await getCompanyScope();
  const scope = scopeWhere(companyId);

  const [statusCounts, allQuotations, customerRevenue, company] = await Promise.all([
    prisma.quotation.groupBy({
      by: ["status"],
      where: scope,
      _count: true,
      _sum: { totalAmount: true },
    }),
    prisma.quotation.findMany({
      where: scope,
      select: { createdAt: true, totalAmount: true, status: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.quotation.groupBy({
      by: ["customerId"],
      where: { status: "ACCEPTED", ...scope },
      _sum: { totalAmount: true },
      _count: true,
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 8,
    }),
    // Brand the report with the selected company, or the first one for "All".
    companyId
      ? prisma.company.findUnique({ where: { id: companyId } })
      : prisma.company.findFirst({ orderBy: { createdAt: "asc" } }),
  ]);

  const customerIds = customerRevenue.map((r) => r.customerId);
  const customerNames = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, name: true },
  });
  const nameMap = Object.fromEntries(customerNames.map((c) => [c.id, c.name]));

  const topCustomers = customerRevenue.map((r) => ({
    name: nameMap[r.customerId] ?? "Unknown",
    total: Number(r._sum.totalAmount ?? 0),
    count: r._count,
  }));

  const periodData = buildPeriodBuckets(
    allQuotations.map((q) => ({
      createdAt: q.createdAt,
      totalAmount: Number(q.totalAmount),
      status: q.status,
    })),
    period
  );

  const accepted = statusCounts.find((s) => s.status === "ACCEPTED");
  const draft = statusCounts.find((s) => s.status === "DRAFT");
  const sent = statusCounts.find((s) => s.status === "SENT");
  const rejected = statusCounts.find((s) => s.status === "REJECTED");
  const totalQuotes = statusCounts.reduce((s, i) => s + i._count, 0);
  const acceptedCount = accepted?._count ?? 0;
  const acceptanceRate = totalQuotes > 0 ? Math.round((acceptedCount / totalQuotes) * 100) : 0;

  const data = {
    company: {
      name: company?.name ?? "Company",
      registrationNo: company?.registrationNo ?? null,
      address: company?.address ?? null,
      city: company?.city ?? null,
      phone: company?.phone ?? null,
      email: company?.email ?? null,
    },
    periodLabel: periodNoun(period),
    generatedAt: new Date().toLocaleDateString("en-MY", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    totalRevenue: Number(accepted?._sum?.totalAmount ?? 0),
    totalQuotes,
    acceptanceRate,
    acceptedCount,
    rejectedCount: rejected?._count ?? 0,
    draftCount: draft?._count ?? 0,
    sentCount: sent?._count ?? 0,
    periodData,
    topCustomers,
  };

  const element = React.createElement(ReportsPDF, { data }) as React.ReactElement;
  const buffer = await renderToBuffer(element);
  const uint8 = new Uint8Array(buffer);

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `SJSS-Report-${period}-${stamp}.pdf`;

  return new NextResponse(uint8, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(uint8.length),
    },
  });
}
