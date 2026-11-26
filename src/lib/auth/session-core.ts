/**
 * Regras de sessão independentes do Next.js (testáveis com o banco real).
 * - Validade de 30 dias, renovada automaticamente quando faltam menos de 15.
 * - Expira após 7 dias sem uso.
 */
import type { DbOrTx } from "@/lib/db";
import { hashToken, randomToken } from "./tokens";
import { loadAuthUser, type AuthUser, type RequestMeta } from "./user";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_RENEW_BEFORE_MS = 15 * 24 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export async function createSessionRecord(db: DbOrTx, userId: string, meta: RequestMeta) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
    },
  });
  return { token, expiresAt };
}

export type ValidatedSession = { sessionId: string; user: AuthUser; expiresAt: Date; renewed: boolean };

export async function validateSessionToken(db: DbOrTx, token: string, now = new Date()): Promise<ValidatedSession | null> {
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session) return null;
  const idleExpired = now.getTime() - session.lastSeenAt.getTime() > SESSION_IDLE_MS;
  if (session.expiresAt <= now || idleExpired) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  const user = await loadAuthUser(db, session.userId);
  if (!user || user.status !== "ACTIVE") {
    await db.session.deleteMany({ where: { userId: session.userId } });
    return null;
  }
  let expiresAt = session.expiresAt;
  let renewed = false;
  const data: { lastSeenAt?: Date; expiresAt?: Date } = {};
  if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) data.lastSeenAt = now;
  if (session.expiresAt.getTime() - now.getTime() < SESSION_RENEW_BEFORE_MS) {
    expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    data.expiresAt = expiresAt;
    data.lastSeenAt = now;
    renewed = true;
  }
  if (data.lastSeenAt || data.expiresAt) await db.session.update({ where: { id: session.id }, data });
  return { sessionId: session.id, user, expiresAt, renewed };
}

export async function deleteSessionByToken(db: DbOrTx, token: string) {
  await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export async function deleteAllSessions(db: DbOrTx, userId: string, exceptSessionId?: string) {
  await db.session.deleteMany({ where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });
}
