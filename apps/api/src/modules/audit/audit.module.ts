import { Body, Controller, ForbiddenException, Get, Module, Post, Query, Req } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { Tx } from "../../common/tx";

/**
 * R284 — la surface d'AUDIT dédiée (canon SO + transport async, ratifié 2026-07-28).
 * « L'auditeur est audité » : chaque consultation SO d'une surface sensible est ELLE-MÊME un
 * événement append-only AUDIT_ACCESS (émis par la garde structurelle, tenant.middleware) —
 * ce journal-là est consultable par la DIRECTION et par SO lui-même : personne ne lit dans
 * l'ombre, pas même l'auditeur. (Argument FINMA : la banque prouve QUI a consulté les
 * données MROS.) L'export d'audit est l'UNE des deux seules écritures de SO — une génération
 * de document, TRACÉE (l'autre : le STOP d'un run, R267, chez Olivia).
 */
type Ctx = { tenantId: string; userId: string; role: string };

@Controller("audit")
export class AuditController {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private garde(ctx: Ctx) {
    if (!["SO", "DIR"].includes(ctx.role))
      throw new ForbiddenException("Le journal des accès d'audit se consulte en SO ou DIRECTION (R284)");
  }

  // ── SO-04 : le journal des accès — qui a consulté quoi, quand (append-only, jamais supprimable). ──
  @Get("acces")
  async acces(@Req() r: any, @Query("limite") limite?: string) {
    this.garde(r.ctx);
    const evs = await this.prisma.domainEvent.findMany({
      where: { tenantId: r.ctx.tenantId, type: "AUDIT_ACCESS" },
      orderBy: { id: "desc" }, take: Math.min(Number(limite ?? 200), 500) });
    return evs.map((e: any) => ({ at: e.at, ...(e.payload as object) }));
  }

  // ── SO-02 : l'export d'audit — génération de document, TRACÉE (qui, quand, périmètre). ──
  @Post("export")
  async exporter(@Req() r: any, @Body() b: any) {
    this.garde(r.ctx);
    const where: any = { tenantId: r.ctx.tenantId };
    if (b?.aggregateId) where.aggregateId = String(b.aggregateId);
    if (b?.type) where.type = String(b.type);
    const evs = await this.prisma.domainEvent.findMany({ where, orderBy: { id: "asc" }, take: 1000 });
    const genereAt = new Date().toISOString();
    await this.prisma.$transaction(async (tx: Tx) =>
      tx.domainEvent.create({ data: { tenantId: r.ctx.tenantId, type: "AUDIT_EXPORT",
        aggregateId: b?.aggregateId ?? "tenant", payload: { par: r.ctx.userId, role: r.ctx.role,
          perimetre: { aggregateId: b?.aggregateId ?? null, type: b?.type ?? null }, n: evs.length },
        at: genereAt } }));
    await this.audit.log(r.ctx.tenantId, r.ctx.userId, "AUDIT_EXPORT", `${b?.aggregateId ?? "tenant"}:${evs.length}`);
    return { genereAt, n: evs.length,
      evenements: evs.map((e: any) => ({ seq: Number(e.id), type: e.type, aggregateId: e.aggregateId, at: e.at, payload: e.payload })) };
  }
}

@Module({ controllers: [AuditController] })
export class AuditModule {}
