"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Alert } from "@/components/ui/alert";
import { forgotPasswordAction } from "@/modules/auth/actions";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(forgotPasswordAction, null);
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Recuperar senha</h1>
      <p className="mb-6 text-sm text-muted-foreground">Informe seu e-mail para receber um link de redefinição.</p>
      {state?.ok ? (
        <Alert variant="info">{state.message}</Alert>
      ) : (
        <form action={action} className="grid gap-4" noValidate>
          {state && !state.ok && <Alert variant="destructive">{state.message}</Alert>}
          <Field label="E-mail" htmlFor="email" error={state?.fieldErrors?.email}>
            <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
          </Field>
          <SubmitButton pendingText="Enviando…" className="w-full">
            Enviar link
          </SubmitButton>
        </form>
      )}
      <Link href="/login" className="mt-4 block text-center text-sm text-primary hover:underline">
        Voltar para o login
      </Link>
    </>
  );
}
