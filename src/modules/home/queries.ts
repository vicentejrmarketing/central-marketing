import { db } from "@/lib/db";
import { can, scopeOf, type Ctx } from "@/lib/auth/user";
import { visibleStoresWhere } from "@/lib/authz/stores";
import { listRegions } from "@/modules/stores/service";
import { latestNotifications, unreadCount } from "@/modules/notifications/service";

/** Números da tela inicial, sempre dentro do escopo do usuário. */
export async function homeSummary(ctx: Ctx) {
  const { user } = ctx;
  const storesScope = scopeOf(user, "stores.view");
  const restricted = storesScope === "STORES" || storesScope === "OWN";
  const storeWhere = await visibleStoresWhere(db, user, "stores.view");
  const manageUsers = can(user, "users.manage");
  const [activeStores, regions, activeUsers, pendingInvites, unread, latest, myStores] = await Promise.all([
    storesScope ? db.store.count({ where: { AND: [storeWhere, { status: "ACTIVE" }] } }) : 0,
    storesScope ? listRegions(ctx) : [],
    manageUsers ? db.user.count({ where: { status: "ACTIVE", passwordHash: { not: null } } }) : 0,
    manageUsers ? db.user.count({ where: { status: "ACTIVE", passwordHash: null } }) : 0,
    unreadCount(user.id),
    latestNotifications(user.id, 5),
    restricted
      ? db.store.findMany({
          where: { AND: [storeWhere, { status: "ACTIVE" }] },
          orderBy: { name: "asc" },
          include: { region: { select: { name: true } } },
        })
      : [],
  ]);
  return { storesScope, restricted, activeStores, regions, activeUsers, pendingInvites, unread, latest, myStores };
}
