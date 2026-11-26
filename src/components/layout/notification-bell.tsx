"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { markAllReadAction, markReadAction } from "@/modules/notifications/actions";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string };

/**
 * Sino de notificações. Nesta etapa atualiza a cada 60 s e ao abrir o menu;
 * o tempo real (SSE) entra na Etapa 7 sem mudar este componente por fora.
 */
export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Item[] | null>(null);
  const [, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setUnread(data.unread);
    setItems(data.items);
  }, []);

  useEffect(() => {
    const t = setInterval(refresh, 60_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const open = (n: Item) => {
    if (!n.readAt) {
      startTransition(async () => {
        await markReadAction({ ids: [n.id] });
        refresh();
      });
    }
    if (n.link) router.push(n.link);
  };

  return (
    <DropdownMenu onOpenChange={(o) => o && refresh()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ""}`}>
          <Bell />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-w-[calc(100vw-1rem)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <p className="text-sm font-semibold">Notificações</p>
          <Button
            variant="ghost"
            size="sm"
            disabled={unread === 0}
            onClick={() =>
              startTransition(async () => {
                await markAllReadAction({});
                refresh();
              })
            }
          >
            <CheckCheck /> Marcar todas como lidas
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items === null ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma notificação por enquanto.</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={cn("flex w-full gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-accent", !n.readAt && "bg-primary/5")}
              >
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{n.title}</span>
                  {n.body && <span className="block text-xs text-muted-foreground">{n.body}</span>}
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{formatRelative(n.createdAt)}</span>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="border-t px-4 py-2 text-center">
          <Link href="/notificacoes" className="text-sm font-medium text-primary hover:underline">
            Ver histórico completo
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
