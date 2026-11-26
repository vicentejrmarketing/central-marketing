import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <SearchX className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p className="max-w-md text-sm text-muted-foreground">O endereço não existe ou você não tem acesso a este conteúdo.</p>
      <Button asChild variant="outline">
        <Link href="/">Voltar para o início</Link>
      </Button>
    </div>
  );
}
