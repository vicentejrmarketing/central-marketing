import type { Metadata } from "next";
import Link from "next/link";
import { requireUser, getRequestMeta } from "@/lib/auth/session";
import { can } from "@/lib/auth/user";
import { guardPage, orNotFound } from "@/lib/auth/page";
import { getUserDetail, userFormOptions } from "@/modules/users/queries";
import { entityHistory } from "@/modules/audit/service";
import { PERMISSIONS } from "@/lib/authz/catalog";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/avatar";
import { UserForm } from "@/components/users/user-form";
import { AccountActions } from "@/components/users/account-actions";
import { PermissionOverrides } from "@/components/users/permission-overrides";
import { avatarUrl } from "@/lib/files/avatar-url";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Usuário" };

export default async function UserPage({ params }: PageProps<"/configuracoes/usuarios/[id]">) {
  const me = await requireUser();
  guardPage(me, "users.manage");
  const { id } = await params;
  const ctx = { user: me, meta: await getRequestMeta() };
  const user = await orNotFound(getUserDetail(ctx, id));
  const { roles, sectors } = await userFormOptions();
  if (user.sectorId && !sectors.some((s) => s.id === user.sectorId) && user.sector)
    sectors.push({ id: user.sector.id, name: `${user.sector.name} (arquivado)` });
  const history = can(me, "audit.view") ? await entityHistory(ctx, "User", user.id, 15) : [];
  const pendingInvite = !user.passwordHash;

  return (
    <>
      <PageHeader
        back={{ href: "/configuracoes/usuarios", label: "Usuários" }}
        title={
          <span className="flex items-center gap-3">
            <UserAvatar name={user.name} src={avatarUrl(user.id, user.avatarKey)} className="size-10 text-sm" />
            {user.name}
            {user.status === "INACTIVE" ? (
              <Badge variant="secondary">Inativo</Badge>
            ) : pendingInvite ? (
              <Badge variant="warning">Convite pendente</Badge>
            ) : (
              <Badge variant="success">Ativo</Badge>
            )}
          </span>
        }
        description={`Cadastrado em ${formatDate(user.createdAt)}${user.lastLoginAt ? ` · último acesso em ${formatDateTime(user.lastLoginAt)}` : ""} · ${user._count.sessions} sessão(ões) aberta(s)`}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="grid content-start gap-6 xl:col-span-2">
          <UserForm roles={roles} sectors={sectors} user={user} />
          {can(me, "permissions.manage") && (
            <Card>
              <CardHeader>
                <CardTitle>Permissões individuais</CardTitle>
                <CardDescription>
                  Exceções valem só para esta pessoa e se somam ao papel <strong>{user.role.name}</strong>. &quot;Negar&quot; sempre vence.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PermissionOverrides
                  userId={user.id}
                  permissions={PERMISSIONS.map((p) => ({ ...p }))}
                  roleScopes={Object.fromEntries(user.role.permissions.map((p) => [p.permissionKey, p.scope]))}
                  overrides={Object.fromEntries(user.overrides.map((o) => [o.permissionKey, { effect: o.effect, scope: o.scope }]))}
                />
              </CardContent>
            </Card>
          )}
        </div>
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Acesso</CardTitle>
            </CardHeader>
            <CardContent>
              <AccountActions
                id={user.id}
                name={user.name}
                active={user.status === "ACTIVE"}
                pendingInvite={pendingInvite}
                isSelf={user.id === me.id}
              />
            </CardContent>
          </Card>
          {(user.role.key === "regional_manager" || user.regionLinks.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Regiões</CardTitle>
                <CardDescription>Os vínculos são feitos na página de cada região.</CardDescription>
              </CardHeader>
              <CardContent>
                {user.regionLinks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sem vínculo com regiões.{" "}
                    <Link href="/regioes" className="text-primary hover:underline">
                      Ir para Regiões
                    </Link>
                  </p>
                ) : (
                  <ul className="grid gap-2 text-sm">
                    {user.regionLinks.map((l) => (
                      <li key={l.id} className="flex justify-between gap-2">
                        <Link href={`/regioes/${l.region.id}`} className="font-medium hover:text-primary">
                          {l.region.name}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {l.endsAt ? `${formatDate(l.startsAt)} a ${formatDate(l.endsAt)}` : `desde ${formatDate(l.startsAt)}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Histórico</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-3 text-sm">
                  {history.map((h) => (
                    <li key={h.id}>
                      <p>{h.summary}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</p>
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
