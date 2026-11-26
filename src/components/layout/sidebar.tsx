"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone } from "lucide-react";
import type { NavGroup } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { NavIcon } from "./nav-icon";

export function SidebarNav({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4" aria-label="Menu principal">
      {groups.map((g, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {g.label && <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">{g.label}</p>}
          {g.items.map((item) => {
            const active = item.match ? pathname.startsWith(item.match) : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
                  active && "bg-sidebar-accent font-medium text-white",
                )}
              >
                <NavIcon name={item.icon} className={cn("size-4", active ? "text-sidebar-primary" : "text-sidebar-muted")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-5 py-4 text-white">
      <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary/20 text-sidebar-primary">
        <Megaphone className="size-4" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold">Central de Marketing</span>
        <span className="block text-[11px] text-sidebar-muted">Gestão operacional</span>
      </span>
    </Link>
  );
}

export function Sidebar({ groups }: { groups: NavGroup[] }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar lg:flex">
      <Brand />
      <SidebarNav groups={groups} />
    </aside>
  );
}
