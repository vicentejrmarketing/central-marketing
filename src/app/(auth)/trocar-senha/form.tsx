"use client";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Alert } from "@/components/ui/alert";
import { forcedChangePasswordAction } from "@/modules/auth/actions";

export function ForcedChangeForm({ email }: { email: string }) {
  const [state, action] = useActionState(forcedChangePasswordAction, null);
  return (
    <form action={action} className="grid gap-4" noValidate>
      {state && !state.ok && <Alert variant="destructive">{state.message}</Alert>}
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <Field label="Senha atual" htmlFor="currentPassword" error={state?.fieldErrors?.currentPassword}>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required autoFocus />
      </Field>
      <Field label="Nova senha" htmlFor="newPassword" error={state?.fieldErrors?.newPassword} hint="Mínimo de 10 caracteres.">
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Repita a nova senha" htmlFor="confirmPassword" error={state?.fieldErrors?.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton className="w-full">Salvar e continuar</SubmitButton>
    </form>
  );
}
