import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SJSS CRM",
  description: "Customer & Quotation Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Apply saved theme before paint to avoid a flash. Default = dark. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('sjss-theme')==='light'){document.documentElement.classList.add('light');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
