import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { guardPage } from "@/lib/auth/page";
import { userFormOptions } from "@/modules/users/queries";
import { PageHeader } from "@/components/layout/page-header";
import { UserForm } from "@/components/users/user-form";

export const metadata: Metadata = { title: "Convidar usuário" };

export default async function NewUserPage() {
  const user = await requireUser();
  guardPage(user, "users.manage");
  const { roles, sectors } = await userFormOptions();
  return (
    <>
      <PageHeader
        title="Convidar usuário"
        description="A pessoa recebe um link para definir a própria senha."
        back={{ href: "/configuracoes/usuarios", label: "Usuários" }}
      />
      <UserForm roles={roles} sectors={sectors} />
    </>
  );
}
