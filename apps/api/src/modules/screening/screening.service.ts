import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { ScreeningQualificationService, EntreeListe, Verdict } from "./rules/screening-qualification";
import { Tx } from "../../common/tx";
import { parserSwift } from "../txflux/swift.module";
import { emitEvent } from "../../common/domain-event";
import { construireIndex, construireIndexCache, construireIdfLocal, candidats, rapprocherDetail, ingererListe } from "@olive/screening-engine";

/**
 * Cablage persistant des regles screening R100->R103 (SC-01..04, ratifiees 15.07.2026).
 * La semantique vit dans rules/screening-qualification.ts (domaine, 4/4 verts) ;
 * ici : persistance Prisma, scope tenant, auteur depuis le JETON (jamais du body),
 * audit de passage, escalade PROPOSEE par evenement (R39/R44 - jamais executee).
 *
 * R408 - le rapprochement delegue au MOTEUR FIN (@olive/screening-engine : Jaro-Winkler + IDF +
 * pre-filtre trigramme). Le score persiste est le COMPOSITE 0-100, plus jamais 100|0 binaire.
 * R409 - l'index trigramme est construit UNE FOIS au chargement de la liste (pas par requete) ;
 * chaque client est pre-filtre (candidats) avant le score fin. R411 - le hit stocke la decomposition.
 * C8 (L5) : l'IDF est INSTANCIÉ PAR RUN (construireIdfLocal) — plus d'état module-global, les runs
 * concurrents ne se contaminent pas ; la passe de scoring reste synchrone (lisibilité, pas nécessité).
 */

export type SujetType = "client" | "personne" | "prospect" | "transaction";
// R100 (screening des transactions) — une PARTIE d'une transaction/position/virement à screener :
// donneur d'ordre, bénéficiaire, banque intermédiaire… `id` est une référence (uuid) que le flux de
// paiement rattache à (transaction, rôle). `est_entite` = true pour une banque/société.
export interface Partie { id: string; name: string; dob?: string; nationalites?: string[]; est_entite?: boolean }
// R100 (branchement flux réel) — les PARTIES d'un message de paiement SWIFT (MT103/MT202/pacs.008),
// telles que le parseur du flux (R300, swift.module) les surligne : donneur d'ordre, bénéficiaire,
// banque bénéficiaire. Le SWIFT met le compte/IBAN sur la 1re ligne (préfixe `/`) et le NOM sur les
// suivantes ; on isole le nom. `id` = `${référence}:${rôle}` → chaque hit se rattache à (virement, rôle).
// Aucune partie inventée : seule une valeur PRÉSENTE dans le message devient une partie à screener.
type SwiftExtraction = { reference?: string; donneurOrdre?: string | null; beneficiaire?: string | null; banqueBeneficiaire?: string | null };
export function partiesSwift(extraction: SwiftExtraction): Partie[] {
  const nomSwift = (champ?: string | null): string | null => {
    if (!champ) return null;
    const lignes = String(champ).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const sansCompte = lignes.filter((l) => !l.startsWith("/"));   // 1re ligne /compte|IBAN → le nom suit
    return sansCompte[0] ?? lignes[0] ?? null;
  };
  const ref = extraction.reference ?? "?";
  const roles: [string, string | null | undefined, boolean][] = [
    ["donneur", extraction.donneurOrdre, false],
    ["beneficiaire", extraction.beneficiaire, false],
    ["banque", extraction.banqueBeneficiaire, true],             // banque intermédiaire = entité
  ];
  return roles.flatMap(([role, champ, est_entite]) => {
    const name = nomSwift(champ);
    return name ? [{ id: `${ref}:${role}`, name, est_entite }] : [];
  });
}
// R100 (branchement flux CORE BANKING) — l'AUTRE canal réel : le journal transactionnel (R297) porte
// la contrepartie de chaque écriture. Chaque transaction dont la contrepartie est NOMMÉE devient une
// partie à screener (`id` = `${refExterne}:contrepartie` → le hit se rattache à l'écriture). Le sens de
// la contrepartie (personne/entité) n'est pas connu du journal : on ne l'invente pas (est_entite laissé
// à false, aucune pénalité de type appliquée à tort). Une écriture sans contrepartie nommée est ignorée.
type LigneFlux = { refExterne?: string; contrepartieNom?: string | null };
export function partiesTransactions(lignes: LigneFlux[]): Partie[] {
  return (lignes ?? []).flatMap((l) => {
    const name = (l.contrepartieNom ?? "").trim();
    return name ? [{ id: `${l.refExterne ?? "?"}:contrepartie`, name, est_entite: false }] : [];
  });
}

