import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const updateSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  prefix: z
    .string()
    .min(1, "Prefix is required")
    .max(10, "Prefix is too long")
    .regex(/^[A-Za-z0-9]+$/, "Prefix can only contain letters and numbers")
    .transform((v) => v.toUpperCase()),
  legalName: z.preprocess(emptyToNull, z.string().nullable()),
  tagline: z.preprocess(emptyToNull, z.string().nullable()),
  registrationNo: z.preprocess(emptyToNull, z.string().nullable()),
  address: z.preprocess(emptyToNull, z.string().nullable()),
  city: z.preprocess(emptyToNull, z.string().nullable()),
  phone: z.preprocess(emptyToNull, z.string().nullable()),
  email: z.preprocess(emptyToNull, z.string().email("Invalid email").nullable()),
  website: z.preprocess(emptyToNull, z.string().nullable()),
  logoUrl: z.preprocess(emptyToNull, z.string().nullable()),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only administrators can edit company details" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Guard against duplicate prefixes across companies.
  const clash = await prisma.company.findFirst({
    where: { prefix: parsed.data.prefix, id: { not: params.id } },
  });
  if (clash) {
    return NextResponse.json(
      { error: `Prefix "${parsed.data.prefix}" is already used by ${clash.name}` },
      { status: 409 }
    );
  }

  try {
    const company = await prisma.company.update({
      where: { id: params.id },
      data: parsed.data,
    });
    return NextResponse.json(company);
  } catch {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
}
