import { Controller, Get, Param, Req } from "@nestjs/common";
import { LedgerService } from "./ledger.service";
import { chargerProfils } from "./profils.loader";
import { PROFILS_DEFAUT_YAML } from "./profils.defaut";

/**
 * P-L7-5 — L'API RÉELLE du ledger (lecture seule, R44 : la vue ne décide rien).
 * Le front (RequirementChecklist) n'affiche QUE ces réponses — aucune valeur fabriquée
 * côté écran (leçon L6-3). Profils chargés PAR REQUÊTE depuis le YAML gouverné (C8).
 */
@Controller("v1/inference")
export class InferenceController {
  constructor(private svc: LedgerService) {}

  @Get(":kycId/ledger")
  async ledger(@Req() r: any, @Param("kycId") kycId: string) {
    const profils = chargerProfils(PROFILS_DEFAUT_YAML);
    const { profil, ledger } = await this.svc.ledger(r.ctx, kycId, profils);
    const statuts = ledger.statuts();
    return { profil, statuts, gap: ledger.gap() };
  }

  @Get(":kycId/explain/:rid")
  async explain(@Req() r: any, @Param("kycId") kycId: string, @Param("rid") rid: string) {
    const profils = chargerProfils(PROFILS_DEFAUT_YAML);
    const { ledger } = await this.svc.ledger(r.ctx, kycId, profils);
    return ledger.explain(rid);
  }
}
