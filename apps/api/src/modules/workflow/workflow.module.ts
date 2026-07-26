import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { WorkflowDefService } from "./workflow-def.service";

/**
 * Porte HTTP du Workflow gouverné (Vague 5, écran « Workflow Designer/Rules »). Délégation
 * PURE vers le domaine ratifié R171→R173 : le brouillon se modifie à volonté (R173) et
 * n'existe jamais pour le moteur ; **publier** grave une version DATÉE (R171), habilitée
 * (workflowRoles), motivée (R7) — et ne se rejoue pas ; une version PUBLIEE est IMMUABLE ;
 * `resoudre(code, date)` rend le grandfathering STRUCTUREL (R172 : le dossier emporte sa
 * version). Auteur = jeton (r.ctx).
 */
@Controller("workflow")
export class WorkflowController {
  constructor(private svc: WorkflowDefService) {}
  @Post("definitions")            creer(@Req() r: any, @Body() b: any) { return this.svc.creerBrouillon(r.ctx, { code: b?.code, contenu: b?.contenu }); }        // R173
  @Patch("definitions/:id")       modifier(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.modifierBrouillon(r.ctx, id, b?.contenu); } // R173
  @Post("definitions/:id/publier") publier(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.publier(r.ctx, id, { depuisLe: b?.depuisLe, motif: b?.motif }); } // R171/R7
  @Get("definitions")             lister(@Req() r: any, @Query("code") code?: string) { return this.svc.lister(r.ctx, code); }
  @Get("resoudre")                resoudre(@Req() r: any, @Query("code") code: string, @Query("date") date: string) { return this.svc.resoudre(r.ctx, code, date); } // R172
}

@Module({ controllers: [WorkflowController], providers: [PrismaService, AuditService, WorkflowDefService], exports: [WorkflowDefService] })
export class WorkflowModule {}
