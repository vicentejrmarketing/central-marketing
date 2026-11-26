import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { requireUser, getRequestMeta } from "@/lib/auth/session";
import { listNotifications } from "@/modules/notifications/service";
import { PageHeader, EmptyState } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MarkAllReadButton, MarkReadLink } from "./client";

export const metadata: Metadata = { title: "Notificações" };

export default async function NotificationsPage({ searchParams }: PageProps<"/notificacoes">) {
  const user = await requireUser();
  const sp = await searchParams;
  const unreadOnly = sp.filtro === "nao-lidas";
  const pageNum = Math.max(1, Number(sp.pagina) || 1);
  const { items, total, page, pages } = await listNotifications({ user, meta: await getRequestMeta() }, { unreadOnly, page: pageNum });
  const base = unreadOnly ? "/notificacoes?filtro=nao-lidas&" : "/notificacoes?";
  return (
    <>
      <PageHeader title="Notificações" description="Histórico completo das suas notificações." actions={<MarkAllReadButton />} />
      <div className="mb-4 flex gap-2">
        <Button variant={unreadOnly ? "outline" : "secondary"} size="sm" asChild>
          <Link href="/notificacoes">Todas</Link>
        </Button>
        <Button variant={unreadOnly ? "secondary" : "outline"} size="sm" asChild>
          <Link href="/notificacoes?filtro=nao-lidas">Não lidas</Link>
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<Bell />} title={unreadOnly ? "Nenhuma notificação não lida" : "Nenhuma notificação"} />
      ) : (
        <Card className="divide-y p-0">
          {items.map((n) => (
            <div key={n.id} className={cn("flex gap-3 px-4 py-3", !n.readAt && "bg-primary/5")}>
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} />
              <div className="min-w-0 flex-1">
                <MarkReadLink id={n.id} href={n.link} unread={!n.readAt} title={n.title} />
                {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(n.createdAt)}
                  {n.readAt && ` · lida em ${formatDateTime(n.readAt)}`}
                </p>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-2 text-sm">
            <span className="text-muted-foreground">
              {total} notificação(ões) · página {page} de {pages}
            </span>
            <span className="flex gap-2">
              {page > 1 && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`${base}pagina=${page - 1}`}>Anterior</Link>
                </Button>
              )}
              {page < pages && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`${base}pagina=${page + 1}`}>Próxima</Link>
                </Button>
              )}
            </span>
          </div>
        </Card>
      )}
    </>
  );
}