// R411 — sérialise les lignes d'export d'audit en CSV RFC 4180. Colonnes STABLES (une par intermédiaire
// explicable). Échappement : un champ contenant «,» «"» ou saut de ligne est encadré de guillemets, les
// guillemets internes doublés. Fonction PURE (aucun accès Prisma) → testable isolément.
const CSV_COLS: [string, (l: any) => any][] = [
  ["at", (l) => l.at], ["statut", (l) => l.statut],
  ["sujet_type", (l) => l.sujet?.type], ["sujet_id", (l) => l.sujet?.id],
  ["entree_uid", (l) => l.entree?.uid], ["entree_hash", (l) => l.entree?.hash],
  ["liste_version", (l) => l.entree?.listeVersion], ["score", (l) => l.score],
  ["via", (l) => l.decomposition?.via], ["nameScore", (l) => l.decomposition?.nameScore],
  ["typePenalty", (l) => l.decomposition?.typePenalty], ["dobContribution", (l) => l.decomposition?.dobContribution],
  ["natContribution", (l) => l.decomposition?.natContribution],
  ["run_id", (l) => l.run?.id], ["run_liste", (l) => l.run?.liste], ["run_version", (l) => l.run?.version],
  ["run_seuil", (l) => l.run?.seuil],
  ["scenario_code", (l) => l.run?.scenario?.scenarioCode], ["scenario_version", (l) => l.run?.scenario?.scenarioVersion],
  ["verdict", (l) => l.qualification?.verdict], ["motif", (l) => l.qualification?.motif],
  ["qualifie_par", (l) => l.qualification?.par], ["qualifie_at", (l) => l.qualification?.at],
];
export function hitsVersCsv(lignes: any[]): string {
  const echapper = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const entete = CSV_COLS.map((c) => c[0]).join(",");
  const corps = (lignes ?? []).map((l) => CSV_COLS.map((c) => echapper(c[1](l))).join(","));
  return [entete, ...corps].join("\r\n");
}
export interface RunDto {
  liste: string; version: string; seuil: number;
  prefiltre: Record<string, number>; entries: EntreeListe[]; clientIds?: string[];
  // R100 (sujets étendus) — le screening vise le CLIENT (défaut, rétro-compatible), la PERSONNE, le
  // PROSPECT/pré-prospect, ou les PARTIES d'une TRANSACTION (sujet='transaction' + `parties`). Même
  // moteur, même règle ; `sujetIds` restreint le périmètre (comme clientIds).
  sujet?: SujetType; sujetIds?: string[]; parties?: Partie[];
  // R414 — gouvernance du réglage : un scénario VERSIONNÉ (AmlScenario.params) fournit la config du
  // moteur (params.moteur) et du pré-filtre (params.prefiltre) en vigueur à la date du run (R29).
  // Un override d'appel reste possible (moteurConfig) et PRIME sur le scénario ; tout est tracé.
  scenarioCode?: string; moteurConfig?: Record<string, number | boolean>;
  // ADR-PEP-001 (P-L4-1) — CATÉGORIE de la liste screenée. "PEP" active le ROUTAGE : un hit au-dessus
  // du seuil devient une PROPOSITION de PEPisation (événement + tâche compliance) — jamais une bascule.
  categorie?: string;
  // C7 (L5) — un override d'appel (moteurConfig) accepté EXIGE une justification (R7), tracée sur le run.
  justification?: string;
}
// Forme COMMUNE d'un sujet screené, quel que soit sa table d'origine (client/personne/prospect).
type Sujet = { id: string; name: string; dob?: string; est_entite: boolean; nationalites?: string[] };
type Ctx = { tenantId: string; userId: string; role: string };
// Config EFFECTIVE d'un run + sa provenance (persistée sur le run pour le rejeu R48/R49).
type ConfigRun = { moteur: Record<string, number | boolean>; prefiltre: Record<string, number>;
  source: { scenarioCode: string; scenarioVersion: number } | null;
  override?: { justification: string; knobs: string[] } | null };   // C7 — override gouverné, tracé

// Decomposition explicable persistee (R411) - prepare R44 (le systeme explique, il ne decide pas).
type HitDetail = { via: string; nameScore: number; typePenalty: number; dobContribution: number; natContribution: number };

