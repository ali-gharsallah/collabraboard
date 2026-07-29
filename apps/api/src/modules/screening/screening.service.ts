import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { ScreeningQualificationService, EntreeListe, Verdict } from "./rules/screening-qualification";
import { Tx } from "../../common/tx";

/**
 * Câblage persistant des règles screening R100→R103 (SC-01..04, ratifiées 15.07.2026).
 * La sémantique vit dans rules/screening-qualification.ts (domaine, 4/4 verts) ;
 * ici : persistance Prisma, scope tenant, auteur depuis le JETON (jamais du body),
 * audit de passage, escalade PROPOSÉE par événement (R39/R44 — jamais exécutée).
 *
 * Rapprochement minimal (exact normalisé) — le moteur fin (golden set 127 cas,
 * pré-filtre trigramme) vit dans services/screening ; brancher ici quand exposé.
 */

export interface RunDto {
  liste: string; version: string; seuil: number;
  prefiltre: Record<string, number>; entries: EntreeListe[]; clientIds?: string[];
}
type Ctx = { tenantId: string; userId: string; role: string };

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const keyOf = (s: string) => norm(s).split(" ").sort().join(" ");
function score(nom: string, e: EntreeListe): number {
  const q = keyOf(nom);
  for (const c of [e.nom_complet, ...(e.alias ?? [])]) if (keyOf(c) === q) return 100;
  return 0;
}

@Injectable()
export class ScreeningService {
  /** Réutilise le hash canonique du domaine — la whitelist R102 s'attache à CETTE empreinte. */
  private domain = new ScreeningQualificationService();
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // ── R100 hits bruts persistés · R102 whitelist par empreinte · R103 trace même sans hit ──
  async run(ctx: Ctx, dto: RunDto) {
    if (!dto?.liste || !dto?.version || !Array.isArray(dto?.entries))
      throw new BadRequestException("liste, version et entries requis");
    return this.prisma.$transaction(async (tx: Tx) => {
      const clients = await tx.client.findMany({ where: {
        tenantId: ctx.tenantId, ...(dto.clientIds ? { id: { in: dto.clientIds } } : {}) } });
      const at = new Date().toISOString();
      const hits: any[] = [];
      for (const c of clients) {
        for (const e of dto.entries) {
          const sc = score(c.name, e);
          if (sc < dto.seuil) continue;
          const entreeHash = this.domain.hashEntree(e);
          // R102 — écarté seulement si un FAUX_POSITIF existe pour (client, entrée, CETTE empreinte)
          const wl = await tx.screeningQualification.findFirst({ where: {
            tenantId: ctx.tenantId, verdict: "FAUX_POSITIF", entreeHash,
            hit: { clientId: c.id, entreeUid: e.uid } } });
          if (wl) continue;
          hits.push(await tx.screeningHit.create({ data: {
            tenantId: ctx.tenantId, clientId: c.id, entreeUid: e.uid, score: sc,
            listeVersion: dto.version, entreeHash, statut: "BRUT", at } }));
        }
      }
      // R103 — la trace de passage s'écrit TOUJOURS, hits ou pas, pré-filtre inclus
      const run = await tx.screeningRun.create({ data: {
        tenantId: ctx.tenantId, liste: dto.liste, listeVersion: dto.version,
        seuil: dto.seuil, prefiltre: dto.prefiltre ?? {}, perimetre: clients.length,
        nbHits: hits.length, at } });
      for (const h of hits) await tx.screeningHit.update({ where: { id: h.id }, data: { runId: run.id } });
      await this.audit.log(ctx.tenantId, ctx.userId, "SCREENING_RUN",
        `${dto.liste}@${dto.version}:${clients.length} clients, ${hits.length} hits`);
      return { run, hits };
    });
  }

  // ── R101 — verdict + motif obligatoire (R7) + auteur = jeton ; VP → escalade PROPOSÉE ──
  async qualify(ctx: Ctx, hitId: string, verdict: Verdict, motif: string) {
    if (!motif || !motif.trim()) throw new BadRequestException("R7 : la qualification exige un motif");
    return this.prisma.$transaction(async (tx: Tx) => {
      const hit = await tx.screeningHit.findFirst({ where: { id: hitId, tenantId: ctx.tenantId } });
      if (!hit) throw new NotFoundException("Hit introuvable");
      if (hit.statut === "QUALIFIE")
        throw new BadRequestException("Hit déjà qualifié — passer par une re-qualification tracée");
      const q = await tx.screeningQualification.create({ data: {
        tenantId: ctx.tenantId, hitId: hit.id, verdict, motif: motif.trim(),
        par: ctx.userId,                                  // R101 : personne nommée = jeton, jamais body
        at: new Date().toISOString(), entreeHash: hit.entreeHash, listeVersion: hit.listeVersion } });
      await tx.screeningHit.update({ where: { id: hit.id }, data: { statut: "QUALIFIE" } });
      if (verdict === "VRAI_POSITIF") {
        // R39/R44 — on PROPOSE : gel, clarification art. 6 LBA, MROS restent des décisions humaines
        await tx.domainEvent.create({ data: { tenantId: ctx.tenantId,
          type: "screening.escalade.proposee", aggregateId: hit.id,
          payload: { hitId: hit.id, clientId: hit.clientId, motif: "Correspondance qualifiée vraie — gel, clarification art. 6 LBA et communication MROS à arbitrer" } } });
      }
      await this.audit.log(ctx.tenantId, ctx.userId, "SCREENING_QUALIFIED", `${hit.id}:${verdict}`);
      return q;
    });
  }

  hits(ctx: Ctx, statut?: string) {
    return this.prisma.screeningHit.findMany({ where: {
      tenantId: ctx.tenantId, ...(statut ? { statut } : {}) } });
  }
  runs(ctx: Ctx) {                                        // R103 — la preuve de fraîcheur, lisible
    return this.prisma.screeningRun.findMany({ where: { tenantId: ctx.tenantId } });
  }
}
