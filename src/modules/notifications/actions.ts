"use server";
import { z } from "zod";
import { jsonAction } from "@/lib/action";
import { markAllRead, markRead } from "./service";

export const markReadAction = jsonAction(z.object({ ids: z.array(z.uuid()).max(200) }), (ctx, input) => markRead(ctx, input.ids), {
  revalidate: ["/notificacoes"],
});

export const markAllReadAction = jsonAction(z.object({}), (ctx) => markAllRead(ctx), {
  revalidate: ["/notificacoes"],
  success: (n) => (n ? "Notificações marcadas como lidas." : "Não havia notificações não lidas."),
});
