/** Erros de domínio com mensagem pronta para o usuário (pt-BR). */
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "RATE_LIMITED",
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthenticated = () => new AppError("Sua sessão expirou. Entre novamente.", "UNAUTHENTICATED");
export const forbidden = (msg = "Você não tem permissão para esta ação.") => new AppError(msg, "FORBIDDEN");
/** Registros fora do escopo também respondem "não encontrado", para não revelar que existem. */
export const notFound = (what = "Registro") => new AppError(`${what} não encontrado.`, "NOT_FOUND");
export const conflict = (msg: string) => new AppError(msg, "CONFLICT");
export const invalid = (msg: string, fieldErrors?: Record<string, string[]>) => new AppError(msg, "VALIDATION", fieldErrors);

/** Falha de lock otimista: alguém salvou o registro antes. */
export const staleVersion = () =>
  conflict("Este registro foi alterado por outra pessoa enquanto você editava. Recarregue a página e tente de novo.");
