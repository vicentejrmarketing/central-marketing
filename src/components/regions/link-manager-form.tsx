"use client";
import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { linkManagerAction } from "@/modules/stores/actions";

export function LinkManagerForm({ regionId, candidates }: { regionId: string; candidates: { id: string; name: string; email: string }[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(linkManagerAction, null);
  useActionFeedback(state, () => {
    formRef.current?.reset();
    router.refresh();
  });
  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum usuário com o papel Gerente Regional disponível. Cadastre o gerente em Usuários com esse papel.
      </p>
    );
  }
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2 sm:flex-row" noValidate>
      <input type="hidden" name="regionId" value={regionId} />
      <div className="flex-1">
        <NativeSelect name="userId" defaultValue="" aria-label="Gerente regional" aria-invalid={Boolean(state?.fieldErrors?.userId)}>
          <option value="" disabled>
            Selecione o gerente regional
          </option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.email})
            </option>
          ))}
        </NativeSelect>
        {state?.fieldErrors?.userId && <p className="mt-1 text-xs text-destructive">{state.fieldErrors.userId[0]}</p>}
      </div>
      <SubmitButton pendingText="Vinculando…">Vincular</SubmitButton>
    </form>
  );
}
