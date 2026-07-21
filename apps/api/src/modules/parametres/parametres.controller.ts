import { Controller, Get, Post, Body, Param, Query, Req } from "@nestjs/common";
import { ParametresService } from "./parametres.service";

/** Porte HTTP du registre R-Q — « tout le paramétrage vit sous Paramètres » (doctrine du
 * 21.07). Délégation pure : le service ratifié décide (écrire = acte motivé, jamais
 * rétroactif R126 ; valeur effective par date R29). Aucune logique ici. */
@Controller("parametres")
export class ParametresController {
  constructor(private parametres: ParametresService) {}

  @Get("registre")
  registre() { return this.parametres.registre(); }

  @Get("valeur/:cle")
  valeur(@Req() req: any, @Param("cle") cle: string, @Query("date") date?: string) {
    return this.parametres.valeurEffective(req.ctx, cle, date ? new Date(date) : new Date());
  }

  @Post("valeur/:cle")
  ecrire(@Req() req: any, @Param("cle") cle: string,
    @Body() body: { valeur: any; motif: string; effetAt?: string }) {
    return this.parametres.ecrire(req.ctx, cle, body?.valeur, body?.motif, body?.effetAt);
  }
}
