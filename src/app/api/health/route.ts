import { NextResponse } from "next/server";
import { databaseIsUp } from "@/modules/system/health";

export const dynamic = "force-dynamic";

/** Verificação de saúde: aplicação no ar e banco respondendo. */
export async function GET() {
  return (await databaseIsUp())
    ? NextResponse.json({ status: "ok" })
    : NextResponse.json({ status: "erro", detalhe: "banco indisponível" }, { status: 503 });
}
