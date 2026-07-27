import { Body, Controller, Get, Param, Post, Query, Req, Module, Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException, UnprocessableEntityException, ServiceUnavailableException, UseGuards } from "@nestjs/common";
import { execFile } from "child_process";
import * as path from "path";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { LicenseModule, ModuleLicencie } from "../license/license.module"; // partie 3 débloquants : enforcement SERVEUR (LS-01)

/**
 * Porte HTTP mince CPSI (spec `spec/cpsi-scenarios/CPSI-PORTE.feature`, CP-01..19). Squelette
 * vertical : chemin SCORE (CP-01/02) + ingestion default-deny (CP-11). Doctrine porte mince :
 *   • Aucune règle réimplémentée. La porte PERSISTE des faits (journal append-only `cpsi_events`,
 *     tenant-scopé, RLS) puis REJOUE le journal du tenant vers le moteur ratifié Python
 *     (`services/cpsi-server-py`, source de vérité R63→R83) pour CALCULER — elle ne décide rien.
 *   • Auteur = jeton (`payload.par = ctx.userId`), jamais le corps.
 *   • Rejeu à date `?asOf=` (R48/R49) : le moteur est une fonction pure des faits ≤ date.
 *   • Default-deny préservé : un type de signal inconnu est refusé AVANT persistance (validation
 *     par rejeu) — la `CpsiError` du moteur devient un 4xx, jamais avalée.
 *   • Transport = shell-out (Q4) : sous-processus `python3 bridge.py`, échangeable sans toucher au contrat.
 */

type Ctx = { tenantId: string; userId: string; role: string };
const cpsiDir = () => process.env.CPSI_DIR ?? path.resolve(process.cwd(), "..", "..", "services", "cpsi-server-py");
const CONTRACT_VERSION = "1";                                             // R248 : version d'enveloppe

// R251 : le pont est un PORT optionnel. Python absent / non exécutable / timeout ⇒ rejet (mappé en
// 503 typé par la porte, jamais un 500 opaque). `GateUnavailable` distingue l'indisponibilité de la
// porte d'une erreur métier typée du moteur.
class GateUnavailable extends Error { constructor(public cause: string) { super(cause); } }

// Invoque le pont Python en sous-processus avec l'ENVELOPPE VERSIONNÉE (R248). Retourne l'enveloppe
// de réponse {contract_version, resultat | erreur_typee, meta}. Jamais d'état ici (lecture pure).
function runBridge(env: any, timeoutMs: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const child = execFile("python3", ["bridge.py"], { cwd: cpsiDir(), maxBuffer: 16 * 1024 * 1024, timeout: timeoutMs },
      (err: any, stdout) => {
        if (err) {                                                       // ENOENT (python absent), timeout (killed), exit≠0
          const cause = err.killed ? `timeout ${timeoutMs}ms` : (err.code === "ENOENT" ? "python3 introuvable" : `échec du moteur (${err.code ?? err.message})`);
          return reject(new GateUnavailable(cause));
        }
        try { resolve(JSON.parse(stdout)); } catch { reject(new GateUnavailable("réponse illisible du moteur")); }
      });
    child.stdin!.end(JSON.stringify(env));
  });
}

