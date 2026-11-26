/**
 * Importação de lojas por planilha (XLSX ou CSV), em duas fases:
 * 1. Pré-visualização: lê o arquivo, valida linha a linha e mostra o que será criado ou atualizado.
 * 2. Confirmação: lê de novo o MESMO arquivo e aplica tudo em uma transação.
 * As colunas são reconhecidas pelo nome do cabeçalho, sem depender da ordem.
 */
import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { db } from "@/lib/db";
import { assertCan, type Ctx } from "@/lib/auth/user";
import { recordAudit } from "@/lib/audit";
import { invalid } from "@/lib/errors";
import { SYSTEM_ROLES } from "@/lib/authz/catalog";
import { UFS, storeSchema } from "./schemas";
import type { Prisma } from "@/generated/prisma/client";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2000;

type Field =
  | "code"
  | "name"
  | "city"
  | "state"
  | "address"
  | "phone"
  | "region"
  | "responsible"
  | "managerName"
  | "managerPhone"
  | "regionalManager"
  | "status";

const ALIASES: Record<Field, string[]> = {
  code: ["codigo", "cod", "codigo da loja", "cod loja", "id loja", "sigla"],
  name: ["nome", "loja", "nome da loja", "unidade", "filial"],
  city: ["cidade", "municipio"],
  state: ["uf", "estado"],
  address: ["endereco", "endereco completo", "logradouro"],
  phone: ["telefone", "telefone da loja", "fone", "tel"],
  region: ["regiao", "regional"],
  responsible: ["responsavel", "responsavel marketing", "responsavel (e-mail)", "responsavel e-mail", "email do responsavel"],
  managerName: ["gerente", "gerente da loja", "nome do gerente"],
  managerPhone: ["telefone do gerente", "fone do gerente", "celular do gerente", "telefone gerente"],
  regionalManager: ["gerente regional", "e-mail do gerente regional", "email do gerente regional", "gerente regional (e-mail)"],
  status: ["status", "situacao", "ativa"],
};

const STATE_NAMES: Record<string, (typeof UFS)[number]> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

export function normalizeHeader(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[_:*]/g, " ").replace(/\s+/g, " ").trim();
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value && value.result !== undefined) return String(value.result).trim();
    if ("richText" in value && Array.isArray(value.richText))
      return value.richText
        .map((r) => r.text)
        .join("")
        .trim();
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if ("hyperlink" in value) return String((value as { text?: string }).text ?? "").trim();
  }
  return String(value).trim();
}

export type RawSheet = {
  headers: string[];
  mapping: Partial<Record<Field, number>>;
  unknownHeaders: string[];
  rows: { line: number; values: string[] }[];
};

export async function readSheet(buffer: ArrayBuffer, fileName: string): Promise<RawSheet> {
  if (buffer.byteLength > MAX_IMPORT_BYTES) throw invalid("O arquivo passa de 5 MB.");
  const wb = new ExcelJS.Workbook();
  const lower = fileName.toLowerCase();
  try {
    if (lower.endsWith(".csv")) {
      const text = new TextDecoder("utf-8").decode(buffer).replace(/^﻿/, "");
      const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
      const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
      await wb.csv.read(Readable.from([text]), { parserOptions: { delimiter } });
    } else if (lower.endsWith(".xlsx")) {
      await wb.xlsx.load(buffer);
    } else {
      throw invalid("Envie um arquivo .xlsx ou .csv.");
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AppError") throw err;
    throw invalid("Não foi possível ler o arquivo. Confira se é uma planilha .xlsx ou .csv válida.");
  }
  const ws = wb.worksheets[0];
  if (!ws) throw invalid("A planilha está vazia.");

  // A linha de cabeçalho é a primeira que tiver uma coluna reconhecida como "nome" da loja.
  let headerRow = 0;
  let headers: string[] = [];
  for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
    const values = (ws.getRow(r).values as ExcelJS.CellValue[]).slice(1).map(cellText);
    if (values.some((v) => ALIASES.name.includes(normalizeHeader(v)))) {
      headerRow = r;
      headers = values;
      break;
    }
  }
  if (!headerRow) throw invalid('Não encontrei o cabeçalho. A planilha precisa de uma coluna "Nome" (ou "Loja").');

  const mapping: Partial<Record<Field, number>> = {};
  const unknownHeaders: string[] = [];
  headers.forEach((h, idx) => {
    const n = normalizeHeader(h);
    if (!n) return;
    const field = (Object.keys(ALIASES) as Field[]).find((f) => ALIASES[f].includes(n));
    if (field && mapping[field] === undefined) mapping[field] = idx;
    else if (!field) unknownHeaders.push(h);
  });

  const rows: RawSheet["rows"] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const values = (ws.getRow(r).values as ExcelJS.CellValue[]).slice(1).map(cellText);
    if (values.every((v) => v === "")) continue;
    rows.push({ line: r, values });
  }
  if (rows.length > MAX_IMPORT_ROWS) throw invalid(`A planilha tem mais de ${MAX_IMPORT_ROWS} linhas.`);
  return { headers, mapping, unknownHeaders, rows };
}

