"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { createStoreAction, updateStoreAction } from "@/modules/stores/actions";
import { UFS } from "@/modules/stores/schemas";
import type { ActionState } from "@/lib/action";

type Option = { id: string; name: string };
export type StoreFormValues = {
  id: string;
  version: number;
  code: string;
  name: string;
  city: string;
  state: string;
  address: string | null;
  phone: string | null;
  regionId: string;
  responsibleUserId: string | null;
  managerName: string | null;
  managerPhone: string | null;
  status: "ACTIVE" | "INACTIVE";
};

export function StoreForm({ regions, users, store }: { regions: Option[]; users: Option[]; store?: StoreFormValues }) {
  const router = useRouter();
  const [state, action] = useActionState(
    (store ? updateStoreAction : createStoreAction) as (
      p: ActionState<{ id: string }>,
      f: FormData,
    ) => Promise<ActionState<{ id: string }>>,
    null,
  );
  useActionFeedback(state, (s) => router.push(`/lojas/${s.data!.id}`));
  const e = state?.fieldErrors ?? {};
  return (
    <form action={action} noValidate>
      {store && <input type="hidden" name="id" value={store.id} />}
      {store && <input type="hidden" name="version" value={store.version} />}
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-6">
          <Field label="Código" htmlFor="code" error={e.code} required className="sm:col-span-2" hint="Ex.: JVL01">
            <Input id="code" name="code" defaultValue={store?.code} required maxLength={20} className="uppercase" />
          </Field>
          <Field label="Nome da loja" htmlFor="name" error={e.name} required className="sm:col-span-4">
            <Input id="name" name="name" defaultValue={store?.name} required />
          </Field>
          <Field label="Cidade" htmlFor="city" error={e.city} required className="sm:col-span-3">
            <Input id="city" name="city" defaultValue={store?.city} required />
          </Field>
          <Field label="UF" htmlFor="state" error={e.state} required className="sm:col-span-1">
            <NativeSelect id="state" name="state" defaultValue={store?.state ?? ""} required>
              <option value="" disabled>
                —
              </option>
              {UFS.map((uf) => (
                <option key={uf}>{uf}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Região" htmlFor="regionId" error={e.regionId} required className="sm:col-span-2">
            <NativeSelect id="regionId" name="regionId" defaultValue={store?.regionId ?? ""} required>
              <option value="" disabled>
                Selecione
              </option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Endereço" htmlFor="address" error={e.address} className="sm:col-span-4">
            <Input id="address" name="address" defaultValue={store?.address ?? ""} />
          </Field>
          <Field label="Telefone da loja" htmlFor="phone" error={e.phone} className="sm:col-span-2">
            <Input id="phone" name="phone" type="tel" defaultValue={store?.phone ?? ""} />
          </Field>
          <Field label="Responsável no marketing" htmlFor="responsibleUserId" error={e.responsibleUserId} className="sm:col-span-2">
            <NativeSelect id="responsibleUserId" name="responsibleUserId" defaultValue={store?.responsibleUserId ?? ""}>
              <option value="">Sem responsável</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label="Gerente da loja"
            htmlFor="managerName"
            error={e.managerName}
            className="sm:col-span-2"
            hint="Só contato; não acessa o sistema."
          >
            <Input id="managerName" name="managerName" defaultValue={store?.managerName ?? ""} />
          </Field>
          <Field label="Telefone do gerente" htmlFor="managerPhone" error={e.managerPhone} className="sm:col-span-2">
            <Input id="managerPhone" name="managerPhone" type="tel" defaultValue={store?.managerPhone ?? ""} />
          </Field>
          <Field label="Status" htmlFor="status" error={e.status} className="sm:col-span-2">
            <NativeSelect id="status" name="status" defaultValue={store?.status ?? "ACTIVE"}>
              <option value="ACTIVE">Ativa</option>
              <option value="INACTIVE">Inativa</option>
            </NativeSelect>
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <SubmitButton>{store ? "Salvar alterações" : "Cadastrar loja"}</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
