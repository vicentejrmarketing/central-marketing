import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { avatarKeyOf } from "@/modules/users/queries";
import { getPrivateFile } from "@/lib/files/storage";

/** Foto de perfil: visível para qualquer usuário logado (nomes e fotos aparecem em listas e atribuições). */
export async function GET(_req: Request, { params }: RouteContext<"/api/files/avatar/[userId]">) {
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });
  const { userId } = await params;
  const key = await avatarKeyOf(userId);
  if (!key) return new NextResponse(null, { status: 404 });
  const file = await getPrivateFile(key);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(file.body as BodyInit, {
    headers: { "Content-Type": file.contentType, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" },
  });
}
