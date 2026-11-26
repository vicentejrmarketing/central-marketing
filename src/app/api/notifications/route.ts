import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { latestNotifications, unreadCount } from "@/modules/notifications/service";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const [items, unread] = await Promise.all([latestNotifications(session.user.id), unreadCount(session.user.id)]);
  return NextResponse.json({ items, unread }, { headers: { "Cache-Control": "no-store" } });
}
