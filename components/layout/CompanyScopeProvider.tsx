"use client";

import { createContext, useContext } from "react";

export interface CompanyScopeValue {
  companies: { id: string; name: string; prefix: string }[];
  companyId: string;
}

const CompanyScopeContext = createContext<CompanyScopeValue>({
  companies: [],
  companyId: "",
});

/**
 * Makes the active company scope available to every client component below it
 * (notably the header switcher), without threading props through each page.
 * The value is read on the server (from the cookie) in the dashboard layout.
 */
export function CompanyScopeProvider({
  value,
  children,
}: {
  value: CompanyScopeValue;
  children: React.ReactNode;
}) {
  return (
    <CompanyScopeContext.Provider value={value}>
      {children}
    </CompanyScopeContext.Provider>
  );
}

export function useCompanyScope() {
  return useContext(CompanyScopeContext);
}
