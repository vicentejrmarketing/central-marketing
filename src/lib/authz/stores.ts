/**
 * Restrição regional. ÚNICO lugar que decide quais lojas um usuário enxerga.
 * Todas as consultas, validações e exportações que envolvem lojas passam por aqui.
 */
import type { DbOrTx } from "@/lib/db";
import type { AuthUser } from "@/lib/auth/user";
import { scopeOf } from "@/lib/auth/user";
import type { PermissionKey } from "@/lib/authz/catalog";
import type { Prisma } from "@/generated/prisma/client";
import { forbidden, invalid } from "@/lib/errors";

/** Lojas das regiões em que o usuário tem vínculo vigente de gerente regional. */
export async function storeIdsFor(db: DbOrTx, userId: string): Promise<string[]> {
  const rows = await db.store.findMany({
    where: { region: { managers: { some: { userId, endsAt: null } } } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Regiões com vínculo vigente do usuário. */
export async function regionIdsFor(db: DbOrTx, userId: string): Promise<string[]> {
  const rows = await db.regionManager.findMany({ where: { userId, endsAt: null }, select: { regionId: true } });
  return [...new Set(rows.map((r) => r.regionId))];
}

/**
 * Filtro de lojas visíveis para uma permissão.
 * - ALL / SECTOR: todas as lojas (lojas não pertencem a setores).
 * - STORES / OWN: só as lojas vinculadas.
 * - sem a permissão: nenhuma.
 */
export async function visibleStoresWhere(db: DbOrTx, user: AuthUser, key: PermissionKey = "stores.view"): Promise<Prisma.StoreWhereInput> {
  const scope = scopeOf(user, key);
  if (scope === null) return { id: { in: [] } };
  if (scope === "ALL" || scope === "SECTOR") return {};
  return { id: { in: await storeIdsFor(db, user.id) } };
}

/**
 * Valida, no servidor, que TODAS as lojas informadas estão dentro do escopo do usuário
 * para a permissão. Lança erro se alguma estiver fora (ou não existir).
 */
export async function assertStoresInScope(
  db: DbOrTx,
  user: AuthUser,
  key: PermissionKey,
  storeIds: string[],
  opts: { requireActive?: boolean } = {},
): Promise<void> {
  const unique = [...new Set(storeIds)];
  if (unique.length === 0) throw invalid("Selecione ao menos uma loja.", { storeIds: ["Selecione ao menos uma loja."] });
  const scope = scopeOf(user, key);
  if (scope === null) throw forbidden();
  const where = await visibleStoresWhere(db, user, key);
  const found = await db.store.findMany({
    where: { AND: [where, { id: { in: unique } }, opts.requireActive ? { status: "ACTIVE" } : {}] },
    select: { id: true },
  });
  if (found.length !== unique.length) {
    throw forbidden("Uma ou mais lojas selecionadas não estão disponíveis para você.");
  }
}
