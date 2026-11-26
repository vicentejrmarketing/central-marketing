import crypto from "node:crypto";

/** Token aleatório de 32 bytes, seguro para URL. */
export function randomToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** O banco guarda apenas o hash SHA-256 de tokens de sessão, convite e redefinição. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
