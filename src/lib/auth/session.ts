import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { unauthenticated } from "@/lib/errors";
import { createSessionRecord, deleteSessionByToken, validateSessionToken } from "./session-core";
import type { AuthUser, Ctx, RequestMeta } from "./user";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-cm_session" : "cm_session";

/** O banco é quem decide a validade da sessão; o cookie só carrega o token opaco. */
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwarded || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent"),
    requestId: h.get("x-vercel-id") || h.get("x-request-id") || crypto.randomUUID(),
  };
}

export async function startSession(userId: string) {
  const meta = await getRequestMeta();
  const { token } = await createSessionRecord(db, userId, meta);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSessionByToken(db, token);
  jar.delete(SESSION_COOKIE);
}

/** Sessão atual, validada no banco uma vez por requisição. */
export const getCurrentSession = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(db, token);
});

export async function getCurrentUser(): Promise<AuthUser | null> {
  return (await getCurrentSession())?.user ?? null;
}

/** Para páginas: exige login (redireciona) e troca de senha obrigatória. */
export async function requireUser(opts: { allowPasswordChange?: boolean } = {}): Promise<AuthUser> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.mustChangePassword && !opts.allowPasswordChange) redirect("/trocar-senha");
  return session.user;
}

/** Para server actions e route handlers: contexto do usuário ou erro 401. */
export async function requireCtx(opts: { allowPasswordChange?: boolean } = {}): Promise<Ctx & { sessionId: string }> {
  const session = await getCurrentSession();
  if (!session) throw unauthenticated();
  if (session.user.mustChangePassword && !opts.allowPasswordChange) throw unauthenticated();
  return { user: session.user, meta: await getRequestMeta(), sessionId: session.sessionId };
}
