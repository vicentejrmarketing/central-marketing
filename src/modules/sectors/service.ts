import { z } from "zod";
import { db } from "@/lib/db";
import { assertCan, type Ctx } from "@/lib/auth/user";
import { recordAudit, diffFields } from "@/lib/audit";
import { conflict, invalid, notFound, staleVersion } from "@/lib/errors";

export const sectorSchema = z.object({
  name: z.string({ error: "Informe o nome." }).trim().min(2, "Informe o nome do setor.").max(60),
  description: z.string().trim().max(300).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida.")
    .default("#64748b"),
  leaderId: z.uuid().optional(),
});
export const updateSectorSchema = sectorSchema.extend({ id: z.uuid(), version: z.coerce.number().int() });

const view = (s: { name: string; description: string | null; color: string; leaderId: string | null; active: boolean }) => ({
  name: s.name,
  description: s.description,
  color: s.color,
  leaderId: s.leaderId,
  active: s.active,
});

async function validateLeader(leaderId: string | undefined) {
  if (!leaderId) return;
  const leader = await db.user.findUnique({ where: { id: leaderId } });
  if (!leader || leader.status !== "ACTIVE") throw invalid("Líder inválido.", { leaderId: ["Selecione um usuário ativo."] });
}

export async function createSector(ctx: Ctx, input: z.infer<typeof sectorSchema>) {
  assertCan(ctx.user, "sectors.manage");
  await validateLeader(input.leaderId);
  return db.$transaction(async (tx) => {
    if (await tx.sector.findUnique({ where: { name: input.name } })) {
      throw invalid("Já existe um setor com este nome.", { name: ["Já existe um setor com este nome."] });
    }
    const sector = await tx.sector.create({
      data: { name: input.name, description: input.description ?? null, color: input.color, leaderId: input.leaderId ?? null },
    });
    await recordAudit(tx, ctx, {
      action: "sector.created",
      entityType: "Sector",
      entityId: sector.id,
      summary: `${ctx.user.name} criou o setor ${sector.name}`,
      after: view(sector),
    });
    return sector;
  });
}

export async function updateSector(ctx: Ctx, input: z.infer<typeof updateSectorSchema>) {
  assertCan(ctx.user, "sectors.manage");
  await validateLeader(input.leaderId);
  return db.$transaction(async (tx) => {
    const current = await tx.sector.findUnique({ where: { id: input.id } });
    if (!current) throw notFound("Setor");
    if (current.version !== input.version) throw staleVersion();
    const dup = await tx.sector.findUnique({ where: { name: input.name } });
    if (dup && dup.id !== current.id) throw invalid("Já existe um setor com este nome.", { name: ["Já existe um setor com este nome."] });
    const updated = await tx.sector.update({
      where: { id: input.id, version: input.version },
      data: {
        name: input.name,
        description: input.description ?? null,
        color: input.color,
        leaderId: input.leaderId ?? null,
        version: { increment: 1 },
      },
    });
    const diff = diffFields(view(current), view(updated));
    if (diff)
      await recordAudit(tx, ctx, {
        action: "sector.updated",
        entityType: "Sector",
        entityId: updated.id,
        summary: `${ctx.user.name} alterou o setor ${updated.name}`,
        ...diff,
      });
    return updated;
  });
}

export async function setSectorActive(ctx: Ctx, id: string, active: boolean) {
  assertCan(ctx.user, "sectors.manage");
  return db.$transaction(async (tx) => {
    const sector = await tx.sector.findUnique({ where: { id } });
    if (!sector) throw notFound("Setor");
    const updated = await tx.sector.update({
      where: { id },
      data: { active, archivedAt: active ? null : new Date(), version: { increment: 1 } },
    });
    await recordAudit(tx, ctx, {
      action: active ? "sector.unarchived" : "sector.archived",
      entityType: "Sector",
      entityId: id,
      summary: `${ctx.user.name} ${active ? "reativou" : "arquivou"} o setor ${sector.name}`,
    });
    return updated;
  });
}

/** Exclusão só para setores sem nenhum usuário (ativo ou inativo). Caso contrário, arquive. */
export async function deleteSector(ctx: Ctx, id: string) {
  assertCan(ctx.user, "sectors.manage");
  return db.$transaction(async (tx) => {
    const sector = await tx.sector.findUnique({ where: { id }, include: { _count: { select: { members: true } } } });
    if (!sector) throw notFound("Setor");
    if (sector._count.members > 0) {
      throw conflict(
        `O setor ${sector.name} tem ${sector._count.members} usuário(s) vinculado(s). Arquive o setor para preservar o histórico.`,
      );
    }
    await tx.sector.delete({ where: { id } });
    await recordAudit(tx, ctx, {
      action: "sector.deleted",
      entityType: "Sector",
      entityId: id,
      summary: `${ctx.user.name} excluiu o setor ${sector.name}`,
      before: view(sector),
    });
  });
}

export async function listSectors() {
  return db.sector.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { leader: { select: { id: true, name: true } }, _count: { select: { members: { where: { status: "ACTIVE" } } } } },
  });
}

/** Setores com contagem de pessoas ativas (tela de Setores). */
export async function sectorsOverview(ctx: Ctx) {
  assertCan(ctx.user, "sectors.manage");
  const [sectors, activeCounts] = await Promise.all([
    db.sector.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { leader: { select: { name: true } }, _count: { select: { members: true } } },
    }),
    db.user.groupBy({ by: ["sectorId"], where: { status: "ACTIVE" }, _count: true }),
  ]);
  const active = new Map(activeCounts.map((c) => [c.sectorId, c._count]));
  return sectors.map((s) => ({ ...s, activeMembers: active.get(s.id) ?? 0 }));
}
