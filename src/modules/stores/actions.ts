"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { formAction, jsonAction, toActionError, type ActionState } from "@/lib/action";
import { requireCtx } from "@/lib/auth/session";
import { linkManagerSchema, regionSchema, storeSchema, unlinkManagerSchema, updateRegionSchema, updateStoreSchema } from "./schemas";
import {
  createRegion,
  createStore,
  linkRegionalManager,
  setRegionActive,
  unlinkRegionalManager,
  updateRegion,
  updateStore,
} from "./service";
import { applyImport, buildPreview, readSheet, type ImportPreview } from "./import";

const pick = (s: { id: string; name: string }) => ({ id: s.id, name: s.name });
const pickRegion = (r: { id: string; name: string; active: boolean }) => ({ id: r.id, name: r.name, active: r.active });

export const createStoreAction = formAction(storeSchema, async (ctx, i) => pick(await createStore(ctx, i)), {
  revalidate: ["/lojas"],
  success: (s) => `Loja ${s.name} cadastrada.`,
});
export const updateStoreAction = formAction(updateStoreSchema, async (ctx, i) => pick(await updateStore(ctx, i)), {
  revalidate: ["/lojas"],
  success: "Loja atualizada.",
});

export const createRegionAction = formAction(regionSchema, async (ctx, i) => pickRegion(await createRegion(ctx, i)), {
  revalidate: ["/regioes"],
  success: (r) => `Região ${r.name} criada.`,
});
export const updateRegionAction = formAction(updateRegionSchema, async (ctx, i) => pickRegion(await updateRegion(ctx, i)), {
  revalidate: ["/regioes"],
  success: "Região atualizada.",
});
export const setRegionActiveAction = jsonAction(
  z.object({ id: z.uuid(), active: z.boolean() }),
  async (ctx, i) => pickRegion(await setRegionActive(ctx, i.id, i.active)),
  {
    revalidate: ["/regioes"],
    success: (r) => (r.active ? "Região reativada." : "Região arquivada."),
  },
);
export const linkManagerAction = formAction(linkManagerSchema, async (ctx, i) => ({ id: (await linkRegionalManager(ctx, i)).id }), {
  revalidate: ["/regioes"],
  success: "Gerente regional vinculado.",
});
export const unlinkManagerAction = jsonAction(unlinkManagerSchema, (ctx, i) => unlinkRegionalManager(ctx, i.linkId), {
  revalidate: ["/regioes"],
  success: "Vínculo encerrado. O histórico foi mantido.",
});

async function previewFrom(formData: FormData) {
  const ctx = await requireCtx();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("NO_FILE");
  const sheet = await readSheet(await file.arrayBuffer(), file.name);
  const preview = await buildPreview(ctx, sheet, file.name, { createRegions: formData.get("createRegions") === "on" });
  return { ctx, preview };
}

export async function previewImportAction(_prev: ActionState<ImportPreview>, formData: FormData): Promise<ActionState<ImportPreview>> {
  try {
    const { preview } = await previewFrom(formData);
    return { ok: true, data: preview, at: Date.now() };
  } catch (err) {
    if (err instanceof Error && err.message === "NO_FILE")
      return { ok: false, message: "Escolha um arquivo .xlsx ou .csv.", at: Date.now() };
    return toActionError(err) as ActionState<ImportPreview>;
  }
}

/** Confirma a importação lendo de novo o MESMO arquivo (não confia em dados vindos do navegador). */
export async function confirmImportAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState<Awaited<ReturnType<typeof applyImport>>>> {
  try {
    const { ctx, preview } = await previewFrom(formData);
    const result = await applyImport(ctx, preview);
    revalidatePath("/lojas");
    revalidatePath("/regioes");
    return {
      ok: true,
      data: result,
      at: Date.now(),
      message: `Importação concluída: ${result.createdCount} criada(s), ${result.updatedCount} atualizada(s), ${result.regionsCreated} região(ões) nova(s).`,
    };
  } catch (err) {
    if (err instanceof Error && err.message === "NO_FILE") return { ok: false, message: "Escolha o arquivo novamente.", at: Date.now() };
    return toActionError(err) as ActionState<Awaited<ReturnType<typeof applyImport>>>;
  }
}
