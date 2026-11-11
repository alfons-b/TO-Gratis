import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // ESLint tidak dipasang sebagai dependensi; jalankan `npm run typecheck` untuk pemeriksaan tipe.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
