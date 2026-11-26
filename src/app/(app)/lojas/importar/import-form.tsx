"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2 } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { confirmImportAction, previewImportAction } from "@/modules/stores/actions";

const ACTION_LABEL = {
  create: <Badge variant="success">Nova</Badge>,
  update: <Badge>Atualizar</Badge>,
  unchanged: <Badge variant="secondary">Sem mudança</Badge>,
  error: <Badge variant="destructive">Erro</Badge>,
};

export function ImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [createRegions, setCreateRegions] = useState(true);
  const [preview, previewAction] = useActionState(previewImportAction, null);
  const [result, confirmAction] = useActionState(confirmImportAction, null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  useActionFeedback(preview);
  useActionFeedback(result);

  const payload = () => {
    const fd = new FormData();
    if (file) fd.append("file", file);
    if (createRegions) fd.append("createRegions", "on");
    return fd;
  };

  const data = preview?.ok ? preview.data : undefined;
  const done = result?.ok;
  const applicable = data ? data.counts.create + data.counts.update : 0;

  return (
    <Card>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <label htmlFor="file" className="text-sm font-medium">
              Planilha (.xlsx ou .csv, até 5 MB)
            </label>
            <Input
              ref={inputRef}
              id="file"
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button disabled={!file || pending} onClick={() => start(() => previewAction(payload()))}>
            {pending ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Pré-visualizar
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={createRegions}
            onChange={(e) => setCreateRegions(e.target.checked)}
            className="size-4 accent-primary"
          />
          Criar regiões que ainda não existem
        </label>

        {data && (
          <div className="grid gap-3">
            {data.missingColumns.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle />
                Faltam colunas obrigatórias: {data.missingColumns.join(", ")}.
              </Alert>
            )}
            {data.unknownHeaders.length > 0 && <Alert variant="info">Colunas ignoradas: {data.unknownHeaders.join(", ")}.</Alert>}
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="success">{data.counts.create} nova(s)</Badge>
              <Badge>{data.counts.update} a atualizar</Badge>
              <Badge variant="secondary">{data.counts.unchanged} sem mudança</Badge>
              <Badge variant="destructive">{data.counts.error} com erro</Badge>
              {data.counts.newRegions > 0 && <Badge variant="warning">{data.counts.newRegions} região(ões) nova(s)</Badge>}
            </div>
            <div className="max-h-[28rem] overflow-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0">
                  <TableRow>
                    <TableHead>Linha</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.line}>
                      <TableCell className="text-muted-foreground">{r.line}</TableCell>
                      <TableCell>{ACTION_LABEL[r.action]}</TableCell>
                      <TableCell>
                        <span className="font-medium">{r.name || "—"}</span>
                        <span className="block text-xs text-muted-foreground">{r.code}</span>
                      </TableCell>
                      <TableCell>
                        {r.city}
                        {r.state && `/${r.state}`}
                      </TableCell>
                      <TableCell>
                        {r.regionName}
                        {r.regionIsNew && (
                          <Badge variant="warning" className="ml-1">
                            nova
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-sm text-xs">
                        {r.errors.map((e) => (
                          <p key={e} className="text-destructive">
                            {e}
                          </p>
                        ))}
                        {r.warnings.map((w) => (
                          <p key={w} className="text-muted-foreground">
                            {w}
                          </p>
                        ))}
                        {r.regionalManagerEmail && <p className="text-muted-foreground">Gerente regional: {r.regionalManagerEmail}</p>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        {done && result.data && (
          <Alert variant="success">
            <CheckCircle2 />
            <span>
              {result.message} {result.data.errorCount > 0 && `${result.data.errorCount} linha(s) com erro não foram importadas.`}{" "}
              <Link href="/lojas" className="font-medium underline">
                Ver lojas
              </Link>
            </span>
          </Alert>
        )}
      </CardContent>
      {data && !done && (
        <CardFooter className="justify-between">
          <p className="text-sm text-muted-foreground">Linhas com erro serão ignoradas e ficarão registradas no histórico da importação.</p>
          <Button
            disabled={pending || applicable === 0 || data.missingColumns.length > 0}
            onClick={() => start(() => confirmAction(payload()))}
          >
            {pending && <Loader2 className="animate-spin" />} Confirmar importação de {applicable} loja(s)
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
