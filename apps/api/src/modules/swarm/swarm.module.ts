import { Body, Controller, Get, Module, Post, Req, Injectable, ForbiddenException, BadRequestException, ConflictException, UnprocessableEntityException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { Tx } from "../../common/tx";
import * as listeBlanche from "./outils-liste-blanche.json";

/**
 * OLIVIA v2 — ARCHITECTURE AGENTIQUE (Partie B DÉGELÉE le 2026-07-27, décision Ali —
 * R259–R266, SW-01..18 ; mapping du message de dégel consigné dans ECARTS).
 *
 * Étape 1 : R264 — LE CONTRAT D'OUTIL PRÉCÈDE TOUT AGENT.
 * Un outil = {code, endpoint_ref, methode GET|PROPOSE, schema_entree, schema_sortie}.
 * `PROPOSE` ne peut cibler QUE la création d'objets `olivia_proposals` (R254). Il n'existe
 * AUCUN outil d'écriture d'état métier (B.0) — et c'est PROUVÉ deux fois :
 *   • CI : `outils-liste-blanche.json` est la SOURCE UNIQUE ; le build échoue si un outil
 *     livré pointe hors liste (B.7 critère 2, script scripts/verifier-liste-blanche-outils.js).
 *   • Runtime : toute déclaration hors liste ⇒ 422 TOOL_ENDPOINT_HORS_LISTE, registre
 *     inchangé (SW-12) — même vérité, même fichier.
 * Écriture = acte ADMIN, lecture ouverte à tous (B.3). Auteur = jeton, jamais le corps.
 */

type Ctx = { tenantId: string; userId: string; role: string };
const LB = listeBlanche as unknown as { lecture: string[]; proposition: string[] };

@Injectable()
export class SwarmToolsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}
  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }

  // ── R264 : déclarer un outil — la liste blanche décide, pas le déclarant ──
  async declarer(ctx: Ctx, dto: { code?: string; endpointRef?: string; methode?: string; schemaEntree?: any; schemaSortie?: any }) {
    if (ctx.role !== "ADMIN") throw new ForbiddenException("R264 : la déclaration d'outil est un acte ADMIN (B.3)");
    if (!dto?.code?.trim() || !dto?.endpointRef?.trim() || !dto?.methode)
      throw new BadRequestException("code, endpointRef et methode requis");
    if (dto.methode !== "GET" && dto.methode !== "PROPOSE")
      throw new UnprocessableEntityException(`R264 : methode « ${dto.methode} » hors contrat — seules GET|PROPOSE existent`);
    const licites = dto.methode === "GET" ? LB.lecture : LB.proposition;   // PROPOSE ⇒ création olivia_proposals, RIEN d'autre
    if (!licites.includes(dto.endpointRef))
      throw new UnprocessableEntityException(
        `TOOL_ENDPOINT_HORS_LISTE: « ${dto.endpointRef} » n'est pas dans la liste blanche ${dto.methode} (R264 — étendre la liste = revue CI, jamais un acte runtime)`);
    const deja = await this.prisma.oliviaTool.findFirst({ where: { tenantId: ctx.tenantId, code: dto.code.trim() } });
    if (deja) throw new ConflictException(`R264 : l'outil « ${dto.code} » existe déjà (unicité tenant+code)`);
    const outil = await this.prisma.$transaction(async (tx: Tx) => {
      const o = await tx.oliviaTool.create({ data: { tenantId: ctx.tenantId, code: dto.code!.trim(),
        endpointRef: dto.endpointRef!.trim(), methode: dto.methode!,
        schemaEntree: dto.schemaEntree ?? {}, schemaSortie: dto.schemaSortie ?? {} } });
      await this.emit(tx, ctx.tenantId, "olivia.outil.declare", o.id,
        { code: o.code, endpointRef: o.endpointRef, methode: o.methode, par: ctx.userId });
      return o;
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "OLIVIA_TOOL_DECLARED", outil.code);
    return { id: outil.id, code: outil.code, endpointRef: outil.endpointRef, methode: outil.methode };
  }

  // ── Lecture ouverte à tous les rôles du tenant (B.3) ──
  async lister(ctx: Ctx) {
    const rows = await this.prisma.oliviaTool.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { code: "asc" } });
    return rows.map((t: any) => ({ id: t.id, code: t.code, endpointRef: t.endpointRef, methode: t.methode,
      schemaEntree: t.schemaEntree, schemaSortie: t.schemaSortie }));
  }
}

@Controller("olivia")
export class SwarmController {
  constructor(private outils: SwarmToolsService) {}
  @Get("tools")  listerOutils(@Req() r: any) { return this.outils.lister(r.ctx); }               // R264 (tous)
  @Post("tools") declarerOutil(@Req() r: any, @Body() b: any) { return this.outils.declarer(r.ctx, b ?? {}); } // R264 (ADMIN)
}

@Module({
  controllers: [SwarmController],
  providers: [PrismaService, AuditService, SwarmToolsService],
  exports: [SwarmToolsService],
})
export class SwarmModule {}
