import { argon2idAsync } from "@noble/hashes/argon2.js";

/**
 * Argon2id em JavaScript puro (biblioteca auditada @noble/hashes), que funciona igual no Node
 * e no Cloudflare Workers (onde não é permitido compilar WebAssembly em tempo de execução).
 * Parâmetros mínimos recomendados pela OWASP: 19 MiB, 2 iterações, 1 thread.
 * Formato gravado: padrão PHC ($argon2id$v=19$m=...,t=...,p=...$sal$hash), compatível com outras implementações.
 */
const PARAMS = { m: 19456, t: 2, p: 1, dkLen: 32 } as const;

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=+$/, "");
function unb64(text: string): Uint8Array {
  const pad = text + "=".repeat((4 - (text.length % 4)) % 4);
  return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await argon2idAsync(password, salt, PARAMS);
  return `$argon2id$v=19$m=${PARAMS.m},t=${PARAMS.t},p=${PARAMS.p}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(passwordHash);
    if (!match) return false;
    const [, m, t, p, saltB64, hashB64] = match;
    const expected = unb64(hashB64!);
    const actual = await argon2idAsync(password, unb64(saltB64!), { m: Number(m), t: Number(t), p: Number(p), dkLen: expected.length });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Hash fixo para gastar o mesmo tempo quando o e-mail não existe (evita descobrir e-mails pelo tempo de resposta). */
let dummyHash: Promise<string> | null = null;
export async function verifyAgainstDummy(password: string) {
  dummyHash ??= hashPassword("senha-inexistente-para-tempo-constante");
  await verifyPassword(await dummyHash, password);
}

export function needsRehash(passwordHash: string): boolean {
  return !passwordHash.startsWith(`$argon2id$v=19$m=${PARAMS.m},t=${PARAMS.t},p=${PARAMS.p}$`);
}

const COMMON = new Set([
  "1234567890", "12345678910", "0123456789", "senha12345", "senha123456", "password123", "qwertyuiop",
  "1q2w3e4r5t", "abcdef1234", "mudar12345", "trocar1234", "marketing123", "marketing2026", "admin12345",
  "administrador", "aaaaaaaaaa", "1111111111", "brasil2026", "iloveyou123", "123456789a",
]);

/** Política: mínimo de 10 caracteres, sem senhas comuns e sem conter o e-mail. Retorna a mensagem de erro, ou null. */
export function passwordPolicyError(password: string, email?: string): string | null {
  if (password.length < 10) return "A senha precisa ter pelo menos 10 caracteres.";
  if (password.length > 200) return "A senha pode ter no máximo 200 caracteres.";
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) return "Essa senha é muito comum. Escolha outra.";
  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return "A senha não pode conter o seu e-mail.";
  return null;
}
