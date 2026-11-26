import { db, type DbOrTx } from "@/lib/db";
import { assertCan, type Ctx } from "@/lib/auth/user";
import { recordAudit, diffFields } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { conflict, invalid, notFound, staleVersion } from "@/lib/errors";
import { SYSTEM_ROLES, permissionDef } from "@/lib/authz/catalog";
import { hashPassword, passwordPolicyError, verifyPassword } from "@/lib/auth/password";
import { deleteAllSessions } from "@/lib/auth/session-core";
import { actionEmail, sendEmail } from "@/lib/email";
import { issueAuthToken } from "@/modules/auth/service";
import type { InviteUserInput, UpdateUserInput } from "./schemas";

const auditable = (u: {
  name: string;
  email: string;
  jobTitle: string | null;
  phone: string | null;
  sectorId: string | null;
  roleId: string;
  status: string;
}) => ({ name: u.name, email: u.email, jobTitle: u.jobTitle, phone: u.phone, sectorId: u.sectorId, roleId: u.roleId, status: u.status });

/** Setor é obrigatório para todos, menos gerentes regionais (que não pertencem ao marketing). */
async function validateRoleAndSector(tx: DbOrTx, roleId: string, sectorId: string | undefined) {
  const role = await tx.role.findUnique({ where: { id: roleId } });
  if (!role) throw invalid("Papel inválido.", { roleId: ["Selecione um papel válido."] });
  if (sectorId) {
    const sector = await tx.sector.findUnique({ where: { id: sectorId } });
    if (!sector || !sector.active) throw invalid("Setor inválido.", { sectorId: ["Selecione um setor ativo."] });
  } else if (role.key !== SYSTEM_ROLES.REGIONAL_MANAGER) {
    throw invalid("Informe o setor.", { sectorId: ["Informe o setor do usuário."] });
  }
  return role;
}

async function ensureAnotherActiveAdmin(tx: DbOrTx, exceptUserId: string) {
  const others = await tx.user.count({
    where: { status: "ACTIVE", role: { key: SYSTEM_ROLES.ADMIN }, id: { not: exceptUserId } },
  });
  if (others === 0) throw conflict("O sistema precisa de pelo menos um administrador ativo.");
}

export async function inviteUser(ctx: Ctx, input: InviteUserInput) {
  assertCan(ctx.user, "users.manage");
  const result = await db.$transaction(async (tx) => {
    if (await tx.user.findUnique({ where: { email: input.email } })) {
      throw invalid("Já existe um usuário com este e-mail.", { email: ["Já existe um usuário com este e-mail."] });
    }
    await validateRoleAndSector(tx, input.roleId, input.sectorId);
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        jobTitle: input.jobTitle ?? null,
        phone: input.phone ?? null,
        sectorId: input.sectorId ?? null,
        roleId: input.roleId,
      },
    });
    const { url } = await issueAuthToken(tx, user.id, "INVITE", ctx.user.id);
    await recordAudit(tx, ctx, {
      action: "user.invited",
      entityType: "User",
      entityId: user.id,
      summary: `${ctx.user.name} convidou ${user.name} (${user.email})`,
      after: auditable(user),
    });
    return { user, url };
  });
  const content = actionEmail({
    greeting: `Olá, ${result.user.name}.`,
    paragraphs: [`${ctx.user.name} convidou você para a Central de Gestão do Marketing.`, "Clique no botão para definir sua senha."],
    buttonLabel: "Aceitar convite",
    url: result.url,
    footer: "O convite vale por 72 horas.",
  });
  const email = await sendEmail({ to: result.user.email, subject: "Convite: Central de Gestão do Marketing", ...content });
  return { userId: result.user.id, inviteUrl: result.url, emailSent: email.sent };
}

