/**
 * Verificação de integridade dos dados (Etapa 1). Uso: pnpm db:verify
 * Erros (código de saída 1) indicam dados inconsistentes; avisos são situações a acompanhar.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { SYSTEM_ROLES } from "../src/lib/authz/catalog";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const errors: string[] = [];
const warnings: string[] = [];

async function main() {
  const activeAdmins = await db.user.count({ where: { status: "ACTIVE", role: { key: SYSTEM_ROLES.ADMIN } } });
  if (activeAdmins === 0) errors.push("Não há administrador ativo.");

  const adminRole = await db.role.findUnique({ where: { key: SYSTEM_ROLES.ADMIN }, include: { permissions: true } });
  for (const k of ["users.manage", "permissions.manage"]) {
    if (!adminRole?.permissions.some((p) => p.permissionKey === k && p.scope === "ALL")) errors.push(`Papel Administrador sem ${k}.`);
  }

  const noSector = await db.user.findMany({
    where: { sectorId: null, role: { key: { not: SYSTEM_ROLES.REGIONAL_MANAGER } } },
    select: { email: true },
  });
  if (noSector.length)
    errors.push(`Usuários sem setor (obrigatório fora do papel Gerente Regional): ${noSector.map((u) => u.email).join(", ")}`);

  const wrongRoleLinks = await db.regionManager.findMany({
    where: { endsAt: null, user: { role: { key: { not: SYSTEM_ROLES.REGIONAL_MANAGER } } } },
    include: { user: { select: { email: true } }, region: { select: { name: true } } },
  });
  if (wrongRoleLinks.length)
    errors.push(
      `Vínculos vigentes de quem não é Gerente Regional: ${wrongRoleLinks.map((l) => `${l.user.email} → ${l.region.name}`).join(", ")}`,
    );

  const duplicated = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM (SELECT "regionId", "userId" FROM "RegionManager" WHERE "endsAt" IS NULL GROUP BY 1, 2 HAVING count(*) > 1) d`;
  if (Number(duplicated[0]?.n ?? 0) > 0) errors.push("Há vínculos vigentes duplicados de gerente regional.");

  const storesInArchived = await db.store.findMany({ where: { status: "ACTIVE", region: { active: false } }, select: { code: true } });
  if (storesInArchived.length) errors.push(`Lojas ativas em regiões arquivadas: ${storesInArchived.map((s) => s.code).join(", ")}`);

  const trigger = await db.$queryRaw<
    { n: bigint }[]
  >`SELECT count(*) AS n FROM pg_trigger WHERE tgname IN ('audit_log_no_update', 'audit_log_no_truncate')`;
  if (Number(trigger[0]?.n ?? 0) !== 2) errors.push("Triggers de imutabilidade da auditoria ausentes.");

  const regionsWithoutManager = await db.region.findMany({
    where: { active: true, managers: { none: { endsAt: null, user: { status: "ACTIVE" } } } },
    select: { name: true },
  });
  if (regionsWithoutManager.length)
    warnings.push(`Regiões sem gerente regional ativo: ${regionsWithoutManager.map((r) => r.name).join(", ")}`);

  const inactiveLinked = await db.regionManager.count({ where: { endsAt: null, user: { status: "INACTIVE" } } });
  if (inactiveLinked) warnings.push(`${inactiveLinked} vínculo(s) vigente(s) de gerentes regionais desativados.`);

  const pendingInvites = await db.user.count({ where: { status: "ACTIVE", passwordHash: null } });
  if (pendingInvites) warnings.push(`${pendingInvites} convite(s) ainda não aceito(s).`);

  console.log(errors.length ? `✗ ${errors.length} erro(s):\n  - ${errors.join("\n  - ")}` : "✓ Nenhum erro de integridade.");
  if (warnings.length) console.log(`! ${warnings.length} aviso(s):\n  - ${warnings.join("\n  - ")}`);
  process.exitCode = errors.length ? 1 : 0;
}

main().finally(() => db.$disconnect());