@Injectable()
export class ScreeningService {
  /** Reutilise le hash canonique du domaine - la whitelist R102 s'attache a CETTE empreinte. */
  private domain = new ScreeningQualificationService();
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  /**
   * R414 — résout la config EFFECTIVE d'un run. Base : le scénario VERSIONNÉ en vigueur à la date
   * (plus haute version active, effet ≤ date — R29), qui porte params.moteur / params.prefiltre.
   * C7 (L5) — l'override d'appel (moteurConfig) n'écrase plus SILENCIEUSEMENT la config gouvernée :
   * il exige (1) l'opt-in tenant `allowCallOverride` (tenant.settings, défaut false — sinon REFUS
   * typé) et (2) une `justification` (R7), TRACÉE sur le run (rejeu R48/R49). Sans scénario ni
   * override : moteur vide → défauts R413 (comportement inchangé), pré-filtre = celui de l'appel.
   */
  private async resoudreConfig(tx: Tx, tenantId: string, dto: RunDto, at: string): Promise<ConfigRun> {
    let scMoteur: Record<string, number | boolean> = {}, scPrefiltre: Record<string, number> = {};
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
    let override: ConfigRun["override"] = null;
    if (dto.moteurConfig && Object.keys(dto.moteurConfig).length > 0) {   // C7 : l'override est un ACTE gouverné
      const t = await tx.tenant.findFirst({ where: { id: tenantId } });
      if (((t?.settings as any) ?? {}).allowCallOverride !== true)
        throw new BadRequestException("C7 : override de la config gouvernée refusé — le tenant n'a pas activé allowCallOverride");
      if (!dto.justification || !dto.justification.trim())
        throw new BadRequestException("C7/R7 : un override accepté exige une justification");
      override = { justification: dto.justification.trim(), knobs: Object.keys(dto.moteurConfig) };
    }
    const moteur = { ...scMoteur, ...(dto.moteurConfig ?? {}) };        // l'appel prime — mais gouverné (C7)
    const prefiltre = { ...scPrefiltre, ...(dto.prefiltre ?? {}) };
    return { moteur, prefiltre, source, override };
  }

  /**
   * R100 (sujets étendus) — charge le périmètre à screener selon le TYPE de sujet, et le ramène à une
   * FORME COMMUNE {id, name, dob, est_entite, nationalites}. Le moteur est agnostique : il ne voit que
   * des noms. Défaut `client` = comportement d'origine. PP par convention pour personne/prospect.
   */
  private async chargerSujets(tx: Tx, tenantId: string, sujet: SujetType, ids?: string[]): Promise<Sujet[]> {
    const filtreId = ids && ids.length ? { id: { in: ids } } : {};
    if (sujet === "personne") {
      const rows: any[] = await tx.person.findMany({ where: { tenantId, etat: "ACTIVE", ...filtreId } });
      return rows.map((p) => ({ id: p.id, name: p.nom, dob: (p.donnees || {}).date_naissance,
        est_entite: false, nationalites: (p.donnees || {}).nationalites }));
    }
    if (sujet === "prospect") {
      const rows: any[] = await tx.onboarding.findMany({ where: { tenantId, ...filtreId } });
      return rows.map((o) => ({ id: o.id, name: o.prospectNom, dob: undefined, est_entite: false, nationalites: undefined }));
    }
    const rows: any[] = await tx.client.findMany({ where: { tenantId, ...filtreId } });
    return rows.map((c) => { const st = c.structure ?? c.type;      // clients réels : structure (PP/PM/…) ; harnais : type
      return { id: c.id, name: c.name, dob: c.dateNaissance ?? c.date_naissance ?? undefined,
        est_entite: st ? st !== "PP" : false, nationalites: c.nationalites ?? (c.country ? [c.country] : undefined) }; });
  }

