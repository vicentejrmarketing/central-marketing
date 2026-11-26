import type { Metadata } from "next";
import { requireUser, getRequestMeta } from "@/lib/auth/session";
import { guardPage } from "@/lib/auth/page";
import { sectorsOverview } from "@/modules/sectors/service";
import { marketingUsers } from "@/modules/users/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectorDialog } from "@/components/sectors/sector-dialog";
import { SectorRowActions } from "@/components/sectors/sector-row-actions";

export const metadata: Metadata = { title: "Setores" };

export default async function SectorsPage() {
  const user = await requireUser();
  guardPage(user, "sectors.manage");
  const [sectors, users] = await Promise.all([sectorsOverview({ user, meta: await getRequestMeta() }), marketingUsers()]);
  return (
    <>
      <PageHeader
        title="Setores"
        description="Áreas do departamento de marketing. Setores com usuários são arquivados em vez de excluídos."
        actions={<SectorDialog users={users} />}
      />
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Setor</TableHead>
              <TableHead>Líder</TableHead>
              <TableHead>Pessoas ativas</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sectors.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <span className="size-3 rounded-full" style={{ background: s.color }} aria-hidden />
                    <span className="font-medium">{s.name}</span>
                    {!s.active && <Badge variant="secondary">Arquivado</Badge>}
                  </span>
                  {s.description && <span className="block pl-5 text-xs text-muted-foreground">{s.description}</span>}
                </TableCell>
                <TableCell>{s.leader?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{s.activeMembers}</TableCell>
                <TableCell className="text-right">
                  <SectorDialog sector={s} users={users} />
                  <SectorRowActions id={s.id} name={s.name} active={s.active} members={s._count.members} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
