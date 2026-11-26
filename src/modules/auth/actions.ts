"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { endSession, getRequestMeta, requireCtx, startSession } from "@/lib/auth/session";
import { formDataToObject, toActionError, type ActionState } from "@/lib/action";
import { authenticate, consumeTokenAndSetPassword, requestPasswordReset } from "./service";
import { changeOwnPassword } from "@/modules/users/service";
import { changePasswordSchema } from "@/modules/users/schemas";
import { emailConfigured } from "@/lib/email";

const loginSchema = z.object({
  email: z.email({ error: "Informe um e-mail válido." }),
  password: z.string({ error: "Informe a senha." }).min(1, "Informe a senha."),
  next: z.string().optional(),
});

/** Só aceita caminhos internos no "next" (evita redirecionamento aberto). */
function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let next = "/";
  try {
    const input = loginSchema.parse(formDataToObject(formData));
    const userId = await authenticate(input.email, input.password, await getRequestMeta());
    await startSession(userId);
    next = safeNext(input.next);
  } catch (err) {
    return toActionError(err);
  }
  redirect(next);
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { email } = z.object({ email: z.email({ error: "Informe um e-mail válido." }) }).parse(formDataToObject(formData));
    await requestPasswordReset(email, await getRequestMeta());
    return {
      ok: true,
      at: Date.now(),
      message: emailConfigured()
        ? "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha em alguns minutos."
        : "O envio de e-mails ainda não foi configurado. Peça ao administrador um link de redefinição de senha.",
    };
  } catch (err) {
    return toActionError(err);
  }
}

const setPasswordSchema = z
  .object({
    token: z.string().min(10),
    password: z.string({ error: "Informe a senha." }).min(1, "Informe a senha."),
    confirmPassword: z.string({ error: "Repita a senha." }),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "As senhas não conferem." });

async function setPasswordWithToken(type: "INVITE" | "PASSWORD_RESET", formData: FormData): Promise<ActionState> {
  let userId: string;
  try {
    const input = setPasswordSchema.parse(formDataToObject(formData));
    userId = await consumeTokenAndSetPassword(input.token, type, input.password, await getRequestMeta());
    await startSession(userId);
  } catch (err) {
    return toActionError(err);
  }
  redirect("/");
}

export async function acceptInviteAction(_prev: ActionState, formData: FormData) {
  return setPasswordWithToken("INVITE", formData);
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData) {
  return setPasswordWithToken("PASSWORD_RESET", formData);
}

/** Troca de senha obrigatória (primeiro acesso do administrador criado pelo seed, por exemplo). */
export async function forcedChangePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx({ allowPasswordChange: true });
    const input = changePasswordSchema.parse(formDataToObject(formData));
    await changeOwnPassword(ctx, input);
  } catch (err) {
    return toActionError(err);
  }
  redirect("/");
}
