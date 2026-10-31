import { PwaSupport } from "@/components/pwa/PwaSupport";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SJSS CRM",
  description: "Projects, site photos, voice notes and quotations",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "SJSS CRM", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/sj-logo-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/sj-logo-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F3F6FB",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") || undefined;
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        {/* Apply a saved preference before paint. New sessions start in light mode. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{document.documentElement.classList.toggle('light',localStorage.getItem('sjss-theme')!=='dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <PwaSupport />
        {children}
      </body>
    </html>
  );
}