@Injectable()
export class CpsiService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private async config(tenantId: string) {
    const t = await this.prisma.tenant.findFirst({ where: { id: tenantId } });
    return ((t?.settings as any) ?? {}).cpsiConfig ?? {};                 // R68 : config CPSI du tenant
  }
  // Journal ordonné (seq croissant, R49) → format de rejeu du pont.
  private async journal(tenantId: string) {
    const rows = await this.prisma.cpsiEvent.findMany({ where: { tenantId }, orderBy: { id: "asc" } });
    return rows.map((e: any) => ({ type: e.type, at: e.at, ...(e.payload as any) }));
  }

  // R248 : invoque le moteur via l'enveloppe versionnée. Rejeu STRICT jusqu'à `as_of` (R48 : les
  // événements > as_of n'existent pas encore) ; un `candidat` (écriture non encore persistée) est
  // scellé en fin de journal pour la validation-par-rejeu. Retourne l'enveloppe de réponse brute.
  private async call(ctx: Ctx, commande: string, payload: any = {}, opts: { asOf?: string; candidat?: any } = {}) {
    const effAt = opts.asOf ?? new Date().toISOString();                  // instant de lecture effectif (as_of ou maintenant)
    const cfg = await this.config(ctx.tenantId);
    const tousEvts = await this.journal(ctx.tenantId);
    const base = tousEvts.filter((e: any) => e.at <= effAt);             // R48 : rejeu STRICT jusqu'à l'instant de lecture
    const journal = opts.candidat ? [...base, opts.candidat] : base;
    const timeout = cfg.cpsi_gate_timeout_ms ?? 5000;                     // R251 : timeout = paramètre tenant
    let rep: any;
    try {
      rep = await runBridge({ contract_version: CONTRACT_VERSION, tenant_id: ctx.tenantId, as_of: effAt, config: cfg, journal, commande, payload }, timeout);
    } catch (e) {
      if (e instanceof GateUnavailable) throw new ServiceUnavailableException(`CPSI_GATE_UNAVAILABLE: ${e.cause}`);  // R251 : refus gracieux typé
      throw e;
    }
    // R250/R39 : le dépassement du seuil d'hydratation MESURE et NOTIFIE — jamais un blocage.
    const warn = cfg.cpsi_replay_warn_ms ?? 2000;
    if (rep?.meta?.duree_ms != null && rep.meta.duree_ms > warn)
      await this.audit.log(ctx.tenantId, ctx.userId, "CPSI_REPLAY_SLOW", `${rep.meta.duree_ms}ms>${warn}ms`);
    return rep;
  }

  // ── R250 : santé de la porte — profondeur du journal, dernier rejeu, contrat, config en vigueur. ──
  async sante(ctx: Ctx) {
    const evts = await this.prisma.cpsiEvent.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { id: "asc" } });
    const cfg = await this.config(ctx.tenantId);
    const r = await this.call(ctx, "rules", {});                          // lecture légère → mesure le dernier rejeu
    const dernierRejeuMs = r?.meta?.duree_ms ?? null;
    const warn = cfg.cpsi_replay_warn_ms ?? 2000;
    const dernierParam = [...evts].reverse().find((e: any) => e.type === "cpsi.param.adopted");
    return { contractVersion: CONTRACT_VERSION, profondeurJournal: evts.length, dernierRejeuMs,
      rejeuWarnMs: warn, rejeuHorsSeuil: dernierRejeuMs != null && dernierRejeuMs > warn,
      configEnVigueur: dernierParam ? dernierParam.at : "base" };         // R68 : version de config en vigueur
  }

  // ── Enregistrement d'un client CPSI (prérequis au score) — un seul par (tenant, client). ──
  async enregistrerClient(ctx: Ctx, dto: { clientId: string; statique?: any; attributs?: any; at?: string }) {
    if (!dto?.clientId) throw new BadRequestException("clientId requis");
    const deja = await this.prisma.cpsiEvent.findFirst({ where: { tenantId: ctx.tenantId, clientId: dto.clientId, type: "cpsi.client.registered" } });
    if (deja) throw new ConflictException("CPSI_CLIENT_ALREADY_REGISTERED");
    const at = dto.at ?? new Date().toISOString();
    await this.prisma.cpsiEvent.create({ data: { tenantId: ctx.tenantId, type: "cpsi.client.registered",
      clientId: dto.clientId, at, payload: { client: dto.clientId, statique: dto.statique ?? {}, attributs: dto.attributs ?? {}, par: ctx.userId } } });
    await this.audit.log(ctx.tenantId, ctx.userId, "CPSI_CLIENT_REGISTERED", dto.clientId);
    return { clientId: dto.clientId, at };
  }

  // ── R63/CP-11 : ingestion d'un signal — default-deny VALIDÉ par rejeu avant persistance. ──
  async ingererSignal(ctx: Ctx, clientId: string, dto: { type: string; severite?: number; at?: string; meta?: any }) {
    if (!dto?.type) throw new BadRequestException("type requis");
    const at = dto.at ?? new Date().toISOString();
    const nouvel = { type: "cpsi.signal.ingested", at, client: clientId, signal: dto.type, severite: dto.severite ?? 1, meta: dto.meta ?? null };
    // Validation par rejeu : on scelle le candidat et on demande un score ; toute CpsiError (type
    // inconnu, client non enregistré) fait échouer AVANT toute écriture. PC-02 : default-deny → 422 typé.
    const r = await this.call(ctx, "score", { client: clientId }, { candidat: nouvel });
    if (r.erreur_typee) throw new UnprocessableEntityException(r.erreur_typee.message);
    await this.prisma.cpsiEvent.create({ data: { tenantId: ctx.tenantId, type: "cpsi.signal.ingested",
      clientId, at, payload: { client: clientId, signal: dto.type, severite: dto.severite ?? 1, meta: dto.meta ?? null, par: ctx.userId } } });
    await this.audit.log(ctx.tenantId, ctx.userId, "CPSI_SIGNAL_INGESTED", `${clientId}:${dto.type}`);
    return { clientId, contractVersion: r.contract_version, ...r.resultat };  // état recalculé (score, bande, drivers)
  }

  // ── CP-01/CP-02 : score perpétuel + drivers (R63/R67), rejeu à date (R48/R64/R68). ──
  async score(ctx: Ctx, clientId: string, asOf?: string) {
    const r = await this.call(ctx, "score", { client: clientId }, { asOf });
    if (r.erreur_typee) throw new NotFoundException(r.erreur_typee.message);  // client inconnu / non enregistré
    return { clientId, asOf: asOf ?? null, contractVersion: r.contract_version, meta: r.meta, ...r.resultat };
  }

  // Lecture générique : rejeu (borné ≤ as_of) puis commande de lecture du moteur. Erreur typée → 4xx.
  private async lire(ctx: Ctx, commande: string, payload: any = {}, asOf?: string) {
    const r = await this.call(ctx, commande, payload, { asOf });
    if (r.erreur_typee) throw new BadRequestException(r.erreur_typee.message);
    return r.resultat;
  }

  // ── CP-03 (R65) : segmentation déterministe en groupes de pairs, rejeu à date. ──
  async segmentation(ctx: Ctx, asOf?: string) {
    return { asOf: asOf ?? null, segments: await this.lire(ctx, "segmentation", {}, asOf) };
  }

  // ── CP-07 (R79) : catalogue de conformité, lecture seule. ──
  async catalogueConformite(ctx: Ctx, asOf?: string) {
    return { asOf: asOf ?? null, catalogue: await this.lire(ctx, "compliance_catalogue", {}, asOf) };
  }

  // ── CP-08 (R68) : règles de calcul en clair. ──
  async regles(ctx: Ctx, asOf?: string) {
    return { asOf: asOf ?? null, regles: await this.lire(ctx, "rules", {}, asOf) };
  }

  // Écriture gouvernée VALIDÉE par rejeu avant persistance (default-deny : opérateur/groupe/sens
  // invalide fait échouer AVANT toute écriture). `candidat` est au format de rejeu du pont.
  private async valider(ctx: Ctx, candidat: any) {
    const r = await this.call(ctx, "groups", {}, { candidat });
    if (r.erreur_typee) throw new BadRequestException(r.erreur_typee.message);
  }

  // ── CP-04/05 (R71/R72) : définir un groupe de population (prédicat composable). ──
  async definirGroupe(ctx: Ctx, dto: { gid: string; label: string; predicat: any; priorite?: number; bareme?: any; at?: string }) {
    if (!dto?.gid || !dto?.label || !dto?.predicat) throw new BadRequestException("gid, label, predicat requis");
    const at = dto.at ?? new Date().toISOString();
    const payload = { gid: dto.gid, label: dto.label, predicat: dto.predicat, priorite: dto.priorite ?? 100, bareme: dto.bareme ?? null, par: ctx.userId };
    await this.valider(ctx, { type: "cpsi.group.defined", at, ...payload });
    await this.prisma.cpsiEvent.create({ data: { tenantId: ctx.tenantId, type: "cpsi.group.defined", clientId: dto.gid, at, payload } });
    await this.audit.log(ctx.tenantId, ctx.userId, "CPSI_GROUP_DEFINED", dto.gid);
    return { gid: dto.gid, at };
  }

  // ── CP-06 (R73) : définir un scénario AML ciblé par groupe (seuil propre à chaque groupe). ──
  async definirScenario(ctx: Ctx, dto: { sid: string; label: string; champ: string; groupesSeuils: any; sens?: string; at?: string }) {
    if (!dto?.sid || !dto?.label || !dto?.champ || !dto?.groupesSeuils) throw new BadRequestException("sid, label, champ, groupesSeuils requis");
    const at = dto.at ?? new Date().toISOString();
    const payload = { sid: dto.sid, label: dto.label, champ: dto.champ, groupes_seuils: dto.groupesSeuils, sens: dto.sens ?? "gte", par: ctx.userId };
    await this.valider(ctx, { type: "cpsi.scenario.defined", at, ...payload });
    await this.prisma.cpsiEvent.create({ data: { tenantId: ctx.tenantId, type: "cpsi.scenario.defined", clientId: dto.sid, at, payload } });
    await this.audit.log(ctx.tenantId, ctx.userId, "CPSI_SCENARIO_DEFINED", dto.sid);
    return { sid: dto.sid, at };
  }

  // ── CP-04 (R71/R72) : groupes d'un client + groupe primaire. ──
  async groupesDe(ctx: Ctx, clientId: string, asOf?: string) {
    return { clientId, asOf: asOf ?? null, ...(await this.lire(ctx, "client_groups", { client: clientId }, asOf)) };
  }

  // ── CP-05 (R74) : registre des groupes en clair. ──
  async groupes(ctx: Ctx, asOf?: string) {
    return { asOf: asOf ?? null, groupes: await this.lire(ctx, "groups", {}, asOf) };
  }

  // ── CP-06 (R73) : évaluer un scénario — seuls les membres des groupes ciblés. ──
  async evaluerScenario(ctx: Ctx, sid: string, asOf?: string) {
    return { asOf: asOf ?? null, ...(await this.lire(ctx, "evaluate_scenario", { scenario: sid }, asOf)) };
  }

  // ── CP-12 (R80/R81) : signaux scorés, alertes (≥X), near-miss, corrélations. ──
  async alertes(ctx: Ctx, asOf?: string, seuil?: number) {
    const r: any = await this.lire(ctx, "alerts", seuil != null ? { seuil } : {}, asOf);
    // AW-08 (canon vague pilote, ratifié) : le SCOPE est appliqué ICI — un RM/ARM ne reçoit que
    // les signaux de SES clients (Client.rmUserId, matrice A.3) ; le front n'a aucun filtre.
    let signaux: any[] = r.signaux; let correlations: Record<string, string[]> = r.correlations;
    if (ctx.role === "RM" || ctx.role === "ARM") {
      const miens = new Set((await this.prisma.client.findMany({
        where: { tenantId: ctx.tenantId, rmUserId: ctx.userId }, select: { id: true } })).map((c) => c.id));
      signaux = signaux.filter((s) => miens.has(s.client));
      correlations = Object.fromEntries(Object.entries(correlations ?? {}).filter(([client]) => miens.has(client)));
    }
    return { asOf: asOf ?? null, signaux,
      alertes: signaux.filter((s: any) => s.statut === "ALERTE"),
      nearMiss: signaux.filter((s: any) => s.statut === "NEAR_MISS"),
      correlations };
  }

  // ── PC-14 (extension ratifiée 2026-07-27, P1) : timeline d'un client — PROJECTION du journal
  //    rejoué ≤ as_of, servie par la porte. Rejouer à la même date redonne l'identique (R48). ──
  async timeline(ctx: Ctx, clientId: string, asOf?: string) {
    const r: any = await this.call(ctx, "timeline", { client: clientId }, { asOf });
    if (r.erreur_typee) throw new BadRequestException(r.erreur_typee.message);
    return { asOf: asOf ?? null, contractVersion: r.contract_version, meta: r.meta, ...r.resultat };
  }

  // ── PC-13 (extension ratifiée 2026-07-27, P1) : volumétrie par scénario — comptages du moteur
  //    à date (onglet Reporting du workspace AML). Le délai hit→MROS reste chez riskcases (PC-12). ──
  async volumetrie(ctx: Ctx, asOf?: string, seuil?: number) {
    const r: any = await this.call(ctx, "volumetrie", seuil != null ? { seuil } : {}, { asOf });
    if (r.erreur_typee) throw new BadRequestException(r.erreur_typee.message);
    return { asOf: asOf ?? null, contractVersion: r.contract_version, meta: r.meta, ...r.resultat };
  }

  // Écriture gouvernée : scelle le candidat, le VALIDE par rejeu (via une op de lecture qui renvoie
  // l'entité résultante), et ne persiste QU'APRÈS succès. Toute CpsiError du moteur (habilitation,
  // motif manquant, transition impossible…) devient un 4xx AVANT persistance — 403 si habilitation.
  private async muter(ctx: Ctx, type: string, clientId: string, fields: any, readOp: string, readExtra: any = {}) {
    const at = fields.at ?? new Date().toISOString();
    const payload: any = { ...fields, par: ctx.userId }; delete payload.at;
    const candidat = { type, at, ...payload };
    const r = await this.call(ctx, readOp, readExtra, { candidat });
    if (r.erreur_typee) {
      if (/habilit/i.test(r.erreur_typee.message)) throw new ForbiddenException(r.erreur_typee.message);
      throw new BadRequestException(r.erreur_typee.message);
    }
    await this.prisma.cpsiEvent.create({ data: { tenantId: ctx.tenantId, type, clientId, at, payload } });
    await this.audit.log(ctx.tenantId, ctx.userId, type.replace(/\./g, "_").toUpperCase(), clientId);
    return r.resultat;
  }

  // ── CP-09 (R70) : bac à sable — dry-run, AUCUNE écriture (le journal n'est pas touché). ──
  async simuler(ctx: Ctx, changements: any) {
    if (!changements || typeof changements !== "object") throw new BadRequestException("changements requis");
    return this.lire(ctx, "sandbox_simulate", { changements, acteur: ctx.userId });
  }

  // ── CP-10 (R69) : l'IA/humain PROPOSE, un humain ADOPTE/REJETTE (motivation obligatoire au rejet). ──
  async proposer(ctx: Ctx, dto: { chemin: string; valeur: any; justification?: string }) {
    if (!dto?.chemin || dto?.valeur === undefined) throw new BadRequestException("chemin et valeur requis");
    return this.muter(ctx, "cpsi.param.proposed", "PARAM",
      { auteur: ctx.userId, chemin: dto.chemin, valeur: dto.valeur, justification: dto.justification ?? "" }, "propose_param");
  }
  async adopter(ctx: Ctx, pid: string) {
    return this.muter(ctx, "cpsi.param.adopted", "PARAM", { pid, humain: ctx.userId }, "proposition", { id: pid });
  }
  async rejeter(ctx: Ctx, pid: string, motivation?: string) {
    return this.muter(ctx, "cpsi.param.rejected", "PARAM", { pid, humain: ctx.userId, motivation: motivation ?? "" }, "proposition", { id: pid });
  }
  // Lecture des propositions (R69) — état reconstruit par rejeu, pour l'écran de gouvernance.
  async listerPropositions(ctx: Ctx) {
    return this.lire(ctx, "propositions", {});
  }

  // ── CP-13 (R82) : rétroaction faux-positif (pénalité escaladante, tracée). ──
  async declarerFauxPositif(ctx: Ctx, dto: { client: string; scenario: string; motif?: string }) {
    if (!dto?.client || !dto?.scenario) throw new BadRequestException("client et scenario requis");
    if (!dto?.motif?.trim())                                              // AW-06 (canon vague pilote) : la voie est TRACÉE
      throw new BadRequestException("R7 : déclarer un faux positif exige un motif");
    await this.muter(ctx, "cpsi.fp.declared", dto.client,
      { client: dto.client, scenario: dto.scenario, acteur: ctx.userId, motif: dto.motif.trim() }, "reporting");
    return { client: dto.client, scenario: dto.scenario, declare: true };
  }

  // ── CP-14 (R75) : marquage insider — habilitation par le RÔLE DU JETON, motif obligatoire. ──
  async taguerInsider(ctx: Ctx, cid: string, dto: { motif?: string; instrument?: string }) {
    return this.muter(ctx, "cpsi.insider.tagged", cid,
      { client: cid, acteur: ctx.userId, role: ctx.role, motif: dto?.motif ?? "", instrument: dto?.instrument ?? null }, "insiders");
  }
  async leverInsider(ctx: Ctx, cid: string, dto: { motif?: string }) {
    return this.muter(ctx, "cpsi.insider.lifted", cid,
      { client: cid, acteur: ctx.userId, role: ctx.role, motif: dto?.motif ?? "" }, "insiders");
  }

  // ── R252/PC-09 : le CPSI PROPOSE, riskcases (R133-R136) instruit. La corrélation R81 (≥2
  // scénarios même client) devient un événement `case_proposal` append-only, consommable par le
  // module riskcases — AUCUN état de riskcase muté ici (R66), aucune surface produit risk-case
  // (les anciennes routes CP-15/16/17 sont SUPERSEDED — voir amendement R248-R252). ──
  async emettreCaseProposals(ctx: Ctx) {
    const r = await this.call(ctx, "alerts", {});
    if (r.erreur_typee) throw new BadRequestException(r.erreur_typee.message);
    const correlations: Record<string, string[]> = r.resultat.correlations ?? {};
    const dejaEmises = new Set((await this.prisma.cpsiEvent.findMany({
      where: { tenantId: ctx.tenantId, type: "cpsi.case_proposal.emitted" } }))
      .map((e: any) => (e.payload as any).cle));
    const emises: any[] = [];
    for (const [client, scenarios] of Object.entries(correlations)) {
      const cle = `${client}|${[...scenarios].sort().join("+")}`;         // PC-10 : idempotence (pattern R76)
      if (dejaEmises.has(cle)) continue;
      const at = new Date().toISOString();
      const payload = { client, scenarios, cle, par: ctx.userId };
      await this.prisma.cpsiEvent.create({ data: { tenantId: ctx.tenantId, type: "cpsi.case_proposal.emitted", clientId: client, at, payload } });
      await this.audit.log(ctx.tenantId, ctx.userId, "CPSI_CASE_PROPOSAL_EMITTED", cle);
      emises.push({ client, scenarios, cle, at });
    }
    return { emises, dejaExistantes: dejaEmises.size, correlationsVues: Object.keys(correlations).length };
  }

  // Lecture des propositions émises — LA surface de consommation du module riskcases (R252).
  async listerCaseProposals(ctx: Ctx) {
    const rows = await this.prisma.cpsiEvent.findMany({
      where: { tenantId: ctx.tenantId, type: "cpsi.case_proposal.emitted" }, orderBy: { id: "asc" } });
    return rows.map((e: any) => { const p = e.payload as any;
      return { client: p.client, scenarios: p.scenarios, cle: p.cle, emisePar: p.par, at: e.at }; });
  }
}

