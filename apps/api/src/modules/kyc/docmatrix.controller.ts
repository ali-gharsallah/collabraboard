import { Body, Controller, Get, Post, Query, Req, BadRequestException } from "@nestjs/common";
import { DocMatrixService, DossierMatrice } from "./docmatrix.service";

// R26/R27/R29 — matrice documentaire versionnée. Le contenu publié provient de l'éditeur
// tenant (arbitrage banque) ; l'API ne porte que le mécanisme (publication append-only,
// résolution en vigueur/à date, évaluation de complétude).
@Controller("doc-matrix")
export class DocMatrixController {
  constructor(private svc: DocMatrixService) {}

  @Get("en-vigueur")
  enVigueur(@Req() req: any, @Query("at") at?: string) {
    return this.svc.enVigueur(req.ctx, at ? new Date(at) : new Date());
  }

  @Post()
  publier(@Req() req: any, @Body() body: any) {
    if (!body?.contenu) throw new BadRequestException("[R26] Corps attendu : { contenu, enVigueurLe? }.");
    return this.svc.publier(req.ctx, body.contenu, body?.enVigueurLe ? new Date(body.enVigueurLe) : new Date());
  }

  @Post("completude")
  completude(@Req() req: any, @Body() body: any) {
    const d = body as DossierMatrice;
    if (!d?.typeEntite || !d?.juridiction || !d?.titulaire)
      throw new BadRequestException("[R26] Descripteur attendu : { typeEntite, juridiction, titulaire, … }.");
    return this.svc.evaluerCompletude(req.ctx, d, body?.at ? new Date(body.at) : new Date());
  }
}
