import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SJSS CRM",
    short_name: "SJSS",
    description: "Projects, site photos and quotations",
    start_url: "/projects",
    scope: "/",
    display: "standalone",
    background_color: "#F3F6FB",
    theme_color: "#F3F6FB",
    icons: [
      {
        src: "/icons/sj-logo-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/sj-logo-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/sj-logo-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
