import { db } from "@/lib/db";
import { assertCan, type Ctx } from "@/lib/auth/user";
import { notFound } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";

export type UserFilters = { q?: string; roleId?: string; sectorId?: string; status?: "ACTIVE" | "INACTIVE" | "PENDING" | "ALL" };

export async function listUsers(ctx: Ctx, f: UserFilters) {
  assertCan(ctx.user, "users.manage");
  const where: Prisma.UserWhereInput = {
    ...(f.roleId ? { roleId: f.roleId } : {}),
    ...(f.sectorId ? { sectorId: f.sectorId } : {}),
    ...(f.status === "INACTIVE"
      ? { status: "INACTIVE" }
      : f.status === "PENDING"
        ? { status: "ACTIVE", passwordHash: null }
        : f.status === "ALL"
          ? {}
          : { status: "ACTIVE" }),
    ...(f.q ? { OR: [{ name: { contains: f.q, mode: "insensitive" } }, { email: { contains: f.q, mode: "insensitive" } }] } : {}),
  };
  return db.user.findMany({
    where,
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      role: { select: { name: true, key: true } },
      sector: { select: { name: true, color: true } },
      regionLinks: { where: { endsAt: null }, include: { region: { select: { name: true } } } },
    },
  });
}

export async function getUserDetail(ctx: Ctx, id: string) {
  assertCan(ctx.user, "users.manage");
  const user = await db.user.findUnique({
    where: { id },
    include: {
      role: { include: { permissions: true } },
      sector: true,
      overrides: { include: { grantedBy: { select: { name: true } } } },
      regionLinks: { orderBy: { startsAt: "desc" }, include: { region: { select: { id: true, name: true } } } },
      authTokens: { where: { usedAt: null, expiresAt: { gt: new Date() } }, select: { type: true, expiresAt: true } },
      _count: { select: { sessions: true } },
    },
  });
  if (!user) throw notFound("Usuário");
  return user;
}

export async function userFormOptions() {
  const [roles, sectors] = await Promise.all([
    db.role.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }], select: { id: true, name: true, key: true, description: true } }),
    db.sector.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { roles, sectors };
}

/** Chave da foto de perfil (qualquer usuário logado pode ver fotos de colegas). */
export async function avatarKeyOf(userId: string) {
  return (await db.user.findUnique({ where: { id: userId }, select: { avatarKey: true } }))?.avatarKey ?? null;
}

export async function ownProfile(ctx: Ctx) {
  const [user, sessions, regions] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: ctx.user.id }, include: { sector: { select: { name: true } } } }),
    db.session.findMany({ where: { userId: ctx.user.id, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } }),
    db.regionManager.findMany({ where: { userId: ctx.user.id, endsAt: null }, include: { region: { select: { name: true } } } }),
  ]);
  return { user, sessions, regions };
}

/** Usuários que podem ser líderes de setor ou responsáveis no marketing (exclui gerentes regionais). */
export async function marketingUsers() {
  return db.user.findMany({
    where: { status: "ACTIVE", role: { key: { not: "regional_manager" } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
