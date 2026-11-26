import { beforeEach, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { applyImport, buildPreview, readSheet } from "@/modules/stores/import";
import { createRegion, createUser, ctxFor, resetData } from "../helpers/factory";

async function xlsx(rows: (string | number)[][]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Lojas");
  rows.forEach((r) => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  return buf instanceof ArrayBuffer ? buf : new Uint8Array(buf as unknown as ArrayBufferLike).slice().buffer;
}

const csv = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

beforeEach(resetData);

describe("importação de lojas", () => {
  it("lê XLSX por nome de coluna, cria regiões novas, vincula gerente regional e é idempotente", async () => {
    const admin = await createUser("admin");
    const rm = await createUser("regional_manager", { email: "regional.norte@empresa.com.br" });
    const ctx = await ctxFor(admin.id);
    await createRegion("Norte SC");
    const file = await xlsx([
      ["Relatório de lojas"],
      [
        "Nome da loja",
        "Código",
        "Cidade",
        "Estado",
        "Região",
        "Gerente",
        "Telefone do gerente",
        "Gerente regional",
        "Situação",
        "Observação",
      ],
      [
        "Joinville 01",
        "jvl01",
        "Joinville",
        "Santa Catarina",
        "Norte SC",
        "Carlos",
        "(47) 99999-0000",
        "regional.norte@empresa.com.br",
        "Ativa",
        "x",
      ],
      ["Blumenau 01", "BNU01", "Blumenau", "SC", "Vale do Itajaí", "", "", "", "", ""],
      ["Sem região", "SR01", "Itajaí", "SC", "", "", "", "", "", ""],
      ["Joinville 01 duplicada", "JVL01", "Joinville", "SC", "Norte SC", "", "", "", "", ""],
    ]);
    const sheet = await readSheet(file, "lojas.xlsx");
    expect(sheet.unknownHeaders).toEqual(["Observação"]);

    const blocked = await buildPreview(ctx, sheet, "lojas.xlsx", { createRegions: false });
    expect(blocked.rows.find((r) => r.code === "BNU01")?.action).toBe("error");

    const preview = await buildPreview(ctx, sheet, "lojas.xlsx", { createRegions: true });
    expect(preview.counts).toMatchObject({ create: 2, error: 2, newRegions: 1 });
    expect(preview.rows[0]).toMatchObject({ code: "JVL01", state: "SC", action: "create", regionalManagerEmail: rm.email });

    const result = await applyImport(ctx, preview);
    expect(result).toMatchObject({ createdCount: 2, updatedCount: 0, regionsCreated: 1, errorCount: 2 });
    expect(await db.store.count()).toBe(2);
    const norte = await db.region.findUniqueOrThrow({ where: { name: "Norte SC" } });
    expect(await db.regionManager.count({ where: { regionId: norte.id, userId: rm.id, endsAt: null } })).toBe(1);

    const again = await buildPreview(ctx, await readSheet(file, "lojas.xlsx"), "lojas.xlsx", { createRegions: true });
    expect(again.counts).toMatchObject({ create: 0, update: 0, unchanged: 2 });
    const imp = await db.storeImport.findFirstOrThrow();
    expect(imp.errors).toHaveLength(2);
  });

  it("lê CSV com ponto e vírgula e gera código a partir do nome quando falta", async () => {
    const admin = await createUser("admin");
    const ctx = await ctxFor(admin.id);
    await createRegion("Sul");
    const sheet = await readSheet(csv("Loja;Cidade;UF;Região\nCriciúma Centro;Criciúma;SC;Sul\n"), "lojas.csv");
    const preview = await buildPreview(ctx, sheet, "lojas.csv", { createRegions: false });
    expect(preview.rows[0]).toMatchObject({ code: "CRICIUMA-CENTRO", action: "create" });
    expect(preview.rows[0]!.warnings[0]).toMatch(/Sem código/);
  });

  it("atualiza lojas existentes e não vincula quem não tem papel de Gerente Regional", async () => {
    const admin = await createUser("admin");
    const colab = await createUser("collaborator", { email: "colab@empresa.com.br" });
    const ctx = await ctxFor(admin.id);
    const r = await createRegion("Norte SC");
    await db.store.create({ data: { code: "JVL01", name: "Joinville 01", city: "Joinville", state: "SC", regionId: r.id } });
    const sheet = await readSheet(
      csv("Código,Nome,Cidade,UF,Região,Gerente regional\nJVL01,Joinville Centro,Joinville,SC,Norte SC,colab@empresa.com.br\n"),
      "x.csv",
    );
    const preview = await buildPreview(ctx, sheet, "x.csv", { createRegions: false });
    expect(preview.rows[0]!.action).toBe("update");
    expect(preview.rows[0]!.warnings.join(" ")).toMatch(/não tem o papel Gerente Regional/);
    await applyImport(ctx, preview);
    expect((await db.store.findFirstOrThrow()).name).toBe("Joinville Centro");
    expect(await db.regionManager.count({ where: { userId: colab.id } })).toBe(0);
  });

  it("só quem gerencia lojas pode importar", async () => {
    const rm = await createUser("regional_manager");
    const sheet = await readSheet(csv("Nome,Cidade,UF,Região\nX,Y,SC,Z\n"), "x.csv");
    await expect(buildPreview(await ctxFor(rm.id), sheet, "x.csv", { createRegions: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("recusa arquivo sem cabeçalho reconhecível ou de tipo errado", async () => {
    await expect(readSheet(csv("a,b\n1,2\n"), "x.csv")).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(readSheet(csv("x"), "x.pdf")).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
