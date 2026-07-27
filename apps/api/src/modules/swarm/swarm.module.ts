import { Body, Controller, Get, Module, Param, Post, Query, Req, Injectable, ForbiddenException, BadRequestException, ConflictException, UnprocessableEntityException, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "crypto";
import { readFileSync } from "fs";
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

/**
 * Étape 2 : R259 — TOUT AGENT EST DÉCLARÉ AU REGISTRE, aucun agent implicite.
 * Registre VERSIONNÉ À DATE (R68) et APPEND-ONLY (SQL) : déclarer = version n+1, retirer =
 * une nouvelle version RETIRE — jamais une mutation. La résolution `resoudre()` est LE point
 * unique que consommeront les runs (SW-01/SW-02) : inconnu ⇒ 422 RUN_AGENT_INCONNU, retiré ⇒
 * 422 RUN_AGENT_RETIRE ; à date, la version d'ÉPOQUE est restituée (le rejeu d'un run ancien
 * utilise la définition d'agent de l'époque). Un agent ne peut déclarer que des outils
 * EXISTANTS au registre R264 (aucun outil implicite non plus).
 */
@Injectable()
export class SwarmAgentsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}
  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }

  // ── R259 : déclarer = version n+1 (ADMIN) — les outils doivent EXISTER (R264) ──
  async declarer(ctx: Ctx, dto: { code?: string; capacite?: string; outilsAutorises?: string[]; gabaritRef?: string }) {
    if (ctx.role !== "ADMIN") throw new ForbiddenException("R259 : la déclaration d'agent est un acte ADMIN (B.3)");
    if (!dto?.code?.trim() || !dto?.capacite?.trim() || !dto?.gabaritRef?.trim() || !Array.isArray(dto?.outilsAutorises))
      throw new BadRequestException("code, capacite, outilsAutorises[] et gabaritRef requis");
    const declares = await this.prisma.oliviaTool.findMany({ where: { tenantId: ctx.tenantId } });
    const connus = new Set(declares.map((t: any) => t.code));
    const fantomes = dto.outilsAutorises.filter((o) => !connus.has(o));
    if (fantomes.length)
      throw new UnprocessableEntityException(`R259/R264 : outils non déclarés au registre : ${fantomes.join(", ")} — aucun outil implicite`);
    const agent = await this.prisma.$transaction(async (tx: Tx) => {
      const derniere = await tx.oliviaAgent.findFirst({ where: { tenantId: ctx.tenantId, code: dto.code!.trim() },
        orderBy: { version: "desc" } });
      const a = await tx.oliviaAgent.create({ data: { tenantId: ctx.tenantId, code: dto.code!.trim(),
        version: (derniere?.version ?? 0) + 1, capacite: dto.capacite!.trim(),
        outilsAutorises: dto.outilsAutorises!, gabaritRef: dto.gabaritRef!.trim(),
        statut: "ACTIF", effectifDepuis: new Date() } });
      await this.emit(tx, ctx.tenantId, "olivia.agent.declare", a.id,
        { code: a.code, version: a.version, gabaritRef: a.gabaritRef, par: ctx.userId });
      return a;
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "OLIVIA_AGENT_DECLARED", `${agent.code}:v${agent.version}`);
    return this.vue(agent);
  }

  // ── R259 : retirer = une NOUVELLE version RETIRE (append-only, jamais une mutation) ──
  async retirer(ctx: Ctx, code: string, dto: { motif?: string }) {
    if (ctx.role !== "ADMIN") throw new ForbiddenException("R259 : le retrait d'agent est un acte ADMIN");
    const courant = await this.enVigueurBrut(ctx.tenantId, code);
    if (!courant) throw new UnprocessableEntityException(`RUN_AGENT_INCONNU: agent « ${code} » jamais déclaré`);
    if (courant.statut === "RETIRE") throw new ConflictException(`R259 : « ${code} » est déjà RETIRE`);
    const retrait = await this.prisma.$transaction(async (tx: Tx) => {
      const a = await tx.oliviaAgent.create({ data: { tenantId: ctx.tenantId, code: courant.code,
        version: courant.version + 1, capacite: courant.capacite,
        outilsAutorises: courant.outilsAutorises as any, gabaritRef: courant.gabaritRef,
        statut: "RETIRE", effectifDepuis: new Date() } });
      await this.emit(tx, ctx.tenantId, "olivia.agent.retire", a.id,
        { code: a.code, version: a.version, motif: dto?.motif ?? null, par: ctx.userId });
      return a;
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "OLIVIA_AGENT_RETIRED", `${retrait.code}:v${retrait.version}`);
    return this.vue(retrait);
  }

  // ── Lecture (tous rôles) : la version EN VIGUEUR par code, à date si asOf (R68) ──
  async lister(ctx: Ctx, asOf?: string) {
    const at = asOf ? new Date(asOf) : new Date();
    const rows = await this.prisma.oliviaAgent.findMany({
      where: { tenantId: ctx.tenantId, effectifDepuis: { lte: at } },
      orderBy: [{ code: "asc" }, { version: "desc" }] });
    const parCode = new Map<string, any>();
    for (const r of rows) if (!parCode.has(r.code)) parCode.set(r.code, r);  // desc ⇒ premier = en vigueur
    return [...parCode.values()].map((a) => this.vue(a));
  }

  // ── SW-01/SW-02 : LA résolution que consomment les runs — refus typés ──
  async resoudre(ctx: Ctx, code: string, asOf?: string) {
    const agent = await this.enVigueurBrut(ctx.tenantId, code, asOf);
    if (!agent) throw new UnprocessableEntityException(`RUN_AGENT_INCONNU: agent « ${code} » absent du registre (R259 — aucun agent implicite)`);
    if (agent.statut === "RETIRE" && !asOf)
      throw new UnprocessableEntityException(`RUN_AGENT_RETIRE: agent « ${code} » retiré — un nouveau run ne peut pas l'invoquer (le replay d'un run ancien reste servi à date)`);
    if (agent.statut === "RETIRE" && asOf)
      throw new UnprocessableEntityException(`RUN_AGENT_RETIRE: agent « ${code} » déjà retiré à ${asOf}`);
    return this.vue(agent);
  }

  private async enVigueurBrut(tenantId: string, code: string, asOf?: string) {
    const at = asOf ? new Date(asOf) : new Date();
    return this.prisma.oliviaAgent.findFirst({
      where: { tenantId, code, effectifDepuis: { lte: at } }, orderBy: { version: "desc" } });
  }
  private vue(a: any) {
    return { id: a.id, code: a.code, version: a.version, capacite: a.capacite,
      outilsAutorises: a.outilsAutorises, gabaritRef: a.gabaritRef, statut: a.statut,
      effectifDepuis: a.effectifDepuis };
  }
}

/**
 * Étape 3 : R260 — LE RUN EST UN JOURNAL : chaque pas est un événement AVANT d'être un effet.
 * Machine : PLANIFIE → EN_COURS → {TERMINE|ECHOUE|INTERROMPU|EPUISE} (↑ PAUSE_PORTE ↔ EN_COURS,
 * R263 à venir). Write-ahead PROUVÉ (SW-03) : l'événement de chaque étape complète est écrit
 * avant que la suivante ne démarre ; une transition = événement PUIS mise à jour du statut.
 * Un processus tué en plein vol laisse un journal NET (seq contigus, chaîne record_hash sans
 * rupture) et un run EN_COURS que la REPRISE passe à INTERROMPU — jamais de reprise implicite.
 *
 * Fournisseur = PORT optionnel (pattern R251/R253) : OLIVIA_FAKE_PORT=1 sert des plans
 * DÉTERMINISTES depuis les fixtures (SWARM_PLAN_FIXTURES) — outillage de TEST, jamais un chemin
 * de prod ; sans port : 503 typé. Les missions sont DÉCLARÉES (artefact missions.default.json
 * = les 2 missions B.4, + tenant.settings.missionsDeclarees pour toute mission ratifiée
 * supplémentaire) et ne tournent qu'ACTIVÉES (missions_actives, vide par défaut — B.5/SW-18).
 */
import * as missionsLivrees from "./missions.default.json";
import { OliviaModule } from "../olivia/olivia.module";
import { OliviaService } from "../olivia/olivia.module";

const shaSw = (s: string) => createHash("sha256").update(s).digest("hex");

// Le port swarm : planifier(mission) → { etapes: [{agent, sortie, cout?, marqueur?}] }.
function portSwarm(): { planifier: (missionCode: string) => any } | null {
  if (process.env.OLIVIA_FAKE_PORT === "1") {
    return { planifier: (missionCode: string) => {
      (global as any).__swarmFakeCalls = ((global as any).__swarmFakeCalls ?? 0) + 1;
      const chemin = process.env.SWARM_PLAN_FIXTURES;
      const plans = chemin ? JSON.parse(readFileSync(chemin, "utf8")) : {};
      const plan = plans[missionCode];
      if (!plan) throw new ServiceUnavailableException(`SWARM_GATE_UNAVAILABLE: aucune fixture de plan pour ${missionCode}`);
      if (plan.repete)                                                    // fixture compacte (SW-06 : 25 étapes)
        return { etapes: Array.from({ length: plan.repete.fois }, () => ({ ...plan.repete })) };
      return plan;
    } };
  }
  return null;                                                            // port réel à brancher — refus 503 typé sans lui
}

// R261 : la capacité v1 du ContextBuilder se déduit de l'ancrage de mission (B.4) — même
// algorithme normatif B.5, même projection par rôle, mêmes refus : le swarm ne voit RIEN
// de plus que son commanditaire.
const CAPACITE_PAR_ANCRAGE: Record<string, string> = { KYC_FILE: "C2", RISK_CASE: "C3" };

@Injectable()
export class SwarmRunsService {
  constructor(private prisma: PrismaService, private audit: AuditService,
    private agents: SwarmAgentsService, private olivia: OliviaService) {}

  private async settings(tenantId: string) {
    const t = await this.prisma.tenant.findFirst({ where: { id: tenantId } });
    return ((t?.settings as any) ?? {});
  }
  // B.4 : les missions livrées + les missions DÉCLARÉES du tenant — jamais une mission ad hoc.
  private missionDef(settings: any, code: string): any | null {
    const livrees = missionsLivrees as Record<string, any>;
    return livrees[code] ?? (settings.missionsDeclarees ?? {})[code] ?? null;
  }

  // ── R260 : append d'un événement au journal — seq contigu, chaîne record_hash ──
  private async appendEvent(tx: Tx, run: { id: string; tenantId: string }, type: string, champs: {
    agentCode?: string; agentVersion?: number; outilCode?: string; entreeEmpreinte?: string;
    contexteObjets?: any; sortie?: any; cout?: any } = {}) {
    const dernier = await tx.oliviaRunEvent.findFirst({ where: { runId: run.id }, orderBy: { seq: "desc" } });
    const seq = (dernier?.seq ?? 0) + 1;
    const prevHash = dernier?.recordHash ?? null;
    const recordHash = shaSw((prevHash ?? "") + JSON.stringify({ seq, type, ...champs }));
    return tx.oliviaRunEvent.create({ data: { tenantId: run.tenantId, runId: run.id, seq, type,
      agentCode: champs.agentCode ?? null, agentVersion: champs.agentVersion ?? null,
      outilCode: champs.outilCode ?? null, entreeEmpreinte: champs.entreeEmpreinte ?? null,
      contexteObjets: champs.contexteObjets ?? undefined, sortie: champs.sortie ?? undefined,
      cout: champs.cout ?? undefined, recordHash, prevHash } });
  }
  // R260 : une transition est un ÉVÉNEMENT avant d'être un effet — jamais l'inverse.
  private async transition(tx: Tx, run: { id: string; tenantId: string }, de: string, vers: string, sortie: any = {}) {
    await this.appendEvent(tx, run, "TRANSITION", { sortie: { de, vers, ...sortie } });
    await tx.oliviaRun.update({ where: { id: run.id }, data: { statut: vers } });
  }

  // ── POST /runs — création + exécution (synchrone v1 du transport, comme Olivia v1) ──
  async creer(ctx: Ctx, dto: { missionCode?: string; ancrageType?: string; ancrageId?: string; budgetSurcharge?: any }) {
    if (!dto?.missionCode) throw new BadRequestException("missionCode requis");
    const settings = await this.settings(ctx.tenantId);
    const def = this.missionDef(settings, dto.missionCode);
    if (!def) throw new UnprocessableEntityException(`RUN_MISSION_INCONNUE: « ${dto.missionCode} » n'est déclarée nulle part (B.4 — jamais une mission ad hoc)`);
    const actives: string[] = settings.missionsActives ?? [];             // B.5 : {} par défaut — v2 ÉTEINTE
    if (!actives.includes(dto.missionCode))
      throw new ForbiddenException(`RUN_MISSION_INACTIVE: « ${dto.missionCode} » n'est pas dans missions_actives (SW-18 — activation explicite, pattern R177/HO-02)`);
    if (def.roles && !def.roles.includes(ctx.role))
      throw new ForbiddenException(`R261 : le rôle ${ctx.role} n'est pas dans la matrice de la mission (B.4)`);
    if (def.ancrage && (!dto.ancrageId || dto.ancrageType !== def.ancrage))
      throw new BadRequestException(`B.4 : la mission exige un ancrage ${def.ancrage}`);
    const port = portSwarm();
    if (!port) throw new ServiceUnavailableException("SWARM_GATE_UNAVAILABLE: port fournisseur non configuré (R251/R253 — refus gracieux typé)");

    // R262 : budget B.5 tenant-paramétré, FIGÉ à la création ; la surcharge par mission ne va
    // qu'À LA BAISSE (SW-08) — au-dessus du paramètre tenant : 422, aucun run créé.
    const budget = { maxEtapes: settings.runMaxEtapes ?? 20, maxDureeS: settings.runMaxDureeS ?? 300,
      maxCoutTokens: settings.runMaxCoutTokens ?? 200000 };
    const sur = dto.budgetSurcharge ?? {};
    for (const [cle, plafond] of Object.entries(budget) as [keyof typeof budget, number][]) {
      const v = sur[cle];
      if (v == null) continue;
      if (typeof v !== "number" || v < 0) throw new BadRequestException(`R262 : surcharge ${cle} invalide`);
      if (v > plafond) throw new UnprocessableEntityException(
        `R262 : la surcharge ne va qu'à la baisse — ${cle}=${v} dépasse le paramètre tenant (${plafond})`);
      budget[cle] = v;
    }
    // R261/OL-05 : l'ancrage est vérifié AVEC LE SCOPE DU COMMANDITAIRE avant toute création —
    // refus central = 403 SCOPE_DENIED, AUCUN run (le même ContextBuilder v1 décide, pas la porte).
    const capacite = CAPACITE_PAR_ANCRAGE[def.ancrage ?? ""] ?? "C1";
    if (def.ancrage)
      await this.olivia.construireContexte(ctx, { capacite, ancrageId: dto.ancrageId! }, settings);

    const run = await this.prisma.oliviaRun.create({ data: { tenantId: ctx.tenantId,
      missionCode: dto.missionCode, commanditaireId: ctx.userId, roleCode: ctx.role,   // jeton, jamais le corps
      ancrageType: dto.ancrageType ?? null, ancrageId: dto.ancrageId ?? null, budget } });

    // SW-01/SW-02 : AUCUN agent implicite — chaque agent de la mission se résout AVANT tout
    // appel fournisseur ; l'échec est immédiat, journalisé, persistant.
    const versions = new Map<string, number>();
    for (const code of def.agents ?? []) {
      try { versions.set(code, (await this.agents.resoudre(ctx, code)).version); }
      catch (e: any) {
        await this.prisma.$transaction(async (tx: Tx) => {
          await this.transition(tx, run, "PLANIFIE", "ECHOUE", { erreur: e?.message ?? String(e) });
        });
        throw e;                                                          // le refus typé (422) sort tel quel
      }
    }

    // Le plan vient du port ; PLAN est un événement AVANT toute exécution (write-ahead du run)
    const plan = port.planifier(dto.missionCode);
    await this.prisma.$transaction(async (tx: Tx) => {
      await this.appendEvent(tx, run, "PLAN", { sortie: { mission: dto.missionCode,
        agents: def.agents ?? [], nbEtapes: (plan.etapes ?? []).length } });
      await this.transition(tx, run, "PLANIFIE", "EN_COURS");
    });

    await this.executer(ctx, run, plan, versions, capacite, settings);
    const fini = await this.prisma.oliviaRun.findFirst({ where: { id: run.id } });
    return this.vue(fini);
  }

  // ── R260 : l'exécuteur — une étape complète = un événement, AVANT que la suivante ne démarre.
  //    R262 : les trois compteurs sont décomptés à CHAQUE étape ; le premier épuisé FERME —
  //    livrable partiel avec mention explicite, l'étape suivante N'EXISTE PAS. ──
  private async executer(ctx: Ctx, run: any, plan: any, versions: Map<string, number>,
    capacite = "C1", settings: any = {}) {
    const debut = Date.now();
    const budget = run.budget as { maxEtapes: number; maxDureeS: number; maxCoutTokens: number };
    const consomme = { etapes: 0, duree_s: 0, tokens: 0 };
    let derniereSortie: any = null;
    let exclusTotal = 0;
    // R261 : le scope du run est FIGÉ — (commanditaire, rôle) du jeton d'origine, pas de l'appelant courant.
    const scope: Ctx = { tenantId: run.tenantId, userId: run.commanditaireId, role: run.roleCode };
    for (const etape of plan.etapes ?? []) {
      // R262 : la porte se vérifie AVANT d'entamer l'étape — jamais de dépassement « pour finir ».
      // La durée se mesure EN DIRECT (l'étape précédente a coûté du temps réel, pas celui d'avant).
      consomme.duree_s = (Date.now() - debut) / 1000;
      const epuise = consomme.etapes >= budget.maxEtapes ? "etapes"
        : consomme.etapes > 0 && consomme.duree_s > budget.maxDureeS ? "duree_s"
        : consomme.tokens >= budget.maxCoutTokens && budget.maxCoutTokens > 0 ? "tokens" : null;
      if (epuise) {
        const libelle = epuise === "etapes" ? "budget étapes" : epuise === "duree_s" ? "budget durée" : "budget tokens";
        await this.prisma.$transaction(async (tx: Tx) => {
          await this.appendEvent(tx, run, "BUDGET_TICK", { sortie: { compteur: epuise,
            valeur: (consomme as any)[epuise], plafond: (budget as any)[epuise === "etapes" ? "maxEtapes" : epuise === "duree_s" ? "maxDureeS" : "maxCoutTokens"] } });
          await this.appendEvent(tx, run, "LIVRABLE", { sortie: { partiel: true,
            mention: `exploration interrompue : ${libelle} (R262)`, contenu: derniereSortie ?? {} } });
          await this.transition(tx, run, "EN_COURS", "EPUISE");
        });
        await this.audit.log(ctx.tenantId, ctx.userId, "OLIVIA_RUN_EPUISE", `${run.id}:${epuise}`);
        return;
      }
      // Simulation kill -9 (fixture SW-03) : le processus « meurt » — AUCUN rattrapage, AUCUNE
      // écriture : le journal s'arrête net après la dernière étape complète, le statut ne ment pas.
      if (etape.marqueur === "CRASH_TEST") throw new Error("SWARM_CRASH_TEST: processus tué entre deux étapes (simulation SW-03)");
      // R261 : CHAQUE étape de CHAQUE agent repasse le ContextBuilder v1 (import, pas copie)
      // avec le scope FIGÉ du commanditaire — deux agents du même run = exactement le même scope.
      let cx: { objets: any[]; exclus: number; empreinte: string } | null = null;
      try {
        cx = await this.olivia.construireContexte(scope, { capacite, ancrageId: run.ancrageId ?? null }, settings);
      } catch (e: any) {
        // Objet CENTRAL devenu inaccessible en cours de run : SCOPE_DENIED + ECHOUE (R255 §3)
        await this.prisma.$transaction(async (tx: Tx) => {
          await this.appendEvent(tx, run, "SCOPE_DENIED", { sortie: { central: true, erreur: e?.message ?? String(e) } });
          await this.transition(tx, run, "EN_COURS", "ECHOUE", { erreur: "objet central hors scope" });
        });
        throw e;
      }
      derniereSortie = etape.sortie ?? {};
      consomme.etapes++;
      consomme.tokens += (etape.cout?.tokens ?? 0);
      await this.prisma.$transaction(async (tx: Tx) => {
        if (cx!.exclus > 0) {                                             // SW-05 : le refus périphérique EST un événement
          exclusTotal += cx!.exclus;
          await this.appendEvent(tx, run, "SCOPE_DENIED", { sortie: { exclus: cx!.exclus, central: false } });
        }
        await this.appendEvent(tx, run, "ETAPE_AGENT", { agentCode: etape.agent,
          agentVersion: versions.get(etape.agent) ?? null as any,
          entreeEmpreinte: cx!.empreinte, contexteObjets: cx!.objets,
          sortie: derniereSortie, cout: etape.cout ?? null });
        await tx.oliviaRun.update({ where: { id: run.id }, data: { consomme: { ...consomme } } });
      });
    }
    await this.prisma.$transaction(async (tx: Tx) => {
      const sortie = exclusTotal > 0
        ? { ...derniereSortie ?? {}, contextePartiel: `contexte partiel : ${exclusTotal} objet(s) exclu(s)` }
        : derniereSortie ?? {};
      await this.appendEvent(tx, run, "LIVRABLE", { sortie });
      await this.transition(tx, run, "EN_COURS", "TERMINE");
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "OLIVIA_RUN_TERMINE", run.id);
  }

  // ── SW-03 : la REPRISE — un run EN_COURS orphelin passe INTERROMPU, jamais repris en douce ──
  async reprise(ctx: Ctx) {
    if (ctx.role !== "ADMIN") throw new ForbiddenException("R260 : la reprise est une route ops (ADMIN)");
    const orphelins = await this.prisma.oliviaRun.findMany({ where: { tenantId: ctx.tenantId, statut: "EN_COURS" } });
    const interrompus: string[] = [];
    for (const run of orphelins) {
      await this.prisma.$transaction(async (tx: Tx) => {
        await this.transition(tx, run, "EN_COURS", "INTERROMPU", { motif: "processus interrompu — constaté à la reprise (R260 : jamais de reprise implicite)" });
      });
      interrompus.push(run.id);
      await this.audit.log(ctx.tenantId, ctx.userId, "OLIVIA_RUN_INTERROMPU", run.id);
    }
    return { interrompus };
  }

  private vue(r: any) {
    return { id: r.id, missionCode: r.missionCode, statut: r.statut, roleCode: r.roleCode,
      ancrageType: r.ancrageType, ancrageId: r.ancrageId, budget: r.budget, consomme: r.consomme,
      livrableMessageId: r.livrableMessageId, createdAt: r.createdAt };
  }
}

@Controller("olivia")
export class SwarmController {
  constructor(private outils: SwarmToolsService, private agents: SwarmAgentsService, private runs: SwarmRunsService) {}
  @Get("tools")  listerOutils(@Req() r: any) { return this.outils.lister(r.ctx); }               // R264 (tous)
  @Post("tools") declarerOutil(@Req() r: any, @Body() b: any) { return this.outils.declarer(r.ctx, b ?? {}); } // R264 (ADMIN)
  @Get("agents") listerAgents(@Req() r: any, @Query("asOf") asOf?: string) { return this.agents.lister(r.ctx, asOf); } // R259 (tous, à date R68)
  @Post("agents") declarerAgent(@Req() r: any, @Body() b: any) { return this.agents.declarer(r.ctx, b ?? {}); }        // R259 (ADMIN)
  @Post("agents/:code/retirer") retirerAgent(@Req() r: any, @Param("code") code: string, @Body() b: any) {
    return this.agents.retirer(r.ctx, code, b ?? {}); }                                          // R259 (ADMIN)
  @Get("agents/:code/en-vigueur") resoudreAgent(@Req() r: any, @Param("code") code: string, @Query("asOf") asOf?: string) {
    return this.agents.resoudre(r.ctx, code, asOf); }                                            // SW-01/02 (résolution des runs)
  @Post("runs")         creerRun(@Req() r: any, @Body() b: any) { return this.runs.creer(r.ctx, b ?? {}); }  // R260 (matrice mission)
  @Post("runs/reprise") reprise(@Req() r: any) { return this.runs.reprise(r.ctx); }              // SW-03 (ops, ADMIN)
}

@Module({
  imports: [OliviaModule],                                                // R261 : le MÊME ContextBuilder v1
  controllers: [SwarmController],
  providers: [PrismaService, AuditService, SwarmToolsService, SwarmAgentsService, SwarmRunsService],
  exports: [SwarmToolsService, SwarmAgentsService, SwarmRunsService],
})
export class SwarmModule {}
