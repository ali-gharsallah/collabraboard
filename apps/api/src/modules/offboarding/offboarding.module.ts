import { Body, Controller, Get, Module, Param, Post, Query, Req } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { OffboardingService, CoreBankingPort } from "./offboarding.service";

/**
 * Porte HTTP du bloc Offboarding (R267→R271). Délégation pure — l'auteur de chaque acte est
 * le jeton (ctx.userId), jamais le body. Le port core banking est injecté comme pour
 * CorebankingModule : vide en prod tant qu'aucun connecteur n'est configuré (R167) ; le port
 * de TEST (OFFB_FAKE_CORE_SOLDES, jamais utilisé en prod) sert la recette OF-06 « port présent ».
 */
@Controller("offboarding")
export class OffboardingController {
  constructor(private svc: OffboardingService) {}
  @Post()                       creer(@Req() r: any, @Body() b: any) { return this.svc.creer(r.ctx, b ?? {}); }             // R267/R268
  @Get()                        liste(@Req() r: any, @Query("statut") statut?: string) { return this.svc.liste(r.ctx, statut); }
  @Get("statut/:clientId")      statut(@Req() r: any, @Param("clientId") cid: string) { return this.svc.statutClient(r.ctx, cid); } // bannières OF-10
  @Get(":id")                   detail(@Req() r: any, @Param("id") id: string) { return this.svc.detail(r.ctx, id); }
  @Get(":id/courrier")          courrier(@Req() r: any, @Param("id") id: string) { return this.svc.courrier(r.ctx, id); } // R270/OF-09
  @Post(":id/transition")       transition(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.transitionner(r.ctx, id, b?.vers, b?.motif); } // R267
  @Post(":id/visa")             viser(@Req() r: any, @Param("id") id: string) { return this.svc.viser(r.ctx, id); }         // R268/R13 — rôle du jeton
  @Post(":id/documents")        doc(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.ajouterDocument(r.ctx, id, b ?? {}); } // R268
  @Post(":id/attestation-avoirs") attester(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.attesterAvoirs(r.ctx, id, b?.motif); } // R269/OF-06
}

function fakeCorePort(): CoreBankingPort | undefined {
  if (process.env.OFFB_FAKE_CORE !== "1") return undefined;   // port de test OF-06 — jamais en prod
  return { systeme: "fake-core", version: "test", perimetre: ["soldes"],
    lire: async (type: string) =>                              // données lues à l'APPEL (les tests font varier les soldes)
      (type === "soldes" ? JSON.parse(process.env.OFFB_FAKE_CORE_SOLDES ?? "[]") : []) };
}

@Module({
  controllers: [OffboardingController],
  providers: [
    {
      provide: OffboardingService,
      useFactory: (prisma: PrismaService, audit: AuditService) =>
        new OffboardingService(prisma, audit, { core: fakeCorePort() }),
      inject: [PrismaService, AuditService],
    },
  ],
  exports: [OffboardingService],
})
export class OffboardingModule {}
