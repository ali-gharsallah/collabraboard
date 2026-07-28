import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { PersonnesService } from "./personnes.service";

/**
 * Porte HTTP des personnes liées (Vague 3, écrans « Personnes liées / UBO » et « Change of
 * Circumstances »). Délégation PURE vers le domaine ratifié R30→R36 (P-01..08). Le backend
 * TRACE et PROPOSE, il n'exécute pas (invariant n°1) : le rattachement de rôle (R31), la
 * relation bijective (R34) et le CoC (R30/R42 : propagation aux dossiers + re-screening
 * DÉCLENCHÉ, jamais exécuté) sont des faits journalisés. Auteur = jeton (r.ctx).
 * NB écart : `PersonneLienService` (R152→R155) reste DORMANT (aucune route) — depuis le solde
 * A3 (2026-07-28) il est CONFORME au schéma réel (modèle `Person`, donnée dans `donnees` R30) ;
 * la chaîne de contrôle ratifiée exploitable reste celle de `PersonnesService`.
 */
@Controller("personnes")
export class PersonnesController {
  constructor(private svc: PersonnesService) {}
  @Post()                    creer(@Req() r: any, @Body() b: any) { return this.svc.creer(r.ctx, { nom: b?.nom, donnees: b?.donnees }); }
  @Post(":id/roles")         lier(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.lier(r.ctx, b?.kycFileId, id, b?.role); }          // R31
  @Post("relations")         relation(@Req() r: any, @Body() b: any) { return this.svc.declarerRelation(r.ctx, b?.aId, b?.bId, b?.typeAb, b?.typeBa); }         // R34
  @Get(":id/relations")      relations(@Req() r: any, @Param("id") id: string) { return this.svc.relationsDe(r.ctx, id); }
  @Post(":id/coc")           coc(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.changementCirconstances(r.ctx, id, b?.champ, b?.valeur, b?.document); } // R30/R42
  @Post(":id/corroboration") corrob(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.signalerDivergence(r.ctx, id, b?.champ, b?.constats ?? {}); }         // R36 (Vague 5)
}

@Module({ controllers: [PersonnesController], providers: [ PersonnesService], exports: [PersonnesService] })
export class PersonnesModule {}
