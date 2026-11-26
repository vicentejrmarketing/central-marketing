import { db } from "@/lib/db";
import type { Ctx } from "@/lib/auth/user";

export const PAGE_SIZE = 30;

export async function listNotifications(ctx: Ctx, opts: { unreadOnly?: boolean; page?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const where = { userId: ctx.user.id, ...(opts.unreadOnly ? { readAt: null } : {}) };
  const [items, total] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.notification.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function unreadCount(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function latestNotifications(userId: string, take = 8) {
  return db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });
}

/** Só marca notificações do próprio usuário (ids de outros são ignorados). */
export async function markRead(ctx: Ctx, ids: string[]) {
  const res = await db.notification.updateMany({
    where: { id: { in: ids }, userId: ctx.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return res.count;
}

export async function markAllRead(ctx: Ctx) {
  const res = await db.notification.updateMany({ where: { userId: ctx.user.id, readAt: null }, data: { readAt: new Date() } });
  return res.count;
}
