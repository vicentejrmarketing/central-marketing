"use server";
import { z } from "zod";
import { formAction, jsonAction } from "@/lib/action";
import { createSector, deleteSector, sectorSchema, setSectorActive, updateSector, updateSectorSchema } from "./service";

const path = ["/configuracoes/setores"];
const pick = (s: { id: string; name: string; active: boolean }) => ({ id: s.id, name: s.name, active: s.active });
export const createSectorAction = formAction(sectorSchema, async (ctx, i) => pick(await createSector(ctx, i)), {
  revalidate: path,
  success: (s) => `Setor ${s.name} criado.`,
});
export const updateSectorAction = formAction(updateSectorSchema, async (ctx, i) => pick(await updateSector(ctx, i)), {
  revalidate: path,
  success: "Setor atualizado.",
});
export const setSectorActiveAction = jsonAction(
  z.object({ id: z.uuid(), active: z.boolean() }),
  async (ctx, i) => pick(await setSectorActive(ctx, i.id, i.active)),
  {
    revalidate: path,
    success: (s) => (s.active ? "Setor reativado." : "Setor arquivado."),
  },
);
export const deleteSectorAction = jsonAction(z.object({ id: z.uuid() }), (ctx, i) => deleteSector(ctx, i.id), {
  revalidate: path,
  success: "Setor excluído.",
});