export type PreviewRow = {
  line: number;
  action: "create" | "update" | "unchanged" | "error";
  code: string;
  name: string;
  city: string;
  state: string;
  regionName: string;
  regionIsNew: boolean;
  regionalManagerEmail: string | null;
  errors: string[];
  warnings: string[];
  data?: Omit<Prisma.StoreUncheckedCreateInput, "regionId"> & { regionName: string; responsibleUserId: string | null };
};

export type ImportPreview = {
  fileName: string;
  totalRows: number;
  rows: PreviewRow[];
  counts: { create: number; update: number; unchanged: number; error: number; newRegions: number };
  missingColumns: string[];
  unknownHeaders: string[];
};

function codeFromName(name: string) {
  return normalizeHeader(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
}

function parseState(raw: string): (typeof UFS)[number] | null {
  const up = raw.trim().toUpperCase();
  if ((UFS as readonly string[]).includes(up)) return up as (typeof UFS)[number];
  return STATE_NAMES[normalizeHeader(raw)] ?? null;
}

function parseStatus(raw: string): "ACTIVE" | "INACTIVE" | null {
  const n = normalizeHeader(raw);
  if (!n) return "ACTIVE";
  if (["ativa", "ativo", "sim", "s", "active", "1", "aberta"].includes(n)) return "ACTIVE";
  if (["inativa", "inativo", "nao", "n", "inactive", "0", "fechada"].includes(n)) return "INACTIVE";
  return null;
}

export async function buildPreview(ctx: Ctx, sheet: RawSheet, fileName: string, opts: { createRegions: boolean }): Promise<ImportPreview> {
  assertCan(ctx.user, "stores.manage");
  const get = (row: string[], f: Field) => (sheet.mapping[f] === undefined ? "" : (row[sheet.mapping[f]!] ?? "").trim());

  const missingColumns: string[] = [];
  if (sheet.mapping.city === undefined) missingColumns.push("Cidade");
  if (sheet.mapping.state === undefined) missingColumns.push("UF");
  if (sheet.mapping.region === undefined) missingColumns.push("Região");

  const [regions, stores, users] = await Promise.all([
    db.region.findMany(),
    db.store.findMany(),
    db.user.findMany({ where: { status: "ACTIVE" }, include: { role: true } }),
  ]);
  const regionByName = new Map(regions.map((r) => [normalizeHeader(r.name), r]));
  const storeByCode = new Map(stores.map((s) => [s.code.toUpperCase(), s]));
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  const usersByName = new Map<string, typeof users>();
  for (const u of users) {
    const k = normalizeHeader(u.name);
    usersByName.set(k, [...(usersByName.get(k) ?? []), u]);
  }

  const seenCodes = new Set<string>();
  const newRegions = new Set<string>();
  const rows: PreviewRow[] = sheet.rows.map(({ line, values }) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const name = get(values, "name");
    let code = get(values, "code").toUpperCase();
    if (!code && name) {
      code = codeFromName(name);
      warnings.push(`Sem código na planilha; será usado "${code}".`);
    }
    const city = get(values, "city");
    const stateRaw = get(values, "state");
    const state = parseState(stateRaw);
    if (stateRaw && !state) errors.push(`UF "${stateRaw}" não reconhecida.`);
    const regionName = get(values, "region");
    const status = parseStatus(get(values, "status"));
    if (!status) errors.push(`Status "${get(values, "status")}" não reconhecido (use Ativa ou Inativa).`);

    let regionIsNew = false;
    if (!regionName) errors.push("Região não informada.");
    else if (!regionByName.has(normalizeHeader(regionName))) {
      if (opts.createRegions) {
        regionIsNew = true;
        newRegions.add(normalizeHeader(regionName));
      } else errors.push(`Região "${regionName}" não existe. Marque "Criar regiões que não existem" ou cadastre antes.`);
    } else if (!regionByName.get(normalizeHeader(regionName))!.active) {
      errors.push(`A região "${regionName}" está arquivada.`);
    }

    let responsibleUserId: string | null = null;
    const resp = get(values, "responsible");
    if (resp) {
      const byEmail = userByEmail.get(resp.toLowerCase());
      const byName = usersByName.get(normalizeHeader(resp));
      if (byEmail) responsibleUserId = byEmail.id;
      else if (byName?.length === 1) responsibleUserId = byName[0]!.id;
      else warnings.push(`Responsável "${resp}" não encontrado entre os usuários ativos; ficará em branco.`);
    }

    let regionalManagerEmail: string | null = null;
    const rm = get(values, "regionalManager");
    if (rm) {
      const u =
        userByEmail.get(rm.toLowerCase()) ??
        (usersByName.get(normalizeHeader(rm))?.length === 1 ? usersByName.get(normalizeHeader(rm))![0] : undefined);
      if (!u) warnings.push(`Gerente regional "${rm}" não é um usuário ativo; o vínculo não será criado.`);
      else if (u.role.key !== SYSTEM_ROLES.REGIONAL_MANAGER)
        warnings.push(`${u.name} não tem o papel Gerente Regional; o vínculo não será criado.`);
      else regionalManagerEmail = u.email;
    }

    if (code && seenCodes.has(code)) errors.push(`Código ${code} repetido na planilha.`);
    if (code) seenCodes.add(code);

    const parsed = storeSchema.safeParse({
      code,
      name,
      city,
      state: state ?? undefined,
      address: get(values, "address") || undefined,
      phone: get(values, "phone") || undefined,
      regionId: "00000000-0000-7000-8000-000000000000", // validado à parte (pode ser região nova)
      managerName: get(values, "managerName") || undefined,
      managerPhone: get(values, "managerPhone") || undefined,
      status: status ?? "ACTIVE",
    });
    if (!parsed.success) {
      const labels: Record<string, string> = {
        code: "Código",
        name: "Nome",
        city: "Cidade",
        state: "UF",
        phone: "Telefone",
        managerPhone: "Telefone do gerente",
        address: "Endereço",
        managerName: "Gerente",
      };
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "");
        if (field === "state" && stateRaw) continue;
        errors.push(`${labels[field] ?? field}: ${issue.message}`);
      }
    }

    const base = { line, code, name, city, state: state ?? stateRaw, regionName, regionIsNew, regionalManagerEmail, errors, warnings };
    if (errors.length || !parsed.success) return { ...base, action: "error" as const };

    const d = parsed.data;
    const data = {
      code: d.code,
      name: d.name,
      city: d.city,
      state: d.state,
      address: d.address ?? null,
      phone: d.phone ?? null,
      managerName: d.managerName ?? null,
      managerPhone: d.managerPhone ?? null,
      status: d.status,
      regionName,
      responsibleUserId,
    };
    const existing = storeByCode.get(d.code);
    if (!existing) return { ...base, action: "create" as const, data };
    const region = regionByName.get(normalizeHeader(regionName));
    const same =
      existing.name === data.name &&
      existing.city === data.city &&
      existing.state === data.state &&
      existing.address === data.address &&
      existing.phone === data.phone &&
      existing.managerName === data.managerName &&
      existing.managerPhone === data.managerPhone &&
      existing.status === data.status &&
      existing.regionId === region?.id &&
      (data.responsibleUserId === null || existing.responsibleUserId === data.responsibleUserId);
    return { ...base, action: same ? ("unchanged" as const) : ("update" as const), data };
  });

  const counts = { create: 0, update: 0, unchanged: 0, error: 0, newRegions: newRegions.size };
  for (const r of rows) counts[r.action]++;
  return { fileName, totalRows: rows.length, rows, counts, missingColumns, unknownHeaders: sheet.unknownHeaders };
}

