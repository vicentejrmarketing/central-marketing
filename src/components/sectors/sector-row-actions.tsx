"use client";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { ConfirmActionButton } from "@/components/form/confirm-action-button";
import { deleteSectorAction, setSectorActiveAction } from "@/modules/sectors/actions";

export function SectorRowActions({ id, name, active, members }: { id: string; name: string; active: boolean; members: number }) {
  return (
    <>
      {active ? (
        <ConfirmActionButton
          action={() => setSectorActiveAction({ id, active: false })}
          title={`Arquivar ${name}?`}
          description="O setor deixa de aparecer para novos cadastros. Os usuários e o histórico continuam ligados a ele."
          confirmLabel="Arquivar"
          variant="ghost"
        >
          <Archive /> Arquivar
        </ConfirmActionButton>
      ) : (
        <ConfirmActionButton
          action={() => setSectorActiveAction({ id, active: true })}
          title={`Reativar ${name}?`}
          description="O setor volta a aparecer nos cadastros."
          confirmLabel="Reativar"
          variant="ghost"
        >
          <ArchiveRestore /> Reativar
        </ConfirmActionButton>
      )}
      {members === 0 && (
        <ConfirmActionButton
          action={() => deleteSectorAction({ id })}
          title={`Excluir ${name}?`}
          description="O setor não tem usuários e será excluído definitivamente. A exclusão fica registrada na auditoria."
          confirmLabel="Excluir"
          destructive
          variant="ghost"
        >
          <Trash2 /> Excluir
        </ConfirmActionButton>
      )}
    </>
  );
}
