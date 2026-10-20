export function emailDeliveryConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM);
}

/** Codes are never written to application logs or returned to the browser. */
export async function sendLoginCode(email: string, code: string, challengeId: string) {
  if (!emailDeliveryConfigured()) throw new Error("Email delivery is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": challengeId,
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM,
      to: [email],
      subject: "Your SJSS CRM sign-in code",
      text: `Your SJSS CRM administrator sign-in code is: ${code}\n\nIt expires in 10 minutes and can be used once. If you did not request this, do not share the code and contact your administrator.`,
    }),
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Email delivery failed");
}
