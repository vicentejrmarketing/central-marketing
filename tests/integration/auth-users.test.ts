import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { authenticate, consumeTokenAndSetPassword, MAX_FAILURES_PER_EMAIL, requestPasswordReset } from "@/modules/auth/service";
import { changeOwnPassword, createResetLink, inviteUser, setPermissionOverride, setUserStatus, updateUser } from "@/modules/users/service";
import { createSessionRecord, SESSION_IDLE_MS, validateSessionToken } from "@/lib/auth/session-core";
import { can } from "@/lib/auth/user";
import { anySectorId, createUser, ctxFor, resetData, roleId } from "../helpers/factory";

const meta = { ip: "10.0.0.1", userAgent: "vitest" };
const tokenFromUrl = (url: string) => url.split("/").at(-1)!;

beforeEach(resetData);

describe("convite → definição de senha → login", () => {
  it("fluxo completo, com token de uso único e sem envio de e-mail configurado", async () => {
    const admin = await createUser("admin");
    const res = await inviteUser(await ctxFor(admin.id), {
      name: "Maria Designer",
      email: "Maria@Empresa.com.br",
      roleId: await roleId("collaborator"),
      sectorId: await anySectorId(),
    });
    expect(res.emailSent).toBe(false);
    expect(res.inviteUrl).toMatch(/^http:\/\/localhost:3000\/convite\//);

    await expect(authenticate("maria@empresa.com.br", "qualquer-coisa-123", meta)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });

    const token = tokenFromUrl(res.inviteUrl);
    await expect(consumeTokenAndSetPassword(token, "INVITE", "curta", meta)).rejects.toMatchObject({ code: "VALIDATION" });
    await consumeTokenAndSetPassword(token, "INVITE", "cavalo-bateria-grampo", meta);
    await expect(consumeTokenAndSetPassword(token, "INVITE", "outra-senha-longa-1", meta)).rejects.toMatchObject({ code: "VALIDATION" });

    const userId = await authenticate("MARIA@empresa.com.br", "cavalo-bateria-grampo", meta);
    expect(userId).toBe(res.userId);
    const audit = await db.auditLog.findMany({ where: { entityId: userId }, orderBy: { createdAt: "asc" } });
    expect(audit.map((a) => a.action)).toEqual(["user.invited", "auth.invite_accepted", "auth.login"]);
  });

  it("e-mail duplicado é recusado", async () => {
    const admin = await createUser("admin");
    const ctx = await ctxFor(admin.id);
    const input = { name: "João", email: "joao@empresa.com.br", roleId: await roleId("collaborator"), sectorId: await anySectorId() };
    await inviteUser(ctx, input);
    await expect(inviteUser(ctx, input)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("setor é obrigatório, exceto para gerente regional", async () => {
    const admin = await createUser("admin");
    const ctx = await ctxFor(admin.id);
    await expect(inviteUser(ctx, { name: "Sem Setor", email: "a@b.com", roleId: await roleId("collaborator") })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(
      inviteUser(ctx, { name: "Gerente Regional", email: "gr@b.com", roleId: await roleId("regional_manager") }),
    ).resolves.toBeTruthy();
  });
});

describe("login: limite contra força bruta", () => {
  it(`bloqueia após ${MAX_FAILURES_PER_EMAIL} erros em 15 minutos, mesmo com a senha certa`, async () => {
    await createUser("collaborator", { email: "alvo@empresa.com.br", password: "senha-correta-123" });
    for (let i = 0; i < MAX_FAILURES_PER_EMAIL; i++) {
      await expect(authenticate("alvo@empresa.com.br", "errada-errada", meta)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    }
    await expect(authenticate("alvo@empresa.com.br", "senha-correta-123", meta)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("usuário inativo não entra", async () => {
    await createUser("collaborator", { email: "inativo@empresa.com.br", password: "senha-correta-123", status: "INACTIVE" });
    await expect(authenticate("inativo@empresa.com.br", "senha-correta-123", meta)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});

describe("sessões no banco", () => {
  it("valida, expira por inatividade e é encerrada ao desativar o usuário", async () => {
    const admin = await createUser("admin");
    const u = await createUser("collaborator", { password: "senha-correta-123" });
    const { token } = await createSessionRecord(db, u.id, meta);
    expect((await validateSessionToken(db, token))?.user.id).toBe(u.id);

    const future = new Date(Date.now() + SESSION_IDLE_MS + 60_000);
    expect(await validateSessionToken(db, token, future)).toBeNull();

    const s2 = await createSessionRecord(db, u.id, meta);
    await setUserStatus(await ctxFor(admin.id), u.id, false);
    expect(await validateSessionToken(db, s2.token)).toBeNull();
    expect(await db.session.count({ where: { userId: u.id } })).toBe(0);
  });

  it("guarda só o hash do token", async () => {
    const u = await createUser("collaborator");
    const { token } = await createSessionRecord(db, u.id, meta);
    expect(await db.session.count({ where: { tokenHash: token } })).toBe(0);
  });

  it("trocar a senha encerra as outras sessões e mantém a atual", async () => {
    const u = await createUser("collaborator", { password: "senha-antiga-123", email: "troca@empresa.com.br" });
    await createSessionRecord(db, u.id, meta);
    await createSessionRecord(db, u.id, meta);
    const current = await db.session.findFirstOrThrow({ where: { userId: u.id } });
    await changeOwnPassword(await ctxFor(u.id, current.id), { currentPassword: "senha-antiga-123", newPassword: "senha-nova-bem-longa" });
    expect((await db.session.findMany({ where: { userId: u.id } })).map((s) => s.id)).toEqual([current.id]);
    await expect(authenticate("troca@empresa.com.br", "senha-nova-bem-longa", meta)).resolves.toBe(u.id);
  });
});

describe("redefinição de senha", () => {
  it("link gerado pelo administrador funciona uma vez e encerra sessões", async () => {
    const admin = await createUser("admin");
    const u = await createUser("collaborator", { password: "senha-antiga-123", email: "esqueci@empresa.com.br" });
    await createSessionRecord(db, u.id, meta);
    const { url } = await createResetLink(await ctxFor(admin.id), u.id);
    await consumeTokenAndSetPassword(tokenFromUrl(url), "PASSWORD_RESET", "nova-senha-segura-1", meta);
    expect(await db.session.count({ where: { userId: u.id } })).toBe(0);
    await expect(authenticate("esqueci@empresa.com.br", "nova-senha-segura-1", meta)).resolves.toBe(u.id);
  });

  it("'esqueci minha senha' não revela se o e-mail existe", async () => {
    await expect(requestPasswordReset("nao-existe@empresa.com.br", meta)).resolves.toBeUndefined();
  });
});

describe("regras de administração", () => {
  it("não permite desativar nem rebaixar o último administrador", async () => {
    const admin = await createUser("admin");
    const other = await createUser("admin");
    const ctx = await ctxFor(other.id);
    await setUserStatus(ctx, admin.id, false);
    await expect(setUserStatus(ctx, other.id, false)).rejects.toMatchObject({ code: "CONFLICT" });
    await setUserStatus(ctx, admin.id, true);
    const fresh = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
    await updateUser(ctx, {
      id: admin.id,
      version: fresh.version,
      name: fresh.name,
      email: fresh.email,
      roleId: await roleId("collaborator"),
      sectorId: await anySectorId(),
    });
    const me = await db.user.findUniqueOrThrow({ where: { id: other.id } });
    await expect(
      updateUser(await ctxFor(other.id), {
        id: other.id,
        version: me.version,
        name: me.name,
        email: me.email,
        roleId: await roleId("collaborator"),
        sectorId: await anySectorId(),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("edição concorrente é detectada pela versão (lock otimista)", async () => {
    const admin = await createUser("admin");
    const u = await createUser("collaborator");
    const ctx = await ctxFor(admin.id);
    const base = { id: u.id, version: u.version, name: "Nome A", email: u.email, roleId: u.roleId, sectorId: u.sectorId! };
    await updateUser(ctx, base);
    await expect(updateUser(ctx, { ...base, name: "Nome B" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("exceções individuais: concessão dá acesso e negação vence o papel", async () => {
    const admin = await createUser("admin");
    const leader = await createUser("sector_leader");
    const ctx = await ctxFor(admin.id);
    expect(can((await ctxFor(leader.id)).user, "requests.create")).toBe(false);
    await setPermissionOverride(ctx, {
      userId: leader.id,
      permissionKey: "requests.create",
      effect: "GRANT",
      scope: "ALL",
      reason: "Abre pedidos institucionais",
    });
    expect(can((await ctxFor(leader.id)).user, "requests.create", "ALL")).toBe(true);
    await setPermissionOverride(ctx, { userId: leader.id, permissionKey: "stores.view", effect: "DENY", scope: "ALL" });
    expect(can((await ctxFor(leader.id)).user, "stores.view")).toBe(false);
    await setPermissionOverride(ctx, { userId: leader.id, permissionKey: "stores.view", effect: null, scope: "ALL" });
    expect(can((await ctxFor(leader.id)).user, "stores.view")).toBe(true);
    expect(await db.auditLog.count({ where: { action: "permission.override_changed", entityId: leader.id } })).toBe(3);
  });

  it("mudar o papel de um gerente regional encerra os vínculos vigentes", async () => {
    const admin = await createUser("admin");
    const rm = await createUser("regional_manager");
    const region = await db.region.create({ data: { name: "Oeste" } });
    await db.regionManager.create({ data: { regionId: region.id, userId: rm.id, assignedById: admin.id } });
    await updateUser(await ctxFor(admin.id), {
      id: rm.id,
      version: rm.version,
      name: rm.name,
      email: rm.email,
      roleId: await roleId("collaborator"),
      sectorId: await anySectorId(),
    });
    expect(await db.regionManager.count({ where: { userId: rm.id, endsAt: null } })).toBe(0);
  });
});

describe("auditoria imutável no banco", () => {
  it("UPDATE e DELETE na trilha são recusados pelo PostgreSQL", async () => {
    const a = await db.auditLog.create({ data: { action: "t", entityType: "t", summary: "t" } });
    await expect(db.auditLog.update({ where: { id: a.id }, data: { summary: "alterado" } })).rejects.toThrow();
    await expect(db.auditLog.delete({ where: { id: a.id } })).rejects.toThrow();
    expect((await db.auditLog.findUniqueOrThrow({ where: { id: a.id } })).summary).toBe("t");
  });
});
