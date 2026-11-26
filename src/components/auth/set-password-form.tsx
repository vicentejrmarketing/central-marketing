"use client";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionState } from "@/lib/action";

export function SetPasswordForm({
  token,
  email,
  action: serverAction,
  submitLabel,
}: {
  token: string;
  email: string;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  submitLabel: string;
}) {
  const [state, action] = useActionState(serverAction, null);
  return (
    <form action={action} className="grid gap-4" noValidate>
      {state && !state.ok && <Alert variant="destructive">{state.message}</Alert>}
      <input type="hidden" name="token" value={token} />
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <Field
        label="Nova senha"
        htmlFor="password"
        error={state?.fieldErrors?.password}
        hint="Mínimo de 10 caracteres. Uma frase longa é mais segura e fácil de lembrar."
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" required autoFocus />
      </Field>
      <Field label="Repita a nova senha" htmlFor="confirmPassword" error={state?.fieldErrors?.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton className="w-full">{submitLabel}</SubmitButton>
    </form>
  );
}
