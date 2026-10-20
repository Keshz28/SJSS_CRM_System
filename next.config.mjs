/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
        { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        ...(process.env.NEXTAUTH_URL?.startsWith("https://")
          ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
      ],
    }];
  },
  serverExternalPackages: ["@prisma/client", "bcryptjs", "@react-pdf/renderer"],
  async redirects() {
    return [
      {
        source: "/uploads/:path*",
        destination: "/api/uploads/blocked",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
