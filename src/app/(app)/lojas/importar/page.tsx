import type { Metadata } from "next";
import { requireUser, getRequestMeta } from "@/lib/auth/session";
import { guardPage } from "@/lib/auth/page";
import { recentImports } from "@/modules/stores/import";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Importar lojas" };

export default async function ImportStoresPage() {
  const user = await requireUser();
  guardPage(user, "stores.manage");
  const imports = await recentImports({ user, meta: await getRequestMeta() });
  return (
    <>
      <PageHeader
        title="Importar lojas"
        description="Envie a planilha, confira a prévia e confirme. Lojas existentes são atualizadas pelo código."
        back={{ href: "/lojas", label: "Lojas" }}
      />
      <div className="grid gap-6">
        <ImportForm />
        <Card>
          <CardHeader>
            <CardTitle>Colunas reconhecidas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            <p>
              <strong className="text-foreground">Nome</strong> (ou Loja) — obrigatória
            </p>
            <p>
              <strong className="text-foreground">Cidade</strong>, <strong className="text-foreground">UF</strong> (ou Estado),{" "}
              <strong className="text-foreground">Região</strong> — obrigatórias
            </p>
            <p>
              <strong className="text-foreground">Código</strong> — se faltar, é gerado a partir do nome
            </p>
            <p>Endereço, Telefone, Gerente, Telefone do gerente</p>
            <p>Responsável (e-mail ou nome de um usuário)</p>
            <p>Gerente regional (e-mail de um usuário com esse papel)</p>
            <p>Status (Ativa/Inativa)</p>
            <p>A ordem das colunas não importa. Aceita .xlsx e .csv (vírgula ou ponto e vírgula).</p>
          </CardContent>
        </Card>
        {imports.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Importações anteriores</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {imports.map((i) => (
                  <li key={i.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>
                      <strong>{i.fileName}</strong> · {i.importedBy.name}
                    </span>
                    <span className="text-muted-foreground">
                      {i.createdCount} criada(s), {i.updatedCount} atualizada(s), {i.regionsCreated} região(ões),{" "}
                      {(i.errors as unknown[]).length} erro(s) · {formatDateTime(i.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
