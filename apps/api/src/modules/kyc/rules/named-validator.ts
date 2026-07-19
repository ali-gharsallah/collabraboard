/**
 * R2 — Visa lié à une PERSONNE NOMMÉE (+ R4 : relais nommé / dérogation tracée).
 *
 * Chaque section a un validateur nommé (une personne, pas un simple rôle). Seul
 * ce validateur résolu peut apposer le visa (R2). S'il est déclaré absent et
 * dispose d'un relais nommé, le relais devient le validateur résolu (R4). Un
 * tiers ne peut signer que sous dérogation explicite et tracée (décideur + fiche
 * de poste, R4). Port fidèle de workflow-engine-py/olive_engine/domain.py.
 */
export class NotAuthorized extends Error {
  readonly rule: string;
  constructor(message: string, rule = 'R2') { super(`[${rule}] ${message}`); this.rule = rule; }
}

export interface Derogation { decideur: string; fichePoste: string; }
export interface NvLogEntry { at: string; action: string; section?: string; validateur?: string; [k: string]: unknown; }

export class NamedValidator {
  private readonly validateurs = new Map<string, string>(); // section -> validateur nommé
  private readonly absences = new Set<string>();
  private readonly relais = new Map<string, string>();      // validateur -> relais nommé
  readonly log: NvLogEntry[] = [];

  assigner(section: string, validateur: string): void { this.validateurs.set(section, validateur); }
  definirRelais(validateur: string, relais: string): void { this.relais.set(validateur, relais); }
  declarerAbsent(validateur: string, at: Date): void {
    this.absences.add(validateur);
    this.log.push({ at: at.toISOString(), action: 'absence_declaree', validateur });
  }

  /** R2/R4 : validateur nommé, ou relais nommé si absent. */
  resoudreValidateur(section: string): string | undefined {
    const v = this.validateurs.get(section);
    if (v !== undefined && this.absences.has(v) && this.relais.has(v)) return this.relais.get(v); // R4
    return v;
  }

  peutViser(section: string, acteur: string, derogation?: Derogation): boolean {
    const v = this.resoudreValidateur(section);
    if (acteur === v) return true;
    return !!derogation; // R4 : dérogation tracée requise pour un tiers
  }

  /** Appose le visa. Lève NotAuthorized (R2) si l'acteur n'est pas le validateur résolu et sans dérogation. */
  viser(section: string, acteur: string, at: Date, derogation?: Derogation): string {
    const v = this.resoudreValidateur(section);
    if (acteur !== v && !derogation) {
      this.log.push({ at: at.toISOString(), action: 'visa_refuse_r2', section, validateur: v, tentative: acteur });
      throw new NotAuthorized(`${acteur} n'est pas le validateur nommé et aucune dérogation n'est fournie`, 'R2');
    }
    if (acteur !== v && derogation) {
      this.log.push({ at: at.toISOString(), action: 'derogation_prononcee', section, validateur: v,
        beneficiaire: acteur, decideur: derogation.decideur, ficheDePoste: derogation.fichePoste });
    }
    this.log.push({ at: at.toISOString(), action: 'visa', section, validateur: v, par: acteur });
    return acteur;
  }
}
