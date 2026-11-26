import type { Metadata } from "next";
import Link from "next/link";
import { Map } from "lucide-react";
import { requireUser, getRequestMeta } from "@/lib/auth/session";
import { can, scopeOf } from "@/lib/auth/user";
import { guardPage } from "@/lib/auth/page";
import { listRegions } from "@/modules/stores/service";
import { PageHeader, EmptyState } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RegionDialog } from "@/components/regions/region-dialog";

export const metadata: Metadata = { title: "Regiões" };

export default async function RegionsPage({ searchParams }: PageProps<"/regioes">) {
  const user = await requireUser();
  guardPage(user, "stores.view");
  const { arquivadas } = await searchParams;
  const showArchived = arquivadas === "1";
  const regions = await listRegions({ user, meta: await getRequestMeta() }, { includeArchived: showArchived });
  const manage = can(user, "regions.manage");
  const restricted = ["STORES", "OWN"].includes(scopeOf(user, "stores.view") ?? "");

  return (
    <>
      <PageHeader
        title={restricted ? "Minhas regiões" : "Regiões"}
        description={manage ? "Agrupe as lojas por região e vincule os gerentes regionais." : undefined}
        actions={manage && <RegionDialog />}
      />
      {manage && (
        <p className="mb-3 text-sm">
          <Link href={showArchived ? "/regioes" : "/regioes?arquivadas=1"} className="text-primary hover:underline">
            {showArchived ? "Ocultar arquivadas" : "Mostrar arquivadas"}
          </Link>
        </p>
      )}
      {regions.length === 0 ? (
        <EmptyState
          icon={<Map />}
          title={restricted ? "Você ainda não está vinculado a nenhuma região" : "Nenhuma região cadastrada"}
          description={manage ? "Crie as regiões aqui ou importe a planilha de lojas com a coluna Região." : undefined}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Região</TableHead>
                <TableHead>Lojas ativas</TableHead>
                <TableHead>Gerentes regionais</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regions.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/regioes/${r.id}`} className="font-medium hover:text-primary">
                      {r.name}
                    </Link>
                    {!r.active && (
                      <Badge variant="secondary" className="ml-2">
                        Arquivada
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{r._count.stores}</TableCell>
                  <TableCell>
                    {r.managers.length === 0 ? <Badge variant="warning">Sem gerente</Badge> : r.managers.map((m) => m.user.name).join(", ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
