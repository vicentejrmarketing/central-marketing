"use server";
import { z } from "zod";
import { formAction, jsonAction } from "@/lib/action";
import { createRole, createRoleSchema, deleteRole, setRolePermission, setRolePermissionSchema } from "./service";

export const createRoleAction = formAction(
  createRoleSchema,
  async (ctx, i) => {
    const r = await createRole(ctx, i);
    return { id: r.id, name: r.name };
  },
  { revalidate: ["/configuracoes/papeis"], success: (r) => `Papel ${r.name} criado.` },
);
export const setRolePermissionAction = jsonAction(setRolePermissionSchema, setRolePermission, {
  success: "Permissão do papel atualizada.",
});
export const deleteRoleAction = jsonAction(z.object({ id: z.uuid() }), (ctx, i) => deleteRole(ctx, i.id), {
  revalidate: ["/configuracoes/papeis"],
  success: "Papel excluído.",
});
