import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { ScreeningQualificationService, EntreeListe, Verdict } from "./rules/screening-qualification";
import { Tx } from "../../common/tx";
import { construireIndex, construireIdf, candidats, rapprocherDetail } from "@olive/screening-engine";

/**
 * Cablage persistant des regles screening R100->R103 (SC-01..04, ratifiees 15.07.2026).
 * La semantique vit dans rules/screening-qualification.ts (domaine, 4/4 verts) ;
 * ici : persistance Prisma, scope tenant, auteur depuis le JETON (jamais du body),
 * audit de passage, escalade PROPOSEE par evenement (R39/R44 - jamais executee).
 *
 * R263 - le rapprochement delegue au MOTEUR FIN (@olive/screening-engine : Jaro-Winkler + IDF +
 * pre-filtre trigramme). Le score persiste est le COMPOSITE 0-100, plus jamais 100|0 binaire.
 * R264 - l'index trigramme est construit UNE FOIS au chargement de la liste (pas par requete) ;
 * chaque client est pre-filtre (candidats) avant le score fin. R266 - le hit stocke la decomposition.
 * NB (dette Phase 2) : l'IDF du moteur est un etat MODULE-global ; on score en une passe SYNCHRONE
 * (avant tout await) pour l'isoler - a instancier par run le jour du multi-tenant vraiment concurrent.
 */

export interface RunDto {
  liste: string; version: string; seuil: number;
  prefiltre: Record<string, number>; entries: EntreeListe[]; clientIds?: string[];
  // R269 — gouvernance du réglage : un scénario VERSIONNÉ (AmlScenario.params) fournit la config du
  // moteur (params.moteur) et du pré-filtre (params.prefiltre) en vigueur à la date du run (R29).
  // Un override d'appel reste possible (moteurConfig) et PRIME sur le scénario ; tout est tracé.
  scenarioCode?: string; moteurConfig?: Record<string, number>;
}
type Ctx = { tenantId: string; userId: string; role: string };
// Config EFFECTIVE d'un run + sa provenance (persistée sur le run pour le rejeu R48/R49).
type ConfigRun = { moteur: Record<string, number>; prefiltre: Record<string, number>;
  source: { scenarioCode: string; scenarioVersion: number } | null };

// Decomposition explicable persistee (R266) - prepare R44 (le systeme explique, il ne decide pas).
type HitDetail = { via: string; nameScore: number; typePenalty: number; dobContribution: number };

@Injectable()
export class ScreeningService {
  /** Reutilise le hash canonique du domaine - la whitelist R102 s'attache a CETTE empreinte. */
  private domain = new ScreeningQualificationService();
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  /**
   * R269 — résout la config EFFECTIVE d'un run. Base : le scénario VERSIONNÉ en vigueur à la date
   * (plus haute version active, effet ≤ date — R29), qui porte params.moteur / params.prefiltre.
   * Override : les paramètres d'appel (moteurConfig, prefiltre) priment, pour tuning/urgence — et
   * la config effective + la provenance sont TRACÉES sur le run (rejeu). Sans scénario ni override :
   * moteur vide → défauts R268 (comportement inchangé), pré-filtre = celui de l'appel.
   */
  private async resoudreConfig(tx: Tx, tenantId: string, dto: RunDto, at: string): Promise<ConfigRun> {
    let scMoteur: Record<string, number> = {}, scPrefiltre: Record<string, number> = {};
    let source: ConfigRun["source"] = null;
    if (dto.scenarioCode) {
      const rows: any[] = await tx.amlScenario.findMany({
        where: { tenantId, code: dto.scenarioCode, active: true } });
      // Effet daté en JS (compatible faux Prisma) : version la plus haute dont effectiveFrom ≤ date.
      const env = rows.filter((r) => new Date(r.effectiveFrom) <= new Date(at))
        .sort((a, b) => b.version - a.version)[0];
      if (env) {
        const p = (env.params ?? {}) as any;
        scMoteur = p.moteur ?? {}; scPrefiltre = p.prefiltre ?? {};
        source = { scenarioCode: env.code, scenarioVersion: env.version };
      }
    }
    const moteur = { ...scMoteur, ...(dto.moteurConfig ?? {}) };        // l'appel prime sur le scénario
    const prefiltre = { ...scPrefiltre, ...(dto.prefiltre ?? {}) };
    return { moteur, prefiltre, source };
  }

