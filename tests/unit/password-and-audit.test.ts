import { describe, expect, it } from "vitest";
import { hashPassword, needsRehash, passwordPolicyError, verifyPassword } from "@/lib/auth/password";
import { diffFields } from "@/lib/audit";
import { hashToken, randomToken } from "@/lib/auth/tokens";

describe("senhas (Argon2id)", () => {
  it("gera hash argon2id com os parâmetros da OWASP e verifica", async () => {
    const h = await hashPassword("uma-senha-bem-longa");
    expect(h.startsWith("$argon2id$v=19$m=19456,t=2,p=1$")).toBe(true);
    expect(needsRehash(h)).toBe(false);
    expect(await verifyPassword(h, "uma-senha-bem-longa")).toBe(true);
    expect(await verifyPassword(h, "errada")).toBe(false);
  });

  it("aplica a política mínima", () => {
    expect(passwordPolicyError("curta")).toMatch(/10 caracteres/);
    expect(passwordPolicyError("1234567890")).toMatch(/comum/);
    expect(passwordPolicyError("joao.silva-2026", "joao.silva@empresa.com")).toMatch(/e-mail/);
    expect(passwordPolicyError("cavalo-bateria-grampo")).toBeNull();
  });
});

describe("tokens", () => {
  it("são aleatórios e só o hash é persistido", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("auditoria: diferença de campos", () => {
  it("guarda só o que mudou e nunca campos sensíveis", () => {
    const d = diffFields(
      { name: "Ana", phone: "1", passwordHash: "x", updatedAt: new Date(1) },
      { name: "Ana", phone: "2", passwordHash: "y", updatedAt: new Date(2) },
    );
    expect(d).toEqual({ before: { phone: "1" }, after: { phone: "2" } });
  });

  it("retorna null quando nada mudou", () => {
    expect(diffFields({ a: 1 }, { a: 1 })).toBeNull();
  });
});
