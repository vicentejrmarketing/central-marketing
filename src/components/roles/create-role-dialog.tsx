"use client";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { createRoleAction } from "@/modules/roles/actions";

export function CreateRoleDialog({ roles }: { roles: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action] = useActionState(createRoleAction, null);
  useActionFeedback(state, (s) => {
    setOpen(false);
    router.push(`/configuracoes/papeis/${s.data!.id}`);
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Novo papel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo papel</DialogTitle>
          <DialogDescription>Crie um papel a partir de outro e ajuste as permissões depois.</DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4" noValidate>
          <Field label="Nome" htmlFor="role-name" error={state?.fieldErrors?.name} required>
            <Input id="role-name" name="name" required autoFocus />
          </Field>
          <Field label="Copiar permissões de" htmlFor="role-copy">
            <NativeSelect id="role-copy" name="copyFromRoleId" defaultValue="">
              <option value="">Começar sem permissões</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Descrição" htmlFor="role-description" error={state?.fieldErrors?.description}>
            <Textarea id="role-description" name="description" rows={2} />
          </Field>
          <DialogFooter>
            <SubmitButton>Criar papel</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
