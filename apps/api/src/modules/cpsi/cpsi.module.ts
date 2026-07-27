import { Body, Controller, Get, Param, Post, Query, Req, Module, Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException, UnprocessableEntityException } from "@nestjs/common";
import { execFile } from "child_process";
import * as path from "path";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

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
const CPSI_DIR = process.env.CPSI_DIR ?? path.resolve(process.cwd(), "..", "..", "services", "cpsi-server-py");
const CONTRACT_VERSION = "1";                                             // R248 : version d'enveloppe

// Invoque le pont Python en sous-processus avec l'ENVELOPPE VERSIONNÉE (R248). Retourne l'enveloppe
// de réponse {contract_version, resultat | erreur_typee, meta}. Jamais d'état ici (lecture pure).
function runBridge(env: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const child = execFile("python3", ["bridge.py"], { cwd: CPSI_DIR, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(err);
        try { resolve(JSON.parse(stdout)); } catch (e) { reject(e); }
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
    const tousEvts = await this.journal(ctx.tenantId);
    const base = tousEvts.filter((e: any) => e.at <= effAt);             // R48 : rejeu STRICT jusqu'à l'instant de lecture
    const journal = opts.candidat ? [...base, opts.candidat] : base;
    return runBridge({ contract_version: CONTRACT_VERSION, tenant_id: ctx.tenantId, as_of: effAt,
      config: await this.config(ctx.tenantId), journal, commande, payload });
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
    return { asOf: asOf ?? null, signaux: r.signaux,
      alertes: r.signaux.filter((s: any) => s.statut === "ALERTE"),
      nearMiss: r.signaux.filter((s: any) => s.statut === "NEAR_MISS"),
      correlations: r.correlations };
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

  // ── CP-13 (R82) : rétroaction faux-positif (pénalité escaladante, tracée). ──
  async declarerFauxPositif(ctx: Ctx, dto: { client: string; scenario: string }) {
    if (!dto?.client || !dto?.scenario) throw new BadRequestException("client et scenario requis");
    await this.muter(ctx, "cpsi.fp.declared", dto.client, { client: dto.client, scenario: dto.scenario, acteur: ctx.userId }, "reporting");
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

  // ── CP-15 (R83/R81) : ouvrir un risk case depuis des alertes corrélées d'un même client. ──
  async ouvrirRiskCase(ctx: Ctx, dto: { alertes: any[] }) {
    if (!Array.isArray(dto?.alertes) || !dto.alertes.length) throw new BadRequestException("alertes requises");
    return this.muter(ctx, "cpsi.riskcase.opened", dto.alertes[0]?.client ?? "—", { alertes: dto.alertes, acteur: ctx.userId }, "open_risk_case");
  }
  // ── CP-16 (R83/R7) : transition — motif obligatoire (clore/escalader/clarifier). ──
  async transitionRiskCase(ctx: Ctx, id: string, dto: { action: string; motif?: string }) {
    if (!dto?.action) throw new BadRequestException("action requise");
    return this.muter(ctx, "cpsi.riskcase.transition", id, { case: id, action: dto.action, motif: dto.motif ?? null, acteur: ctx.userId }, "risk_case", { id });
  }
  async documenterRiskCase(ctx: Ctx, id: string, dto: { note?: string }) {
    return this.muter(ctx, "cpsi.riskcase.note", id, { case: id, note: dto?.note ?? "", acteur: ctx.userId }, "risk_case", { id });
  }
  async riskCase(ctx: Ctx, id: string) {
    return this.lire(ctx, "risk_case", { id });
  }
  // ── CP-17 (R39) : reporting SLA — mesure, ne bloque pas. ──
  async reporting(ctx: Ctx, slaJours?: number) {
    return this.lire(ctx, "reporting", slaJours != null ? { sla_jours: slaJours } : {});
  }
}

@Controller("cpsi")
export class CpsiController {
  constructor(private svc: CpsiService) {}
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
  @Post("sandbox/simulate")        simuler(@Req() r: any, @Body() b: any) { return this.svc.simuler(r.ctx, b?.changements); }                            // CP-09
  @Post("params/proposals")        proposer(@Req() r: any, @Body() b: any) { return this.svc.proposer(r.ctx, b); }                                     // CP-10
  @Post("params/proposals/:pid/adopt")  adopter(@Req() r: any, @Param("pid") pid: string) { return this.svc.adopter(r.ctx, pid); }                     // CP-10
  @Post("params/proposals/:pid/reject") rejeter(@Req() r: any, @Param("pid") pid: string, @Body() b: any) { return this.svc.rejeter(r.ctx, pid, b?.motivation); } // CP-10
  @Post("false-positives")         fauxPositif(@Req() r: any, @Body() b: any) { return this.svc.declarerFauxPositif(r.ctx, b); }                        // CP-13
  @Post("clients/:cid/insider")      insider(@Req() r: any, @Param("cid") cid: string, @Body() b: any) { return this.svc.taguerInsider(r.ctx, cid, b); }     // CP-14
  @Post("clients/:cid/insider/lift") insiderLift(@Req() r: any, @Param("cid") cid: string, @Body() b: any) { return this.svc.leverInsider(r.ctx, cid, b); }   // CP-14
  @Post("risk-cases")              ouvrirRc(@Req() r: any, @Body() b: any) { return this.svc.ouvrirRiskCase(r.ctx, b); }                                // CP-15
  @Get("risk-cases/reporting")     reporting(@Req() r: any, @Query("slaJours") sla?: string) { return this.svc.reporting(r.ctx, sla != null ? Number(sla) : undefined); } // CP-17
  @Post("risk-cases/:id/transition") transitionRc(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.transitionRiskCase(r.ctx, id, b); } // CP-16
  @Post("risk-cases/:id/notes")    noterRc(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.documenterRiskCase(r.ctx, id, b); }   // CP-16
  @Get("risk-cases/:id")           getRc(@Req() r: any, @Param("id") id: string) { return this.svc.riskCase(r.ctx, id); }                               // CP-15/16
}

@Module({
  controllers: [CpsiController],
  providers: [
    PrismaService, AuditService,
    { provide: CpsiService, useFactory: (p: PrismaService, a: AuditService) => new CpsiService(p, a), inject: [PrismaService, AuditService] },
  ],
  exports: [CpsiService],
})
export class CpsiModule {}
