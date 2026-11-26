import { db, type DbOrTx } from "@/lib/db";
import { AppError, invalid } from "@/lib/errors";
import { hashPassword, needsRehash, passwordPolicyError, verifyAgainstDummy, verifyPassword } from "@/lib/auth/password";
import { hashToken, randomToken } from "@/lib/auth/tokens";
import { deleteAllSessions } from "@/lib/auth/session-core";
import { recordAudit } from "@/lib/audit";
import type { RequestMeta } from "@/lib/auth/user";
import { actionEmail, appUrl, sendEmail } from "@/lib/email";
import type { AuthTokenType } from "@/generated/prisma/enums";

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILURES_PER_EMAIL = 5;
export const MAX_FAILURES_PER_IP = 30;
const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

const GENERIC_LOGIN_ERROR = "E-mail ou senha incorretos.";

/** Verifica credenciais com limite contra força bruta. Retorna o id do usuário autenticado. */
export async function authenticate(emailRaw: string, password: string, meta: RequestMeta): Promise<string> {
  const email = emailRaw.trim().toLowerCase();
  const ip = meta.ip ?? "desconhecido";
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const [byEmail, byIp] = await Promise.all([
    db.loginAttempt.count({ where: { email, success: false, createdAt: { gte: since } } }),
    db.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } }),
  ]);
  if (byEmail >= MAX_FAILURES_PER_EMAIL || byIp >= MAX_FAILURES_PER_IP) {
    throw new AppError("Muitas tentativas sem sucesso. Aguarde 15 minutos e tente de novo.", "RATE_LIMITED");
  }

  const user = await db.user.findUnique({ where: { email } });
  let ok = false;
  if (user?.passwordHash && user.status === "ACTIVE") {
    ok = await verifyPassword(user.passwordHash, password);
  } else {
    await verifyAgainstDummy(password);
  }
  await db.loginAttempt.create({ data: { email, ip, success: ok } });
  if (!ok || !user) throw new AppError(GENERIC_LOGIN_ERROR, "UNAUTHENTICATED");

  await db.$transaction(async (tx) => {
    const data: { lastLoginAt: Date; passwordHash?: string } = { lastLoginAt: new Date() };
    if (needsRehash(user.passwordHash!)) data.passwordHash = await hashPassword(password);
    await tx.user.update({ where: { id: user.id }, data });
    await recordAudit(
      tx,
      { user: null, meta },
      {
        action: "auth.login",
        entityType: "User",
        entityId: user.id,
        summary: `${user.name} entrou no sistema`,
      },
    );
  });
  return user.id;
}

/** Cria um token de convite ou redefinição (uso único). Tokens anteriores do mesmo tipo são invalidados. */
export async function issueAuthToken(tx: DbOrTx, userId: string, type: AuthTokenType, createdById: string | null) {
  const token = randomToken();
  await tx.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  await tx.authToken.create({
    data: {
      tokenHash: hashToken(token),
      type,
      userId,
      createdById,
      expiresAt: new Date(Date.now() + (type === "INVITE" ? INVITE_TTL_MS : RESET_TTL_MS)),
    },
  });
  const path = type === "INVITE" ? `/convite/${token}` : `/redefinir-senha/${token}`;
  return { token, url: appUrl(path) };
}

export async function findValidToken(token: string, type: AuthTokenType) {
  const row = await db.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, status: true } } },
  });
  if (!row || row.type !== type || row.usedAt || row.expiresAt <= new Date() || row.user.status !== "ACTIVE") return null;
  return row;
}

/** Define a senha a partir de um convite ou link de redefinição. Encerra as sessões anteriores. */
export async function consumeTokenAndSetPassword(token: string, type: AuthTokenType, password: string, meta: RequestMeta) {
  const row = await findValidToken(token, type);
  if (!row) throw invalid("Este link é inválido ou expirou. Peça um novo ao administrador.");
  const policy = passwordPolicyError(password, row.user.email);
  if (policy) throw invalid(policy, { password: [policy] });
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    const used = await tx.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count !== 1) throw invalid("Este link já foi usado.");
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash, mustChangePassword: false } });
    await deleteAllSessions(tx, row.userId);
    await recordAudit(
      tx,
      { user: null, meta },
      {
        action: type === "INVITE" ? "auth.invite_accepted" : "auth.password_reset",
        entityType: "User",
        entityId: row.userId,
        summary:
          type === "INVITE" ? `${row.user.name} aceitou o convite e definiu a senha` : `${row.user.name} redefiniu a senha pelo link`,
      },
    );
  });
  return row.userId;
}

/**
 * "Esqueci minha senha". Sempre responde a mesma coisa (não revela se o e-mail existe).
 * Só envia o link por e-mail; se o e-mail não estiver configurado, a tela orienta a falar com o administrador.
 */
export async function requestPasswordReset(emailRaw: string, meta: RequestMeta) {
  const email = emailRaw.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE" || !user.passwordHash) return;
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const recent = await db.authToken.count({ where: { userId: user.id, type: "PASSWORD_RESET", createdAt: { gte: since } } });
  if (recent >= 3) return;
  const { url } = await db.$transaction(async (tx) => {
    const issued = await issueAuthToken(tx, user.id, "PASSWORD_RESET", null);
    await recordAudit(
      tx,
      { user: null, meta },
      {
        action: "auth.password_reset_requested",
        entityType: "User",
        entityId: user.id,
        summary: `Redefinição de senha solicitada para ${user.email}`,
      },
    );
    return issued;
  });
  const content = actionEmail({
    greeting: `Olá, ${user.name}.`,
    paragraphs: ["Recebemos um pedido para redefinir a sua senha na Central de Gestão do Marketing."],
    buttonLabel: "Redefinir senha",
    url,
    footer: "O link vale por 1 hora. Se você não pediu, ignore este e-mail.",
  });
  await sendEmail({ to: user.email, subject: "Redefinição de senha", ...content });
}
