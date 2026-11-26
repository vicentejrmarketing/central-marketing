import type { z } from "zod";
import { db, type DbOrTx } from "@/lib/db";
import { assertCan, can, type Ctx } from "@/lib/auth/user";
import { recordAudit, diffFields } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { conflict, invalid, notFound, staleVersion } from "@/lib/errors";
import { SYSTEM_ROLES } from "@/lib/authz/catalog";
import { regionIdsFor, visibleStoresWhere } from "@/lib/authz/stores";
import type { Prisma } from "@/generated/prisma/client";
import { notifyIfRegionalWithoutManager } from "@/modules/users/service";
import type { StoreFilters, StoreInput, regionSchema, updateRegionSchema, updateStoreSchema } from "./schemas";

/* ------------------------------------------------------------------ */
/* Consultas (sempre com o escopo do usuário)                          */
/* ------------------------------------------------------------------ */

export async function listStores(ctx: Ctx, filters: StoreFilters = {}) {
  const scope = await visibleStoresWhere(db, ctx.user, "stores.view");
  const where: Prisma.StoreWhereInput = { AND: [scope] };
  const and = where.AND as Prisma.StoreWhereInput[];
  if (filters.regionId) and.push({ regionId: filters.regionId });
  if (filters.status && filters.status !== "ALL") and.push({ status: filters.status });
  else if (!filters.status) and.push({ status: "ACTIVE" });
  if (filters.q) {
    const ids = await searchStoreIds(filters.q);
    and.push({ id: { in: ids } });
  }
  return db.store.findMany({
    where,
    orderBy: [{ name: "asc" }],
    include: {
      region: { select: { id: true, name: true } },
      responsible: { select: { id: true, name: true } },
    },
  });
}

/** Busca sem acento por nome, código ou cidade. */
export async function searchStoreIds(q: string, limit = 500): Promise<string[]> {
  const term = `%${q.toLowerCase().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Store"
    WHERE immutable_unaccent(lower("name" || ' ' || "code" || ' ' || "city")) LIKE immutable_unaccent(${term})
    LIMIT ${limit}`;
  return rows.map((r) => r.id);
}

export async function getStore(ctx: Ctx, id: string) {
  const scope = await visibleStoresWhere(db, ctx.user, "stores.view");
  const store = await db.store.findFirst({
    where: { AND: [scope, { id }] },
    include: {
      region: {
        include: {
          managers: {
            where: { endsAt: null },
            include: { user: { select: { id: true, name: true, email: true, phone: true, status: true } } },
          },
        },
      },
      responsible: { select: { id: true, name: true, email: true } },
    },
  });
  if (!store) throw notFound("Loja");
  return store;
}

export async function listRegions(ctx: Ctx, opts: { includeArchived?: boolean } = {}) {
  assertCan(ctx.user, "stores.view");
  const fullView = can(ctx.user, "stores.view", "ALL") || can(ctx.user, "regions.manage");
  const where: Prisma.RegionWhereInput = fullView ? {} : { id: { in: await regionIdsFor(db, ctx.user.id) } };
  if (!opts.includeArchived) where.active = true;
  return db.region.findMany({
    where,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { stores: { where: { status: "ACTIVE" } } } },
      managers: { where: { endsAt: null }, include: { user: { select: { id: true, name: true, status: true } } } },
    },
  });
}

export async function getRegion(ctx: Ctx, id: string) {
  assertCan(ctx.user, "stores.view");
  const fullView = can(ctx.user, "stores.view", "ALL") || can(ctx.user, "regions.manage");
  if (!fullView && !(await regionIdsFor(db, ctx.user.id)).includes(id)) throw notFound("Região");
  const region = await db.region.findUnique({
    where: { id },
    include: {
      stores: { orderBy: { name: "asc" }, include: { responsible: { select: { id: true, name: true } } } },
      managers: {
        orderBy: [{ endsAt: { sort: "desc", nulls: "first" } }, { startsAt: "desc" }],
        include: {
          user: { select: { id: true, name: true, email: true, phone: true, status: true } },
          assignedBy: { select: { name: true } },
          endedBy: { select: { name: true } },
        },
      },
    },
  });
  if (!region) throw notFound("Região");
  return region;
}

/* ------------------------------------------------------------------ */
/* Lojas                                                               */
/* ------------------------------------------------------------------ */

const storeView = (s: {
  code: string;
  name: string;
  city: string;
  state: string;
  address: string | null;
  phone: string | null;
  regionId: string;
  responsibleUserId: string | null;
  managerName: string | null;
  managerPhone: string | null;
  status: string;
}) => ({
  code: s.code,
  name: s.name,
  city: s.city,
  state: s.state,
  address: s.address,
  phone: s.phone,
  regionId: s.regionId,
  responsibleUserId: s.responsibleUserId,
  managerName: s.managerName,
  managerPhone: s.managerPhone,
  status: s.status,
});

