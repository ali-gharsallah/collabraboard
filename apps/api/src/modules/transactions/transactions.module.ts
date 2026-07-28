import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { TransactionGateService, gardeComportement } from "./transaction-gate.service";

/**
 * Porte HTTP du portail transactionnel (Vague 4, écran « Transferts & ordres »). Délégation
 * PURE vers le domaine ratifié R140→R143. Toute transaction passe par le portail : verdict
 * PASSE|BLOQUE|SUSPEND tracé garde par garde (append-only) ; la file de revue est habilitée
 * (R143) ; la décision est motivée (R7) ; la **vue client** ne porte JAMAIS de motif AML
 * (art. 10a, R132) — seulement un statut. Auteur = jeton (r.ctx).
 * Gardes câblées : `gardeComportement` (R142, le KYC nourrit la transaction). La garde gel-MROS
 * (R131) exige `MrosService` et sera ajoutée quand le portail devra confronter les gels actifs.
 */
@Controller("transactions")
export class TransactionsController {
  constructor(private svc: TransactionGateService) {}
  @Post("evaluer")           evaluer(@Req() r: any, @Body() b: any) { return this.svc.evaluer(r.ctx, b); }                     // R140/R141/R142
  @Get("revue")              revue(@Req() r: any) { return this.svc.listerRevue(r.ctx); }                                      // R143 (habilitée)
  @Post(":id/decider")       decider(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.decider(r.ctx, id, b?.decision, b?.motif); } // R143/R7
  @Get(":id/statut-client")  statut(@Req() r: any, @Param("id") id: string) { return this.svc.vueClient(r.ctx, id); }          // R132 (sans motif AML)
}

@Module({
  controllers: [TransactionsController],
  providers: [
    {
      provide: TransactionGateService,
      useFactory: (prisma: PrismaService, audit: AuditService) =>
        new TransactionGateService(prisma, audit, [gardeComportement()]),
      inject: [PrismaService, AuditService],
    }],
  exports: [TransactionGateService],
})
export class TransactionsModule {}
