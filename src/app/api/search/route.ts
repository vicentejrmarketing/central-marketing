import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession, getRequestMeta } from "@/lib/auth/session";
import { globalSearch } from "@/modules/search/service";

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  const results = await globalSearch({ user: session.user, meta: await getRequestMeta() }, q);
  return NextResponse.json({ results });
}
