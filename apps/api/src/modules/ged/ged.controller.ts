import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { GedIngestionService } from "./ged-ingestion.service";
import { GedService } from "./ged.service";
import { GedAvanceService } from "./ged-avance.service";
import { VuesService } from "./vues.service";
import { RechercheService } from "../recherche/recherche.service";
import { CoffreService } from "../coffre/coffre.service";

/**
 * Surface REST de la GED — une PORTE, pas une logique : toutes les gardes (droits par
 * type, filtrage au résultat, motifs, gels) vivent aux services, déjà testées. Le
 * contexte (banque/utilisateur/rôle) est porté par req.ctx (JWT/IAM en production —
 * même middleware que kyc.controller). Doc d'intégration : docs/ged-api.md.
 */
@Controller("ged")
export class GedController {
  constructor(
    private ingestion: GedIngestionService,
    private ged: GedService,
    private avance: GedAvanceService,
    private vues: VuesService,
    private recherche: RechercheService,
    private coffre: CoffreService,
  ) {}

  // ── Entrée ──
  @Post("documents")
  ingester(@Req() req: any, @Body() body: any) {
    return this.ingestion.ingerer(req.ctx, body);
  }
  @Post("documents/:id/classement")
  classer(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    return this.ingestion.classer(req.ctx, id, body.typeCode);
  }

  // ── Consultation (filtrée aux droits du porteur du jeton) ──
  // ÉCART SIGNALÉ (lot 36) : la porte livrée appelait `this.ged.lister` / `this.ged.lire`,
  // méthodes ABSENTES du `GedService` ratifié (qui n'expose aucune surface de consultation).
  // Endpoints GET /documents et GET /documents/:id RETIRÉS en attendant la ratification de
  // cette surface — aucun service ratifié n'est modifié. Cf. rapport lot 36.
  @Get("documents/:id/contenu/:versionId")
  contenu(@Req() req: any, @Param("versionId") versionId: string) {
    return this.coffre.lire(req.ctx, versionId);   // relecture vérifiée par empreinte
  }

  // ── Recherche & vues ──
  @Get("recherche")
  chercher(@Req() req: any, @Query("q") q: string) {
    return this.recherche.chercher(req.ctx, q ?? "");
  }
  @Get("vues/:code")
  vue(@Req() req: any, @Param("code") code: string) {
    return this.vues.evaluer(req.ctx, code);
  }

  // ── Actes sensibles (motivés — le motif voyage dans le corps) ──
  @Post("documents/:id/gel")
  gel(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    return this.avance.poserHold(req.ctx, id, body.motif);
  }
}
