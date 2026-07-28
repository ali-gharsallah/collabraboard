import { Body, Controller, Get, Module, Param, Post, Req } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { PreRevueService } from "./prerevue.service";
import { claudeIaAdapter } from "../../adapters/claude-ia.adapter";

// Câblage bloc 20 (R121→R124), matérialisé depuis le bloc 2/3 de
// prerevue.schema-controller-adapter.ts. PreRevueService reçoit son port IA via useFactory
// (paramètre structurel `{ ia }` non résoluble par metadata) ; sans ANTHROPIC_API_KEY le port
// est absent → `demander` refuse proprement (AG-02). Exporté pour le gate R123 côté KYC.
@Controller("ia/prerevue")
export class PreRevueController {
  constructor(private svc: PreRevueService) {}
  @Post("kyc/:id")           demander(@Req() r: any, @Param("id") id: string) { return this.svc.demander(r.ctx, id); }           // R121
  @Get(":id")                relire(@Req() r: any, @Param("id") id: string) { return this.svc.relire(r.ctx, id); }               // R122
  @Post(":id/points/:idx")   traiter(@Req() r: any, @Param("id") id: string, @Param("idx") i: string, @Body() b: any) { return this.svc.traiterPoint(r.ctx, id, +i, b?.statut, b?.motif); } // R123
  @Get("kyc/:id/traitement") verif(@Req() r: any, @Param("id") id: string) { return this.svc.verifierTraitement(r.ctx, id); }   // R123
  @Post("prompt")            prompt(@Req() r: any, @Body() b: any) { return this.svc.versionnerPrompt(r.ctx, b?.texte); }        // R124
}

@Module({
  controllers: [PreRevueController],
  providers: [
    PrismaService,
    AuditService,
    {
      provide: PreRevueService,
      // Lot 45 (arbitrage Ali, option 1) : l'adaptateur ratifié JETTE sans ANTHROPIC_API_KEY
      // (CL-01/R138). L'appel eager au boot est GARDÉ — sans clé, port = undefined : le module
      // démarre, la pré-revue refuse proprement à l'appel (comportement préservé). Ce module
      // (prerevue.module.ts) est le câblage Nest actif importé par app.module.
      useFactory: (p: PrismaService, a: AuditService) =>
        new PreRevueService(p, a, { ia: process.env.ANTHROPIC_API_KEY ? claudeIaAdapter()
          // Port de TEST déterministe (même doctrine que le port Olivia v1 : OLIVIA_FAKE_PORT=1,
          // outillage de test, JAMAIS un chemin de prod) — livré au solde de l'anomalie A3 pour
          // couvrir e2e le chemin demander() : les points = les réponses manquantes du snapshot.
          : process.env.OLIVIA_FAKE_PORT === "1" ? {
              prerevue: async (snapshot: any) => ({ modele: "fake-prerevue-1.0",
                points: (snapshot.sections ?? []).flatMap((s: any) => (s.reponses ?? [])
                  .filter((q: any) => q.valeur == null)
                  .map((q: any) => ({ constat: `réponse manquante : ${q.code}`, section: s.code, question: q.code }))) }),
            } : undefined }),
      inject: [PrismaService, AuditService],
    },
  ],
  exports: [PreRevueService],
})
export class PreRevueModule {}
