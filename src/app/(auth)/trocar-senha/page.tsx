import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { ForcedChangeForm } from "./form";

export const metadata: Metadata = { title: "Trocar senha" };

export default async function ForcedChangePage() {
  const user = await requireUser({ allowPasswordChange: true });
  if (!user.mustChangePassword) redirect("/");
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Troque sua senha</h1>
      <p className="mb-6 text-sm text-muted-foreground">Por segurança, defina uma senha pessoal antes de continuar.</p>
      <ForcedChangeForm email={user.email} />
    </>
  );
}
