import { NextResponse, type NextRequest } from "next/server";

/**
 * Checagem OTIMISTA: só redireciona para /login quem nem tem cookie de sessão.
 * A validação real (sessão no banco, permissões, escopo de lojas) acontece no servidor
 * de cada página, ação e rota.
 */
const PUBLIC = ["/login", "/recuperar-senha", "/redefinir-senha", "/convite", "/api/health"];
const COOKIE = process.env.NODE_ENV === "production" ? "__Host-cm_session" : "cm_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isPublic && !request.cookies.has(COOKIE)) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
