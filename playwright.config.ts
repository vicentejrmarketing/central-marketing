import { defineConfig, devices } from "@playwright/test";

const E2E_DB = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/central_marketing_e2e";
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Usa o Chrome instalado na máquina quando houver (CHROME_PATH); senão, o Chromium do Playwright.
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 860 } }, testIgnore: /mobile\.spec\.ts/ },
    // O teste de celular roda depois do fluxo principal (usa a senha já trocada do admin).
    { name: "celular", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/, dependencies: ["desktop"] },
  ],
  // E2E_TARGET=workers roda contra o build do Cloudflare dentro do workerd (vite preview).
  // Antes, gere o build com DATABASE_URL do banco E2E e APP_URL_PRODUCTION=http://localhost:3100.
  webServer: {
    command: process.env.E2E_TARGET === "workers" ? `pnpm exec vite preview --port ${PORT} --strictPort` : `pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: E2E_DB, APP_URL: `http://localhost:${PORT}`, RESEND_API_KEY: "" },
  },
});
