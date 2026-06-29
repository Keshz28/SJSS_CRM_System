import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { QuotationPDF } from "@/lib/pdf-document";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quotation = await prisma.quotation.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      company: true,
      items: { orderBy: { order: "asc" } },
      createdBy: { select: { name: true } },
    },
  });

  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = {
    quotationNumber: quotation.quotationNumber,
    status: quotation.status,
    subject: quotation.subject,
    createdAt: quotation.createdAt.toISOString(),
    validUntil: quotation.validUntil?.toISOString() ?? null,
    notes: quotation.notes,
    terms: quotation.terms,
    totalAmount: Number(quotation.totalAmount),
    company: {
      name: quotation.company?.name ?? "Company",
      tagline: quotation.company?.tagline ?? null,
      registrationNo: quotation.company?.registrationNo ?? null,
      address: quotation.company?.address ?? null,
      city: quotation.company?.city ?? null,
      phone: quotation.company?.phone ?? null,
      email: quotation.company?.email ?? null,
      website: quotation.company?.website ?? null,
    },
    customer: {
      name: quotation.customer.name,
      contactPerson: quotation.customer.contactPerson,
      email: quotation.customer.email,
      phone: quotation.customer.phone,
      address: quotation.customer.address,
      city: quotation.customer.city,
    },
    items: quotation.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    })),
    createdBy: quotation.createdBy,
  };

  const element = React.createElement(QuotationPDF, { data }) as React.ReactElement;
  const buffer = await renderToBuffer(element);
  const uint8 = new Uint8Array(buffer);

  const filename = `${quotation.quotationNumber}.pdf`;

  return new NextResponse(uint8, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(uint8.length),
    },
  });
}
