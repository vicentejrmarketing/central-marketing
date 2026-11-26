import { db } from "@/lib/db";
import { SYSTEM_ROLES } from "@/lib/authz/catalog";

/** Opções para os formulários de loja. */
export async function storeFormOptions() {
  const [regions, users] = await Promise.all([
    db.region.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({
      where: { status: "ACTIVE", role: { key: { not: SYSTEM_ROLES.REGIONAL_MANAGER } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { regions, users };
}
