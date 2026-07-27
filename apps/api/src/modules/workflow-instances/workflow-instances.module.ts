import { Controller, Get, Param, Query, Req, Module, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { KycModule } from "../kyc/kyc.module";
import { KycService } from "../kyc/kyc.service";

/**
 * Porte HTTP « Workflow Instances » (SPEC-FRONT-CÂBLAGE v2, FE-WFI · A1/D1 · A3.2). Projection LISIBLE,
 * en LECTURE SEULE, du workflow gouverné RATIFIÉ : le **dossier KYC** (`kyc-workflow.chaine`, R171-173).
 * Une instance = un `KycFile` ; ses **visas** = `KycVisa` (R15) ; sa **timeline** = les `DomainEvent` de
 * l'agrégat (append-only, ordre serveur). Reconnaissance A3 = **CAS A** (état persisté requêtable) :
 * aucune projection dérivée nécessaire, aucun endpoint d'écriture (l'avancement passe par visas/tâches/
 * événements du moteur — intouchable). La porte relaie/projette, ne décide pas (PT-01). Le **rejeu à date**
 * (`asOf`, R48/R49) est délégué au ratifié `KycService.etatADate` ; l'**acteur** d'un événement est LU dans
 * le payload moteur (`null` si le moteur ne l'a pas écrit — jamais synthétisé). Métadonnées seulement (R110).
 */

type Ctx = { tenantId: string; userId: string; role: string };

const etape = (statut: string): string =>
  statut === "VALIDATED" ? "Validé"
  : statut === "REJECTED" ? "Rejeté"
  : statut === "UNDER_REVIEW" ? "Revue & visas"
  : "Collecte";

// Acteur d'un événement = lu dans le payload moteur (donnée existante), jamais fabriqué.
const acteurDe = (payload: any): string | null =>
  payload?.par ?? payload?.by ?? payload?.holder ?? payload?.validatedBy ?? payload?.signedBy ?? payload?.requester ?? payload?.from ?? null;

@Injectable()
export class WorkflowInstancesService {
  constructor(private prisma: PrismaService, private kyc: KycService) {}

  private mapVisa = (v: any) => ({
    section: v.sectionCode, roleRequis: v.requiredRole, statut: v.status,
    signePar: v.signedBy, signeAt: v.signedAt, verdict: v.verdict, assigne: v.validateur });

  // GET /v1/workflow-instances?status=&type=&subjectId= — liste (dossiers KYC), filtres, sans rejouer d'événements (Q2).
  async lister(ctx: Ctx, f: { status?: string; type?: string; subjectId?: string }) {
    const where: any = { tenantId: ctx.tenantId };
    if (f.status) where.status = f.status;
    if (f.type) where.workflow = f.type.replace(/^KYC:/, "");                 // type = "KYC:CDD" ou "CDD"
    if (f.subjectId) where.clientId = f.subjectId;                            // subjectRef = clientId
    const rows = await this.prisma.kycFile.findMany({ where, include: { visas: true }, orderBy: { createdAt: "desc" } });
    return rows.map((k: any) => {
      const visas = k.visas ?? [];
      return {
        id: k.id, code: k.code, type: `KYC:${k.workflow}`, subjectRef: k.clientId,
        status: k.status, currentStep: etape(k.status), revision: k.revision,
        visas: `${visas.filter((v: any) => v.status === "SIGNED").length}/${visas.length}`, majAt: k.createdAt,
      };
    });
  }

  // GET /v1/workflow-instances/:id[?asOf=] — détail : steps + visas (R15) + statut. asOf → état d'alors (R48).
  async detail(ctx: Ctx, id: string, asOf?: string) {
    const k = await this.prisma.kycFile.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { sections: { orderBy: { orderIndex: "asc" } }, visas: true } });
    if (!k) throw new NotFoundException("Instance de workflow introuvable");
    const steps = (k.sections as any[]).map((s) => ({ code: s.code, label: s.label, ordre: s.orderIndex }));
    if (asOf) {
      // Rejeu à date : statut délégué au ratifié KycService.etatADate ; visas au format R15 reconstruits
      // par comparaison temporelle (signé si signedAt ≤ asOf) — lecture pure, aucune écriture.
      const rejeu = await this.kyc.etatADate(ctx, k.code, new Date(asOf));
      const t = new Date(asOf).getTime();
      const visas = (k.visas as any[]).map((v) => this.mapVisa({ ...v,
        status: v.signedAt && new Date(v.signedAt).getTime() <= t ? "SIGNED" : "PENDING",
        signedBy: v.signedAt && new Date(v.signedAt).getTime() <= t ? v.signedBy : null,
        signedAt: v.signedAt && new Date(v.signedAt).getTime() <= t ? v.signedAt : null }));
      return { id: k.id, code: k.code, type: `KYC:${k.workflow}`, subjectRef: k.clientId,
        status: rejeu.statutADate, currentStep: rejeu.statutADate, existeADate: rejeu.existeADate,
        asOf, steps, visas, lectureSeule: true };
    }
    return { id: k.id, code: k.code, type: `KYC:${k.workflow}`, subjectRef: k.clientId,
      status: k.status, currentStep: etape(k.status), revision: k.revision,
      steps, visas: (k.visas as any[]).map(this.mapVisa) };
  }

  // GET /v1/workflow-instances/:id/events[?asOf=] — timeline append-only (acteur + horodatage + type).
  async events(ctx: Ctx, id: string, asOf?: string) {
    const evs = await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, aggregateId: id }, orderBy: { id: "asc" } });
    const t = asOf ? new Date(asOf).getTime() : null;
    return evs
      .filter((e: any) => t === null || new Date(e.at).getTime() <= t)         // R48 : seuls les événements ≤ asOf
      .map((e: any) => ({ type: e.type, at: e.at, acteur: acteurDe(e.payload), payload: e.payload }));
  }
}

@Controller("workflow-instances")
export class WorkflowInstancesController {
  constructor(private svc: WorkflowInstancesService) {}
  @Get()            lister(@Req() r: any, @Query("status") status?: string, @Query("type") type?: string, @Query("subjectId") subjectId?: string) {
    return this.svc.lister(r.ctx, { status, type, subjectId }); }
  @Get(":id")       detail(@Req() r: any, @Param("id") id: string, @Query("asOf") asOf?: string) { return this.svc.detail(r.ctx, id, asOf); }
  @Get(":id/events") events(@Req() r: any, @Param("id") id: string, @Query("asOf") asOf?: string) { return this.svc.events(r.ctx, id, asOf); }
}

@Module({
  imports: [KycModule],                                                       // KycService (ratifié) pour le rejeu à date
  controllers: [WorkflowInstancesController],
  providers: [
    PrismaService,
    { provide: WorkflowInstancesService, useFactory: (p: PrismaService, k: KycService) => new WorkflowInstancesService(p, k), inject: [PrismaService, KycService] },
  ],
  exports: [WorkflowInstancesService],
})
export class WorkflowInstancesModule {}
