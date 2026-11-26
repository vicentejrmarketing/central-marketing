import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { findValidToken } from "@/modules/auth/service";
import { acceptInviteAction } from "@/modules/auth/actions";

export const metadata: Metadata = { title: "Aceitar convite" };

export default async function InvitePage({ params }: PageProps<"/convite/[token]">) {
  const { token } = await params;
  const row = await findValidToken(token, "INVITE");
  if (!row) {
    return (
      <>
        <h1 className="mb-4 text-xl font-semibold">Convite inválido</h1>
        <Alert variant="destructive">Este convite expirou ou já foi usado. Peça um novo convite ao administrador.</Alert>
        <Link href="/login" className="mt-4 block text-center text-sm text-primary hover:underline">
          Ir para o login
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Bem-vindo(a), {row.user.name.split(" ")[0]}!</h1>
      <p className="mb-6 text-sm text-muted-foreground">Defina sua senha para acessar com o e-mail {row.user.email}.</p>
      <SetPasswordForm token={token} email={row.user.email} action={acceptInviteAction} submitLabel="Definir senha e entrar" />
    </>
  );
}
