import { requireUser } from "@/lib/auth/session";
import { buildNav } from "@/lib/nav";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { unreadCount } from "@/modules/notifications/service";
import { avatarUrl } from "@/lib/files/avatar-url";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const nav = buildNav(user);
  const unread = await unreadCount(user.id);
  return (
    <div className="flex min-h-screen">
      <Sidebar groups={nav} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur sm:px-6">
          <MobileNav groups={nav} />
          <div className="min-w-0 flex-1">
            <GlobalSearch />
          </div>
          <NotificationBell initialUnread={unread} />
          <UserMenu name={user.name} email={user.email} roleName={user.roleName} avatarSrc={avatarUrl(user.id, user.avatarKey)} />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
