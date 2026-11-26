"use client";
import { useRouter } from "next/navigation";
import { ConfirmActionButton } from "@/components/form/confirm-action-button";
import { deleteRoleAction } from "@/modules/roles/actions";

export function ConfirmActionButtonDelete({ id, name, icon }: { id: string; name: string; icon: React.ReactNode }) {
  const router = useRouter();
  return (
    <ConfirmActionButton
      action={() => deleteRoleAction({ id })}
      title={`Excluir o papel ${name}?`}
      description="Nenhum usuário usa este papel. A exclusão fica registrada na auditoria."
      confirmLabel="Excluir"
      destructive
      size="default"
      onDone={() => router.push("/configuracoes/papeis")}
    >
      {icon} Excluir papel
    </ConfirmActionButton>
  );
}
