import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { GedIngestionService } from "./ged-ingestion.service";
import { GedService } from "./ged.service";
import { GedAvanceService } from "./ged-avance.service";
import { VuesService } from "./vues.service";
import { RechercheService } from "../recherche/recherche.service";
import { CoffreService } from "../coffre/coffre.service";
import { GedConsultationService } from "./ged-consultation.service";

/**
 * Surface REST de la GED — une PORTE, pas une logique : chaque endpoint mappe UNE méthode
 * du domaine ratifié, sans en inventer. Les gardes (droits par type, filtrage au résultat,
 * motifs, gels) vivent aux services, déjà testées. Contexte (banque/utilisateur/rôle) :
 * req.ctx — même middleware que kyc.controller. Doc : docs/ged-api.md.
 * CORRECTIF (écart attrapé par la chaîne à deux postes) : la première version appelait
 * lister/lire — inexistants au domaine. Lot 42 : la consultation (lister/fiche) existe
 * désormais, prouvée GS-01..05 — la promesse est tenue.
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
    private consultation: GedConsultationService,
  ) {}

  // ── Consultation (GS-01..05 : R110 relu à l'acte, jamais de contenu — R145) ──
  @Get("documents")
  listerDocuments(@Req() req: any, @Query("clientId") clientId?: string,
    @Query("typeCode") typeCode?: string, @Query("statut") statut?: string) {
    return this.consultation.listerDocuments(req.ctx, { clientId, typeCode, statut });
  }
  @Get("documents/:id")
  fiche(@Req() req: any, @Param("id") id: string) {
    return this.consultation.fiche(req.ctx, id);
  }

  // ── Entrée ──
  @Post("documents")
  ingester(@Req() req: any, @Body() body: any) {
    return this.ingestion.ingerer(req.ctx, body);
  }
  @Post("documents/:id/classement")
  classer(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    return this.ingestion.classer(req.ctx, id, body.typeCode);
  }

  // ── Contenu : la seule voie est la relecture vérifiée du coffre (empreinte — R145) ──
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
