import type { DbOrTx } from "@/lib/db";
import { computeEffectivePermissions, scopeCovers, type ScopeMap } from "@/lib/authz/effective";
import type { PermissionKey } from "@/lib/authz/catalog";
import type { PermissionScope, UserStatus } from "@/generated/prisma/enums";
import { forbidden } from "@/lib/errors";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  mustChangePassword: boolean;
  avatarKey: string | null;
  sectorId: string | null;
  roleId: string;
  roleKey: string;
  roleName: string;
  permissions: ScopeMap;
};

export type RequestMeta = { ip?: string | null; userAgent?: string | null; requestId?: string | null };

/** Contexto passado a todos os serviços: quem está agindo e de onde. */
export type Ctx = { user: AuthUser; meta: RequestMeta };

export async function loadAuthUser(db: DbOrTx, userId: string): Promise<AuthUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      role: { include: { permissions: true } },
      overrides: true,
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    avatarKey: user.avatarKey,
    sectorId: user.sectorId,
    roleId: user.roleId,
    roleKey: user.role.key,
    roleName: user.role.name,
    permissions: computeEffectivePermissions(user.role.permissions, user.overrides),
  };
}

/** Escopo concedido para a permissão, ou null se o usuário não a tem. */
export function scopeOf(user: AuthUser, key: PermissionKey): PermissionScope | null {
  return user.permissions.get(key) ?? null;
}

export function can(user: AuthUser, key: PermissionKey, required: PermissionScope = "OWN"): boolean {
  const granted = scopeOf(user, key);
  return granted !== null && scopeCovers(granted, required);
}

export function assertCan(user: AuthUser, key: PermissionKey, required: PermissionScope = "OWN"): PermissionScope {
  const granted = scopeOf(user, key);
  if (granted === null || !scopeCovers(granted, required)) throw forbidden();
  return granted;
}
