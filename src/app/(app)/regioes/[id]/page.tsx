import type { Metadata } from "next";
import Link from "next/link";
import { requireUser, getRequestMeta } from "@/lib/auth/session";
import { can } from "@/lib/auth/user";
import { guardPage, orNotFound } from "@/lib/auth/page";
import { getRegion, listRegionalManagerCandidates } from "@/modules/stores/service";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RegionDialog } from "@/components/regions/region-dialog";
import { LinkManagerForm } from "@/components/regions/link-manager-form";
import { RegionArchiveButton, UnlinkManagerButton } from "@/components/regions/region-actions";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Região" };

export default async function RegionPage({ params }: PageProps<"/regioes/[id]">) {
  const user = await requireUser();
  guardPage(user, "stores.view");
  const { id } = await params;
  const region = await orNotFound(getRegion({ user, meta: await getRequestMeta() }, id));
  const manage = can(user, "regions.manage");
  const current = region.managers.filter((m) => !m.endsAt);
  const past = region.managers.filter((m) => m.endsAt);
  const candidates = manage ? (await listRegionalManagerCandidates()).filter((c) => !current.some((m) => m.userId === c.id)) : [];

  return (
    <>
      <PageHeader
        back={{ href: "/regioes", label: "Regiões" }}
        title={
          <span className="flex items-center gap-3">
            {region.name}
            {!region.active && <Badge variant="secondary">Arquivada</Badge>}
          </span>
        }
        description={region.description ?? undefined}
        actions={
          manage && (
            <>
              <RegionDialog region={region} />
              <RegionArchiveButton id={region.id} active={region.active} name={region.name} />
            </>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Lojas ({region.stores.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-3">
            {region.stores.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">Nenhuma loja nesta região.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loja</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {region.stores.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link href={`/lojas/${s.id}`} className="font-medium hover:text-primary">
                          {s.name}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{s.code}</span>
                      </TableCell>
                      <TableCell>
                        {s.city}/{s.state}
                      </TableCell>
                      <TableCell>
                        {s.status === "ACTIVE" ? <Badge variant="success">Ativa</Badge> : <Badge variant="secondary">Inativa</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <div className="grid content-start gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Gerentes regionais</CardTitle>
              <CardDescription>Abrem e acompanham requisições somente para as lojas desta região.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {current.length === 0 && (
                <Badge variant="warning" className="w-fit">
                  Nenhum gerente vinculado
                </Badge>
              )}
              {current.map((m) => (
                <div key={m.id} className="flex items-start justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {m.user.name}
                      {m.user.status === "INACTIVE" && <span className="text-muted-foreground"> (inativo)</span>}
                    </p>
                    <p className="text-muted-foreground">{m.user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Desde {formatDate(m.startsAt)} · vinculado por {m.assignedBy.name}
                    </p>
                  </div>
                  {manage && <UnlinkManagerButton linkId={m.id} name={m.user.name} region={region.name} />}
                </div>
              ))}
              {manage && region.active && <LinkManagerForm regionId={region.id} candidates={candidates} />}
            </CardContent>
          </Card>
          {manage && past.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Vínculos anteriores</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 text-sm">
                  {past.map((m) => (
                    <li key={m.id}>
                      <span className="font-medium">{m.user.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(m.startsAt)} a {formatDate(m.endsAt)}
                        {m.endedBy && ` · encerrado por ${m.endedBy.name}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
