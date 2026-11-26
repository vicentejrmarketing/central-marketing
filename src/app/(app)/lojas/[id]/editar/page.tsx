import type { Metadata } from "next";
import { requireUser, getRequestMeta } from "@/lib/auth/session";
import { guardPage, orNotFound } from "@/lib/auth/page";
import { getStore } from "@/modules/stores/service";
import { storeFormOptions } from "@/modules/stores/options";
import { PageHeader } from "@/components/layout/page-header";
import { StoreForm } from "@/components/stores/store-form";

export const metadata: Metadata = { title: "Editar loja" };

export default async function EditStorePage({ params }: PageProps<"/lojas/[id]/editar">) {
  const user = await requireUser();
  guardPage(user, "stores.manage");
  const { id } = await params;
  const store = await orNotFound(getStore({ user, meta: await getRequestMeta() }, id));
  const { regions, users } = await storeFormOptions();
  if (!regions.some((r) => r.id === store.regionId)) regions.push({ id: store.regionId, name: `${store.region.name} (arquivada)` });
  return (
    <>
      <PageHeader title={`Editar ${store.name}`} back={{ href: `/lojas/${store.id}`, label: store.name }} />
      <StoreForm regions={regions} users={users} store={store} />
    </>
  );
}
