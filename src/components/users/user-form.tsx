"use client";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CopyLink } from "@/components/form/copy-link";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { inviteUserAction, updateUserAction } from "@/modules/users/actions";
import type { ActionState } from "@/lib/action";

type Role = { id: string; name: string; key: string; description: string | null };
type User = {
  id: string;
  version: number;
  name: string;
  email: string;
  jobTitle: string | null;
  phone: string | null;
  sectorId: string | null;
  roleId: string;
};

type Props = { roles: Role[]; sectors: { id: string; name: string }[]; user?: User };

export function UserForm(props: Props) {
  // A chave recria o formulário (e zera o estado da ação) ao convidar outra pessoa.
  const [formKey, setFormKey] = useState(0);
  return <UserFormInner key={formKey} {...props} onReset={() => setFormKey((k) => k + 1)} />;
}

function UserFormInner({ roles, sectors, user, onReset }: Props & { onReset: () => void }) {
  const router = useRouter();
  const [state, action] = useActionState(
    (user ? updateUserAction : inviteUserAction) as (p: ActionState<unknown>, f: FormData) => Promise<ActionState<unknown>>,
    null,
  );
  const [roleId, setRoleId] = useState(user?.roleId ?? "");
  const role = roles.find((r) => r.id === roleId);
  const isRegional = role?.key === "regional_manager";
  useActionFeedback(state, () => user && router.refresh());
  const e = state?.fieldErrors ?? {};
  const invited = !user && state?.ok ? (state.data as { userId: string; inviteUrl: string; emailSent: boolean }) : null;

  if (invited) {
    return (
      <Card>
        <CardContent className="grid gap-4">
          <Alert variant="success">
            <CheckCircle2 />
            Usuário criado.{invited.emailSent ? " O convite foi enviado por e-mail." : ""}
          </Alert>
          {!invited.emailSent && (
            <div className="grid gap-2">
              <p className="text-sm">
                O envio de e-mail não está configurado. Copie o link do convite e envie para a pessoa (vale por 72 horas):
              </p>
              <CopyLink url={invited.inviteUrl} label="Link do convite" />
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end">
          <Button variant="outline" onClick={() => router.push(`/configuracoes/usuarios/${invited.userId}`)}>
            Ver cadastro
          </Button>
          <Button onClick={onReset}>Convidar outra pessoa</Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <form action={action} noValidate>
      {user && <input type="hidden" name="id" value={user.id} />}
      {user && <input type="hidden" name="version" value={user.version} />}
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo" htmlFor="name" error={e.name} required>
            <Input id="name" name="name" defaultValue={user?.name} required autoComplete="off" />
          </Field>
          <Field label="E-mail" htmlFor="email" error={e.email} required>
            <Input id="email" name="email" type="email" defaultValue={user?.email} required autoComplete="off" />
          </Field>
          <Field label="Papel" htmlFor="roleId" error={e.roleId} required hint={role?.description ?? undefined}>
            <NativeSelect id="roleId" name="roleId" value={roleId} onChange={(ev) => setRoleId(ev.target.value)} required>
              <option value="" disabled>
                Selecione
              </option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label="Setor"
            htmlFor="sectorId"
            error={e.sectorId}
            required={!isRegional}
            hint={isRegional ? "Opcional: gerentes regionais não pertencem a um setor do marketing." : undefined}
          >
            <NativeSelect id="sectorId" name="sectorId" defaultValue={user?.sectorId ?? ""}>
              <option value="">{isRegional ? "Sem setor" : "Selecione"}</option>
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Cargo" htmlFor="jobTitle" error={e.jobTitle} hint="Só informativo; não dá acesso a nada.">
            <Input id="jobTitle" name="jobTitle" defaultValue={user?.jobTitle ?? ""} />
          </Field>
          <Field label="Telefone" htmlFor="phone" error={e.phone}>
            <Input id="phone" name="phone" type="tel" defaultValue={user?.phone ?? ""} />
          </Field>
          {isRegional && !user && (
            <Alert variant="info" className="sm:col-span-2">
              Depois de criar, vincule o gerente à região dele na tela Regiões.
            </Alert>
          )}
        </CardContent>
        <CardFooter className="justify-end">
          {!user && (
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
          )}
          <SubmitButton>{user ? "Salvar alterações" : "Criar e convidar"}</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
