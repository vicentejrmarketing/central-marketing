import { can, scopeOf, type AuthUser } from "@/lib/auth/user";

export type NavItem = { href: string; label: string; icon: string; match?: string };
export type NavGroup = { label?: string; items: NavItem[] };

/** Menu lateral montado a partir das permissões. Só aparecem módulos já implementados. */
export function buildNav(user: AuthUser): NavGroup[] {
  const main: NavItem[] = [{ href: "/", label: "Início", icon: "home" }];
  const storesScope = scopeOf(user, "stores.view");
  if (storesScope) {
    const restricted = storesScope === "STORES" || storesScope === "OWN";
    main.push({ href: "/lojas", label: restricted ? "Minhas lojas" : "Lojas", icon: "store", match: "/lojas" });
    main.push({ href: "/regioes", label: restricted ? "Minhas regiões" : "Regiões", icon: "map", match: "/regioes" });
  }
  main.push({ href: "/notificacoes", label: "Notificações", icon: "bell", match: "/notificacoes" });

  const admin: NavItem[] = [];
  if (can(user, "users.manage"))
    admin.push({ href: "/configuracoes/usuarios", label: "Usuários", icon: "users", match: "/configuracoes/usuarios" });
  if (can(user, "sectors.manage"))
    admin.push({ href: "/configuracoes/setores", label: "Setores", icon: "layers", match: "/configuracoes/setores" });
  if (can(user, "permissions.manage"))
    admin.push({ href: "/configuracoes/papeis", label: "Papéis e permissões", icon: "shield", match: "/configuracoes/papeis" });
  if (can(user, "audit.view")) admin.push({ href: "/auditoria", label: "Auditoria", icon: "history", match: "/auditoria" });

  return [{ items: main }, ...(admin.length ? [{ label: "Administração", items: admin }] : [])];
}
