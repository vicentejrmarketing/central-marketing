/**
 * Matriz de permissões da Etapa 1: cada operação administrativa executada com cada papel.
 * As checagens são feitas no servidor (serviços), não na interface.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { SystemRoleKey } from "@/lib/authz/catalog";
import { createResetLink, inviteUser, setPermissionOverride, setUserStatus } from "@/modules/users/service";
import { createSector, deleteSector, setSectorActive } from "@/modules/sectors/service";
import { createRole, setRolePermission } from "@/modules/roles/service";
import { createRegion as createRegionSvc, createStore as createStoreSvc, linkRegionalManager, listStores } from "@/modules/stores/service";
import { listAudit } from "@/modules/audit/service";
import { anySectorId, createRegion, createUser, ctxFor, resetData, roleId } from "../helpers/factory";

const ROLES: SystemRoleKey[] = ["admin", "marketing_manager", "regional_manager", "sector_leader", "collaborator"];
const ctxs = {} as Record<SystemRoleKey, Awaited<ReturnType<typeof ctxFor>>>;
let target: { id: string };
let regionId: string;
let rmId: string;

beforeAll(async () => {
  await resetData();
  for (const r of ROLES) ctxs[r] = await ctxFor((await createUser(r)).id);
  target = await createUser("collaborator", { password: "senha-alvo-12345" });
  regionId = (await createRegion("Região Matriz")).id;
  rmId = (await createUser("regional_manager")).id;
});

let n = 0;
type Op = { name: string; allowed: SystemRoleKey[]; run: (ctx: (typeof ctxs)[SystemRoleKey]) => Promise<unknown> };

const ops: Op[] = [
  {
    name: "convidar usuário",
    allowed: ["admin"],
    run: async (c) =>
      inviteUser(c, {
        name: `Convidado ${n++}`,
        email: `c${n++}@m.local`,
        roleId: await roleId("collaborator"),
        sectorId: await anySectorId(),
      }),
  },
  { name: "gerar link de redefinição", allowed: ["admin"], run: (c) => createResetLink(c, target.id) },
  {
    name: "desativar/reativar usuário",
    allowed: ["admin"],
    run: async (c) => {
      await setUserStatus(c, target.id, false);
      await setUserStatus(c, target.id, true);
    },
  },
  {
    name: "conceder exceção de permissão",
    allowed: ["admin"],
    run: (c) => setPermissionOverride(c, { userId: target.id, permissionKey: "reports.view", effect: null, scope: "ALL" }),
  },
  { name: "criar setor", allowed: ["admin"], run: (c) => createSector(c, { name: `Setor ${n++}`, color: "#123456" }) },
  {
    name: "arquivar setor",
    allowed: ["admin"],
    run: async (c) => {
      const s = await db.sector.create({ data: { name: `Arq ${n++}` } });
      await setSectorActive(c, s.id, false);
    },
  },
  {
    name: "excluir setor vazio",
    allowed: ["admin"],
    run: async (c) => {
      const s = await db.sector.create({ data: { name: `Del ${n++}` } });
      await deleteSector(c, s.id);
    },
  },
  { name: "criar papel", allowed: ["admin"], run: (c) => createRole(c, { name: `Papel ${n++}` }) },
  {
    name: "alterar permissão de papel",
    allowed: ["admin"],
    run: async (c) => setRolePermission(c, { roleId: await roleId("collaborator"), permissionKey: "reports.view", scope: null }),
  },
  { name: "criar região", allowed: ["admin", "marketing_manager"], run: (c) => createRegionSvc(c, { name: `Região ${n++}` }) },
  {
    name: "cadastrar loja",
    allowed: ["admin", "marketing_manager"],
    run: (c) => createStoreSvc(c, { code: `M${n++}`, name: "Loja Matriz", city: "Blumenau", state: "SC", regionId, status: "ACTIVE" }),
  },
  {
    name: "vincular gerente regional",
    allowed: ["admin", "marketing_manager"],
    run: async (c) => {
      const l = await linkRegionalManager(c, { regionId, userId: rmId });
      await db.regionManager.update({ where: { id: l.id }, data: { endsAt: new Date() } });
    },
  },
  { name: "consultar auditoria", allowed: ["admin"], run: (c) => listAudit(c, {}) },
  {
    name: "listar lojas",
    allowed: ["admin", "marketing_manager", "regional_manager", "sector_leader", "collaborator"],
    run: (c) => listStores(c),
  },
];

describe.each(ops)("$name", (op) => {
  it.each(ROLES)("%s", async (role) => {
    const promise = op.run(ctxs[role]);
    if (op.allowed.includes(role)) await expect(promise).resolves.not.toThrow();
    else await expect(promise).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
