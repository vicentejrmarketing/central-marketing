import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet, Plus, Store } from "lucide-react";
import { requireUser, getRequestMeta } from "@/lib/auth/session";
import { can, scopeOf } from "@/lib/auth/user";
import { guardPage } from "@/lib/auth/page";
import { listRegions, listStores } from "@/modules/stores/service";
import { storeFiltersSchema } from "@/modules/stores/schemas";
import { PageHeader, EmptyState } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Lojas" };

export default async function StoresPage({ searchParams }: PageProps<"/lojas">) {
  const user = await requireUser();
  guardPage(user, "stores.view");
  const ctx = { user, meta: await getRequestMeta() };
  const filters = storeFiltersSchema.parse(await searchParams);
  const [stores, regions] = await Promise.all([listStores(ctx, filters), listRegions(ctx)]);
  const restricted = ["STORES", "OWN"].includes(scopeOf(user, "stores.view") ?? "");
  const manage = can(user, "stores.manage");
  const hasFilter = Boolean(filters.q || filters.regionId || filters.status);

  return (
    <>
      <PageHeader
        title={restricted ? "Minhas lojas" : "Lojas"}
        description={restricted ? "Lojas das regiões vinculadas a você." : "Todas as unidades atendidas pelo marketing."}
        actions={
          manage && (
            <>
              <Button variant="outline" asChild>
                <Link href="/lojas/importar">
                  <FileSpreadsheet /> Importar planilha
                </Link>
              </Button>
              <Button asChild>
                <Link href="/lojas/nova">
                  <Plus /> Nova loja
                </Link>
              </Button>
            </>
          )
        }
      />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_200px_160px_auto]" role="search">
        <Input name="q" defaultValue={filters.q} placeholder="Buscar por nome, código ou cidade" aria-label="Buscar lojas" />
        <NativeSelect name="regionId" defaultValue={filters.regionId ?? ""} aria-label="Região">
          <option value="">Todas as regiões</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={filters.status ?? ""} aria-label="Status">
          <option value="">Ativas</option>
          <option value="INACTIVE">Inativas</option>
          <option value="ALL">Todas</option>
        </NativeSelect>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
          {hasFilter && (
            <Button variant="ghost" asChild>
              <Link href="/lojas">Limpar</Link>
            </Button>
          )}
        </div>
      </form>

      {stores.length === 0 ? (
        <EmptyState
          icon={<Store />}
          title={
            hasFilter
              ? "Nenhuma loja encontrada com esses filtros"
              : restricted
                ? "Nenhuma loja vinculada a você"
                : "Nenhuma loja cadastrada"
          }
          description={
            restricted && !hasFilter
              ? "Peça ao gestor de marketing para vincular você à sua região."
              : manage && !hasFilter
                ? "Importe a planilha das lojas ou cadastre uma por uma."
                : undefined
          }
          action={
            manage && !hasFilter ? (
              <Button asChild>
                <Link href="/lojas/importar">
                  <FileSpreadsheet /> Importar planilha
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loja</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Região</TableHead>
                <TableHead className="hidden md:table-cell">Responsável</TableHead>
                <TableHead className="hidden lg:table-cell">Gerente da loja</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.map((s) => (
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
                  <TableCell>{s.region.name}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {s.responsible?.name ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {s.managerName ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {s.status === "ACTIVE" ? <Badge variant="success">Ativa</Badge> : <Badge variant="secondary">Inativa</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">{stores.length} loja(s)</p>
        </Card>
      )}
    </>
  );
}
