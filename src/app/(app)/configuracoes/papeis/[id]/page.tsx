import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { requireUser, getRequestMeta } from "@/lib/auth/session";
import { guardPage, orNotFound } from "@/lib/auth/page";
import { getRole } from "@/modules/roles/service";
import { PERMISSIONS, SYSTEM_ROLES } from "@/lib/authz/catalog";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleMatrix } from "@/components/roles/role-matrix";
import { ConfirmActionButtonDelete } from "./delete-button";

export const metadata: Metadata = { title: "Papel" };

export default async function RolePage({ params }: PageProps<"/configuracoes/papeis/[id]">) {
  const user = await requireUser();
  guardPage(user, "permissions.manage");
  const { id } = await params;
  const role = await orNotFound(getRole({ user, meta: await getRequestMeta() }, id));
  return (
    <>
      <PageHeader
        back={{ href: "/configuracoes/papeis", label: "Papéis e permissões" }}
        title={
          <span className="flex items-center gap-3">
            {role.name}
            {role.isSystem && <Badge variant="secondary">Sistema</Badge>}
          </span>
        }
        description={role.description ?? undefined}
        actions={!role.isSystem && role._count.users === 0 && <ConfirmActionButtonDelete id={role.id} name={role.name} icon={<Trash2 />} />}
      />
      <Card>
        <CardHeader>
          <CardTitle>Permissões do papel</CardTitle>
          <CardDescription>
            Alterações valem na próxima ação de cada usuário com este papel ({role._count.users} no total). Escopos: Próprios = registros em
            que a pessoa participa; Setor = do setor dela; Lojas vinculadas = das regiões dela; Todos = sem restrição.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RoleMatrix
            roleId={role.id}
            permissions={PERMISSIONS.map((p) => ({ ...p }))}
            scopes={Object.fromEntries(role.permissions.map((p) => [p.permissionKey, p.scope]))}
            locked={role.key === SYSTEM_ROLES.ADMIN ? ["users.manage", "permissions.manage"] : []}
          />
        </CardContent>
      </Card>
    </>
  );
}
