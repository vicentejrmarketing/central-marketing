import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { findValidToken } from "@/modules/auth/service";
import { resetPasswordAction } from "@/modules/auth/actions";

export const metadata: Metadata = { title: "Redefinir senha" };

export default async function ResetPage({ params }: PageProps<"/redefinir-senha/[token]">) {
  const { token } = await params;
  const row = await findValidToken(token, "PASSWORD_RESET");
  if (!row) {
    return (
      <>
        <h1 className="mb-4 text-xl font-semibold">Link inválido</h1>
        <Alert variant="destructive">Este link expirou ou já foi usado. Solicite um novo.</Alert>
        <Link href="/recuperar-senha" className="mt-4 block text-center text-sm text-primary hover:underline">
          Pedir novo link
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Redefinir senha</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Defina uma nova senha para {row.user.email}. As outras sessões abertas serão encerradas.
      </p>
      <SetPasswordForm token={token} email={row.user.email} action={resetPasswordAction} submitLabel="Salvar nova senha" />
    </>
  );
}
