"use client";
import { useActionState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { changePasswordAction, removeAvatarAction, updateProfileAction, uploadAvatarAction } from "@/modules/users/actions";

export function ProfileForm({ name, phone, jobTitle }: { name: string; phone: string | null; jobTitle: string | null }) {
  const router = useRouter();
  const [state, action] = useActionState(updateProfileAction, null);
  useActionFeedback(state, () => router.refresh());
  const e = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="Nome completo" htmlFor="name" error={e.name} required className="sm:col-span-2">
        <Input id="name" name="name" defaultValue={name} required />
      </Field>
      <Field label="Cargo" htmlFor="jobTitle" error={e.jobTitle}>
        <Input id="jobTitle" name="jobTitle" defaultValue={jobTitle ?? ""} />
      </Field>
      <Field label="Telefone" htmlFor="phone" error={e.phone}>
        <Input id="phone" name="phone" type="tel" defaultValue={phone ?? ""} />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton>Salvar perfil</SubmitButton>
      </div>
    </form>
  );
}

export function AvatarForm({ name, src }: { name: string; src: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(uploadAvatarAction, null);
  const [pending, start] = useTransition();
  useActionFeedback(state, () => {
    formRef.current?.reset();
    router.refresh();
  });
  return (
    <form ref={formRef} action={action} className="flex items-center gap-4">
      <UserAvatar name={name} src={src} className="size-16 text-lg" />
      <div className="grid gap-2">
        <input
          ref={inputRef}
          type="file"
          name="avatar"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={() => formRef.current?.requestSubmit()}
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload /> {src ? "Trocar foto" : "Enviar foto"}
          </Button>
          {src && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await removeAvatarAction();
                  if (res?.ok) toast.success(res.message);
                  else toast.error(res?.message);
                  router.refresh();
                })
              }
            >
              <X /> Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG ou WebP, até 2 MB.</p>
      </div>
    </form>
  );
}

export function PasswordForm({ email }: { email: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [state, action] = useActionState(changePasswordAction, null);
  useActionFeedback(state, () => {
    formRef.current?.reset();
    router.refresh();
  });
  const e = state?.fieldErrors ?? {};
  return (
    <form ref={formRef} action={action} className="grid gap-4" noValidate>
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <Field label="Senha atual" htmlFor="currentPassword" error={e.currentPassword}>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" />
      </Field>
      <Field label="Nova senha" htmlFor="newPassword" error={e.newPassword} hint="Mínimo de 10 caracteres.">
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" />
      </Field>
      <Field label="Repita a nova senha" htmlFor="confirmPassword" error={e.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" />
      </Field>
      <div>
        <SubmitButton>Alterar senha</SubmitButton>
      </div>
    </form>
  );
}