export async function resendInvite(ctx: Ctx, userId: string) {
  assertCan(ctx.user, "users.manage");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("Usuário");
  if (user.passwordHash) throw conflict('Este usuário já definiu a senha. Use "Gerar link de redefinição".');
  if (user.status !== "ACTIVE") throw conflict("Reative o usuário antes de reenviar o convite.");
  const { url } = await db.$transaction(async (tx) => {
    const issued = await issueAuthToken(tx, user.id, "INVITE", ctx.user.id);
    await recordAudit(tx, ctx, {
      action: "user.invite_resent",
      entityType: "User",
      entityId: user.id,
      summary: `${ctx.user.name} gerou novo convite para ${user.name}`,
    });
    return issued;
  });
  const content = actionEmail({
    greeting: `Olá, ${user.name}.`,
    paragraphs: [`${ctx.user.name} enviou um novo convite para a Central de Gestão do Marketing.`],
    buttonLabel: "Aceitar convite",
    url,
    footer: "O convite vale por 72 horas.",
  });
  const email = await sendEmail({ to: user.email, subject: "Convite: Central de Gestão do Marketing", ...content });
  return { url, emailSent: email.sent };
}

/** Link de redefinição gerado pelo administrador (para quem esqueceu a senha). */
export async function createResetLink(ctx: Ctx, userId: string) {
  assertCan(ctx.user, "users.manage");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("Usuário");
  if (user.status !== "ACTIVE") throw conflict("Reative o usuário antes de redefinir a senha.");
  if (!user.passwordHash) throw conflict('O usuário ainda não aceitou o convite. Use "Reenviar convite".');
  const { url } = await db.$transaction(async (tx) => {
    const issued = await issueAuthToken(tx, user.id, "PASSWORD_RESET", ctx.user.id);
    await recordAudit(tx, ctx, {
      action: "user.reset_link_created",
      entityType: "User",
      entityId: user.id,
      summary: `${ctx.user.name} gerou link de redefinição de senha para ${user.name}`,
    });
    return issued;
  });
  const content = actionEmail({
    greeting: `Olá, ${user.name}.`,
    paragraphs: [`${ctx.user.name} gerou um link para você redefinir sua senha.`],
    buttonLabel: "Redefinir senha",
    url,
    footer: "O link vale por 1 hora.",
  });
  const email = await sendEmail({ to: user.email, subject: "Redefinição de senha", ...content });
  return { url, emailSent: email.sent };
}

export async function updateUser(ctx: Ctx, input: UpdateUserInput) {
  assertCan(ctx.user, "users.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: input.id }, include: { role: true } });
    if (!current) throw notFound("Usuário");
    if (current.version !== input.version) throw staleVersion();
    if (input.email !== current.email && (await tx.user.findUnique({ where: { email: input.email } }))) {
      throw invalid("Já existe um usuário com este e-mail.", { email: ["Já existe um usuário com este e-mail."] });
    }
    const role = await validateRoleAndSector(tx, input.roleId, input.sectorId);
    if (current.role.key === SYSTEM_ROLES.ADMIN && role.key !== SYSTEM_ROLES.ADMIN && current.status === "ACTIVE") {
      await ensureAnotherActiveAdmin(tx, current.id);
    }
    const updated = await tx.user.update({
      where: { id: input.id, version: input.version },
      data: {
        name: input.name,
        email: input.email,
        jobTitle: input.jobTitle ?? null,
        phone: input.phone ?? null,
        sectorId: input.sectorId ?? null,
        roleId: input.roleId,
        version: { increment: 1 },
      },
    });
    const diff = diffFields(auditable(current), auditable(updated));
    if (diff) {
      await recordAudit(tx, ctx, {
        action: "user.updated",
        entityType: "User",
        entityId: updated.id,
        summary: `${ctx.user.name} alterou o cadastro de ${updated.name}`,
        ...diff,
      });
    }
    // Ao deixar de ser gerente regional, os vínculos vigentes são encerrados (com histórico).
    if (current.role.key === SYSTEM_ROLES.REGIONAL_MANAGER && role.key !== SYSTEM_ROLES.REGIONAL_MANAGER) {
      const links = await tx.regionManager.findMany({ where: { userId: updated.id, endsAt: null }, include: { region: true } });
      for (const link of links) {
        await tx.regionManager.update({ where: { id: link.id }, data: { endsAt: new Date(), endedById: ctx.user.id } });
        await recordAudit(tx, ctx, {
          action: "region.manager_unlinked",
          entityType: "Region",
          entityId: link.regionId,
          summary: `${updated.name} deixou de ser gerente regional de ${link.region.name} (mudança de papel)`,
        });
      }
    }
    return updated;
  });
}

