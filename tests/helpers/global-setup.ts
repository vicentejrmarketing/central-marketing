import { execFileSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { syncConfiguration } from "../../src/modules/setup/seed-core";

/** Recria o banco de testes a partir das migrações e sincroniza a configuração (papéis, permissões, setores). */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/central_marketing_test";
  execFileSync("node", ["--experimental-wasm-modules", "--no-warnings", "scripts/db-local.mjs", "reset"], {
    env: { ...process.env, DATABASE_URL: url, NODE_ENV: "test" },
    stdio: "inherit",
  });
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  await syncConfiguration(db);
  await db.$disconnect();
}
