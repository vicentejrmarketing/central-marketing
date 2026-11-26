"use client";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { createSectorAction, updateSectorAction } from "@/modules/sectors/actions";
import type { ActionState } from "@/lib/action";

type Sector = { id: string; version: number; name: string; description: string | null; color: string; leaderId: string | null };

export function SectorDialog({ sector, users }: { sector?: Sector; users: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action] = useActionState(
    (sector ? updateSectorAction : createSectorAction) as (p: ActionState<unknown>, f: FormData) => Promise<ActionState<unknown>>,
    null,
  );
  useActionFeedback(state, () => {
    setOpen(false);
    router.refresh();
  });
  const e = state?.fieldErrors ?? {};
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {sector ? (
          <Button variant="ghost" size="sm">
            <Pencil /> Editar
          </Button>
        ) : (
          <Button>
            <Plus /> Novo setor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{sector ? `Editar ${sector.name}` : "Novo setor"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid gap-4" noValidate>
          {sector && <input type="hidden" name="id" value={sector.id} />}
          {sector && <input type="hidden" name="version" value={sector.version} />}
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label="Nome" htmlFor="sector-name" error={e.name} required>
              <Input id="sector-name" name="name" defaultValue={sector?.name} required autoFocus />
            </Field>
            <Field label="Cor" htmlFor="sector-color" error={e.color}>
              <Input id="sector-color" name="color" type="color" defaultValue={sector?.color ?? "#64748b"} className="w-16 p-1" />
            </Field>
          </div>
          <Field label="Líder do setor" htmlFor="sector-leader" error={e.leaderId}>
            <NativeSelect id="sector-leader" name="leaderId" defaultValue={sector?.leaderId ?? ""}>
              <option value="">Sem líder definido</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Descrição" htmlFor="sector-description" error={e.description}>
            <Textarea id="sector-description" name="description" defaultValue={sector?.description ?? ""} rows={3} />
          </Field>
          <DialogFooter>
            <SubmitButton>{sector ? "Salvar" : "Criar setor"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
