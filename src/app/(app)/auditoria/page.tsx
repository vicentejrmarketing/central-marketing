import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { requireUser, getRequestMeta } from "@/lib/auth/session";
import { guardPage } from "@/lib/auth/page";
import { auditActors, listAudit } from "@/modules/audit/service";
import { PageHeader, EmptyState } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Auditoria" };

const ENTITY_LABELS: Record<string, string> = {
  User: "Usuários",
  Store: "Lojas",
  Region: "Regiões",
  Sector: "Setores",
  Role: "Papéis",
  StoreImport: "Importações",
};

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);
const schema = z.object({
  actorId: z.uuid().optional().catch(undefined),
  entityType: z.string().max(40).optional().catch(undefined),
  from: dateParam,
  to: dateParam,
  page: z.coerce.number().int().min(1).optional().catch(undefined),
});

/** Datas do filtro em dias de São Paulo (UTC−3). */
const spStart = (d: string) => new Date(`${d}T00:00:00-03:00`);

function Json({ value }: { value: unknown }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return (
    <pre className="max-w-xs overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted px-2 py-1 font-mono text-[11px]">
      {JSON.stringify(value, null, 1)}
    </pre>
  );
}

export default async function AuditPage({ searchParams }: PageProps<"/auditoria">) {
  const user = await requireUser();
  guardPage(user, "audit.view");
  const raw = await searchParams;
  const f = schema.parse(raw);
  const to = f.to ? new Date(spStart(f.to).getTime() + 86400000) : undefined;
  const ctx = { user, meta: await getRequestMeta() };
  const [{ items, total, page, pages }, actors] = await Promise.all([
    listAudit(ctx, { actorId: f.actorId, entityType: f.entityType, from: f.from ? spStart(f.from) : undefined, to, page: f.page }),
    auditActors(ctx),
  ]);
  const qs = (p: number) => {
    const s = new URLSearchParams(Object.entries({ ...f, page: String(p) }).filter(([, v]) => v !== undefined) as [string, string][]);
    return `/auditoria?${s}`;
  };
  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Trilha imutável de todas as ações importantes. Nenhum registro pode ser alterado ou apagado."
      />
      <form className="mb-4 grid gap-2 sm:grid-cols-[200px_180px_160px_160px_auto]">
        <NativeSelect name="actorId" defaultValue={f.actorId ?? ""} aria-label="Quem">
          <option value="">Todas as pessoas</option>
          {actors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="entityType" defaultValue={f.entityType ?? ""} aria-label="Tipo de registro">
          <option value="">Todos os registros</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
        <Input type="date" name="from" defaultValue={f.from} aria-label="De" />
        <Input type="date" name="to" defaultValue={f.to} aria-label="Até" />
        <div className="flex gap-2">
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/auditoria">Limpar</Link>
          </Button>
        </div>
      </form>
      {items.length === 0 ? (
        <EmptyState title="Nenhum registro encontrado" />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data e hora</TableHead>
                <TableHead>Quem</TableHead>
                <TableHead>O que aconteceu</TableHead>
                <TableHead className="hidden xl:table-cell">Antes</TableHead>
                <TableHead className="hidden xl:table-cell">Depois</TableHead>
                <TableHead className="hidden lg:table-cell">Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((a) => (
                <TableRow key={a.id} className="align-top">
                  <TableCell className="whitespace-nowrap">{formatDateTime(a.createdAt)}</TableCell>
                  <TableCell>{a.actor?.name ?? <span className="text-muted-foreground">Sistema</span>}</TableCell>
                  <TableCell>
                    <p>{a.summary}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{a.action}</p>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <Json value={a.before} />
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <Json value={a.after} />
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">{a.ip ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              {total.toLocaleString("pt-BR")} registro(s) · página {page} de {pages}
            </span>
            <span className="flex gap-2">
              {page > 1 && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={qs(page - 1)}>Anterior</Link>
                </Button>
              )}
              {page < pages && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={qs(page + 1)}>Próxima</Link>
                </Button>
              )}
            </span>
          </div>
        </Card>
      )}
    </>
  );
}
