import { db } from "@/lib/db";
import { assertCan, type Ctx } from "@/lib/auth/user";
import type { Prisma } from "@/generated/prisma/client";
import { notFound } from "@/lib/errors";
import { visibleStoresWhere } from "@/lib/authz/stores";

export const AUDIT_PAGE_SIZE = 50;

export type AuditFilters = { actorId?: string; entityType?: string; action?: string; from?: Date; to?: Date; page?: number };

export async function listAudit(ctx: Ctx, f: AuditFilters) {
  assertCan(ctx.user, "audit.view");
  const where: Prisma.AuditLogWhereInput = {
    ...(f.actorId ? { actorId: f.actorId } : {}),
    ...(f.entityType ? { entityType: f.entityType } : {}),
    ...(f.action ? { action: { startsWith: f.action } } : {}),
    ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } } : {}),
  };
  const page = Math.max(1, f.page ?? 1);
  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      include: { actor: { select: { id: true, name: true } } },
    }),
    db.auditLog.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)) };
}

/**
 * Histórico de uma loja (página da loja). Visível a quem pode ver a loja; só traz o resumo,
 * sem os valores técnicos de antes/depois, que ficam na auditoria dos administradores.
 */
export async function storeHistory(ctx: Ctx, storeId: string, take = 30) {
  const scope = await visibleStoresWhere(db, ctx.user, "stores.view");
  const visible = await db.store.count({ where: { AND: [scope, { id: storeId }] } });
  if (!visible) throw notFound("Loja");
  return db.auditLog.findMany({
    where: { entityType: "Store", entityId: storeId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, summary: true, createdAt: true, action: true },
  });
}

export async function entityHistory(ctx: Ctx, entityType: string, entityId: string, take = 30) {
  assertCan(ctx.user, "audit.view");
  return db.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take,
    include: { actor: { select: { name: true } } },
  });
}

export async function auditActors(ctx: Ctx) {
  assertCan(ctx.user, "audit.view");
  return db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}
