import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus, Users } from "lucide-react";
import { z } from "zod";
import { requireUser, getRequestMeta } from "@/lib/auth/session";
import { guardPage } from "@/lib/auth/page";
import { listUsers, userFormOptions } from "@/modules/users/queries";
import { PageHeader, EmptyState } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { avatarUrl } from "@/lib/files/avatar-url";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Usuários" };

const filtersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  roleId: z.uuid().optional().catch(undefined),
  sectorId: z.uuid().optional().catch(undefined),
  status: z.enum(["ACTIVE", "INACTIVE", "PENDING", "ALL"]).optional().catch(undefined),
});

export default async function UsersPage({ searchParams }: PageProps<"/configuracoes/usuarios">) {
  const user = await requireUser();
  guardPage(user, "users.manage");
  const f = filtersSchema.parse(await searchParams);
  const [users, { roles, sectors }] = await Promise.all([listUsers({ user, meta: await getRequestMeta() }, f), userFormOptions()]);
  const hasFilter = Boolean(f.q || f.roleId || f.sectorId || f.status);
  return (
    <>
      <PageHeader
        title="Usuários"
        description="Pessoas com acesso ao sistema."
        actions={
          <Button asChild>
            <Link href="/configuracoes/usuarios/novo">
              <UserPlus /> Convidar usuário
            </Link>
          </Button>
        }
      />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_180px_180px_160px_auto]" role="search">
        <Input name="q" defaultValue={f.q} placeholder="Nome ou e-mail" aria-label="Buscar usuários" />
        <NativeSelect name="roleId" defaultValue={f.roleId ?? ""} aria-label="Papel">
          <option value="">Todos os papéis</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="sectorId" defaultValue={f.sectorId ?? ""} aria-label="Setor">
          <option value="">Todos os setores</option>
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={f.status ?? ""} aria-label="Status">
          <option value="">Ativos</option>
          <option value="PENDING">Convite pendente</option>
          <option value="INACTIVE">Inativos</option>
          <option value="ALL">Todos</option>
        </NativeSelect>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
          {hasFilter && (
            <Button variant="ghost" asChild>
              <Link href="/configuracoes/usuarios">Limpar</Link>
            </Button>
          )}
        </div>
      </form>
      {users.length === 0 ? (
        <EmptyState icon={<Users />} title="Nenhum usuário encontrado" />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead className="hidden md:table-cell">Setor / Regiões</TableHead>
                <TableHead className="hidden lg:table-cell">Cadastro</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link href={`/configuracoes/usuarios/${u.id}`} className="flex items-center gap-3">
                      <UserAvatar name={u.name} src={avatarUrl(u.id, u.avatarKey)} />
                      <span>
                        <span className="block font-medium hover:text-primary">{u.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {u.email}
                          {u.jobTitle && ` · ${u.jobTitle}`}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>{u.role.name}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {u.role.key === "regional_manager"
                      ? u.regionLinks.map((l) => l.region.name).join(", ") || <span className="text-muted-foreground">Sem região</span>
                      : (u.sector?.name ?? "—")}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{formatDate(u.createdAt)}</TableCell>
                  <TableCell>
                    {u.status === "INACTIVE" ? (
                      <Badge variant="secondary">Inativo</Badge>
                    ) : !u.passwordHash ? (
                      <Badge variant="warning">Convite pendente</Badge>
                    ) : (
                      <Badge variant="success">Ativo</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">{users.length} usuário(s)</p>
        </Card>
      )}
    </>
  );
}
