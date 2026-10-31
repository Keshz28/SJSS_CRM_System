import { NextResponse } from "next/server";
export function GET() {
  return NextResponse.json(
    { error: "Use the signed-in media viewer." },
    { status: 404 },
  );
}
