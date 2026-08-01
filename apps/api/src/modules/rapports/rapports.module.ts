import { Module, Controller, Get, Query, Req, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";

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

  // Rapport PEP : les personnes au statut PEP en vigueur (+ fin de mandat éventuelle).
  async pep(ctx: Ctx) {
    const ps = await this.prisma.person.findMany({
      where: { tenantId: ctx.tenantId, statutPep: true }, select: { id: true, nom: true, finMandatPep: true } });
    return ps.map((p: any) => ({ personne: p.id, nom: p.nom, statut: "PEP", finMandat: p.finMandatPep }));
  }

  // Liste des hits de screening et leur traitement (BRUT | QUALIFIE).
  async hits(ctx: Ctx) {
    const hs = await this.prisma.screeningHit.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true, clientId: true, statut: true, score: true, listeVersion: true }, orderBy: { at: "desc" } });
    return hs.map((h: any) => ({ hit: h.id, client: h.clientId, etat: h.statut, score: h.score, listeVersion: h.listeVersion }));
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
  constructor(private svc: RapportsService) {}
  @Get("derogations") derogations(@Req() r: any) { return this.svc.derogations(r.ctx); }
  @Get("pep") pep(@Req() r: any) { return this.svc.pep(r.ctx); }
  @Get("hits") hits(@Req() r: any) { return this.svc.hits(r.ctx); }
  @Get("retards-recertification")
  retards(@Req() r: any, @Query("delaiJours") delaiJours?: string) {
    return this.svc.retardsRecertification(r.ctx, delaiJours != null ? Number(delaiJours) : 0);
  }
}

@Module({ controllers: [RapportsController], providers: [RapportsService, PrismaService] })
export class RapportsModule {}
