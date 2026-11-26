import type { NextConfig } from "next";

/**
 * Lido pelo vinext (Cloudflare) e pelo Next.js (servidor Node).
 * Sistema inteiramente por usuário: renderização dinâmica, sem cache compartilhado.
 * A Content-Security-Policy com nonce entra na Etapa 7 (segurança).
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Tailwind CSS v4 no build do Next.js (Turbopack). Sem isso o CSS sai sem as classes utilitárias.
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
