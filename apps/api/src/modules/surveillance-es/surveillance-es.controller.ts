import { Controller, Get, Param, Req } from "@nestjs/common";
import { EsSubscriber } from "./es-subscriber.service";
import { EsProjections } from "./es-projections.service";
import { EsHits } from "./es-hits.service";
import { EsPep } from "./es-pep.service";

/**
 * API LECTURE SEULE du sidecar surveillance-es (câblage front, doctrine §1/§2 du doc ES) :
 * le module reste DORMANT/shadow tant que la bascule humaine ES-4 n'est pas actée — cette
 * API n'expose que des VUES par rejeu (état du souscripteur, files reconstruites), jamais
 * une écriture, jamais une décision (R44). L'état du monolithe fait foi ; l'écran l'affiche.
 */
@Controller("surveillance-es")
export class SurveillanceEsController {
  constructor(private sub: EsSubscriber, private proj: EsProjections,
    private hits: EsHits, private pep: EsPep) {}

  /** Curseur + compteurs du souscripteur (observabilité ES-1) + mode d'activation. */
  @Get("etat")
  async etat() {
    return { actif: process.env.ES_SOUSCRIPTEUR === "on", souscripteur: await this.sub.etat() };
  }

  /** File d'alertes ES — projection reconstruite par rejeu (ES-2, aucune table). */
  @Get("alertes")
  alertes(@Req() r: any) { return this.proj.fileAlertes(r.ctx); }

  /** Timeline des hits screening par rejeu (ES-6). */
  @Get("hits")
  fileHits(@Req() r: any) { return this.hits.fileHits(r.ctx); }

  @Get("hits/:hitId")
  etatHit(@Req() r: any, @Param("hitId") hitId: string) { return this.hits.etatHit(r.ctx, hitId); }

  /** Décisions PEP par rejeu (ES-7). */
  @Get("pep")
  filePep(@Req() r: any) { return this.pep.filePep(r.ctx); }

  @Get("pep/:personId")
  etatPep(@Req() r: any, @Param("personId") personId: string) { return this.pep.etatPep(r.ctx, personId); }
}