  // -- R100 hits bruts persistes . R102 whitelist par empreinte . R103 trace meme sans hit --
  async run(ctx: Ctx, dto: RunDto) {
    if (!dto?.liste || !dto?.version || !Array.isArray(dto?.entries))
      throw new BadRequestException("liste, version et entries requis");
    return this.prisma.$transaction(async (tx: Tx) => {
      const clients = await tx.client.findMany({ where: {
        tenantId: ctx.tenantId, ...(dto.clientIds ? { id: { in: dto.clientIds } } : {}) } });
      const at = new Date().toISOString();

      // R269 - config EFFECTIVE (scenario versionne AmlScenario.params + override d'appel).
      const cfg = await this.resoudreConfig(tx, ctx.tenantId, dto, at);

      // R264 - index trigramme construit UNE FOIS au chargement de la liste. IDF : n<2 donnerait
      // log(1)=0 -> NaN ; on ne le construit qu'a partir de 2 entrees (sinon repli poids=1 du moteur).
      const idx = construireIndex(dto.entries as any);
      if (dto.entries.length >= 2) construireIdf(dto.entries as any);

      // Passe de SCORING synchrone (aucun await) : pre-filtre trigramme puis score composite du
      // meilleur candidat au-dessus du seuil (R263). Isole l'etat IDF global des await de persistance.
      const trouves: { client: any; uid: string; score: number; entree: EntreeListe; detail: HitDetail }[] = [];
      for (const c of clients) {
        const st = (c as any).structure ?? (c as any).type;      // clients réels : structure (PP/PM/…) ; harnais : type
        const requete = { nom: c.name, dob: (c as any).dateNaissance ?? (c as any).date_naissance ?? undefined,
          est_entite: st ? st !== "PP" : false };
        const cand = candidats(idx, c.name, cfg.prefiltre);           // R264/R269 - pre-filtre (config en vigueur)
        const r = rapprocherDetail(requete, cand, dto.seuil, cfg.moteur); // R263/R269 - score fin (knobs en vigueur)
        if (!r) continue;
        trouves.push({ client: c, uid: r.uid, score: r.score, entree: r.entree as any,
          detail: { via: r.detail.via, nameScore: Math.round(r.detail.nameScore),
            typePenalty: r.detail.typePenalty, dobContribution: r.detail.dobContribution } });
      }

      // Passe de PERSISTANCE (await) - whitelist R102 par empreinte inchangee.
      const hits: any[] = [];
      for (const t of trouves) {
        const entreeHash = this.domain.hashEntree(t.entree);
        // R102 - ecarte seulement si un FAUX_POSITIF existe pour (client, entree, CETTE empreinte)
        const wl = await tx.screeningQualification.findFirst({ where: {
          tenantId: ctx.tenantId, verdict: "FAUX_POSITIF", entreeHash,
          hit: { clientId: t.client.id, entreeUid: t.uid } } });
        if (wl) continue;
        hits.push(await tx.screeningHit.create({ data: {
          tenantId: ctx.tenantId, clientId: t.client.id, entreeUid: t.uid, score: t.score,
          listeVersion: dto.version, entreeHash, statut: "BRUT", at,
          detail: t.detail } }));      // R266 - decomposition explicable (score, via, DOB, type)
      }
      // R103 - la trace de passage s'ecrit TOUJOURS, hits ou pas, pre-filtre inclus
      const run = await tx.screeningRun.create({ data: {
        tenantId: ctx.tenantId, liste: dto.liste, listeVersion: dto.version,
        seuil: dto.seuil, prefiltre: cfg.prefiltre, perimetre: clients.length,
        nbHits: hits.length, at,
        config: cfg as any } });   // R269 - config effective + scenario/version en vigueur (rejeu)
      for (const h of hits) await tx.screeningHit.update({ where: { id: h.id }, data: { runId: run.id } });
      await this.audit.log(ctx.tenantId, ctx.userId, "SCREENING_RUN",
        `${dto.liste}@${dto.version}:${clients.length} clients, ${hits.length} hits`);
      return { run, hits };
    });
  }

  // -- R101 - verdict + motif obligatoire (R7) + auteur = jeton ; VP -> escalade PROPOSEE --
  async qualify(ctx: Ctx, hitId: string, verdict: Verdict, motif: string) {
    if (!motif || !motif.trim()) throw new BadRequestException("R7 : la qualification exige un motif");
    return this.prisma.$transaction(async (tx: Tx) => {
      const hit = await tx.screeningHit.findFirst({ where: { id: hitId, tenantId: ctx.tenantId } });
      if (!hit) throw new NotFoundException("Hit introuvable");
      if (hit.statut === "QUALIFIE")
        throw new BadRequestException("Hit déjà qualifié — passer par une re-qualification tracée");
      const q = await tx.screeningQualification.create({ data: {
        tenantId: ctx.tenantId, hitId: hit.id, verdict, motif: motif.trim(),
        par: ctx.userId,                                  // R101 : personne nommee = jeton, jamais body
        at: new Date().toISOString(), entreeHash: hit.entreeHash, listeVersion: hit.listeVersion } });
      await tx.screeningHit.update({ where: { id: hit.id }, data: { statut: "QUALIFIE" } });
      if (verdict === "VRAI_POSITIF") {
        // R39/R44 - on PROPOSE : gel, clarification art. 6 LBA, MROS restent des decisions humaines
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
  runs(ctx: Ctx) {                                        // R103 - la preuve de fraicheur, lisible
    return this.prisma.screeningRun.findMany({ where: { tenantId: ctx.tenantId } });
  }
}
