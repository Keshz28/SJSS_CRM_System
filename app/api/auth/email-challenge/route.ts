import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/password-login";
import { readJson } from "@/lib/request-body";
import { administratorEmailRequired, EmailVerificationError, issueEmailChallenge } from "@/lib/email-verification";

export async function POST(req: NextRequest) {
  const user = await verifyPassword(await readJson(req));
  if (!user) return NextResponse.json({ error: "Unable to sign in. Check your details, or wait after repeated attempts." }, { status: 401 });
  if (user.role !== "ADMIN" || !administratorEmailRequired()) return NextResponse.json({ step: "password" });
  try { return NextResponse.json({ step: "code", ...await issueEmailChallenge(user) }); }
  catch (error) {
    if (error instanceof EmailVerificationError)
      return NextResponse.json({ error: error.message }, { status: error.status, headers: error.status === 429 ? { "Retry-After": "60" } : undefined });
    return NextResponse.json({ error: "Verification is temporarily unavailable. Please try again later." }, { status: 503 });
  }
}