@UseGuards(ModuleLicencie("cpsi"))            // LS-01 : module hors licence → 403 MODULE_INACTIF (l'enforcement est serveur)
@Controller("cpsi")
export class CpsiController {
  constructor(private svc: CpsiService) {}
  @Get("health")                   sante(@Req() r: any) { return this.svc.sante(r.ctx); }                                                // R250
  @Post("clients")                 enregistrer(@Req() r: any, @Body() b: any) { return this.svc.enregistrerClient(r.ctx, b); }
  @Post("clients/:cid/signals")    ingerer(@Req() r: any, @Param("cid") cid: string, @Body() b: any) { return this.svc.ingererSignal(r.ctx, cid, b); } // CP-11
  @Get("clients/:cid/score")       score(@Req() r: any, @Param("cid") cid: string, @Query("asOf") asOf?: string) { return this.svc.score(r.ctx, cid, asOf); } // CP-01/02
  @Get("segmentation")             segmentation(@Req() r: any, @Query("asOf") asOf?: string) { return this.svc.segmentation(r.ctx, asOf); }            // CP-03
  @Get("compliance-catalogue")     catalogue(@Req() r: any, @Query("asOf") asOf?: string) { return this.svc.catalogueConformite(r.ctx, asOf); }        // CP-07
  @Get("rules")                    regles(@Req() r: any, @Query("asOf") asOf?: string) { return this.svc.regles(r.ctx, asOf); }                        // CP-08
  @Post("groups")                  defGroupe(@Req() r: any, @Body() b: any) { return this.svc.definirGroupe(r.ctx, b); }                              // CP-04/05
  @Get("groups")                   groupes(@Req() r: any, @Query("asOf") asOf?: string) { return this.svc.groupes(r.ctx, asOf); }                     // CP-05
  @Get("clients/:cid/groups")      groupesDe(@Req() r: any, @Param("cid") cid: string, @Query("asOf") asOf?: string) { return this.svc.groupesDe(r.ctx, cid, asOf); } // CP-04
  @Post("scenarios")               defScenario(@Req() r: any, @Body() b: any) { return this.svc.definirScenario(r.ctx, b); }                           // CP-06
  @Get("scenarios/:sid/evaluate")  evalScenario(@Req() r: any, @Param("sid") sid: string, @Query("asOf") asOf?: string) { return this.svc.evaluerScenario(r.ctx, sid, asOf); } // CP-06
  @Get("alerts")                   alertes(@Req() r: any, @Query("asOf") asOf?: string, @Query("seuil") seuil?: string) { return this.svc.alertes(r.ctx, asOf, seuil != null ? Number(seuil) : undefined); } // CP-12
  @Get("clients/:cid/timeline")    timeline(@Req() r: any, @Param("cid") cid: string, @Query("asOf") asOf?: string) { return this.svc.timeline(r.ctx, cid, asOf); }   // PC-14 (P1)
  @Get("volumetrie")               volumetrie(@Req() r: any, @Query("asOf") asOf?: string, @Query("seuil") seuil?: string) { return this.svc.volumetrie(r.ctx, asOf, seuil != null ? Number(seuil) : undefined); } // PC-13 (P1)
  @Post("sandbox/simulate")        simuler(@Req() r: any, @Body() b: any) { return this.svc.simuler(r.ctx, b?.changements); }                            // CP-09
  @Get("params/proposals")         propositions(@Req() r: any) { return this.svc.listerPropositions(r.ctx); }                                          // CP-10 (lecture)
  @Post("params/proposals")        proposer(@Req() r: any, @Body() b: any) { return this.svc.proposer(r.ctx, b); }                                     // CP-10
  @Post("params/proposals/:pid/adopt")  adopter(@Req() r: any, @Param("pid") pid: string) { return this.svc.adopter(r.ctx, pid); }                     // CP-10
  @Post("params/proposals/:pid/reject") rejeter(@Req() r: any, @Param("pid") pid: string, @Body() b: any) { return this.svc.rejeter(r.ctx, pid, b?.motivation); } // CP-10
  @Post("false-positives")         fauxPositif(@Req() r: any, @Body() b: any) { return this.svc.declarerFauxPositif(r.ctx, b); }                        // CP-13
  @Post("clients/:cid/insider")      insider(@Req() r: any, @Param("cid") cid: string, @Body() b: any) { return this.svc.taguerInsider(r.ctx, cid, b); }     // CP-14
  @Post("clients/:cid/insider/lift") insiderLift(@Req() r: any, @Param("cid") cid: string, @Body() b: any) { return this.svc.leverInsider(r.ctx, cid, b); }   // CP-14
  // R252/PC-11 : AUCUNE surface produit risk-case sur la porte (CP-15/16/17 SUPERSEDED —
  // l'instruction, les transitions et le reporting SLA relèvent de riskcases R133-R136).
  @Post("case-proposals")          emettreCp(@Req() r: any) { return this.svc.emettreCaseProposals(r.ctx); }                              // PC-09/10
  @Get("case-proposals")           listerCp(@Req() r: any) { return this.svc.listerCaseProposals(r.ctx); }                               // PC-09 (consommation riskcases)
}

@Module({
  imports: [LicenseModule],
  controllers: [CpsiController],
  providers: [
    PrismaService, AuditService,
    { provide: CpsiService, useFactory: (p: PrismaService, a: AuditService) => new CpsiService(p, a), inject: [PrismaService, AuditService] },
  ],
  exports: [CpsiService],
})
export class CpsiModule {}
