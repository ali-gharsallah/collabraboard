/**
 * R13 — Exclusion 4-yeux au niveau SECTION (+ R52 : contributeur exclu du visa final).
 *
 * Toucher un champ d'une section fait de vous un « préparateur » de CETTE section.
 * Un préparateur est exclu de la validation (visa) de sa propre section — mais
 * PAS des autres (exclusion limitée, V-03). Sur l'étape finale, TOUT contributeur
 * du dossier est exclu (R52, ratifié 2026-07-12). Toute tentative refusée est
 * tracée. Port fidèle de workflow-engine-py/olive_engine/domain.py (R13/R52).
 */
export class FourEyesViolation extends Error {
  readonly rule: string;
  constructor(message: string, rule = 'R13') { super(`[${rule}] ${message}`); this.rule = rule; }
}

export interface FeLogEntry { at: string; action: string; section: string; acteur: string; }

export class SectionFourEyes {
  private readonly preparateurs = new Map<string, Set<string>>(); // section -> contributeurs
  readonly log: FeLogEntry[] = [];

  constructor(private readonly finalStep = 'FINAL') {}

  private bucket(section: string): Set<string> {
    let s = this.preparateurs.get(section);
    if (!s) { s = new Set(); this.preparateurs.set(section, s); }
    return s;
  }

  /** R13 : toucher un champ fait de vous un préparateur de la section. */
  contribuer(section: string, acteur: string, at: Date): void {
    this.bucket(section).add(acteur);
    this.log.push({ at: at.toISOString(), action: 'contribution', section, acteur });
  }

  preparateursDe(section: string): string[] { return [...(this.preparateurs.get(section) ?? [])]; }

  contributeursDossier(): string[] {
    const u = new Set<string>();
    for (const s of this.preparateurs.values()) for (const a of s) u.add(a);
    return [...u];
  }

  peutViser(section: string, acteur: string): boolean {
    if (this.bucket(section).has(acteur)) return false;                    // R13
    if (section === this.finalStep && this.contributeursDossier().includes(acteur)) return false; // R52
    return true;
  }

  /** Appose le visa d'une section ; lève FourEyesViolation si exclu. */
  viser(section: string, acteur: string, at: Date): true {
    if (this.bucket(section).has(acteur)) {
      this.log.push({ at: at.toISOString(), action: 'visa_refuse_4yeux', section, acteur });
      throw new FourEyesViolation('Principe 4-yeux : préparateur exclu de la validation de sa section', 'R13');
    }
    if (section === this.finalStep && this.contributeursDossier().includes(acteur)) {
      this.log.push({ at: at.toISOString(), action: 'visa_final_refuse_contributeur', section, acteur });
      throw new FourEyesViolation('Contributeur du dossier exclu du visa de validation finale', 'R52');
    }
    this.log.push({ at: at.toISOString(), action: 'visa', section, acteur });
    return true;
  }
}
