"use server";
import { z } from "zod";
import { formAction, jsonAction } from "@/lib/action";
import { requireCtx } from "@/lib/auth/session";
import { toActionError, type ActionState } from "@/lib/action";
import { IMAGE_TYPES, deletePrivateFile, putPrivateFile } from "@/lib/files/storage";
import { revalidatePath } from "next/cache";
import { changePasswordSchema, inviteUserSchema, overrideSchema, profileSchema, setUserStatusSchema, updateUserSchema } from "./schemas";
import {
  changeOwnPassword,
  createResetLink,
  inviteUser,
  resendInvite,
  revokeOwnSession,
  setOwnAvatar,
  setPermissionOverride,
  setUserStatus,
  updateOwnProfile,
  updateUser,
} from "./service";

export const inviteUserAction = formAction(inviteUserSchema, inviteUser, {
  revalidate: ["/configuracoes/usuarios"],
  success: (r) => (r.emailSent ? "Convite enviado por e-mail." : "Usuário criado. Copie o link do convite e envie para a pessoa."),
});

export const updateUserAction = formAction(updateUserSchema, async (ctx, i) => ({ id: (await updateUser(ctx, i)).id }), {
  revalidate: ["/configuracoes/usuarios"],
  success: "Cadastro atualizado.",
});

export const setUserStatusAction = jsonAction(
  setUserStatusSchema,
  async (ctx, i) => ({ status: (await setUserStatus(ctx, i.id, i.active)).status }),
  {
    revalidate: ["/configuracoes/usuarios"],
    success: (u) => (u.status === "ACTIVE" ? "Usuário reativado." : "Usuário desativado e sessões encerradas."),
  },
);

export const resendInviteAction = jsonAction(z.object({ id: z.uuid() }), (ctx, i) => resendInvite(ctx, i.id), {
  success: (r) => (r.emailSent ? "Novo convite enviado por e-mail." : "Novo convite gerado. Copie o link."),
});

export const createResetLinkAction = jsonAction(z.object({ id: z.uuid() }), (ctx, i) => createResetLink(ctx, i.id), {
  success: (r) => (r.emailSent ? "Link de redefinição enviado por e-mail." : "Link de redefinição gerado. Copie e envie para a pessoa."),
});

export const setOverrideAction = jsonAction(overrideSchema, setPermissionOverride, { success: "Permissão individual atualizada." });

export const updateProfileAction = formAction(profileSchema, async (ctx, i) => ({ id: (await updateOwnProfile(ctx, i)).id }), {
  revalidate: ["/perfil", "/"],
  success: "Perfil atualizado.",
});

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    const input = changePasswordSchema.parse(Object.fromEntries(formData));
    await changeOwnPassword(ctx, input);
    revalidatePath("/perfil");
    return { ok: true, message: "Senha alterada. As outras sessões foram encerradas.", at: Date.now() };
  } catch (err) {
    return toActionError(err);
  }
}

export async function revokeSessionAction(input: { id: string }): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    await revokeOwnSession(ctx, z.uuid().parse(input.id));
    revalidatePath("/perfil");
    return { ok: true, message: "Sessão encerrada.", at: Date.now() };
  } catch (err) {
    return toActionError(err);
  }
}

const MAX_AVATAR = 2 * 1024 * 1024;

export async function uploadAvatarAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    const file = formData.get("avatar");
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Escolha uma imagem.", at: Date.now() };
    const ext = IMAGE_TYPES[file.type];
    if (!ext) return { ok: false, message: "Use uma imagem JPG, PNG ou WebP.", at: Date.now() };
    if (file.size > MAX_AVATAR) return { ok: false, message: "A imagem pode ter no máximo 2 MB.", at: Date.now() };
    const key = await putPrivateFile(`avatars/${ctx.user.id}.${ext}`, file, file.type);
    const previous = await setOwnAvatar(ctx, key);
    if (previous) await deletePrivateFile(previous);
    revalidatePath("/", "layout");
    return { ok: true, message: "Foto atualizada.", at: Date.now() };
  } catch (err) {
    return toActionError(err);
  }
}

export async function removeAvatarAction(): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    const previous = await setOwnAvatar(ctx, null);
    if (previous) await deletePrivateFile(previous);
    revalidatePath("/", "layout");
    return { ok: true, message: "Foto removida.", at: Date.now() };
  } catch (err) {
    return toActionError(err);
  }
}
