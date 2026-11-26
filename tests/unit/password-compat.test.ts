import { describe, expect, it } from "vitest";
import { hashPassword, needsRehash, verifyPassword } from "@/lib/auth/password";

describe("compatibilidade de hashes Argon2id", () => {
  it("verifica hash PHC gerado pela libargon2 nativa (@node-rs/argon2, usada antes da migração)", async () => {
    // Vetor real gerado com @node-rs/argon2 (m=19456, t=2, p=1) para a senha "troque-esta-senha-123".
    const legacy = "$argon2id$v=19$m=19456,t=2,p=1$l67nWVoHrA68VlwWf5Q+4A$88fjIgOwoVNDy+kNSWiqLXDUN2C9ceMyq0EoqLwKGeE";
    expect(await verifyPassword(legacy, "troque-esta-senha-123")).toBe(true);
    expect(await verifyPassword(legacy, "outra-senha-qualquer")).toBe(false);
    expect(needsRehash(legacy)).toBe(false);
  });

  it("gera hash no mesmo formato PHC", async () => {
    const h = await hashPassword("cavalo-bateria-grampo");
    expect(h).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/);
  });

  it("recusa hash malformado", async () => {
    expect(await verifyPassword("$2b$10$abc", "x")).toBe(false);
  });
});
