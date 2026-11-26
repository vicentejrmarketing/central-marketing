"use client";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { createRegionAction, updateRegionAction } from "@/modules/stores/actions";
import type { ActionState } from "@/lib/action";

export function RegionDialog({ region }: { region?: { id: string; version: number; name: string; description: string | null } }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action] = useActionState(
    (region ? updateRegionAction : createRegionAction) as (p: ActionState<unknown>, f: FormData) => Promise<ActionState<unknown>>,
    null,
  );
  useActionFeedback(state, () => {
    setOpen(false);
    router.refresh();
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {region ? (
          <Button variant="outline">
            <Pencil /> Editar
          </Button>
        ) : (
          <Button>
            <Plus /> Nova região
          </Button>
        )}
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{region ? "Editar região" : "Nova região"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid gap-4" noValidate>
          {region && <input type="hidden" name="id" value={region.id} />}
          {region && <input type="hidden" name="version" value={region.version} />}
          <Field label="Nome" htmlFor="region-name" error={state?.fieldErrors?.name} required>
            <Input id="region-name" name="name" defaultValue={region?.name} required autoFocus />
          </Field>
          <Field label="Descrição" htmlFor="region-description" error={state?.fieldErrors?.description}>
            <Textarea id="region-description" name="description" defaultValue={region?.description ?? ""} rows={3} />
          </Field>
          <DialogFooter>
            <SubmitButton>{region ? "Salvar" : "Criar região"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
