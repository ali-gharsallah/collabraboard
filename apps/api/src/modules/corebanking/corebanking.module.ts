import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { CoreSyncService } from "./core-sync.service";

/**
 * Porte HTTP du core banking (Vague 4, écran « Settlement / exécution »). Le core est un
 * PORT (R167→R169) — Avaloq/Temenos/Finnova/ERI deviennent des implémentations d'un contrat,
 * jamais réimplémentés ici. **Phase 1 : LECTURE SEULE.** Sans port configuré (`ports = {}`),
 * `importerLot` REFUSE explicitement (R114/R167) — jamais de donnée simulée. `etatSync` restitue
 * l'état de synchronisation (lots, quarantaine). Providers via `useFactory` (port injecté vide).
 */
@Controller("corebanking")
export class CorebankingController {
  constructor(private svc: CoreSyncService) {}
  @Get("etat")        etat(@Req() r: any) { return this.svc.etatSync(r.ctx); }                                          // R168 lecture seule
  @Post("importer")   importer(@Req() r: any, @Body() b: any) { return this.svc.importerLot(r.ctx, b?.type); }          // R167 : refuse sans port
}

@Module({
  controllers: [CorebankingController],
  providers: [
    PrismaService, AuditService,
    {
      provide: CoreSyncService,
      useFactory: (prisma: PrismaService, audit: AuditService) => new CoreSyncService(prisma, audit, {}),
      inject: [PrismaService, AuditService],
    },
  ],
  exports: [CoreSyncService],
})
export class CorebankingModule {}
