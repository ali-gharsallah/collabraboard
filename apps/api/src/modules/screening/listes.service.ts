import { Injectable, ConflictException, BadRequestException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { emitEvent } from "../../common/domain-event";
import { Tx } from "../../common/tx";
import { ScreeningService } from "./screening.service";
import { ingererListe } from "@olive/screening-engine";

/**
 * R409 (L6 · P-L6-1) — INGESTION DE LISTES RÉELLES VERSIONNÉE (OpenSanctions, secours SECO/OFAC).
 * Chaque import crée une VERSION IMMUABLE (source, version, hash) : réimporter la même version avec
 * les mêmes entrées est idempotent ; avec des entrées différentes = REFUS (une version ne se réécrit
 * pas). Le DELTA vs la version précédente est calculé entité par entité (ajoutées / modifiées /
 * retirées) et déclenche : (1) le RESCREENING CIBLÉ du stock — via le pipeline normal (blocking +
 * moteur fin), mais contre les SEULES entrées ajoutées/modifiées ; (2) pour les entrées RETIRÉES
 * (delisting), les hits encore OUVERTS passent en REVUE ACCÉLÉRÉE (événement + tâche compliance) —
 * JAMAIS de clôture automatique (R44 : l'humain qualifie). L'âge de la liste est exposé (API ; le
 * bandeau front le consomme). Conservation ≥ 90 jours : la purge d'une version plus récente refuse.
 * Événements au catalogue C6 (validés au write).
 */

type Ctx = { tenantId: string; userId: string; role: string };
const sha = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex");
const PREFILTRE_DEFAUT = { minPartages: 2, maxTrigrammes: 12, plafond: 400 };
const RETENTION_JOURS = 90;

@Injectable()
export class ListesService {
  constructor(private prisma: PrismaService, private audit: AuditService, private screening: ScreeningService) {}

  /** Import bulk OU delta : la détection est automatique (delta = il existe une version antérieure). */
  async importer(ctx: Ctx, dto: { source: string; version: string; entries: any[];
    seuil?: number; prefiltre?: Record<string, number> }) {
    if (!dto?.source || !dto?.version || !Array.isArray(dto?.entries) || dto.entries.length === 0)
      throw new BadRequestException("source, version et entries (non vides) requis");
    const entries = ingererListe(dto.entries);                       // normalisation multi-format (R409)
    const hash = sha(entries);

    const resultat = await this.prisma.$transaction(async (tx: Tx) => {
      const existante = await tx.listeVersion.findFirst({
        where: { tenantId: ctx.tenantId, source: dto.source, version: dto.version } });
      if (existante) {
        if (existante.hash === hash) return { deja: true, version: existante };   // idempotence
        throw new ConflictException(
          `R409 : la version ${dto.source}@${dto.version} est IMMUABLE — réimporter d'autres entrées est refusé (nouvelle version requise)`);
      }
      // Delta entité par entité vs la DERNIÈRE version de la même source.
      const precedentes = await tx.listeVersion.findMany({
        where: { tenantId: ctx.tenantId, source: dto.source } });
      const precedente = precedentes.sort((a: any, b: any) => String(a.importeLe).localeCompare(String(b.importeLe))).pop();
      let delta: { ajoutees: string[]; modifiees: string[]; retirees: string[] } | null = null;
      if (precedente) {
        const avant = new Map((precedente.entries as any[]).map((e: any) => [e.uid, sha(e)]));
        const apres = new Map(entries.map((e: any) => [e.uid, sha(e)]));
        delta = {
          ajoutees: [...apres.keys()].filter((u) => !avant.has(u)),
          modifiees: [...apres.keys()].filter((u) => avant.has(u) && avant.get(u) !== apres.get(u)),
          retirees: [...avant.keys()].filter((u) => !apres.has(u)),
        };
      }
      const importeLe = new Date().toISOString();
      const version = await tx.listeVersion.create({ data: {
        tenantId: ctx.tenantId, source: dto.source, version: dto.version, hash,
        entries: entries as any, nEntrees: entries.length, delta: delta as any, importeLe } });
      await emitEvent(tx, ctx.tenantId, "liste.version.importee", version.id, {
        source: dto.source, version: dto.version, hash, nEntrees: entries.length,
        ajoutees: delta?.ajoutees.length ?? entries.length, modifiees: delta?.modifiees.length ?? 0,
        retirees: delta?.retirees.length ?? 0 });
      return { deja: false, version, delta, entries };
    });
    if ((resultat as any).deja) return { deja: true, source: dto.source, version: dto.version };
    await this.audit.log(ctx.tenantId, ctx.userId, "LISTE_IMPORTEE", `${dto.source}@${dto.version}`);

    const { delta, entries: normalisees } = resultat as any;
    let rescreening: any = null; let delisting: any = null;
    if (delta) {
      // ── RESCREENING CIBLÉ : le stock (clients) contre les SEULES entrées ajoutées/modifiées. ──
      const cibles = new Set([...delta.ajoutees, ...delta.modifiees]);
      if (cibles.size) {
        const sousListe = (normalisees as any[]).filter((e) => cibles.has(e.uid));
        const r: any = await this.screening.run(ctx, { liste: dto.source, version: dto.version,
          seuil: dto.seuil ?? 85, prefiltre: dto.prefiltre ?? PREFILTRE_DEFAUT, entries: sousListe });
        rescreening = { entrees: sousListe.length, hits: r.hits.length, runId: r.run.id };
        await this.prisma.$transaction((tx: Tx) => emitEvent(tx, ctx.tenantId, "liste.rescreening.cible",
          r.run.id, { source: dto.source, version: dto.version, entrees: sousListe.length, hits: r.hits.length }));
      }
      // ── DELISTING : hits encore OUVERTS sur une entrée retirée → revue ACCÉLÉRÉE, jamais de clôture. ──
      if (delta.retirees.length) {
        const ouverts = await this.prisma.screeningHit.findMany({
          where: { tenantId: ctx.tenantId, statut: "BRUT", entreeUid: { in: delta.retirees } } });
        await this.prisma.$transaction(async (tx: Tx) => {
          for (const h of ouverts) {
            await emitEvent(tx, ctx.tenantId, "liste.delisting.revue", h.id,
              { source: dto.source, version: dto.version, uid: h.entreeUid, hitId: h.id });
            await tx.task.create({ data: { tenantId: ctx.tenantId, assigneeId: "COMPLIANCE",
              type: "REVUE_DELISTING", statut: "OUVERTE", createdAt: new Date().toISOString(),
              subjectType: "screening_hit", subjectId: h.id, origine: `delisting:${dto.source}@${dto.version}:${h.entreeUid}` } });
          }
        });
        delisting = { retirees: delta.retirees.length, hitsEnRevue: ouverts.length };
      }
    }
    return { deja: false, source: dto.source, version: dto.version, hash: (resultat as any).version.hash,
      nEntrees: (resultat as any).version.nEntrees, delta, rescreening, delisting };
  }

  /** Âge des listes (bandeau + API) : dernière version par source, avec ageJours. `now` injectable (tests). */
  async listes(ctx: Ctx, now: Date = new Date()) {
    const rows = await this.prisma.listeVersion.findMany({ where: { tenantId: ctx.tenantId } });
    const parSource = new Map<string, any>();
    for (const r of rows) {
      const cur = parSource.get(r.source);
      if (!cur || String(r.importeLe) >= String(cur.importeLe)) parSource.set(r.source, r);   // >= : à horodatage égal (même ms), la plus récemment insérée gagne
    }
    return [...parSource.values()].map((r) => ({ source: r.source, version: r.version,
      importeLe: r.importeLe, nEntrees: r.nEntrees,
      ageJours: Math.floor((now.getTime() - new Date(r.importeLe).getTime()) / 86_400_000) }));
  }

  /** Conservation ≥ 90 j : purger une version plus récente REFUSE (les hits/runs y réfèrent). */
  async purger(ctx: Ctx, dto: { source: string; version: string }, now: Date = new Date()) {
    const v = await this.prisma.listeVersion.findFirst({
      where: { tenantId: ctx.tenantId, source: dto?.source, version: dto?.version } });
    if (!v) throw new BadRequestException("version introuvable");
    const ageJours = (now.getTime() - new Date(v.importeLe).getTime()) / 86_400_000;
    if (ageJours < RETENTION_JOURS)
      throw new ConflictException(`R409 : conservation ${RETENTION_JOURS} j — cette version a ${Math.floor(ageJours)} j, purge refusée`);
    await this.prisma.listeVersion.deleteMany({ where: { id: v.id } });
    await this.audit.log(ctx.tenantId, ctx.userId, "LISTE_PURGEE", `${dto.source}@${dto.version}`);
    return { purgee: true };
  }
}
