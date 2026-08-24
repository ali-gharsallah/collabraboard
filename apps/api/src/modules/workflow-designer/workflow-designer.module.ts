import { Body, Controller, Get, Module, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { GedIngestionService } from "../ged/ged-ingestion.service";
import { WorkflowModule } from "../workflow/workflow.module";
import { WorkflowDefService } from "../workflow/workflow-def.service";
import { WorkflowDesignerService, StubVisionExtractor, VisionExtractor } from "./workflow-designer.service";

/**
 * Bloc WD — porte HTTP mince du pipeline WorkflowIR. Le service porte les invariants
 * (R432–R438) ; la publication reste au module workflow existant (R436). E-WD-2 : le
 * VisionExtractor par défaut est le STUB hors-ligne — l'implémentation API s'active par
 * le flag licence tenant `wdVisionApi` (branchement production, hors de ce module).
 */
@Controller("workflow-designer")
export class WorkflowDesignerController {
  constructor(private svc: WorkflowDesignerService) {}

  @Post("import")
  importer(@Req() r: any, @Body() b: any) { return this.svc.importer(r.ctx, b ?? {}); }

  @Get(":id")
  etat(@Req() r: any, @Param("id") id: string, @Query("date") date?: string) {
    return this.svc.etat(r.ctx, id, date ? new Date(date) : undefined);
  }

  @Patch(":id/ir")
  editer(@Req() r: any, @Param("id") id: string, @Body() b: any) {
    return this.svc.editer(r.ctx, id, b?.patch ?? b ?? {});
  }

  @Post(":id/ratify")
  ratifier(@Req() r: any, @Param("id") id: string) { return this.svc.ratifier(r.ctx, id); }
}

@Module({
  imports: [WorkflowModule],
  controllers: [WorkflowDesignerController],
  providers: [
    { provide: GedIngestionService,
      useFactory: (p: PrismaService, a: AuditService) => new GedIngestionService(p, a),
      inject: [PrismaService, AuditService] },
    { provide: "VISION_EXTRACTOR", useClass: StubVisionExtractor },
    { provide: WorkflowDesignerService,
      useFactory: (p: PrismaService, a: AuditService, g: GedIngestionService,
        d: WorkflowDefService, v: VisionExtractor) => new WorkflowDesignerService(p, a, g, d, v),
      inject: [PrismaService, AuditService, GedIngestionService, WorkflowDefService, "VISION_EXTRACTOR"] },
  ],
  exports: [WorkflowDesignerService],
})
export class WorkflowDesignerModule {}
