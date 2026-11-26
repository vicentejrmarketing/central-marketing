import type { DbOrTx } from "@/lib/db";

export type NotificationInput = {
  userIds: string[];
  type: string;
  title: string;
  body?: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  /** Quando informado, evita notificação repetida (o sufixo :userId é adicionado). */
  dedupeKey?: string;
  /** Não notifica quem fez a ação. */
  excludeUserId?: string;
};

/** Cria notificações in-app. Chamar dentro da transação da ação que as origina. */
export async function notify(db: DbOrTx, input: NotificationInput): Promise<number> {
  const ids = [...new Set(input.userIds)].filter((id) => id !== input.excludeUserId);
  if (ids.length === 0) return 0;
  const res = await db.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${userId}` : null,
    })),
    skipDuplicates: true,
  });
  return res.count;
}

/** Usuários ativos que têm determinado papel de sistema (ex.: administradores). */
export async function activeUserIdsWithRole(db: DbOrTx, roleKey: string): Promise<string[]> {
  const rows = await db.user.findMany({ where: { status: "ACTIVE", role: { key: roleKey } }, select: { id: true } });
  return rows.map((r) => r.id);
}
