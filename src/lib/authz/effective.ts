/**
 * Cálculo da permissão efetiva: permissões do papel + concessões individuais − negações individuais.
 * Funções puras (sem banco) para serem testadas isoladamente.
 */
import type { OverrideEffect, PermissionScope } from "@/generated/prisma/enums";

export type ScopeMap = Map<string, PermissionScope>;

export function computeEffectivePermissions(
  rolePermissions: { permissionKey: string; scope: PermissionScope }[],
  overrides: { permissionKey: string; effect: OverrideEffect; scope: PermissionScope }[],
): ScopeMap {
  const map: ScopeMap = new Map(rolePermissions.map((p) => [p.permissionKey, p.scope]));
  for (const o of overrides) {
    if (o.effect === "GRANT") map.set(o.permissionKey, o.scope);
  }
  // DENY sempre vence, por isso é aplicado por último.
  for (const o of overrides) {
    if (o.effect === "DENY") map.delete(o.permissionKey);
  }
  return map;
}

/**
 * Um escopo "cobre" outro quando dá pelo menos o mesmo acesso.
 * ALL cobre todos; SECTOR e STORES são independentes entre si; ambos cobrem OWN.
 */
export function scopeCovers(granted: PermissionScope, required: PermissionScope): boolean {
  if (granted === "ALL") return true;
  if (granted === required) return true;
  if (required === "OWN") return granted === "SECTOR" || granted === "STORES";
  return false;
}