  // -- R100 hits bruts persistes . R102 whitelist par empreinte . R103 trace meme sans hit --
  async run(ctx: Ctx, dto: RunDto) {
    if (!dto?.liste || !dto?.version || !Array.isArray(dto?.entries))
      throw new BadRequestException("liste, version et entries requis");
    const sujetType: SujetType = dto.sujet ?? "client";
    return this.prisma.$transaction(async (tx: Tx) => {
      // R100 (sujets étendus) — charge le périmètre selon le TYPE de sujet, ramené à une forme commune.
      // 'transaction' : les parties viennent EXPLICITEMENT du flux (paiement/virement), pas d'une table.
      const sujets: Sujet[] = sujetType === "transaction"
        ? (dto.parties ?? []).map((p) => ({ id: p.id, name: p.name, dob: p.dob, est_entite: !!p.est_entite, nationalites: p.nationalites }))
        : await this.chargerSujets(tx, ctx.tenantId, sujetType, dto.sujetIds ?? dto.clientIds);
      const at = new Date().toISOString();

      // R414 - config EFFECTIVE (scenario versionne AmlScenario.params + override d'appel).
      const cfg = await this.resoudreConfig(tx, ctx.tenantId, dto, at);
      // V2-M45 — le SEUIL EFFECTIF. Sans `seuil` à l'appel, deux choses cassaient en silence
      // puis en fracas : la comparaison `score >= undefined` est toujours fausse (donc ZÉRO hit,
      // sans que rien ne le dise), et `screeningRun.create` tombait ensuite en 500 sur une
      // colonne non nulle. Le repli n'invente rien : c'est le paramètre GOUVERNÉ `screeningSeuil`
      // (R100, registre R-Q, défaut 85) — celui-là même que l'écran de paramétrage édite.
      const tnt = await tx.tenant.findFirst({ where: { id: ctx.tenantId } });
      const seuilGouverne = ((tnt?.settings as any) ?? {}).screeningSeuil;
      const seuil: number = typeof dto.seuil === "number" ? dto.seuil
        : typeof seuilGouverne === "number" ? seuilGouverne : 85;

      // R409 - index trigramme MÉMOÏSÉ par liste@version (PERF : le rescreening répété d'un portefeuille
      // contre la même liste ne le reconstruit plus). L'index ne porte que des données de LISTE (jamais
      // tenant) → cache partageable sans fuite. IDF : n<2 donnerait log(1)=0 -> NaN ; construit à partir de 2.
      // R416 — canal PHONÉTIQUE du pré-filtre : quand le moteur en vigueur utilise la phonétique, on le
      // branche AUSSI sur le blocking, sinon une translittération n'entre jamais dans les candidats et le
      // score fin phonétique ne s'exécute pas. OFF (défaut) → index/candidats trigramme inchangés (bit pour
      // bit). La clé de cache varie par méthode (index phonétique distinct par méthode).
      const phon = cfg.moteur && (cfg.moteur as any).phonetique
        ? { phonetique: true as const, phonetiqueMethode: (((cfg.moteur as any).phonetiqueMethode as string) === "double" ? "double" : "metaphone") as "metaphone" | "double" }
        : null;
      // V2-M46 — NORMALISER les entrées comme le fait la route d'import (R409). `run()` indexait
      // `dto.entries` BRUTES : un appelant envoyant le format DOCUMENTÉ de l'import ({id, name})
      // produisait un index sans trigrammes → zéro candidat → ZÉRO HIT, et un run persisté
      // « 0 hit » — soit, pour un moteur de screening, un dossier propre qui ne l'est pas.
      // `ingererListe` est IDEMPOTENTE : une entrée déjà au format moteur traverse inchangée.
      const entrees = ingererListe(dto.entries as any) as any[];
      const cacheKey = `${dto.liste}@${dto.version}${phon ? `#${phon.phonetiqueMethode}` : ""}`;
      const idx = construireIndexCache(cacheKey, entrees, phon ?? undefined);
      // C8 (L5) — IDF LOCAL AU RUN : plus d'état module-global ; deux runs interleavés (tenants/listes
      // différents) ne peuvent plus se contaminer. IDF : n<2 donnerait log(1)=0 -> NaN ; construit à partir de 2.
      const idf = entrees.length >= 2 ? construireIdfLocal(entrees) : undefined;

      // Passe de SCORING synchrone (aucun await) : pre-filtre trigramme puis score composite du
      // meilleur candidat au-dessus du seuil (R408). Isole l'etat IDF global des await de persistance.
      const trouves: { sujetId: string; uid: string; score: number; entree: EntreeListe; detail: HitDetail }[] = [];
      for (const s of sujets) {
        const requete = { nom: s.name, dob: s.dob, est_entite: s.est_entite, nationalites: s.nationalites }; // R417 - nationalité
        const cand = candidats(idx, s.name, { ...cfg.prefiltre, ...(phon ?? {}) }); // R409/R414/R416 - pre-filtre (config + phonétique en vigueur)
        const r = rapprocherDetail(requete, cand, seuil, cfg.moteur, idf); // R408/R414 - score fin (knobs en vigueur), IDF du run (C8)
        if (!r) continue;
        trouves.push({ sujetId: s.id, uid: r.uid, score: r.score, entree: r.entree as any,
          detail: { via: r.detail.via, nameScore: Math.round(r.detail.nameScore),
            typePenalty: r.detail.typePenalty, dobContribution: r.detail.dobContribution,
            natContribution: r.detail.natContribution } });
      }

      // Passe de PERSISTANCE (await) - whitelist R102 par empreinte inchangee.
      const hits: any[] = [];
      for (const t of trouves) {
        const entreeHash = this.domain.hashEntree(t.entree);
        // R102 - ecarte seulement si un FAUX_POSITIF existe pour (client, entree, CETTE empreinte)
        const wl = await tx.screeningQualification.findFirst({ where: {
          tenantId: ctx.tenantId, verdict: "FAUX_POSITIF", entreeHash,
          hit: { clientId: t.sujetId, entreeUid: t.uid } } });
        if (wl) continue;
        const hitCree = await tx.screeningHit.create({ data: {
          tenantId: ctx.tenantId, clientId: t.sujetId, sujetType, entreeUid: t.uid, score: t.score,
          listeVersion: dto.version, entreeHash, statut: "BRUT", at,
          detail: t.detail } });      // R411 - decomposition explicable (score, via, DOB, type)
        hits.push(hitCree);
        // ES-6 (C6) : la TIMELINE du hit devient événementielle — la détection est un fait
        // horodaté du journal (le sidecar ES la rejoue) ; l'état reste la table (CRUD-primaire).
        await emitEvent(tx, ctx.tenantId, "screening.hit.detecte", hitCree.id,
          { hitId: hitCree.id, clientId: t.sujetId, entreeUid: t.uid, score: t.score, listeVersion: dto.version });
      }
      // R103 - la trace de passage s'ecrit TOUJOURS, hits ou pas, pre-filtre inclus
      const run = await tx.screeningRun.create({ data: {
        tenantId: ctx.tenantId, liste: dto.liste, listeVersion: dto.version, sujetType,
        seuil, prefiltre: cfg.prefiltre, perimetre: sujets.length,
        nbHits: hits.length, at,
        // R414/R415 - config effective + scenario/version + perimetre exact : de quoi REJOUER a l'identique.
        config: { ...cfg, clientIds: sujets.map((s) => s.id) } as any } });
      for (const h of hits) await tx.screeningHit.update({ where: { id: h.id }, data: { runId: run.id } });

      // ── ADR-PEP-001 / R44 (P-L4-1) — ROUTAGE PEP : sur une liste de catégorie PEP, chaque hit
      // au-dessus du seuil de revue devient une PROPOSITION de PEPisation : événement
      // pep.proposition.creee + tâche assignée au rôle compliance. JAMAIS de bascule de statutPep ici
      // (l'autorité reste personnes.service, décision humaine — le screening PROPOSE). Idempotence :
      // même (sujet, entrée, version de liste) = une seule proposition, clé déterministe en aggregateId.
      if ((dto.categorie ?? "").toUpperCase() === "PEP") {
        for (const h of hits) {
          const t = trouves.find((x) => x.sujetId === h.clientId && x.uid === h.entreeUid);
          const cle = `pep:${h.clientId}:${h.entreeUid}:${dto.version}`;
          const deja = await tx.domainEvent.findFirst({ where: {
            tenantId: ctx.tenantId, type: "pep.proposition.creee", aggregateId: cle } });
          if (deja) continue;
          // P-L5-2 (C6) : émission par emitEvent — le catalogue VALIDE le payload au write.
          await emitEvent(tx, ctx.tenantId, "pep.proposition.creee",
            cle, { cle, hitId: h.id, personId: h.clientId, liste: dto.liste,
              listeVersion: dto.version, score: h.score, decomposition: t?.detail ?? null });
          await tx.task.create({ data: { tenantId: ctx.tenantId, assigneeId: "COMPLIANCE",
            type: "PEP_PROPOSITION", statut: "OUVERTE", createdAt: at,
            subjectType: "personne", subjectId: h.clientId, origine: cle } });
        }
      }

      await this.audit.log(ctx.tenantId, ctx.userId, "SCREENING_RUN",
        `${dto.liste}@${dto.version}:${sujets.length} ${sujetType}(s), ${hits.length} hits`);
      return { run, hits };
    });
  }

