import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { ensureFirstAdmin, syncConfiguration } from "../src/modules/setup/seed-core";

async function main() {
  const url =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error("Nenhuma conexão de banco definida (DATABASE_URL).");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const cfg = await syncConfiguration(db);
    console.log(
      `Permissões e papéis sincronizados. Papéis criados: ${cfg.rolesCreated.join(", ") || "nenhum"}. Setores criados: ${cfg.sectorsCreated}.`,
    );
    const admin = await ensureFirstAdmin(db, {
      name: process.env.SEED_ADMIN_NAME,
      email: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD,
    });
    console.log(
      admin.created
        ? `Primeiro administrador criado: ${admin.email} (troca de senha obrigatória no primeiro acesso).`
        : "Já existe administrador ativo.",
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
