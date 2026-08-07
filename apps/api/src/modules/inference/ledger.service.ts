import { Injectable } from "@nestjs/common";
import { CaseFactsReader } from "./case-facts.reader";
import { CompletionProfile } from "./types";
import { resoudreProfil } from "./profils.resolver";
import { RequirementLedger } from "./requirement-ledger";

/**
 * P-L7-3 — LedgerService : la façade DI. Sans état (C8) : chaque appel LIT le dossier
 * (CaseFactsReader), résout le profil (fallback juridiction) et instancie un RequirementLedger
 * ÉPHÉMÈRE. Les profils sont FOURNIS par l'appelant (chargés du YAML gouverné — le miroir des
 * règles arrive en P-L7-4 ; l'API réelle en P-L7-5).
 */
@Injectable()
export class LedgerService {
  constructor(private reader: CaseFactsReader) {}

  async ledger(ctx: { tenantId: string }, kycFileId: string, profils: CompletionProfile[],
    now: Date = new Date()): Promise<{ profil: string; ledger: RequirementLedger }> {
    const lecture = await this.reader.lire(ctx, kycFileId, now);
    const profil = resoudreProfil(profils, {
      entityType: lecture.facts.entityType, jurisdiction: lecture.facts.jurisdiction });
    return { profil: profil.profil, ledger: new RequirementLedger(profil, lecture, now) };
  }
}
