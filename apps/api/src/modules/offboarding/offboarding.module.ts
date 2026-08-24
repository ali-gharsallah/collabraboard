import { Body, Controller, Get, Module, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { OffboardingService, CoreBankingPort } from "./offboarding.service";
import { OffboardingMoteurService } from "./offboarding-moteur.service";
import { ReviewsModule } from "../reviews/reviews.module";            // Bloc 65 Volet B (R474)
import { DecisionUnifieeService } from "../reviews/decision-unifiee.service";

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

/** Bloc 62 (repo R439–R445) — offboarding AU MOTEUR : l'état est un REJEU du journal,
 *  la publication des paramètres passe par le pop-up d'engagement R445 (PATCH params). */
@Controller("offboarding-moteur")
export class OffboardingMoteurController {
  constructor(private svc: OffboardingMoteurService) {}
  @Get("params")                params(@Req() r: any, @Query("date") d?: string) { return this.svc.parametres(r.ctx, d ? new Date(d) : undefined); }
  @Patch("params")              modifier(@Req() r: any, @Body() b: any) { return this.svc.modifierParametre(r.ctx, b ?? {}); }   // R445
  @Post("instances")            initier(@Req() r: any, @Body() b: any) { return this.svc.initier(r.ctx, b ?? {}); }              // R442
  @Get("instances/:id")         etat(@Req() r: any, @Param("id") id: string, @Query("date") d?: string) { return this.svc.etat(r.ctx, id, d ? new Date(d) : undefined); }   // R439/R48
  @Get("instances/:id/health")  health(@Req() r: any, @Param("id") id: string) { return this.svc.healthCheck(r.ctx, id); }       // R440/OF-12
  @Post("instances/:id/viser")  viser(@Req() r: any, @Param("id") id: string) { return this.svc.viser(r.ctx, id); }              // R441/R13
  @Post("instances/:id/checklist") cocher(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.cocherItem(r.ctx, id, b?.label); }   // R443
  @Get("instances/:id/trail")   trail(@Req() r: any, @Param("id") id: string) { return this.svc.auditTrail(r.ctx, id); }         // R444/R51
}

function fakeCorePort(): CoreBankingPort | undefined {
  if (process.env.OFFB_FAKE_CORE !== "1") return undefined;   // port de test OF-06 — jamais en prod
  return { systeme: "fake-core", version: "test", perimetre: ["soldes"],
    lire: async (type: string) =>                              // données lues à l'APPEL (les tests font varier les soldes)
      (type === "soldes" ? JSON.parse(process.env.OFFB_FAKE_CORE_SOLDES ?? "[]") : []) };
}

@Module({
  imports: [ReviewsModule],                                           // Bloc 65 Volet B : la barre de décision (R474)
  controllers: [OffboardingController, OffboardingMoteurController],
  providers: [
    {
      provide: OffboardingService,
      useFactory: (prisma: PrismaService, audit: AuditService) =>
        new OffboardingService(prisma, audit, { core: fakeCorePort() }),
      inject: [PrismaService, AuditService],
    },
    {
      provide: OffboardingMoteurService,
      useFactory: (prisma: PrismaService, audit: AuditService, du: DecisionUnifieeService) => {
        const svc = new OffboardingMoteurService(prisma, audit, { core: fakeCorePort() });
        du.brancherMoteur(svc);         // R474 : Valider sur OFFBOARDING = moteur.viser — aucun fork
        return svc;
      },
      inject: [PrismaService, AuditService, DecisionUnifieeService],
    },
  ],
  exports: [OffboardingService, OffboardingMoteurService],
})
export class OffboardingModule {}
