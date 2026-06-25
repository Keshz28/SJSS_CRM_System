"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password. Please try again.");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex bg-[#081028]">
      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 overflow-hidden">
        {/* ambient glows */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#CB3CFF]/12 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#00C2FF]/10 rounded-full blur-3xl pointer-events-none" />

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
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#CB3CFF] to-[#00C2FF] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-[#CB3CFF]/30">
            <span className="text-white text-4xl font-black tracking-tight">S</span>
          </div>

          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
            SJSS CRM
          </h1>
          <p className="text-[#7E89AC] text-lg leading-relaxed">
            Your business, beautifully organised.
            <br />
            Quotations, customers &amp; insights — all in one place.
          </p>

          {/* feature chips */}
          <div className="mt-10 flex flex-col gap-3 text-left">
            {[
              "Quotation creation & PDF export",
              "Customer & company management",
              "Revenue reports & pipeline view",
            ].map((feat) => (
              <div
                key={feat}
                className="flex items-center gap-3 bg-[#0B1739]/80 border border-[#343B4F] rounded-xl px-4 py-3"
              >
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-[#CB3CFF] to-[#00C2FF] flex-shrink-0" />
                <span className="text-[#AEB9E1] text-sm">{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 relative">
        {/* mobile-only glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-[#CB3CFF]/10 rounded-full blur-3xl pointer-events-none lg:hidden" />

        <div className="relative w-full max-w-md">
          {/* mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#CB3CFF] to-[#00C2FF] flex items-center justify-center shadow-lg shadow-[#CB3CFF]/25">
              <span className="text-white text-lg font-bold">S</span>
            </div>
            <span className="text-white font-bold text-lg">SJSS CRM</span>
          </div>

          {/* card */}
          <div className="bg-[#0B1739] border border-[#343B4F] rounded-2xl p-8 shadow-2xl">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-white">Welcome back</h2>
              <p className="text-[#7E89AC] text-sm mt-1">Sign in to continue to your dashboard</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-[#AEB9E1] mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7E89AC]" />
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
                <label className="block text-sm font-medium text-[#AEB9E1] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7E89AC]" />
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
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7E89AC] hover:text-[#AEB9E1] transition-colors"
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
              {error && (
                <div className="flex items-start gap-2.5 bg-[#FF5A65]/10 border border-[#FF5A65]/30 rounded-xl px-3.5 py-3">
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
                  "Sign in"
                )}
              </button>
            </form>
          </div>

          {/* footer */}
          <div className="flex items-center justify-center gap-2 mt-6 text-xs text-[#7E89AC]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>SJSS Internal System — Authorised users only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
