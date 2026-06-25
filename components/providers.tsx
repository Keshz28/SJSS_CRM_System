"use client";

import { SessionProvider } from "next-auth/react";
import { Suspense } from "react";
import { NavProgress } from "@/components/layout/NavProgress";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Suspense>
        <NavProgress />
      </Suspense>
      {children}
    </SessionProvider>
  );
}
