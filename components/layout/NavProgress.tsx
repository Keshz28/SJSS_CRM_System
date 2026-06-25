"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When route changes, hide the bar
  useEffect(() => {
    // Route finished — complete and hide
    setWidth(100);
    animRef.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 300);
    return () => { if (animRef.current) clearTimeout(animRef.current); };
  }, [pathname, searchParams]);

  // Listen for link clicks to show the bar
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || href === pathname) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      if (animRef.current) clearTimeout(animRef.current);

      setVisible(true);
      setWidth(0);
      // Ramp up quickly to 70%, then stall waiting for server
      timerRef.current = setTimeout(() => setWidth(30), 50);
      timerRef.current = setTimeout(() => setWidth(60), 300);
      timerRef.current = setTimeout(() => setWidth(75), 800);
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 z-[9999] h-[2px] transition-all duration-300 ease-out"
      style={{
        width: `${width}%`,
        background: "linear-gradient(to right, #CB3CFF, #00C2FF)",
        boxShadow: "0 0 8px rgba(203,60,255,0.6)",
      }}
    />
  );
}
