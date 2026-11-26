import "server-only";
import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireCtx } from "@/lib/auth/session";
import type { Ctx } from "@/lib/auth/user";

export type ActionState<T = unknown> = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  data?: T;
  /** Muda a cada execução, para o cliente saber que chegou uma resposta nova. */
  at?: number;
} | null;

/**
 * Converte FormData em objeto. Campos repetidos (ex.: várias lojas) viram lista.
 * Arquivos são mantidos como File; strings vazias viram undefined.
 */
export function formDataToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const values = fd.getAll(key).map((v) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim()) : v));
    const clean = values.filter((v) => v !== undefined);
    out[key.replace(/\[\]$/, "")] = key.endsWith("[]") ? clean : clean.length > 1 ? clean : clean[0];
  }
  return out;
}

export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export function toActionError(err: unknown): NonNullable<ActionState> {
  unstable_rethrow(err);
  if (err instanceof AppError) return { ok: false, message: err.message, fieldErrors: err.fieldErrors, at: Date.now() };
  if (err instanceof z.ZodError) {
    return { ok: false, message: "Confira os campos destacados.", fieldErrors: zodFieldErrors(err), at: Date.now() };
  }
  console.error("[action] erro inesperado", err);
  return { ok: false, message: "Não foi possível concluir. Tente novamente em instantes.", at: Date.now() };
}

type Options<R> = {
  success?: string | ((result: R) => string);
  revalidate?: string[];
  allowPasswordChange?: boolean;
};

/**
 * Server action para formulários (useActionState). Garante o contrato de toda escrita:
 * sessão válida → validação Zod → serviço (que checa permissão, grava em transação e audita).
 */
export function formAction<S extends z.ZodType, R>(schema: S, handler: (ctx: Ctx, input: z.infer<S>) => Promise<R>, opts: Options<R> = {}) {
  return async (_prev: ActionState<R>, formData: FormData): Promise<ActionState<R>> => {
    try {
      const ctx = await requireCtx({ allowPasswordChange: opts.allowPasswordChange });
      const input = schema.parse(formDataToObject(formData));
      const result = await handler(ctx, input);
      for (const p of opts.revalidate ?? []) revalidatePath(p);
      const message = typeof opts.success === "function" ? opts.success(result) : opts.success;
      return { ok: true, message, data: result, at: Date.now() };
    } catch (err) {
      return toActionError(err) as ActionState<R>;
    }
  };
}

/** Server action chamada com objeto (botões, menus), com o mesmo contrato. */
export function jsonAction<S extends z.ZodType, R>(schema: S, handler: (ctx: Ctx, input: z.infer<S>) => Promise<R>, opts: Options<R> = {}) {
  return async (raw: z.input<S>): Promise<ActionState<R>> => {
    try {
      const ctx = await requireCtx({ allowPasswordChange: opts.allowPasswordChange });
      const input = schema.parse(raw);
      const result = await handler(ctx, input);
      for (const p of opts.revalidate ?? []) revalidatePath(p);
      const message = typeof opts.success === "function" ? opts.success(result) : opts.success;
      return { ok: true, message, data: result, at: Date.now() };
    } catch (err) {
      return toActionError(err) as ActionState<R>;
    }
  };
}
