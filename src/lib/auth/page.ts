import "server-only";
import { notFound } from "next/navigation";
import { can, type AuthUser } from "./user";
import type { PermissionKey } from "@/lib/authz/catalog";
import type { PermissionScope } from "@/generated/prisma/enums";
import { AppError } from "@/lib/errors";

/**
 * Proteção de páginas: sem permissão, responde 404 (não revela que a página existe).
 * As ações e consultas chamadas pela página checam de novo no servidor.
 */
export function guardPage(user: AuthUser, key: PermissionKey, scope: PermissionScope = "OWN") {
  if (!can(user, key, scope)) notFound();
}

/** Converte "não encontrado"/"sem permissão" dos serviços em página 404. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof AppError && (err.code === "NOT_FOUND" || err.code === "FORBIDDEN")) notFound();
    throw err;
  }
}