export async function setUserStatus(ctx: Ctx, userId: string, active: boolean) {
  assertCan(ctx.user, "users.manage");
  if (userId === ctx.user.id && !active) throw conflict("Você não pode desativar a própria conta.");
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user) throw notFound("Usuário");
    if (!active && user.role.key === SYSTEM_ROLES.ADMIN) await ensureAnotherActiveAdmin(tx, user.id);
    const updated = await tx.user.update({
      where: { id: userId },
      data: { status: active ? "ACTIVE" : "INACTIVE", deactivatedAt: active ? null : new Date(), version: { increment: 1 } },
    });
    if (!active) {
      await deleteAllSessions(tx, userId);
      const links = await tx.regionManager.findMany({ where: { userId, endsAt: null }, include: { region: true } });
      for (const link of links) await notifyIfRegionalWithoutManager(tx, link.regionId, link.region.name);
    }
    await recordAudit(tx, ctx, {
      action: active ? "user.reactivated" : "user.deactivated",
      entityType: "User",
      entityId: userId,
      summary: `${ctx.user.name} ${active ? "reativou" : "desativou"} ${user.name}`,
      before: { status: user.status },
      after: { status: updated.status },
    });
    return updated;
  });
}

/** Concede (GRANT), nega (DENY) ou remove (null) uma exceção individual de permissão. */
export async function setPermissionOverride(
  ctx: Ctx,
  input: {
    userId: string;
    permissionKey: string;
    effect: "GRANT" | "DENY" | null;
    scope: "OWN" | "SECTOR" | "STORES" | "ALL";
    reason?: string;
  },
) {
  assertCan(ctx.user, "permissions.manage");
  const def = permissionDef(input.permissionKey);
  if (!def) throw invalid("Permissão desconhecida.");
  if (input.userId === ctx.user.id && input.effect === "DENY" && input.permissionKey === "permissions.manage") {
    throw conflict("Você não pode remover de si mesmo a permissão de gerenciar permissões.");
  }
  const scope = def.scoped ? input.scope : "ALL";
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: input.userId } });
    if (!user) throw notFound("Usuário");
    const existing = await tx.userPermissionOverride.findUnique({
      where: { userId_permissionKey: { userId: input.userId, permissionKey: input.permissionKey } },
    });
    if (input.effect === null) {
      if (existing) await tx.userPermissionOverride.delete({ where: { id: existing.id } });
    } else {
      await tx.userPermissionOverride.upsert({
        where: { userId_permissionKey: { userId: input.userId, permissionKey: input.permissionKey } },
        create: {
          userId: input.userId,
          permissionKey: input.permissionKey,
          effect: input.effect,
          scope,
          reason: input.reason ?? null,
          grantedById: ctx.user.id,
        },
        update: { effect: input.effect, scope, reason: input.reason ?? null, grantedById: ctx.user.id },
      });
    }
    await recordAudit(tx, ctx, {
      action: "permission.override_changed",
      entityType: "User",
      entityId: user.id,
      summary:
        input.effect === null
          ? `${ctx.user.name} removeu a exceção "${def.label}" de ${user.name}`
          : `${ctx.user.name} ${input.effect === "GRANT" ? "concedeu" : "negou"} "${def.label}"${input.effect === "GRANT" && def.scoped ? ` (${scope})` : ""} para ${user.name}`,
      before: existing ? { effect: existing.effect, scope: existing.scope } : null,
      after: input.effect ? { effect: input.effect, scope, reason: input.reason ?? null } : null,
    });
  });
}

