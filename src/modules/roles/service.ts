import { z } from "zod";
import { db } from "@/lib/db";
import { assertCan, type Ctx } from "@/lib/auth/user";
import { recordAudit } from "@/lib/audit";
import { conflict, invalid, notFound } from "@/lib/errors";
import { PERMISSIONS, SYSTEM_ROLES, permissionDef } from "@/lib/authz/catalog";

export const createRoleSchema = z.object({
  name: z.string({ error: "Informe o nome." }).trim().min(3, "Informe o nome do papel.").max(60),
  description: z.string().trim().max(300).optional(),
  copyFromRoleId: z.uuid().optional(),
});

export const setRolePermissionSchema = z.object({
  roleId: z.uuid(),
  permissionKey: z.string(),
  scope: z.enum(["OWN", "SECTOR", "STORES", "ALL"]).nullable(),
});

/** Permissões que o papel Administrador nunca perde (evita que o sistema fique sem quem o administre). */
const ADMIN_LOCKED = new Set(["users.manage", "permissions.manage"]);

function slug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

export async function listRoles() {
  return db.role.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: { permissions: true, _count: { select: { users: { where: { status: "ACTIVE" } } } } },
  });
}

export async function createRole(ctx: Ctx, input: z.infer<typeof createRoleSchema>) {
  assertCan(ctx.user, "permissions.manage");
  return db.$transaction(async (tx) => {
    if (await tx.role.findUnique({ where: { name: input.name } })) {
      throw invalid("Já existe um papel com este nome.", { name: ["Já existe um papel com este nome."] });
    }
    let key = `custom_${slug(input.name)}`;
    if (await tx.role.findUnique({ where: { key } })) key = `${key}_${Date.now().toString(36)}`;
    const role = await tx.role.create({ data: { key, name: input.name, description: input.description ?? null } });
    if (input.copyFromRoleId) {
      const source = await tx.rolePermission.findMany({ where: { roleId: input.copyFromRoleId } });
      await tx.rolePermission.createMany({
        data: source.map((p) => ({ roleId: role.id, permissionKey: p.permissionKey, scope: p.scope })),
      });
    }
    await recordAudit(tx, ctx, {
      action: "role.created",
      entityType: "Role",
      entityId: role.id,
      summary: `${ctx.user.name} criou o papel ${role.name}`,
    });
    return role;
  });
}

export async function setRolePermission(ctx: Ctx, input: z.infer<typeof setRolePermissionSchema>) {
  assertCan(ctx.user, "permissions.manage");
  const def = permissionDef(input.permissionKey);
  if (!def) throw invalid("Permissão desconhecida.");
  const scope = input.scope === null ? null : def.scoped ? input.scope : "ALL";
  return db.$transaction(async (tx) => {
    const role = await tx.role.findUnique({ where: { id: input.roleId } });
    if (!role) throw notFound("Papel");
    if (role.key === SYSTEM_ROLES.ADMIN && ADMIN_LOCKED.has(def.key) && scope !== "ALL") {
      throw conflict("O papel Administrador sempre mantém as permissões de gerenciar usuários e permissões.");
    }
    const existing = await tx.rolePermission.findUnique({ where: { roleId_permissionKey: { roleId: role.id, permissionKey: def.key } } });
    if (scope === null) {
      if (existing) await tx.rolePermission.delete({ where: { roleId_permissionKey: { roleId: role.id, permissionKey: def.key } } });
    } else {
      await tx.rolePermission.upsert({
        where: { roleId_permissionKey: { roleId: role.id, permissionKey: def.key } },
        create: { roleId: role.id, permissionKey: def.key, scope },
        update: { scope },
      });
    }
    await recordAudit(tx, ctx, {
      action: "role.permission_changed",
      entityType: "Role",
      entityId: role.id,
      summary: `${ctx.user.name} alterou "${def.label}" no papel ${role.name}: ${existing?.scope ?? "sem acesso"} → ${scope ?? "sem acesso"}`,
      before: { [def.key]: existing?.scope ?? null },
      after: { [def.key]: scope },
    });
  });
}

export async function deleteRole(ctx: Ctx, roleId: string) {
  assertCan(ctx.user, "permissions.manage");
  return db.$transaction(async (tx) => {
    const role = await tx.role.findUnique({ where: { id: roleId }, include: { _count: { select: { users: true } } } });
    if (!role) throw notFound("Papel");
    if (role.isSystem) throw conflict("Papéis de sistema não podem ser excluídos.");
    if (role._count.users > 0)
      throw conflict(`O papel ${role.name} está atribuído a ${role._count.users} usuário(s). Mude o papel deles antes.`);
    await tx.role.delete({ where: { id: roleId } });
    await recordAudit(tx, ctx, {
      action: "role.deleted",
      entityType: "Role",
      entityId: roleId,
      summary: `${ctx.user.name} excluiu o papel ${role.name}`,
    });
  });
}

export const PERMISSION_MODULES = [...new Set(PERMISSIONS.map((p) => p.module))];

export async function getRole(ctx: Ctx, id: string) {
  assertCan(ctx.user, "permissions.manage");
  const role = await db.role.findUnique({ where: { id }, include: { permissions: true, _count: { select: { users: true } } } });
  if (!role) throw notFound("Papel");
  return role;
}
