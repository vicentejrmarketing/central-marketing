import { execFileSync } from "node:child_process";

/** Banco exclusivo dos testes ponta a ponta: recriado a partir das migrações + seed de configuração. */
export default function globalSetup() {
  const env = {
    ...process.env,
    DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/central_marketing_e2e",
    NODE_ENV: "test" as const,
    SEED_ADMIN_NAME: "Admin E2E",
    SEED_ADMIN_EMAIL: "admin.e2e@central.local",
    SEED_ADMIN_PASSWORD: "senha-inicial-e2e-123",
  };
  execFileSync("node", ["--experimental-wasm-modules", "--no-warnings", "scripts/db-local.mjs", "reset"], { env, stdio: "inherit" });
  execFileSync("pnpm", ["-s", "db:seed"], { env, stdio: "inherit" });
}