async function validateStoreRefs(tx: DbOrTx, input: { regionId: string; responsibleUserId?: string }) {
  const region = await tx.region.findUnique({ where: { id: input.regionId } });
  if (!region || !region.active) throw invalid("Região inválida.", { regionId: ["Selecione uma região ativa."] });
  if (input.responsibleUserId) {
    const user = await tx.user.findUnique({ where: { id: input.responsibleUserId } });
    if (!user || user.status !== "ACTIVE") throw invalid("Responsável inválido.", { responsibleUserId: ["Selecione um usuário ativo."] });
  }
  return region;
}

function storeData(input: StoreInput) {
  return {
    code: input.code,
    name: input.name,
    city: input.city,
    state: input.state,
    address: input.address ?? null,
    phone: input.phone ?? null,
    regionId: input.regionId,
    responsibleUserId: input.responsibleUserId ?? null,
    managerName: input.managerName ?? null,
    managerPhone: input.managerPhone ?? null,
    status: input.status,
  };
}

export async function createStore(ctx: Ctx, input: StoreInput) {
  assertCan(ctx.user, "stores.manage");
  return db.$transaction(async (tx) => {
    if (await tx.store.findUnique({ where: { code: input.code } })) {
      throw invalid("Já existe uma loja com este código.", { code: ["Já existe uma loja com este código."] });
    }
    const region = await validateStoreRefs(tx, input);
    const store = await tx.store.create({ data: storeData(input) });
    await recordAudit(tx, ctx, {
      action: "store.created",
      entityType: "Store",
      entityId: store.id,
      summary: `${ctx.user.name} cadastrou a loja ${store.name} (${store.code}) na região ${region.name}`,
      after: storeView(store),
    });
    return store;
  });
}

export async function updateStore(ctx: Ctx, input: z.infer<typeof updateStoreSchema>) {
  assertCan(ctx.user, "stores.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.store.findUnique({ where: { id: input.id }, include: { region: true } });
    if (!current) throw notFound("Loja");
    if (current.version !== input.version) throw staleVersion();
    const dup = await tx.store.findUnique({ where: { code: input.code } });
    if (dup && dup.id !== current.id)
      throw invalid("Já existe uma loja com este código.", { code: ["Já existe uma loja com este código."] });
    const region = await validateStoreRefs(tx, input);
    const updated = await tx.store.update({
      where: { id: input.id, version: input.version },
      data: { ...storeData(input), version: { increment: 1 } },
    });
    const diff = diffFields(storeView(current), storeView(updated));
    if (diff) {
      const regionChanged = current.regionId !== updated.regionId;
      await recordAudit(tx, ctx, {
        action: "store.updated",
        entityType: "Store",
        entityId: updated.id,
        summary: regionChanged
          ? `${ctx.user.name} moveu a loja ${updated.name} da região ${current.region.name} para ${region.name}`
          : `${ctx.user.name} alterou a loja ${updated.name}`,
        ...diff,
      });
      if (regionChanged) {
        const managers = await tx.regionManager.findMany({
          where: { regionId: { in: [current.regionId, updated.regionId] }, endsAt: null },
          select: { userId: true, regionId: true },
        });
        await notify(tx, {
          userIds: managers.filter((m) => m.regionId === updated.regionId).map((m) => m.userId),
          type: "store.region_changed",
          title: `A loja ${updated.name} passou para a sua região`,
          link: `/lojas/${updated.id}`,
          entityType: "Store",
          entityId: updated.id,
          excludeUserId: ctx.user.id,
        });
        await notify(tx, {
          userIds: managers.filter((m) => m.regionId === current.regionId).map((m) => m.userId),
          type: "store.region_changed",
          title: `A loja ${updated.name} saiu da sua região`,
          body: `Agora ela pertence à região ${region.name}.`,
          entityType: "Store",
          entityId: updated.id,
          excludeUserId: ctx.user.id,
        });
      }
    }
    return updated;
  });
}

/* ------------------------------------------------------------------ */
/* Regiões e gerentes regionais                                        */
/* ------------------------------------------------------------------ */

export async function createRegion(ctx: Ctx, input: z.infer<typeof regionSchema>) {
  assertCan(ctx.user, "regions.manage");
  return db.$transaction(async (tx) => {
    if (await tx.region.findUnique({ where: { name: input.name } }))
      throw invalid("Já existe uma região com este nome.", { name: ["Já existe uma região com este nome."] });
    const region = await tx.region.create({ data: { name: input.name, description: input.description ?? null } });
    await recordAudit(tx, ctx, {
      action: "region.created",
      entityType: "Region",
      entityId: region.id,
      summary: `${ctx.user.name} criou a região ${region.name}`,
    });
    return region;
  });
}