  /**
   * R100 (branchement du flux RÉEL) — screene les PARTIES d'un VIREMENT à partir de son message de
   * paiement SWIFT brut. C'est le point où le screening de transaction cesse d'être une saisie
   * manuelle : le message (MT103/MT202/pacs.008) est parsé par le flux (R300), les parties sont
   * EXTRAITES (donneur / bénéficiaire / banque), puis on délègue à run(sujet='transaction'). Message
   * non parsable = refus TYPÉ (jamais deviné, pattern R169). « Aucun hit ≠ pas d'alerte » (R100)
   * s'applique tel quel : les hits produits se rattachent à (virement:référence, rôle).
   */
  async runSwift(ctx: Ctx, dto: Omit<RunDto, "parties" | "sujet"> & { texte?: string }) {
    if (!dto?.texte?.trim()) throw new BadRequestException("texte du message SWIFT requis");
    const p = parserSwift(dto.texte);
    if (!p.extraction) throw new BadRequestException(`message SWIFT non parsable — ${p.motif ?? "format inconnu"}`);
    const parties = partiesSwift(p.extraction);
    const { run, hits } = await this.run(ctx, { ...dto, sujet: "transaction", parties });
    return { reference: p.extraction.reference, type: p.extraction.type, parties, run, hits };
  }

