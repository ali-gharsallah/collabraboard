import { Controller, Get, Post, Body, Param, Req } from "@nestjs/common";
import { WorkloadService } from "./workload.service";

/** Porte HTTP de la capacité d'équipe (R183→R185). Délégation pure : la transparence
 * structurelle, le signal sans déplacement et le barème versionné sont dans le service
 * ratifié — un tiers non responsable est refusé et tracé PAR LE SERVICE. */
@Controller("workload")
export class WorkloadController {
  constructor(private workload: WorkloadService) {}

  @Get("equipes/:role")
  equipe(@Req() req: any, @Param("role") role: string) { return this.workload.chargeEquipe(req.ctx, role); }

  @Get("mesures/:userId")
  mesures(@Req() req: any, @Param("userId") userId: string) { return this.workload.mesuresDe(req.ctx, userId); }

  @Post("equipes/:role/surcharges")
  signaler(@Req() req: any, @Param("role") role: string) { return this.workload.signalerSurcharges(req.ctx, role); }

  @Post("taches/:id/reassigner")
  reassigner(@Req() req: any, @Param("id") id: string, @Body() body: { versUserId: string; motif: string }) {
    return this.workload.reassigner(req.ctx, id, body?.versUserId, body?.motif);
  }

  @Get("points/:userId")
  points(@Req() req: any, @Param("userId") userId: string) { return this.workload.points(req.ctx, userId); }

  @Post("equipes/:role/snapshot-rh")
  snapshot(@Req() req: any, @Param("role") role: string) { return this.workload.snapshotRh(req.ctx, role); }
}
