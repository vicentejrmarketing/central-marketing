import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Map, Store, Users } from "lucide-react";
import { requireUser, getRequestMeta } from "@/lib/auth/session";
import { can } from "@/lib/auth/user";
import { homeSummary } from "@/modules/home/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Início" };

function greeting() {
  const h = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(new Date()),
  );
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function Stat({ href, icon, label, value, hint }: { href?: string; icon: React.ReactNode; label: string; value: number; hint?: string }) {
  const body = (
    <Card className="transition-colors hover:border-primary/40">
      <CardContent className="flex items-center gap-4">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">{icon}</span>
        <div>
          <p className="text-2xl font-semibold leading-none">{value.toLocaleString("pt-BR")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function HomePage() {
  const user = await requireUser();
  const ctx = { user, meta: await getRequestMeta() };
  const { storesScope, restricted, activeStores, regions, activeUsers, pendingInvites, unread, latest, myStores } = await homeSummary(ctx);
  const regionsWithoutManager = regions.filter((r) => r.managers.length === 0);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {greeting()}, {user.name.split(" ")[0]}.
        </h1>
        <p className="text-sm text-muted-foreground">
          {user.roleName}
          {restricted && regions.length > 0 && ` · ${regions.map((r) => r.name).join(", ")}`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {storesScope && (
          <Stat href="/lojas" icon={<Store />} label={restricted ? "Minhas lojas ativas" : "Lojas ativas"} value={activeStores} />
        )}
        {storesScope && <Stat href="/regioes" icon={<Map />} label={restricted ? "Minhas regiões" : "Regiões"} value={regions.length} />}
        {can(user, "users.manage") && (
          <Stat
            href="/configuracoes/usuarios"
            icon={<Users />}
            label="Usuários ativos"
            value={activeUsers}
            hint={pendingInvites ? `${pendingInvites} convite(s) pendente(s)` : undefined}
          />
        )}
        <Stat href="/notificacoes" icon={<Bell />} label="Notificações não lidas" value={unread} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {restricted ? (
          <Card>
            <CardHeader>
              <CardTitle>Minhas lojas</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              {myStores.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Você ainda não está vinculado a nenhuma região. Fale com o gestor de marketing.
                </p>
              ) : (
                <ul className="divide-y">
                  {myStores.map((s) => (
                    <li key={s.id}>
                      <Link href={`/lojas/${s.id}`} className="flex items-center justify-between py-2 text-sm hover:text-primary">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-muted-foreground">
                          {s.city}/{s.state} · {s.region.name}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : (
          can(user, "regions.manage") && (
            <Card>
              <CardHeader>
                <CardTitle>Cobertura das regiões</CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                {regions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma região cadastrada.{" "}
                    <Link href="/regioes" className="text-primary hover:underline">
                      Cadastre as regiões
                    </Link>{" "}
                    ou{" "}
                    <Link href="/lojas/importar" className="text-primary hover:underline">
                      importe a planilha de lojas
                    </Link>
                    .
                  </p>
                ) : regionsWithoutManager.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Todas as {regions.length} regiões têm gerente regional vinculado.</p>
                ) : (
                  <ul className="divide-y">
                    {regionsWithoutManager.map((r) => (
                      <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                        <Link href={`/regioes/${r.id}`} className="font-medium hover:text-primary">
                          {r.name}
                        </Link>
                        <Badge variant="warning">Sem gerente regional</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )
        )}

        <Card>
          <CardHeader>
            <CardTitle>Últimas notificações</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            {latest.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma notificação por enquanto.</p>
            ) : (
              <ul className="divide-y">
                {latest.map((n) => (
                  <li key={n.id} className="py-2 text-sm">
                    {n.link ? (
                      <Link href={n.link} className="font-medium hover:text-primary">
                        {n.title}
                      </Link>
                    ) : (
                      <span className="font-medium">{n.title}</span>
                    )}
                    <p className="text-xs text-muted-foreground">{formatRelative(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
