import { Controller, Get, Param, Query, Req, Module, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";

/**
 * Porte HTTP « Workflow Instances » (SPEC-FRONT-CÂBLAGE v2, FE-WFI · amendement A1/D1). Projection
 * LISIBLE, en LECTURE SEULE, du workflow gouverné RATIFIÉ : le **dossier KYC** (`kyc-workflow.chaine`,
 * R171-173 le résolvent). Une instance = un `KycFile` ; ses **visas** = `KycVisa` (visa uniforme R15,
 * exclusion 4-yeux R13 déjà appliquée par le service au moment de signer) ; sa **timeline** = les
 * `DomainEvent` de l'agrégat (append-only, ordre serveur — FE-20). Zéro logique métier, zéro règle
 * nouvelle, zéro modèle nouveau : la porte relaie/projette, elle ne décide pas (PT-01).
 *
 * ⚠ Écart signalé (docs/ECARTS-FRONT.md) : les instances projetées sont aujourd'hui les dossiers KYC
 * (seul workflow gouverné ratifié à visas + timeline). D'autres types de workflow s'ajouteront avec
 * leur canon — jamais synthétisés ici.
 */

type Ctx = { tenantId: string; userId: string; role: string };

const etape = (statut: string): string =>
  statut === "VALIDATED" ? "Validé"
  : statut === "REJECTED" ? "Rejeté"
  : statut === "UNDER_REVIEW" ? "Revue & visas"
  : "Collecte";

@Injectable()
export class WorkflowInstancesService {
  constructor(private prisma: PrismaService) {}

  // GET /v1/workflow-instances — liste des instances (dossiers KYC), filtrable par statut.
  async lister(ctx: Ctx, filtre: { status?: string }) {
    const where: any = { tenantId: ctx.tenantId };
    if (filtre.status) where.status = filtre.status;
    const rows = await this.prisma.kycFile.findMany({ where, include: { visas: true }, orderBy: { createdAt: "desc" } });
    return rows.map((k: any) => {
      const visas = k.visas ?? [];
      const signes = visas.filter((v: any) => v.status === "SIGNED").length;
      return {
        id: k.id, code: k.code, type: `KYC:${k.workflow}`, clientId: k.clientId,
        status: k.status, etapeCourante: etape(k.status), revision: k.revision,
        visas: `${signes}/${visas.length}`, majAt: k.createdAt,
      };
    });
  }

  // GET /v1/workflow-instances/:id — détail : steps (sections) + visas (R15) + statut. Métadonnées
  // seulement (jamais le contenu des questions — R110).
  async detail(ctx: Ctx, id: string) {
    const k = await this.prisma.kycFile.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { sections: { orderBy: { orderIndex: "asc" } }, visas: true },
    });
    if (!k) throw new NotFoundException("Instance de workflow introuvable");
    return {
      id: k.id, code: k.code, type: `KYC:${k.workflow}`, clientId: k.clientId,
      status: k.status, etapeCourante: etape(k.status), revision: k.revision,
      steps: (k.sections as any[]).map((s) => ({ code: s.code, label: s.label, ordre: s.orderIndex })),
      visas: (k.visas as any[]).map((v) => ({
        section: v.sectionCode, roleRequis: v.requiredRole, statut: v.status,
        signePar: v.signedBy, signeAt: v.signedAt, verdict: v.verdict, assigne: v.validateur,
      })),
    };
  }

  // GET /v1/workflow-instances/:id/events — timeline append-only (DomainEvents de l'agrégat), ordre serveur.
  async events(ctx: Ctx, id: string) {
    const evs = await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, aggregateId: id }, orderBy: { id: "asc" },
    });
    return evs.map((e: any) => ({ type: e.type, at: e.at, payload: e.payload }));
  }
}

@Controller("workflow-instances")
export class WorkflowInstancesController {
  constructor(private svc: WorkflowInstancesService) {}
  @Get()            lister(@Req() r: any, @Query("status") status?: string) { return this.svc.lister(r.ctx, { status }); }
  @Get(":id")       detail(@Req() r: any, @Param("id") id: string) { return this.svc.detail(r.ctx, id); }
  @Get(":id/events") events(@Req() r: any, @Param("id") id: string) { return this.svc.events(r.ctx, id); }
}

@Module({
  controllers: [WorkflowInstancesController],
  providers: [
    PrismaService,
    { provide: WorkflowInstancesService, useFactory: (p: PrismaService) => new WorkflowInstancesService(p), inject: [PrismaService] },
  ],
  exports: [WorkflowInstancesService],
})
export class WorkflowInstancesModule {}
