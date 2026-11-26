/**
 * Busca global (Ctrl+K). Cada grupo respeita as permissões e o escopo de lojas do usuário.
 * Novos módulos (requisições, tarefas, equipamentos, arquivos) entram aqui nas próximas etapas.
 */
import { db } from "@/lib/db";
import { can, type Ctx } from "@/lib/auth/user";
import { regionIdsFor, visibleStoresWhere } from "@/lib/authz/stores";
import { searchStoreIds } from "@/modules/stores/service";

export type SearchResult = { group: string; id: string; title: string; subtitle?: string; href: string };

export async function globalSearch(ctx: Ctx, rawQuery: string): Promise<SearchResult[]> {
  const q = rawQuery.trim();
  if (q.length < 2) return [];
  const results: SearchResult[] = [];

  if (can(ctx.user, "stores.view")) {
    const scope = await visibleStoresWhere(db, ctx.user, "stores.view");
    const ids = await searchStoreIds(q, 50);
    const stores = await db.store.findMany({
      where: { AND: [scope, { id: { in: ids } }] },
      orderBy: { name: "asc" },
      take: 8,
      include: { region: { select: { name: true } } },
    });
    results.push(
      ...stores.map((s) => ({
        group: "Lojas",
        id: s.id,
        title: s.name,
        subtitle: `${s.code} · ${s.city}/${s.state} · ${s.region.name}${s.status === "INACTIVE" ? " · inativa" : ""}`,
        href: `/lojas/${s.id}`,
      })),
    );

    const fullView = can(ctx.user, "stores.view", "ALL") || can(ctx.user, "regions.manage");
    const regions = await db.region.findMany({
      where: {
        name: { contains: q, mode: "insensitive" },
        ...(fullView ? {} : { id: { in: await regionIdsFor(db, ctx.user.id) } }),
      },
      take: 5,
      orderBy: { name: "asc" },
    });
    results.push(
      ...regions.map((r) => ({
        group: "Regiões",
        id: r.id,
        title: r.name,
        subtitle: r.active ? undefined : "arquivada",
        href: `/regioes/${r.id}`,
      })),
    );
  }

  if (can(ctx.user, "users.manage")) {
    const term = `%${q.toLowerCase().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM "User" WHERE immutable_unaccent(lower("name" || ' ' || "email")) LIKE immutable_unaccent(${term}) LIMIT 8`;
    const users = await db.user.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      include: { role: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    results.push(
      ...users.map((u) => ({
        group: "Pessoas",
        id: u.id,
        title: u.name,
        subtitle: `${u.email} · ${u.role.name}${u.status === "INACTIVE" ? " · inativo" : ""}`,
        href: `/configuracoes/usuarios/${u.id}`,
      })),
    );
  }

  if (can(ctx.user, "sectors.manage")) {
    const sectors = await db.sector.findMany({ where: { name: { contains: q, mode: "insensitive" } }, take: 5 });
    results.push(...sectors.map((s) => ({ group: "Setores", id: s.id, title: s.name, href: `/configuracoes/setores` })));
  }

  return results;
}