export async function updateOwnProfile(ctx: Ctx, input: { name: string; phone?: string; jobTitle?: string }) {
  return db.$transaction(async (tx) => {
    const current = await tx.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
    const updated = await tx.user.update({
      where: { id: ctx.user.id },
      data: { name: input.name, phone: input.phone ?? null, jobTitle: input.jobTitle ?? null, version: { increment: 1 } },
    });
    const diff = diffFields(auditable(current), auditable(updated));
    if (diff)
      await recordAudit(tx, ctx, {
        action: "user.profile_updated",
        entityType: "User",
        entityId: ctx.user.id,
        summary: `${updated.name} atualizou o próprio perfil`,
        ...diff,
      });
    return updated;
  });
}

export async function changeOwnPassword(ctx: Ctx & { sessionId: string }, input: { currentPassword: string; newPassword: string }) {
  const user = await db.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
  if (!user.passwordHash || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw invalid("Senha atual incorreta.", { currentPassword: ["Senha atual incorreta."] });
  }
  if (input.currentPassword === input.newPassword) {
    throw invalid("A nova senha precisa ser diferente da atual.", { newPassword: ["Escolha uma senha diferente da atual."] });
  }
  const policy = passwordPolicyError(input.newPassword, user.email);
  if (policy) throw invalid(policy, { newPassword: [policy] });
  const passwordHash = await hashPassword(input.newPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } });
    // Mantém a sessão atual e encerra as demais.
    await deleteAllSessions(tx, user.id, ctx.sessionId);
    await recordAudit(tx, ctx, {
      action: "user.password_changed",
      entityType: "User",
      entityId: user.id,
      summary: `${user.name} trocou a própria senha`,
    });
  });
}

export async function revokeOwnSession(ctx: Ctx & { sessionId: string }, sessionId: string) {
  if (sessionId === ctx.sessionId) throw conflict('Para encerrar a sessão atual, use "Sair".');
  const res = await db.session.deleteMany({ where: { id: sessionId, userId: ctx.user.id } });
  if (res.count === 0) throw notFound("Sessão");
  await recordAudit(db, ctx, {
    action: "user.session_revoked",
    entityType: "User",
    entityId: ctx.user.id,
    summary: `${ctx.user.name} encerrou uma sessão em outro dispositivo`,
  });
}

/** Troca a foto e devolve a chave anterior (para o arquivo antigo ser apagado). */
export async function setOwnAvatar(ctx: Ctx, avatarKey: string | null): Promise<string | null> {
  return db.$transaction(async (tx) => {
    const previous = (await tx.user.findUniqueOrThrow({ where: { id: ctx.user.id }, select: { avatarKey: true } })).avatarKey;
    await tx.user.update({ where: { id: ctx.user.id }, data: { avatarKey } });
    await recordAudit(tx, ctx, {
      action: "user.avatar_changed",
      entityType: "User",
      entityId: ctx.user.id,
      summary: `${ctx.user.name} ${avatarKey ? "alterou" : "removeu"} a foto de perfil`,
    });
    return previous;
  });
}

/** Avisa administradores quando o gerente regional é desativado com vínculos vigentes. */
export async function notifyIfRegionalWithoutManager(tx: DbOrTx, regionId: string, regionName: string) {
  const remaining = await tx.regionManager.count({ where: { regionId, endsAt: null, user: { status: "ACTIVE" } } });
  if (remaining > 0) return;
  const admins = await tx.user.findMany({
    where: { status: "ACTIVE", role: { key: { in: [SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.MARKETING_MANAGER] } } },
    select: { id: true },
  });
  await notify(tx, {
    userIds: admins.map((a) => a.id),
    type: "region.without_manager",
    title: `A região ${regionName} ficou sem gerente regional`,
    body: "Nenhuma loja dessa região pode abrir requisições até que um gerente seja vinculado.",
    link: `/regioes/${regionId}`,
    entityType: "Region",
    entityId: regionId,
  });
}
