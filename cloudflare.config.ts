import { bindings, defineConfig, defineWorker } from "cf/config";

/**
 * Configuração do Worker (fonte da verdade do deploy no Cloudflare).
 * - HYPERDRIVE: conexão com o PostgreSQL. Defina CF_HYPERDRIVE_ID antes do deploy.
 * - FILES: bucket R2 privado para fotos.
 * - APP_URL: URL pública (links de convite e redefinição de senha).
 * - Segredos opcionais (e-mail): RESEND_API_KEY e EMAIL_FROM via `cf workers secrets`.
 */
const hyperdriveId = process.env.CF_HYPERDRIVE_ID ?? "";
const appUrl = process.env.APP_URL_PRODUCTION ?? "https://central-marketing.workers.dev";

export default defineConfig({
  ...(process.env.CLOUDFLARE_ACCOUNT_ID ? { accountId: process.env.CLOUDFLARE_ACCOUNT_ID } : {}),
  worker: defineWorker({
    name: "central-marketing",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-02",
    compatibilityFlags: ["nodejs_compat"],
    observability: { enabled: true },
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      HYPERDRIVE: bindings.hyperdrive({
        id: hyperdriveId,
        dev: { connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/central_marketing" },
      }),
      FILES: bindings.r2({ name: "central-marketing-files" }),
      APP_URL: bindings.text(appUrl),
    },
  }),
});
