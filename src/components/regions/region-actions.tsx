"use client";
import { Archive, ArchiveRestore, Unlink } from "lucide-react";
import { ConfirmActionButton } from "@/components/form/confirm-action-button";
import { setRegionActiveAction, unlinkManagerAction } from "@/modules/stores/actions";

export function UnlinkManagerButton({ linkId, name, region }: { linkId: string; name: string; region: string }) {
  return (
    <ConfirmActionButton
      action={() => unlinkManagerAction({ linkId })}
      title="Encerrar vínculo"
      description={
        <>
          {name} deixará de ver e de solicitar demandas para as lojas de {region} imediatamente. O histórico do vínculo será mantido.
        </>
      }
      confirmLabel="Encerrar vínculo"
      destructive
      variant="ghost"
    >
      <Unlink /> Desvincular
    </ConfirmActionButton>
  );
}

export function RegionArchiveButton({ id, active, name }: { id: string; active: boolean; name: string }) {
  return active ? (
    <ConfirmActionButton
      action={() => setRegionActiveAction({ id, active: false })}
      title="Arquivar região"
      description={<>A região {name} deixará de aparecer nos cadastros. Só é possível arquivar uma região sem lojas ativas.</>}
      confirmLabel="Arquivar"
      size="default"
    >
      <Archive /> Arquivar
    </ConfirmActionButton>
  ) : (
    <ConfirmActionButton
      action={() => setRegionActiveAction({ id, active: true })}
      title="Reativar região"
      description={<>A região {name} voltará a aparecer nos cadastros.</>}
      confirmLabel="Reativar"
      size="default"
    >
      <ArchiveRestore /> Reativar
    </ConfirmActionButton>
  );
}
