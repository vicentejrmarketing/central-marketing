import "dotenv/config";
import { defineConfig } from "prisma/config";

/** Migrações usam a conexão DIRETA (sem pooler) quando o provedor oferece uma. */
const directUrl =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: directUrl,
  },
});