  /**
   * R100 (branchement du flux CORE BANKING) — screene les CONTREPARTIES du journal transactionnel
   * (R297) contre la liste. C'est le canal réel complémentaire de SWIFT : les parties ne sont pas
   * saisies, elles sont LUES du journal (tenant-scopé, éventuellement restreint à un client). On délègue
   * à run(sujet='transaction') ; chaque hit se rattache à (écriture:refExterne, contrepartie). Journal
   * vide = 0 partie → run tracé sans hit (R103), « aucun hit ≠ pas d'alerte » (R100) inchangé.
   */
  async runFlux(ctx: Ctx, dto: Omit<RunDto, "parties" | "sujet"> & { clientId?: string }) {
    if (!dto?.liste || !dto?.version || !Array.isArray(dto?.entries))
      throw new BadRequestException("liste, version et entries requis");
    const lignes = await this.prisma.transaction.findMany({
      where: { tenantId: ctx.tenantId, ...(dto.clientId ? { clientId: dto.clientId } : {}) } });
    const parties = partiesTransactions(lignes as any);
    const { run, hits } = await this.run(ctx, { ...dto, sujet: "transaction", parties });
    return { transactions: lignes.length, parties: parties.length, run, hits };
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
      // ES-6 (C6) : CHAQUE qualification (VP comme FP) est un fait du journal — timeline rejouable.
      await emitEvent(tx, ctx.tenantId, "screening.hit.qualifie", hit.id,
        { hitId: hit.id, verdict, motif: motif.trim(), par: ctx.userId });
      if (verdict === "VRAI_POSITIF") {
        // R39/R44 - on PROPOSE : gel, clarification art. 6 LBA, MROS restent des decisions humaines
        // P-L5-2 (C6) : émission par emitEvent — le catalogue VALIDE le payload au write.
        await emitEvent(tx, ctx.tenantId, "screening.escalade.proposee", hit.id,
          { hitId: hit.id, clientId: hit.clientId, motif: "Correspondance qualifiée vraie — gel, clarification art. 6 LBA et communication MROS à arbitrer" });
      }
      await this.audit.log(ctx.tenantId, ctx.userId, "SCREENING_QUALIFIED", `${hit.id}:${verdict}`);
      return q;
    });
  }

  /**
   * HISTORISATION / AUDIT — le hit est une pièce forensique IMMUABLE (score, décomposition, version de
   * liste ; le run lié porte la config qui l'a produit — R414). On lit l'historique d'un SUJET dans le
   * temps : par client et fenêtre de dates. Index (tenant_id, client_id, at) pour la requête à l'échelle.
   */
  hits(ctx: Ctx, f: { statut?: string; clientId?: string; sujetType?: string; since?: string; until?: string } = {}) {
    const at = (f.since || f.until) ? { at: { ...(f.since ? { gte: f.since } : {}), ...(f.until ? { lte: f.until } : {}) } } : {};
    return this.prisma.screeningHit.findMany({
      where: { tenantId: ctx.tenantId, ...(f.statut ? { statut: f.statut } : {}),
        ...(f.clientId ? { clientId: f.clientId } : {}), ...(f.sujetType ? { sujetType: f.sujetType } : {}), ...at },
      orderBy: { at: "desc" } });
  }
  runs(ctx: Ctx) {                                        // R103 - la preuve de fraicheur, lisible
    return this.prisma.screeningRun.findMany({ where: { tenantId: ctx.tenantId } });
  }

  /**
   * R411 (export d'audit) — assemble, pour une fenêtre/sujet, un JEU DE LIGNES AUDITABLE : chaque hit
   * (pièce forensique immuable) JOINT à la config qui l'a produit (run — liste/version/seuil/scénario,
   * R414) ET à sa qualification motivée la plus récente (verdict/motif/auteur=jeton, R101). But : sortir
   * l'historique tel quel pour un contrôle (révision interne, régulateur), sans recalcul — le repo fait foi.
   * Même scope tenant et mêmes filtres que hits(). L'export lui-même est tracé (qui a exporté quoi, quand).
   */
  async exporterHits(ctx: Ctx, f: { statut?: string; clientId?: string; sujetType?: string; since?: string; until?: string } = {}) {
    const hits: any[] = await this.hits(ctx, f);
    const runIds = [...new Set(hits.map((h) => h.runId).filter(Boolean))];
    const hitIds = hits.map((h) => h.id);
    const runs: any[] = runIds.length
      ? await this.prisma.screeningRun.findMany({ where: { tenantId: ctx.tenantId, id: { in: runIds } } }) : [];
    const quals: any[] = hitIds.length
      ? await this.prisma.screeningQualification.findMany({ where: { tenantId: ctx.tenantId, hitId: { in: hitIds } } }) : [];
    const runById = new Map(runs.map((r) => [r.id, r]));
    // Qualification la PLUS RÉCENTE par hit (une re-qualification tracée prime, R101).
    const qualByHit = new Map<string, any>();
    for (const q of quals) {
      const cur = qualByHit.get(q.hitId);
      if (!cur || String(q.at) > String(cur.at)) qualByHit.set(q.hitId, q);
    }
    const lignes = hits.map((h) => {
      const run = runById.get(h.runId);
      const cfg = (run?.config ?? {}) as any;
      const q = qualByHit.get(h.id);
      return {
        hitId: h.id, at: h.at, statut: h.statut,
        sujet: { type: h.sujetType ?? "client", id: h.clientId },
        entree: { uid: h.entreeUid, hash: h.entreeHash, listeVersion: h.listeVersion },
        score: h.score, decomposition: h.detail ?? null,          // R411 - via/nameScore/typePenalty/DOB/nat
        run: run ? { id: run.id, liste: run.liste, version: run.listeVersion, seuil: run.seuil,
          scenario: cfg.source ?? null } : null,                   // R414 - la config qui a produit le hit
        qualification: q ? { verdict: q.verdict, motif: q.motif, par: q.par, at: q.at } : null, // R101
      };
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "SCREENING_EXPORT",
      `${lignes.length} hits${f.since ? ` depuis ${f.since}` : ""}${f.until ? ` jusqu'à ${f.until}` : ""}`);
    return { genereLe: new Date().toISOString(), parJeton: ctx.userId, filtre: f, total: lignes.length, lignes };
  }

  /**
   * R411 (export d'audit, format CSV) — même contenu que exporterHits, APLATI en CSV RFC 4180 pour un
   * tableur/contrôleur. Une colonne par intermédiaire explicable ; l'export CSV est tracé comme le JSON.
   */
  async exporterHitsCsv(ctx: Ctx, f: { statut?: string; clientId?: string; sujetType?: string; since?: string; until?: string } = {}) {
    const exp = await this.exporterHits(ctx, f);
    return hitsVersCsv(exp.lignes);
  }

  // ── R415 — GOUVERNANCE de la config du moteur : publier/lister des VERSIONS (AmlScenario) ──
  // Le code de scenario porteur de la config de screening. La voie run(dto.scenarioCode) resout la
  // version en vigueur (R414) ; ici on la PUBLIE et on la LIT, comme tout parametre versionne (R125).
  static readonly CODE_CONFIG = "SC-SCREENING";

  /** R415/R7 — publie une NOUVELLE version de la config (motif obligatoire, auteur = jeton, effet date R29). */
  async publierConfig(ctx: Ctx, dto: { moteur?: Record<string, number | boolean>; prefiltre?: Record<string, number>;
    effectiveFrom?: string; motif?: string }) {
    if (!dto?.motif || !dto.motif.trim()) throw new BadRequestException("R7 : publier une config exige un motif");
    return this.prisma.$transaction(async (tx: Tx) => {
      const rows: any[] = await tx.amlScenario.findMany({
        where: { tenantId: ctx.tenantId, code: ScreeningService.CODE_CONFIG } });
      const version = (rows.reduce((m, r) => Math.max(m, r.version), 0)) + 1;   // versions monotones par tenant
      const scen = await tx.amlScenario.create({ data: {
        tenantId: ctx.tenantId, code: ScreeningService.CODE_CONFIG, ruleRef: "R415", fam: "GV",
        version, effectiveFrom: dto.effectiveFrom ?? new Date().toISOString(),
        params: { moteur: dto.moteur ?? {}, prefiltre: dto.prefiltre ?? {}, motif: dto.motif.trim() },
        niveau: null, blocking: false, active: true } });
      await this.audit.log(ctx.tenantId, ctx.userId, "SCREENING_CONFIG_PUBLIEE",
        `${ScreeningService.CODE_CONFIG} v${version}`);
      return scen;
    });
  }

  /** R415 — les versions publiees + celle EN VIGUEUR a la date (R29), pour l'ecran de gouvernance. */
  async configs(ctx: Ctx, at: string = new Date().toISOString()) {
    const rows: any[] = await this.prisma.amlScenario.findMany({
      where: { tenantId: ctx.tenantId, code: ScreeningService.CODE_CONFIG } });
    const versions = rows.sort((a, b) => b.version - a.version);
    const enVigueur = versions.filter((r) => r.active && new Date(r.effectiveFrom) <= new Date(at))
      .sort((a, b) => b.version - a.version)[0] ?? null;
    return { code: ScreeningService.CODE_CONFIG, enVigueur, versions };
  }

  /**
   * R415/R48/R49 — REJEU d'un run : on re-score son perimetre EXACT avec la config PERSISTEE sur le
   * run (jamais la config courante), contre les memes entrees. Ne persiste RIEN : c'est une preuve
   * de reproductibilite, pas un nouveau run. Renvoie les hits recalcules + s'ils egalent l'origine.
   */
  async replay(ctx: Ctx, runId: string, entries: EntreeListe[]) {
    const run: any = await this.prisma.screeningRun.findFirst({ where: { id: runId, tenantId: ctx.tenantId } });
    if (!run) throw new NotFoundException("Run introuvable");
    if (!Array.isArray(entries)) throw new BadRequestException("entries requis pour rejouer");
    const cfg = (run.config ?? {}) as any;
    const clientIds: string[] = cfg.clientIds ?? [];
    const clients = await this.prisma.client.findMany({ where: {
      tenantId: ctx.tenantId, ...(clientIds.length ? { id: { in: clientIds } } : {}) } });
    // R416 — rejeu FIDÈLE : si la config persistée utilisait la phonétique, le pré-filtre du rejeu doit
    // l'appliquer AUSSI (sinon un candidat entré par voie phonétique manquerait et le hit ne se rejouerait pas).
    const phon = cfg.moteur && cfg.moteur.phonetique
      ? { phonetique: true as const, phonetiqueMethode: ((cfg.moteur.phonetiqueMethode as string) === "double" ? "double" : "metaphone") as "metaphone" | "double" }
      : null;
    const idx = construireIndex(entries as any, phon ?? undefined);
    const idf = entries.length >= 2 ? construireIdfLocal(entries as any) : undefined;   // C8 — local au rejeu
    const rejoue: { clientId: string; entreeUid: string; score: number }[] = [];
    for (const c of clients) {
      const st = (c as any).structure ?? (c as any).type;
      const requete = { nom: c.name, dob: (c as any).dateNaissance ?? (c as any).date_naissance ?? undefined,
        est_entite: st ? st !== "PP" : false };
      const cand = candidats(idx, c.name, { ...(cfg.prefiltre ?? {}), ...(phon ?? {}) });
      const r = rapprocherDetail(requete, cand, run.seuil, cfg.moteur ?? {}, idf);
      if (r) rejoue.push({ clientId: c.id, entreeUid: r.uid, score: r.score });
    }
    // Comparaison a l'origine (hits persistes du run) — R48/R49 : meme config → memes hits.
    const origine = (await this.prisma.screeningHit.findMany({ where: { tenantId: ctx.tenantId, runId } }))
      .map((h: any) => ({ clientId: h.clientId, entreeUid: h.entreeUid, score: h.score }));
    const norm = (xs: any[]) => JSON.stringify([...xs].sort((a, b) =>
      (a.clientId + a.entreeUid).localeCompare(b.clientId + b.entreeUid)));
    const identique = norm(rejoue) === norm(origine);
    await this.audit.log(ctx.tenantId, ctx.userId, "SCREENING_REPLAY", `${runId}:${identique ? "identique" : "DIVERGENT"}`);
    return { runId, config: cfg, rejoue, origine, identique };
  }
}
