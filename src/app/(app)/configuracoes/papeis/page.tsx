import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { guardPage } from "@/lib/auth/page";
import { listRoles } from "@/modules/roles/service";
import { PERMISSIONS } from "@/lib/authz/catalog";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateRoleDialog } from "@/components/roles/create-role-dialog";

export const metadata: Metadata = { title: "Papéis e permissões" };

export default async function RolesPage() {
  const user = await requireUser();
  guardPage(user, "permissions.manage");
  const roles = await listRoles();
  return (
    <>
      <PageHeader
        title="Papéis e permissões"
        description="O papel define o acesso padrão. Exceções individuais são feitas no cadastro de cada usuário."
        actions={<CreateRoleDialog roles={roles.map((r) => ({ id: r.id, name: r.name }))} />}
      />
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Papel</TableHead>
              <TableHead>Permissões</TableHead>
              <TableHead>Usuários ativos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/configuracoes/papeis/${r.id}`} className="font-medium hover:text-primary">
                    {r.name}
                  </Link>
                  {r.isSystem && (
                    <Badge variant="secondary" className="ml-2">
                      Sistema
                    </Badge>
                  )}
                  {r.description && <span className="block max-w-xl text-xs text-muted-foreground">{r.description}</span>}
                </TableCell>
                <TableCell>
                  {r.permissions.length} de {PERMISSIONS.length}
                </TableCell>
                <TableCell>{r._count.users}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
