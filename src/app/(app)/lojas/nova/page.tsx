import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { guardPage } from "@/lib/auth/page";
import { storeFormOptions } from "@/modules/stores/options";
import { PageHeader } from "@/components/layout/page-header";
import { StoreForm } from "@/components/stores/store-form";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Nova loja" };

export default async function NewStorePage() {
  const user = await requireUser();
  guardPage(user, "stores.manage");
  const { regions, users } = await storeFormOptions();
  return (
    <>
      <PageHeader title="Nova loja" back={{ href: "/lojas", label: "Lojas" }} />
      {regions.length === 0 ? (
        <Alert variant="warning">
          Cadastre uma região antes de cadastrar lojas.{" "}
          <Link href="/regioes" className="font-medium underline">
            Ir para Regiões
          </Link>
        </Alert>
      ) : (
        <StoreForm regions={regions} users={users} />
      )}
    </>
  );
}
