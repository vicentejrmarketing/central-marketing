"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Alert } from "@/components/ui/alert";
import { loginAction } from "@/modules/auth/actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, null);
  return (
    <form action={action} className="grid gap-4" noValidate>
      {state && !state.ok && <Alert variant="destructive">{state.message}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="E-mail" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </Field>
      <Field label="Senha" htmlFor="password" error={state?.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton pendingText="Entrando…" className="w-full">
        Entrar
      </SubmitButton>
      <Link href="/recuperar-senha" className="text-center text-sm text-primary hover:underline">
        Esqueci minha senha
      </Link>
    </form>
  );
}
