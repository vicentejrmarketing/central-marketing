import type { Metadata } from "next";
import Link from "next/link";
import { History, MapPin, Pencil, Phone, UserRound } from "lucide-react";
import { requireUser, getRequestMeta } from "@/lib/auth/session";
import { can } from "@/lib/auth/user";
import { guardPage, orNotFound } from "@/lib/auth/page";
import { getStore } from "@/modules/stores/service";
import { storeHistory } from "@/modules/audit/service";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/lojas/[id]">): Promise<Metadata> {
  const user = await requireUser();
  const { id } = await params;
  const store = await getStore({ user, meta: {} }, id).catch(() => null);
  return { title: store?.name ?? "Loja" };
}

function Info({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}

export default async function StorePage({ params }: PageProps<"/lojas/[id]">) {
  const user = await requireUser();
  guardPage(user, "stores.view");
  const { id } = await params;
  const ctx = { user, meta: await getRequestMeta() };
  const store = await orNotFound(getStore(ctx, id));
  const history = await storeHistory(ctx, id);

  return (
    <>
      <PageHeader
        back={{ href: "/lojas", label: "Lojas" }}
        title={
          <span className="flex items-center gap-3">
            {store.name}
            {store.status === "ACTIVE" ? <Badge variant="success">Ativa</Badge> : <Badge variant="secondary">Inativa</Badge>}
          </span>
        }
        description={`${store.code} · ${store.city}/${store.state} · Região ${store.region.name}`}
        actions={
          can(user, "stores.manage") && (
            <Button variant="outline" asChild>
              <Link href={`/lojas/${store.id}/editar`}>
                <Pencil /> Editar
              </Link>
            </Button>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Dados da loja</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <Info icon={<MapPin />} label="Endereço">
              {store.address ?? "—"}
              <br />
              {store.city}/{store.state}
            </Info>
            <Info icon={<Phone />} label="Telefone da loja">
              {store.phone ?? "—"}
            </Info>
            <Info icon={<UserRound />} label="Gerente da loja (contato)">
              {store.managerName ?? "—"}
              {store.managerPhone && <span className="block text-muted-foreground">{store.managerPhone}</span>}
            </Info>
            <Info icon={<UserRound />} label="Responsável no marketing">
              {store.responsible?.name ?? "—"}
            </Info>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gerentes regionais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              Região{" "}
              <Link href={`/regioes/${store.region.id}`} className="font-medium text-foreground hover:text-primary">
                {store.region.name}
              </Link>
            </p>
            {store.region.managers.length === 0 ? (
              <Badge variant="warning" className="w-fit">
                Sem gerente regional vinculado
              </Badge>
            ) : (
              store.region.managers.map((m) => (
                <div key={m.id} className="text-sm">
                  <p className="font-medium">
                    {m.user.name}
                    {m.user.status === "INACTIVE" && <span className="text-muted-foreground"> (inativo)</span>}
                  </p>
                  <p className="text-muted-foreground">
                    {m.user.email}
                    {m.user.phone && ` · ${m.user.phone}`}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-4" /> Histórico
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
            ) : (
              <ol className="relative grid gap-4 border-l pl-5">
                {history.map((h) => (
                  <li key={h.id} className="text-sm">
                    <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-card bg-primary" />
                    <p>{h.summary}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
