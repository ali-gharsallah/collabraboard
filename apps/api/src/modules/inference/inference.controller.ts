import { Controller, Get, Param, Req, NotFoundException } from "@nestjs/common";
import { LedgerService } from "./ledger.service";
import { chargerProfils } from "./profils.loader";
import { PROFILS_DEFAUT_YAML } from "./profils.defaut";
import { ProfilIntrouvable } from "./profils.resolver";

/**
 * P-L7-5 — L'API RÉELLE du ledger (lecture seule, R44 : la vue ne décide rien).
 * Le front (RequirementChecklist) n'affiche QUE ces réponses — aucune valeur fabriquée
 * côté écran (leçon L6-3). Profils chargés PAR REQUÊTE depuis le YAML gouverné (C8).
 *
 * V2-M47 — « aucun profil applicable » est un REFUS, pas un incident serveur. Le résolveur
 * lève franchement quand aucun CompletionProfile ne couvre (entityType, juridiction) : c'est
 * voulu (P-L7-1 — pas d'exigences « par défaut » silencieuses). Mais laisser cette erreur
 * remonter en 500 rendait l'écran muet : « Internal server error » là où l'utilisateur doit
 * lire QUELLE paire n'est pas couverte, pour la faire publier au référentiel. Le message du
 * résolveur est conservé mot pour mot — l'écran l'affiche tel quel (FE-04).
 */
@Controller("inference")
export class InferenceController {
  constructor(private svc: LedgerService) {}

  private async ledgerOuRefus(ctx: any, kycId: string) {
    try {
      return await this.svc.ledger(ctx, kycId, chargerProfils(PROFILS_DEFAUT_YAML));
    } catch (e) {
      if (e instanceof ProfilIntrouvable) throw new NotFoundException((e as Error).message);
      throw e;
    }
  }

  @Get(":kycId/ledger")
  async ledger(@Req() r: any, @Param("kycId") kycId: string) {
    const { profil, ledger } = await this.ledgerOuRefus(r.ctx, kycId);
    return { profil, statuts: ledger.statuts(), gap: ledger.gap() };
  }

  @Get(":kycId/explain/:rid")
  async explain(@Req() r: any, @Param("kycId") kycId: string, @Param("rid") rid: string) {
    const { ledger } = await this.ledgerOuRefus(r.ctx, kycId);
    return ledger.explain(rid);
  }
}
