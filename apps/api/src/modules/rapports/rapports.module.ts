import { Module, Controller, Get, Query, Req, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { KpiService } from "./kpi.service";

// R50 — Exports réglementaires « en un clic » (port fidèle domain.py rapport_derogations / rapport_pep /
// rapport_hits / rapport_retards_recertification). Lecture seule, scopée tenant (SERVEUR). Le registre
// s'appuie sur les tables/journaux EXISTANTS (aucun modèle nouveau) : dérogations = journal d'événements,
// PEP = personnes (statut_pep), hits = screening_hits, retards = review_deadlines (recertifications).

type Ctx = { tenantId: string; userId: string; role: string };

@Injectable()
export class RapportsService {
  constructor(private prisma: PrismaService) {}

  // Registre des dérogations : tout événement de dérogation tracé (ex. cross-border xb.derogation.*).
  async derogations(ctx: Ctx) {
    const evs = await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, type: { contains: "derogation" } }, orderBy: { id: "desc" } });
    return evs.map((e: any) => ({ type: e.type, aggregateId: e.aggregateId,
      decideur: (e.payload as any)?.par ?? (e.payload as any)?.decideur ?? (e.payload as any)?.viseur ?? null,
      at: e.at, payload: e.payload }));
  }

  // Événements du cycle PEP (propositions + décisions) — support commun de pep() et hits().
  private async evenementsPep(ctx: Ctx) {
    const evs = await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId,
        type: { in: ["pep.proposition.creee", "pep.proposition.rejetee", "personne.pep.declare"] } },
      orderBy: { id: "asc" } });
    const props = evs.filter((e: any) => e.type === "pep.proposition.creee").map((e: any) => e.payload as any);
    const rejets = new Map<string, any>();                                 // cle → {motif, par}
    for (const e of evs) if (e.type === "pep.proposition.rejetee") rejets.set((e.payload as any)?.cle, e.payload);
    const declares = new Map<string, any>();                               // personId → payload du declare
    for (const e of evs) if (e.type === "personne.pep.declare") declares.set(e.aggregateId, e.payload);
    const hitsPepises = new Set([...declares.values()].map((p: any) => p?.sourceHitId).filter(Boolean));
    return { props, rejets, declares, hitsPepises };
  }

  /**
   * Rapport PEP (R50, étendu ADR-PEP-001/P-L4-2) — le registre reflète L'AUTORITÉ, pas les signaux :
   * `declares` = les PEP décidés par un HUMAIN (personnes.statutPep), avec la trace liante sourceHitId
   * quand la décision répond à une proposition issue d'un hit ; `propositions` = les signaux en cours
   * ({ ouvertes, rejetees }), section DISTINCTE, jamais confondue avec l'autorité.
   */
  async pep(ctx: Ctx) {
    const ps = await this.prisma.person.findMany({
      where: { tenantId: ctx.tenantId, statutPep: true }, select: { id: true, nom: true, finMandatPep: true } });
    const { props, rejets, declares, hitsPepises } = await this.evenementsPep(ctx);
    const lignes = ps.map((p: any) => { const d = declares.get(p.id);
      return { personne: p.id, nom: p.nom, statut: "PEP", finMandat: p.finMandatPep,
        ...(d?.sourceHitId ? { sourceHitId: d.sourceHitId } : {}) }; });
    const ouvertes = props.filter((p) => !rejets.has(p.cle) && !hitsPepises.has(p.hitId))
      .map((p) => ({ cle: p.cle, personne: p.personId, hit: p.hitId, liste: p.liste, listeVersion: p.listeVersion, score: p.score }));
    const rejetees = props.filter((p) => rejets.has(p.cle))
      .map((p) => ({ cle: p.cle, personne: p.personId, hit: p.hitId, motif: rejets.get(p.cle)?.motif, par: rejets.get(p.cle)?.par }));
    return { declares: lignes, propositions: { ouvertes, rejetees } };
  }

  // Liste des hits de screening et leur traitement (BRUT | QUALIFIE). P-L4-2 : quand le hit a produit
  // une proposition de PEPisation, le rapport porte la TRACE LIANTE hit ↔ décision (PEPISE | REJETEE | OUVERTE).
  async hits(ctx: Ctx) {
    const hs = await this.prisma.screeningHit.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true, clientId: true, statut: true, score: true, listeVersion: true }, orderBy: { at: "desc" } });
    const { props, rejets, hitsPepises } = await this.evenementsPep(ctx);
    const propParHit = new Map(props.map((p: any) => [p.hitId, p.cle]));
    return hs.map((h: any) => ({ hit: h.id, client: h.clientId, etat: h.statut, score: h.score, listeVersion: h.listeVersion,
      ...(propParHit.has(h.id) ? { tracePep: { proposition: propParHit.get(h.id),
        decision: hitsPepises.has(h.id) ? "PEPISE" : (rejets.has(propParHit.get(h.id)!) ? "REJETEE" : "OUVERTE") } } : {}) }));
  }

  // Recertifications (reviews) ouvertes au-delà du délai : échéance PLANIFIEE dont la due date est passée
  // depuis plus de `delaiJours` (défaut 0 = simplement en retard). now injectable pour le test.
  async retardsRecertification(ctx: Ctx, delaiJours = 0, now: Date = new Date()) {
    const seuil = new Date(now.getTime() - delaiJours * 86400000);
    const ds = await this.prisma.reviewDeadline.findMany({
      where: { tenantId: ctx.tenantId, statut: "PLANIFIEE", dueDate: { lt: seuil } },
      select: { id: true, clientId: true, dueDate: true, ddlLevel: true } });
    return ds.map((d: any) => ({ deadline: d.id, client: d.clientId, dueDate: d.dueDate, niveau: d.ddlLevel }));
  }
}

@Controller("rapports")
export class RapportsController {
  constructor(private svc: RapportsService, private kpi: KpiService) {}
  @Get("derogations") derogations(@Req() r: any) { return this.svc.derogations(r.ctx); }
  @Get("kpi") kpiConformite(@Req() r: any, @Query("du") du: string, @Query("au") au: string) { return this.kpi.conformite(r.ctx, { du, au }); }   // P-L8-2
  @Get("kpi/trimestre") kpiTrimestre(@Req() r: any, @Query("annee") a: string, @Query("t") t2: string) { return this.kpi.trimestriel(r.ctx, Number(a), Number(t2) as any); }
  @Get("pep") pep(@Req() r: any) { return this.svc.pep(r.ctx); }
  @Get("hits") hits(@Req() r: any) { return this.svc.hits(r.ctx); }
  @Get("retards-recertification")
  retards(@Req() r: any, @Query("delaiJours") delaiJours?: string) {
    return this.svc.retardsRecertification(r.ctx, delaiJours != null ? Number(delaiJours) : 0);
  }
}

@Module({ controllers: [RapportsController], providers: [RapportsService, KpiService, PrismaService] })
export class RapportsModule {}
