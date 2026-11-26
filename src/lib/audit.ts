import type { DbOrTx } from "@/lib/db";
import type { Ctx } from "@/lib/auth/user";
import type { Prisma } from "@/generated/prisma/client";

const SENSITIVE = new Set(["passwordHash", "password", "tokenHash", "token", "refreshToken", "accessToken", "secret"]);

type Plain = Record<string, unknown>;

function sanitize(value: unknown): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === "object") {
    const out: Plain = {};
    for (const [k, v] of Object.entries(value as Plain)) {
      if (SENSITIVE.has(k)) continue;
      out[k] = sanitize(v);
    }
    return out;
  }
  return value;
}

/** Retorna só os campos que mudaram entre antes e depois (já sem campos sensíveis). */
export function diffFields(before: Plain, after: Plain): { before: Plain; after: Plain } | null {
  const b = sanitize(before) as Plain;
  const a = sanitize(after) as Plain;
  const outB: Plain = {};
  const outA: Plain = {};
  for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (key === "updatedAt" || key === "version") continue;
    if (JSON.stringify(b[key]) !== JSON.stringify(a[key])) {
      outB[key] = b[key] ?? null;
      outA[key] = a[key] ?? null;
    }
  }
  return Object.keys(outA).length ? { before: outB, after: outA } : null;
}

export type AuditInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
};

/**
 * Registra uma entrada na trilha de auditoria. Deve ser chamada DENTRO da mesma transação
 * da alteração, para que as duas coisas aconteçam juntas ou nenhuma aconteça.
 */
export async function recordAudit(db: DbOrTx, ctx: Ctx | { user: null; meta: Ctx["meta"] }, input: AuditInput) {
  await db.auditLog.create({
    data: {
      actorId: ctx.user?.id ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
      before: input.before === undefined ? undefined : (sanitize(input.before) as Prisma.InputJsonValue),
      after: input.after === undefined ? undefined : (sanitize(input.after) as Prisma.InputJsonValue),
      ip: ctx.meta.ip ?? null,
      userAgent: ctx.meta.userAgent?.slice(0, 500) ?? null,
      requestId: ctx.meta.requestId ?? null,
    },
  });
}