/** Aplica a importação. Linhas com erro são ignoradas e ficam registradas no histórico da importação. */
export async function applyImport(ctx: Ctx, preview: ImportPreview) {
  assertCan(ctx.user, "stores.manage");
  if (preview.missingColumns.length) throw invalid(`Faltam colunas obrigatórias: ${preview.missingColumns.join(", ")}.`);
  const valid = preview.rows.filter((r) => r.action === "create" || r.action === "update");
  return db.$transaction(
    async (tx) => {
      const regionIds = new Map<string, string>();
      let regionsCreated = 0;
      for (const r of await tx.region.findMany()) regionIds.set(normalizeHeader(r.name), r.id);
      for (const row of valid) {
        const key = normalizeHeader(row.regionName);
        if (!regionIds.has(key)) {
          const region = await tx.region.create({ data: { name: row.regionName.trim() } });
          regionIds.set(key, region.id);
          regionsCreated++;
          await recordAudit(tx, ctx, {
            action: "region.created",
            entityType: "Region",
            entityId: region.id,
            summary: `${ctx.user.name} criou a região ${region.name} (importação de planilha)`,
          });
        }
      }
      let createdCount = 0;
      let updatedCount = 0;
      for (const row of valid) {
        const { regionName, ...data } = row.data!;
        const regionId = regionIds.get(normalizeHeader(regionName))!;
        const existing = await tx.store.findUnique({ where: { code: data.code } });
        if (existing) {
          const updated = await tx.store.update({
            where: { id: existing.id },
            data: { ...data, responsibleUserId: data.responsibleUserId ?? existing.responsibleUserId, regionId, version: { increment: 1 } },
          });
          updatedCount++;
          await recordAudit(tx, ctx, {
            action: "store.updated",
            entityType: "Store",
            entityId: updated.id,
            summary: `${ctx.user.name} atualizou a loja ${updated.name} pela importação de ${preview.fileName}`,
          });
        } else {
          const created = await tx.store.create({ data: { ...data, regionId } });
          createdCount++;
          await recordAudit(tx, ctx, {
            action: "store.created",
            entityType: "Store",
            entityId: created.id,
            summary: `${ctx.user.name} cadastrou a loja ${created.name} pela importação de ${preview.fileName}`,
          });
        }
      }
      // Vínculos de gerente regional informados na planilha (somente usuários com o papel certo).
      const manager = await tx.user.findMany({
        where: { email: { in: valid.map((r) => r.regionalManagerEmail).filter((e): e is string => !!e) } },
        select: { id: true, email: true, name: true },
      });
      const managerByEmail = new Map(manager.map((m) => [m.email.toLowerCase(), m]));
      const linked = new Set<string>();
      for (const row of valid) {
        if (!row.regionalManagerEmail) continue;
        const m = managerByEmail.get(row.regionalManagerEmail.toLowerCase());
        const regionId = regionIds.get(normalizeHeader(row.regionName))!;
        if (!m || linked.has(`${regionId}:${m.id}`)) continue;
        linked.add(`${regionId}:${m.id}`);
        const exists = await tx.regionManager.findFirst({ where: { regionId, userId: m.id, endsAt: null } });
        if (!exists) {
          await tx.regionManager.create({ data: { regionId, userId: m.id, assignedById: ctx.user.id } });
          await recordAudit(tx, ctx, {
            action: "region.manager_linked",
            entityType: "Region",
            entityId: regionId,
            summary: `${ctx.user.name} vinculou ${m.name} como gerente regional de ${row.regionName} (importação de planilha)`,
          });
        }
      }
      const errors = preview.rows.filter((r) => r.action === "error").map((r) => ({ line: r.line, errors: r.errors }));
      const imp = await tx.storeImport.create({
        data: {
          fileName: preview.fileName,
          totalRows: preview.totalRows,
          createdCount,
          updatedCount,
          regionsCreated,
          errors: errors as Prisma.InputJsonValue,
          importedById: ctx.user.id,
        },
      });
      await recordAudit(tx, ctx, {
        action: "store.imported",
        entityType: "StoreImport",
        entityId: imp.id,
        summary: `${ctx.user.name} importou ${preview.fileName}: ${createdCount} loja(s) criada(s), ${updatedCount} atualizada(s), ${regionsCreated} região(ões) nova(s), ${errors.length} linha(s) com erro`,
      });
      return { createdCount, updatedCount, regionsCreated, errorCount: errors.length, importId: imp.id };
    },
    { timeout: 60_000 },
  );
}

export async function recentImports(ctx: Ctx, take = 10) {
  assertCan(ctx.user, "stores.manage");
  return db.storeImport.findMany({ orderBy: { createdAt: "desc" }, take, include: { importedBy: { select: { name: true } } } });
}
