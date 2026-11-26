/**
 * Restrição regional: o gerente regional só vê e só pode usar as lojas das regiões vinculadas a ele.
 * Cobre listas, detalhes, regiões, busca global, validação de lojas e histórico.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { assertStoresInScope, storeIdsFor } from "@/lib/authz/stores";
import {
  getRegion,
  getStore,
  listRegions,
  listStores,
  linkRegionalManager,
  unlinkRegionalManager,
  updateStore,
} from "@/modules/stores/service";
import { globalSearch } from "@/modules/search/service";
import { storeHistory } from "@/modules/audit/service";
import { createRegion, createStore, createUser, ctxFor, linkManager, resetData } from "../helpers/factory";

let admin: Awaited<ReturnType<typeof createUser>>;
let rmNorte: Awaited<ReturnType<typeof createUser>>;
let rmNorte2: Awaited<ReturnType<typeof createUser>>;
let rmSul: Awaited<ReturnType<typeof createUser>>;
let norte: Awaited<ReturnType<typeof createRegion>>;
let sul: Awaited<ReturnType<typeof createRegion>>;
let jvl: Awaited<ReturnType<typeof createStore>>;
let fln: Awaited<ReturnType<typeof createStore>>;

beforeAll(async () => {
  await resetData();
  admin = await createUser("admin", { name: "Admin" });
  rmNorte = await createUser("regional_manager", { name: "Gerente Norte" });
  rmNorte2 = await createUser("regional_manager", { name: "Gerente Norte Substituto" });
  rmSul = await createUser("regional_manager", { name: "Gerente Sul" });
  norte = await createRegion("Norte SC");
  sul = await createRegion("Grande Florianópolis");
  jvl = await createStore(norte.id, { name: "Joinville 01", code: "JVL01", city: "Joinville" });
  await createStore(norte.id, { name: "Jaraguá 01", code: "JGS01", city: "Jaraguá do Sul" });
  fln = await createStore(sul.id, { name: "Florianópolis 01", code: "FLN01", city: "Florianópolis" });
  await linkManager(norte.id, rmNorte.id, admin.id);
  await linkManager(norte.id, rmNorte2.id, admin.id);
  await linkManager(sul.id, rmSul.id, admin.id);
});

describe("lojas visíveis", () => {
  it("gerente regional vê só as lojas da sua região", async () => {
    const stores = await listStores(await ctxFor(rmNorte.id));
    expect(stores.map((s) => s.code).sort()).toEqual(["JGS01", "JVL01"]);
  });

  it("dois gerentes da mesma região veem as mesmas lojas", async () => {
    const a = await storeIdsFor(db, rmNorte.id);
    const b = await storeIdsFor(db, rmNorte2.id);
    expect(new Set(a)).toEqual(new Set(b));
  });

  it("administrador vê todas", async () => {
    const stores = await listStores(await ctxFor(admin.id));
    expect(stores).toHaveLength(3);
  });

  it("detalhe de loja de outra região responde 'não encontrada'", async () => {
    await expect(getStore(await ctxFor(rmNorte.id), fln.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getStore(await ctxFor(rmSul.id), fln.id)).resolves.toMatchObject({ code: "FLN01" });
  });

  it("histórico de loja de outra região também é negado", async () => {
    await expect(storeHistory(await ctxFor(rmSul.id), jvl.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("regiões visíveis", () => {
  it("gerente regional vê só as próprias regiões", async () => {
    const regions = await listRegions(await ctxFor(rmSul.id));
    expect(regions.map((r) => r.name)).toEqual(["Grande Florianópolis"]);
    await expect(getRegion(await ctxFor(rmSul.id), norte.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("busca global", () => {
  it("não devolve lojas, regiões nem pessoas fora do escopo", async () => {
    const results = await globalSearch(await ctxFor(rmNorte.id), "florian");
    expect(results).toEqual([]);
    const own = await globalSearch(await ctxFor(rmNorte.id), "jaragua");
    expect(own.map((r) => r.title)).toEqual(["Jaraguá 01"]);
    const people = await globalSearch(await ctxFor(rmNorte.id), "gerente");
    expect(people.filter((r) => r.group === "Pessoas")).toEqual([]);
  });

  it("busca ignora acentos", async () => {
    const results = await globalSearch(await ctxFor(admin.id), "FLORIANOPOLIS");
    expect(results.some((r) => r.title === "Florianópolis 01")).toBe(true);
  });
});

describe("validação de lojas no servidor (usada por requisições, tarefas e exportações)", () => {
  it("recusa qualquer loja fora das regiões do gerente, mesmo misturada com lojas válidas", async () => {
    const ctx = await ctxFor(rmNorte.id);
    await expect(assertStoresInScope(db, ctx.user, "requests.create", [jvl.id])).resolves.toBeUndefined();
    await expect(assertStoresInScope(db, ctx.user, "requests.create", [jvl.id, fln.id])).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("administrador pode usar qualquer loja", async () => {
    const ctx = await ctxFor(admin.id);
    await expect(assertStoresInScope(db, ctx.user, "requests.create", [jvl.id, fln.id])).resolves.toBeUndefined();
  });

  it("colaborador, sem a permissão de abrir requisição, é recusado", async () => {
    const colab = await createUser("collaborator");
    const ctx = await ctxFor(colab.id);
    await expect(assertStoresInScope(db, ctx.user, "requests.create", [jvl.id])).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("loja inativa é recusada quando a operação exige loja ativa", async () => {
    const fechada = await createStore(norte.id, { name: "Joinville 99", status: "INACTIVE" });
    const ctx = await ctxFor(rmNorte.id);
    await expect(assertStoresInScope(db, ctx.user, "requests.create", [fechada.id], { requireActive: true })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("mudanças de vínculo e de região têm efeito imediato", () => {
  it("ao desvincular, o gerente deixa de ver as lojas na hora e o histórico fica guardado", async () => {
    const temp = await createUser("regional_manager", { name: "Gerente Temporário" });
    const adminCtx = await ctxFor(admin.id);
    const link = await linkRegionalManager(adminCtx, { regionId: sul.id, userId: temp.id });
    expect((await listStores(await ctxFor(temp.id))).map((s) => s.code)).toEqual(["FLN01"]);
    await unlinkRegionalManager(adminCtx, link.id);
    expect(await listStores(await ctxFor(temp.id))).toEqual([]);
    const history = await db.regionManager.findUniqueOrThrow({ where: { id: link.id } });
    expect(history.endsAt).not.toBeNull();
    expect(history.endedById).toBe(admin.id);
  });

  it("loja que muda de região passa para o gerente da nova região", async () => {
    const adminCtx = await ctxFor(admin.id);
    const store = await createStore(norte.id, { name: "São Bento 01", code: "SBS01" });
    await updateStore(adminCtx, {
      id: store.id,
      version: store.version,
      code: "SBS01",
      name: "São Bento 01",
      city: "São Bento do Sul",
      state: "SC",
      regionId: sul.id,
      status: "ACTIVE",
    });
    expect((await storeIdsFor(db, rmSul.id)).includes(store.id)).toBe(true);
    expect((await storeIdsFor(db, rmNorte.id)).includes(store.id)).toBe(false);
    const notes = await db.notification.findMany({ where: { entityId: store.id } });
    expect(notes.map((n) => n.userId).sort()).toEqual([rmNorte.id, rmNorte2.id, rmSul.id].sort());
  });

  it("só usuários com papel Gerente Regional podem ser vinculados", async () => {
    const colab = await createUser("collaborator");
    await expect(linkRegionalManager(await ctxFor(admin.id), { regionId: norte.id, userId: colab.id })).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("não permite vínculo vigente duplicado (também protegido por índice único no banco)", async () => {
    await expect(linkRegionalManager(await ctxFor(admin.id), { regionId: norte.id, userId: rmNorte.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(linkManager(norte.id, rmNorte.id, admin.id)).rejects.toThrow();
  });

  it("gerente regional não pode vincular nem desvincular gerentes", async () => {
    await expect(linkRegionalManager(await ctxFor(rmNorte.id), { regionId: sul.id, userId: rmNorte.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
