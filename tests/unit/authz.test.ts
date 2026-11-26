import { describe, expect, it } from "vitest";
import { computeEffectivePermissions, scopeCovers } from "@/lib/authz/effective";
import { PERMISSIONS, SYSTEM_ROLE_DEFS } from "@/lib/authz/catalog";

describe("permissão efetiva", () => {
  const role = [
    { permissionKey: "stores.view", scope: "ALL" as const },
    { permissionKey: "tasks.view", scope: "SECTOR" as const },
  ];

  it("usa as permissões do papel quando não há exceções", () => {
    const map = computeEffectivePermissions(role, []);
    expect(map.get("stores.view")).toBe("ALL");
    expect(map.get("tasks.view")).toBe("SECTOR");
    expect(map.has("users.manage")).toBe(false);
  });

  it("concessão individual adiciona ou substitui o escopo", () => {
    const map = computeEffectivePermissions(role, [
      { permissionKey: "requests.create", effect: "GRANT", scope: "ALL" },
      { permissionKey: "tasks.view", effect: "GRANT", scope: "ALL" },
    ]);
    expect(map.get("requests.create")).toBe("ALL");
    expect(map.get("tasks.view")).toBe("ALL");
  });

  it("negação individual sempre vence, inclusive sobre o papel", () => {
    const map = computeEffectivePermissions(role, [{ permissionKey: "stores.view", effect: "DENY", scope: "ALL" }]);
    expect(map.has("stores.view")).toBe(false);
  });
});

describe("cobertura de escopos", () => {
  it("ALL cobre todos; SECTOR e STORES cobrem OWN; SECTOR e STORES não se cobrem", () => {
    expect(scopeCovers("ALL", "STORES")).toBe(true);
    expect(scopeCovers("SECTOR", "OWN")).toBe(true);
    expect(scopeCovers("STORES", "OWN")).toBe(true);
    expect(scopeCovers("STORES", "SECTOR")).toBe(false);
    expect(scopeCovers("SECTOR", "STORES")).toBe(false);
    expect(scopeCovers("OWN", "ALL")).toBe(false);
  });
});

describe("catálogo e matriz padrão", () => {
  it("todas as permissões da matriz existem no catálogo", () => {
    const keys = new Set(PERMISSIONS.map((p) => p.key));
    for (const def of Object.values(SYSTEM_ROLE_DEFS)) {
      for (const k of Object.keys(def.permissions)) expect(keys.has(k as never)).toBe(true);
    }
  });

  it("gerente regional: escopo STORES para ver e abrir requisições, sem acesso administrativo", () => {
    const p = SYSTEM_ROLE_DEFS.regional_manager.permissions;
    expect(p["requests.create"]).toBe("STORES");
    expect(p["requests.view"]).toBe("STORES");
    expect(p["stores.view"]).toBe("STORES");
    expect(p["users.manage"]).toBeUndefined();
    expect(p["stores.manage"]).toBeUndefined();
    expect(p["equipment.manage"]).toBeUndefined();
  });

  it("líderes e colaboradores não abrem requisições por padrão", () => {
    expect(SYSTEM_ROLE_DEFS.sector_leader.permissions["requests.create"]).toBeUndefined();
    expect(SYSTEM_ROLE_DEFS.collaborator.permissions["requests.create"]).toBeUndefined();
  });

  it("administrador e gestor abrem requisições para qualquer loja", () => {
    expect(SYSTEM_ROLE_DEFS.admin.permissions["requests.create"]).toBe("ALL");
    expect(SYSTEM_ROLE_DEFS.marketing_manager.permissions["requests.create"]).toBe("ALL");
  });
});
