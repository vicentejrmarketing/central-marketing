import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createSector, deleteSector, updateSector } from "@/modules/sectors/service";
import { createRole, deleteRole, setRolePermission } from "@/modules/roles/service";
import { createRegion, setRegionActive } from "@/modules/stores/service";
import { can } from "@/lib/auth/user";
import { createStore, createUser, ctxFor, resetData, roleId } from "../helpers/factory";

beforeEach(resetData);

describe("setores", () => {
  it("setor com usuários não pode ser excluído; sem usuários, pode", async () => {
    const admin = await createUser("admin");
    const ctx = await ctxFor(admin.id);
    const s = await createSector(ctx, { name: "Eventos", color: "#aa00aa" });
    await createUser("collaborator", { sectorId: s.id });
    await expect(deleteSector(ctx, s.id)).rejects.toMatchObject({ code: "CONFLICT" });
    const empty = await createSector(ctx, { name: "Temporário", color: "#aa00aa" });
    await deleteSector(ctx, empty.id);
    expect(await db.sector.findUnique({ where: { id: empty.id } })).toBeNull();
  });

  it("nome duplicado é recusado e o líder precisa ser usuário ativo", async () => {
    const admin = await createUser("admin");
    const ctx = await ctxFor(admin.id);
    await expect(createSector(ctx, { name: "Design", color: "#000000" })).rejects.toMatchObject({ code: "VALIDATION" });
    const inactive = await createUser("collaborator", { status: "INACTIVE" });
    const s = await createSector(ctx, { name: "Eventos", color: "#000000" });
    await expect(
      updateSector(ctx, { id: s.id, version: s.version, name: "Eventos", color: "#000000", leaderId: inactive.id }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("papéis", () => {
  it("papel personalizado copia permissões e pode ser excluído quando sem usuários", async () => {
    const admin = await createUser("admin");
    const ctx = await ctxFor(admin.id);
    const role = await createRole(ctx, { name: "Estagiário", copyFromRoleId: await roleId("collaborator") });
    expect(await db.rolePermission.count({ where: { roleId: role.id } })).toBe(
      await db.rolePermission.count({ where: { roleId: await roleId("collaborator") } }),
    );
    await deleteRole(ctx, role.id);
  });

  it("papéis de sistema não podem ser excluídos e o Administrador não perde as permissões essenciais", async () => {
    const admin = await createUser("admin");
    const ctx = await ctxFor(admin.id);
    await expect(deleteRole(ctx, await roleId("collaborator"))).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      setRolePermission(ctx, { roleId: await roleId("admin"), permissionKey: "users.manage", scope: null }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("alterar a matriz do papel vale na próxima requisição do usuário", async () => {
    const admin = await createUser("admin");
    const colab = await createUser("collaborator");
    expect(can((await ctxFor(colab.id)).user, "reports.view")).toBe(false);
    await setRolePermission(await ctxFor(admin.id), { roleId: await roleId("collaborator"), permissionKey: "reports.view", scope: "OWN" });
    expect(can((await ctxFor(colab.id)).user, "reports.view")).toBe(true);
    await setRolePermission(await ctxFor(admin.id), { roleId: await roleId("collaborator"), permissionKey: "reports.view", scope: null });
  });
});

describe("regiões", () => {
  it("não arquiva região com lojas ativas", async () => {
    const admin = await createUser("admin");
    const ctx = await ctxFor(admin.id);
    const region = await createRegion(ctx, { name: "Vale do Itajaí" });
    const store = await createStore(region.id);
    await expect(setRegionActive(ctx, region.id, false)).rejects.toMatchObject({ code: "CONFLICT" });
    await db.store.update({ where: { id: store.id }, data: { status: "INACTIVE" } });
    await expect(setRegionActive(ctx, region.id, false)).resolves.toBeTruthy();
  });
});
