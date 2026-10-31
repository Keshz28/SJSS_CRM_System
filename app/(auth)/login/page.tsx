"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/layout/BrandLogo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [resendWait, setResendWait] = useState(0);
  useEffect(() => {
    if (!resendWait) return;
    const timer = setTimeout(() => setResendWait((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendWait]);

  async function finishSignIn() {
    const result = await signIn("credentials", { email, password, challengeId, code, redirect: false });
    if (result?.error || !result?.ok) {
      setError(challengeId ? "The code is invalid or expired. Try again, or request a new code." : "Unable to sign in. Check your details, or wait 15 minutes after repeated attempts.");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  async function beginSignIn() {
    const response = await fetch("/api/auth/email-challenge", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to send a verification code.");
    if (data.step === "code") {
      setChallengeId(data.challengeId); setCode(""); setResendWait(data.resendAfter);
    } else await finishSignIn();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (challengeId) await finishSignIn();
      else await beginSignIn();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-dx-bg overflow-hidden">
      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 overflow-hidden">
        {/* ambient glows */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-dx-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-dx-accent-2/10 rounded-full blur-3xl pointer-events-none" />

        {/* decorative grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#AEB9E1 1px, transparent 1px), linear-gradient(90deg, #AEB9E1 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 text-center max-w-md">
          {/* logo mark */}
          <BrandLogo large className="w-64 h-64 mx-auto mb-6 rounded-3xl shadow-xl" />

          <h1 className="text-4xl font-bold text-dx-ink mb-3 tracking-tight">
            SJSS CRM
          </h1>
          <p className="text-dx-ink-faint text-lg leading-relaxed">
            Your business, beautifully organised.
            <br />
            Projects, site updates and customers in one place.
          </p>

          {/* feature chips */}
          <div className="mt-10 flex flex-col gap-3 text-left">
            {[
              "Quotation creation & PDF export",
              "Customer & company management",
              "Site photos, voice notes & project updates",
            ].map((feat) => (
              <div
                key={feat}
                className="flex items-center gap-3 bg-dx-surface/80 border border-dx-line rounded-xl px-4 py-3"
              >
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-dx-action to-dx-action-2 flex-shrink-0" />
                <span className="text-dx-ink-muted text-sm">{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 relative">
        {/* mobile-only glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-dx-accent/10 rounded-full blur-3xl pointer-events-none lg:hidden" />

        <div className="relative w-full max-w-md">
          {/* mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <BrandLogo className="w-16 h-16 shadow-sm" />
            <span className="text-dx-ink font-bold text-lg">SJSS CRM</span>
          </div>

          {/* card */}
          <div className="bg-dx-surface border border-dx-line rounded-2xl p-8 shadow-2xl">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-dx-ink">Welcome back</h2>
              <p className="text-dx-ink-faint text-sm mt-1">Sign in to continue to your dashboard</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {!challengeId && <>
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-dx-ink-muted mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dx-ink-faint" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="dx-input"
                    placeholder="you@company.com"
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-dx-ink-muted mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dx-ink-faint" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="dx-input pr-10"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-dx-ink-faint hover:text-dx-ink-muted transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              </>}
              {challengeId && <div className="space-y-3">
                <p className="text-sm text-dx-ink-muted break-words">Enter the six-digit code sent to {email}. It expires in 10 minutes.</p>
                <label htmlFor="email-code" className="block text-sm font-medium text-dx-ink-muted">Email verification code</label>
                <input id="email-code" className="dx-input tracking-widest" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoFocus />
                <button type="button" disabled={loading || resendWait > 0} className="text-sm text-dx-accent disabled:opacity-50 min-h-11" onClick={async () => {
                  setLoading(true); setError("");
                  try { await beginSignIn(); }
                  catch (error) { setError(error instanceof Error ? error.message : "Could not resend the code."); }
                  finally { setLoading(false); }
                }}>{resendWait > 0 ? `Resend code in ${resendWait}s` : "Resend code"}</button>
              </div>}
              {error && (
                <div role="alert" className="flex items-start gap-2.5 bg-[#FF5A65]/10 border border-[#FF5A65]/30 rounded-xl px-3.5 py-3">
                  <span className="text-[#FF5A65] text-sm">{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="dx-btn-gradient w-full mt-1"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  challengeId ? "Verify and sign in" : "Sign in"
                )}
              </button>
              {challengeId && <button type="button" disabled={loading} className="dx-btn-ghost w-full" onClick={() => { setChallengeId(""); setCode(""); setPassword(""); setError(""); }}>Back to sign in</button>}
            </form>
          </div>

          {/* footer */}
          <div className="flex items-center justify-center gap-2 mt-6 text-xs text-dx-ink-faint">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>SJSS Internal System — Authorised users only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
