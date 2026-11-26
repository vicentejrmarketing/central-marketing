import { db } from "@/lib/db";
import { loadAuthUser, type Ctx } from "@/lib/auth/user";
import { hashPassword } from "@/lib/auth/password";
import { INITIAL_SECTORS, type SystemRoleKey } from "@/lib/authz/catalog";

let seq = 0;
const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

/**
 * Limpa os dados operacionais entre arquivos de teste. Mantém papéis, permissões e setores.
 * A trilha de auditoria é imutável por trigger; no banco de TESTES os triggers são
 * desligados só nesta sessão (session_replication_role) para permitir a limpeza.
 */
export async function resetData() {
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = replica`);
    await tx.$executeRawUnsafe(
      `TRUNCATE "AuditLog", "Notification", "StoreImport", "RegionManager", "Store", "Region", "UserPermissionOverride", "Session", "AuthToken", "LoginAttempt" CASCADE`,
    );
    await tx.$executeRawUnsafe(`UPDATE "Sector" SET "leaderId" = NULL`);
    await tx.$executeRawUnsafe(`DELETE FROM "User"`);
    await tx.$executeRawUnsafe(`DELETE FROM "Role" WHERE "isSystem" = false`);
    await tx.sector.deleteMany({ where: { name: { notIn: INITIAL_SECTORS.map((s) => s.name) } } });
    await tx.sector.updateMany({ data: { active: true, archivedAt: null } });
  });
}

export async function roleId(key: SystemRoleKey | string) {
  return (await db.role.findUniqueOrThrow({ where: { key } })).id;
}

export async function anySectorId() {
  return (await db.sector.findFirstOrThrow({ where: { active: true }, orderBy: { name: "asc" } })).id;
}

export async function createUser(
  role: SystemRoleKey,
  opts: { name?: string; email?: string; password?: string; sectorId?: string | null; status?: "ACTIVE" | "INACTIVE" } = {},
) {
  const id = uid();
  return db.user.create({
    data: {
      name: opts.name ?? `Usuário ${id}`,
      email: opts.email ?? `u${id}@teste.local`,
      passwordHash: opts.password ? await hashPassword(opts.password) : null,
      roleId: await roleId(role),
      sectorId: opts.sectorId === undefined ? (role === "regional_manager" ? null : await anySectorId()) : opts.sectorId,
      status: opts.status ?? "ACTIVE",
    },
  });
}

export async function ctxFor(userId: string, sessionId = "test-session"): Promise<Ctx & { sessionId: string }> {
  const user = await loadAuthUser(db, userId);
  if (!user) throw new Error("usuário não encontrado");
  return { user, meta: { ip: "127.0.0.1", userAgent: "vitest", requestId: "test" }, sessionId };
}

export async function createRegion(name = `Região ${uid()}`) {
  return db.region.create({ data: { name } });
}

export async function createStore(
  regionId: string,
  opts: { name?: string; code?: string; city?: string; status?: "ACTIVE" | "INACTIVE" } = {},
) {
  const id = uid();
  return db.store.create({
    data: {
      code: opts.code ?? `L${id}`.toUpperCase().slice(0, 20),
      name: opts.name ?? `Loja ${id}`,
      city: opts.city ?? "Joinville",
      state: "SC",
      regionId,
      status: opts.status ?? "ACTIVE",
    },
  });
}

export async function linkManager(regionId: string, userId: string, assignedById: string) {
  return db.regionManager.create({ data: { regionId, userId, assignedById } });
}