export async function updateRegion(ctx: Ctx, input: z.infer<typeof updateRegionSchema>) {
  assertCan(ctx.user, "regions.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.region.findUnique({ where: { id: input.id } });
    if (!current) throw notFound("Região");
    if (current.version !== input.version) throw staleVersion();
    const dup = await tx.region.findUnique({ where: { name: input.name } });
    if (dup && dup.id !== current.id)
      throw invalid("Já existe uma região com este nome.", { name: ["Já existe uma região com este nome."] });
    const updated = await tx.region.update({
      where: { id: input.id, version: input.version },
      data: { name: input.name, description: input.description ?? null, version: { increment: 1 } },
    });
    const diff = diffFields(
      { name: current.name, description: current.description },
      { name: updated.name, description: updated.description },
    );
    if (diff)
      await recordAudit(tx, ctx, {
        action: "region.updated",
        entityType: "Region",
        entityId: updated.id,
        summary: `${ctx.user.name} alterou a região ${updated.name}`,
        ...diff,
      });
    return updated;
  });
}

/** Arquivar só é permitido sem lojas ativas na região. */
export async function setRegionActive(ctx: Ctx, id: string, active: boolean) {
  assertCan(ctx.user, "regions.manage");
  return db.$transaction(async (tx) => {
    const region = await tx.region.findUnique({
      where: { id },
      include: { _count: { select: { stores: { where: { status: "ACTIVE" } } } } },
    });
    if (!region) throw notFound("Região");
    if (!active && region._count.stores > 0)
      throw conflict(`A região ${region.name} ainda tem ${region._count.stores} loja(s) ativa(s). Mova ou desative as lojas antes.`);
    const updated = await tx.region.update({
      where: { id },
      data: { active, archivedAt: active ? null : new Date(), version: { increment: 1 } },
    });
    await recordAudit(tx, ctx, {
      action: active ? "region.unarchived" : "region.archived",
      entityType: "Region",
      entityId: id,
      summary: `${ctx.user.name} ${active ? "reativou" : "arquivou"} a região ${region.name}`,
    });
    return updated;
  });
}

export async function linkRegionalManager(ctx: Ctx, input: { regionId: string; userId: string }) {
  assertCan(ctx.user, "regions.manage");
  return db.$transaction(async (tx) => {
    const region = await tx.region.findUnique({ where: { id: input.regionId } });
    if (!region || !region.active) throw notFound("Região");
    const user = await tx.user.findUnique({ where: { id: input.userId }, include: { role: true } });
    if (!user || user.status !== "ACTIVE") throw invalid("Usuário inválido.", { userId: ["Selecione um usuário ativo."] });
    if (user.role.key !== SYSTEM_ROLES.REGIONAL_MANAGER) {
      throw invalid("Só usuários com o papel Gerente Regional podem ser vinculados a regiões.", {
        userId: ["O usuário precisa ter o papel Gerente Regional."],
      });
    }
    const existing = await tx.regionManager.findFirst({ where: { regionId: region.id, userId: user.id, endsAt: null } });
    if (existing) throw conflict(`${user.name} já é gerente regional de ${region.name}.`);
    const link = await tx.regionManager.create({ data: { regionId: region.id, userId: user.id, assignedById: ctx.user.id } });
    await recordAudit(tx, ctx, {
      action: "region.manager_linked",
      entityType: "Region",
      entityId: region.id,
      summary: `${ctx.user.name} vinculou ${user.name} como gerente regional de ${region.name}`,
      after: { userId: user.id },
    });
    await notify(tx, {
      userIds: [user.id],
      type: "region.linked",
      title: `Você agora é gerente regional de ${region.name}`,
      body: "As lojas dessa região já aparecem em Minhas lojas.",
      link: `/regioes/${region.id}`,
      entityType: "Region",
      entityId: region.id,
      excludeUserId: ctx.user.id,
    });
    return link;
  });
}

export async function unlinkRegionalManager(ctx: Ctx, linkId: string) {
  assertCan(ctx.user, "regions.manage");
  return db.$transaction(async (tx) => {
    const link = await tx.regionManager.findUnique({ where: { id: linkId }, include: { region: true, user: true } });
    if (!link) throw notFound("Vínculo");
    if (link.endsAt) throw conflict("Este vínculo já foi encerrado.");
    await tx.regionManager.update({ where: { id: linkId }, data: { endsAt: new Date(), endedById: ctx.user.id } });
    await recordAudit(tx, ctx, {
      action: "region.manager_unlinked",
      entityType: "Region",
      entityId: link.regionId,
      summary: `${ctx.user.name} desvinculou ${link.user.name} da região ${link.region.name}`,
      before: { userId: link.userId },
    });
    await notify(tx, {
      userIds: [link.userId],
      type: "region.unlinked",
      title: `Você deixou de ser gerente regional de ${link.region.name}`,
      body: "As lojas dessa região não aparecem mais para você.",
      entityType: "Region",
      entityId: link.regionId,
      excludeUserId: ctx.user.id,
    });
    await notifyIfRegionalWithoutManager(tx, link.regionId, link.region.name);
  });
}

/** Gerentes regionais ativos (para o seletor de vínculo). */
export async function listRegionalManagerCandidates() {
  return db.user.findMany({
    where: { status: "ACTIVE", role: { key: SYSTEM_ROLES.REGIONAL_MANAGER } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
}
