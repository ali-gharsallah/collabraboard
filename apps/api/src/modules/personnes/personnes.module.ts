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
  // ── ADR-PEP-001 (P-L4-1) : la DÉCISION PEP est humaine et passe par ces chemins — sourceHitId
  //    optionnel = trace liante vers la proposition issue d'un hit (le hit propose, jamais ne bascule).
  @Post(":id/pep")           pep(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.declarerPep(r.ctx, id, b?.source, b?.sourceHitId); }                     // R32
  @Post(":id/pep/lever")     depep(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.leverPep(r.ctx, id, b?.sourceHitId); }                                 // R33
  @Post("pep/propositions/rejeter") rejetPep(@Req() r: any, @Body() b: any) { return this.svc.rejeterPropositionPep(r.ctx, b?.cle, b?.motif); }                                     // R7
}

@Module({ controllers: [PersonnesController], providers: [ PersonnesService], exports: [PersonnesService] })
export class PersonnesModule {}
