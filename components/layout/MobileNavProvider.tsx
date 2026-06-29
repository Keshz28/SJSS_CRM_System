"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface MobileNavValue {
  /** Whether the mobile slide-in sidebar is open. Always closed-state on desktop (sidebar is permanent there). */
  open: boolean;
  setOpen: (value: boolean) => void;
}

const MobileNavContext = createContext<MobileNavValue>({
  open: false,
  setOpen: () => {},
});

/**
 * Shares the mobile sidebar (drawer) open-state between the Header's hamburger
 * button and the Sidebar drawer, which are siblings in the layout tree.
 * Also locks body scroll while the drawer is open so the page behind it
 * doesn't scroll under the user's finger.
 */
export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
      };
    }
  }, [open]);

  return (
    <MobileNavContext.Provider value={{ open, setOpen }}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  return useContext(MobileNavContext);
}
