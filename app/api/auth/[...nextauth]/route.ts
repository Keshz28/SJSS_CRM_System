import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { readRequestBytes } from "@/lib/request-body";

const handler = NextAuth(authOptions);

export { handler as GET };
export async function POST(req: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  let bytes: Uint8Array;
  try { bytes = await readRequestBytes(req, 16 * 1024); }
  catch { return NextResponse.json({ error: "Invalid authentication request." }, { status: 400 }); }
  return handler(new NextRequest(req.url, {
    method: req.method,
    headers: req.headers,
    body: new Uint8Array(bytes),
  }), context);
}
