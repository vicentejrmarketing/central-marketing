/**
 * Dados de CONFIGURAÇÃO do sistema (nunca dados fictícios de operação):
 * catálogo de permissões, papéis de sistema, setores iniciais e o primeiro administrador.
 * Idempotente: pode rodar a cada deploy.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { INITIAL_SECTORS, PERMISSIONS, SYSTEM_ROLE_DEFS, SYSTEM_ROLES, type SystemRoleKey } from "@/lib/authz/catalog";
import { hashPassword, passwordPolicyError } from "@/lib/auth/password";

export async function syncConfiguration(db: PrismaClient) {
  // 1. Catálogo de permissões (cria, atualiza textos e remove chaves que saíram do código).
  for (const p of PERMISSIONS) {
    await db.permission.upsert({
      where: { key: p.key },
      create: { key: p.key, module: p.module, label: p.label, description: p.description, scoped: p.scoped },
      update: { module: p.module, label: p.label, description: p.description, scoped: p.scoped },
    });
  }
  await db.permission.deleteMany({ where: { key: { notIn: PERMISSIONS.map((p) => p.key) } } });

  // 2. Papéis de sistema. A matriz padrão só é aplicada na criação do papel.
  const created: string[] = [];
  for (const [key, def] of Object.entries(SYSTEM_ROLE_DEFS) as [SystemRoleKey, (typeof SYSTEM_ROLE_DEFS)[SystemRoleKey]][]) {
    const existing = await db.role.findUnique({ where: { key } });
    if (existing) {
      await db.role.update({ where: { key }, data: { isSystem: true, description: existing.description ?? def.description } });
      continue;
    }
    const role = await db.role.create({ data: { key, name: def.name, description: def.description, isSystem: true } });
    await db.rolePermission.createMany({
      data: Object.entries(def.permissions).map(([permissionKey, scope]) => ({ roleId: role.id, permissionKey, scope })),
    });
    created.push(def.name);
  }
  // O Administrador sempre tem as permissões administrativas essenciais.
  const admin = await db.role.findUniqueOrThrow({ where: { key: SYSTEM_ROLES.ADMIN } });
  for (const permissionKey of ["users.manage", "permissions.manage"]) {
    await db.rolePermission.upsert({
      where: { roleId_permissionKey: { roleId: admin.id, permissionKey } },
      create: { roleId: admin.id, permissionKey, scope: "ALL" },
      update: { scope: "ALL" },
    });
  }

  // 3. Setores iniciais, só se ainda não houver nenhum setor (depois são configuráveis).
  let sectorsCreated = 0;
  if ((await db.sector.count()) === 0) {
    for (const s of INITIAL_SECTORS) await db.sector.create({ data: s });
    sectorsCreated = INITIAL_SECTORS.length;
  }
  return { rolesCreated: created, sectorsCreated };
}

/** Cria o primeiro administrador se não houver nenhum administrador ativo. */
export async function ensureFirstAdmin(db: PrismaClient, input: { name?: string; email?: string; password?: string }) {
  const admin = await db.role.findUniqueOrThrow({ where: { key: SYSTEM_ROLES.ADMIN } });
  const active = await db.user.count({ where: { roleId: admin.id, status: "ACTIVE" } });
  if (active > 0) return { created: false as const };
  if (!input.email || !input.password || !input.name) {
    throw new Error("Defina SEED_ADMIN_NAME, SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD para criar o primeiro administrador.");
  }
  const policy = passwordPolicyError(input.password, input.email);
  if (policy) throw new Error(`SEED_ADMIN_PASSWORD: ${policy}`);
  const sector =
    (await db.sector.findFirst({ where: { name: "Gestão de Marketing" } })) ?? (await db.sector.findFirst({ where: { active: true } }));
  const user = await db.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: await hashPassword(input.password),
      mustChangePassword: true,
      roleId: admin.id,
      sectorId: sector?.id ?? null,
    },
  });
  await db.auditLog.create({
    data: {
      action: "user.bootstrap_admin",
      entityType: "User",
      entityId: user.id,
      summary: `Primeiro administrador criado pelo seed: ${user.email}`,
    },
  });
  return { created: true as const, email: user.email };
}
