import type { Metadata } from "next";
import { getCurrentSession, requireUser } from "@/lib/auth/session";
import { ownProfile } from "@/modules/users/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarForm, PasswordForm, ProfileForm } from "@/components/profile/profile-forms";
import { SessionsList } from "@/components/profile/sessions-list";
import { avatarUrl } from "@/lib/files/avatar-url";
import { SCOPE_LABELS, PERMISSIONS } from "@/lib/authz/catalog";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function ProfilePage() {
  const me = await requireUser();
  const session = (await getCurrentSession())!;
  const { user, sessions, regions } = await ownProfile({ user: me, meta: {} });
  const perms = PERMISSIONS.filter((p) => me.permissions.has(p.key));
  return (
    <>
      <PageHeader
        title="Meu perfil"
        description={`${me.roleName}${user.sector ? ` · ${user.sector.name}` : ""}${regions.length ? ` · ${regions.map((r) => r.region.name).join(", ")}` : ""}`}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados pessoais</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <AvatarForm name={user.name} src={avatarUrl(user.id, user.avatarKey)} />
            <ProfileForm name={user.name} phone={user.phone} jobTitle={user.jobTitle} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Senha</CardTitle>
            <CardDescription>Ao trocar, as sessões em outros dispositivos são encerradas.</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm email={user.email} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sessões abertas</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <SessionsList
              currentId={session.sessionId}
              sessions={sessions.map((s) => ({
                id: s.id,
                userAgent: s.userAgent,
                ip: s.ip,
                lastSeenAt: s.lastSeenAt.toISOString(),
                createdAt: s.createdAt.toISOString(),
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Minhas permissões</CardTitle>
            <CardDescription>Definidas pelo papel e por exceções individuais do administrador.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {perms.map((p) => (
                <li key={p.key} className="flex justify-between gap-2">
                  <span>{p.label}</span>
                  <span className="text-muted-foreground">{p.scoped ? SCOPE_LABELS[me.permissions.get(p.key)!] : "Sim"}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
