/**
 * R85 — Passage de main entre validateurs, section par section.
 *
 * Le validateur passe la main à l'étape suivante (nextStep) ou rend la main à
 * l'étape précédente (revenir). MESSAGE OBLIGATOIRE à chaque passage. Jusqu'à la
 * section de validation : valider ou rejeter (motif obligatoire, R7). Tout est
 * tracé (R48/R49) ; rien ne change d'état sans événement tracé (invariant moteur).
 * Port fidèle de olive_cpsi/kyc_handoff.py. Entité de domaine instanciée par KYC.
 */
export class HandoffError extends Error {}

export type HandoffStatus = 'en_cours' | 'valide' | 'rejete';

export interface HandoffLogEntry {
  at: string; action: string; phase: string; user: string; message: string;
  [k: string]: unknown;
}

export class KycHandoff {
  private idx = 0;
  status: HandoffStatus = 'en_cours';
  readonly log: HandoffLogEntry[] = [];
  private readonly phases: string[];

  constructor(phases: string[], idx = 0, status: HandoffStatus = 'en_cours') {
    if (!phases || phases.length === 0) throw new HandoffError('Au moins une phase requise');
    this.phases = [...phases];
    this.idx = Math.max(0, Math.min(idx, phases.length - 1));
    this.status = status;
  }

  private trace(at: Date, action: string, user: string, message: string, kw: Record<string, unknown> = {}): void {
    this.log.push({ at: at.toISOString(), action, phase: this.phases[this.idx], user, message, ...kw });
  }

  phaseCourante(): string { return this.phases[this.idx]; }
  estDerniere(): boolean { return this.idx >= this.phases.length - 1; }

  private exigeMessage(message: string, quoi: string): void {
    if (!message || !message.trim()) throw new HandoffError(`Message obligatoire ${quoi} (R85)`);
  }

  nextStep(user: string, message: string, at: Date): string {
    if (this.status !== 'en_cours') throw new HandoffError(`Dossier terminé (${this.status})`);
    this.exigeMessage(message, 'au passage de main');
    if (this.estDerniere()) throw new HandoffError('Dernière étape — utilisez valider() ou rejeter()');
    const de = this.phases[this.idx];
    this.idx += 1;
    this.trace(at, 'next_step', user, message.trim(), { de, a: this.phases[this.idx] });
    return this.phases[this.idx];
  }

  revenir(user: string, message: string, at: Date): string {
    if (this.status !== 'en_cours') throw new HandoffError(`Dossier terminé (${this.status})`);
    this.exigeMessage(message, 'au renvoi');
    if (this.idx === 0) throw new HandoffError('Déjà à la première étape');
    const de = this.phases[this.idx];
    this.idx -= 1;
    this.trace(at, 'revenir', user, message.trim(), { de, a: this.phases[this.idx] });
    return this.phases[this.idx];
  }

  valider(user: string, message: string, at: Date): HandoffStatus {
    if (this.status !== 'en_cours') throw new HandoffError(`Dossier terminé (${this.status})`);
    if (!this.estDerniere()) throw new HandoffError("La validation n'est possible qu'à la section de validation");
    this.exigeMessage(message, 'à la validation');
    this.status = 'valide';
    this.trace(at, 'validation', user, message.trim());
    return this.status;
  }

  rejeter(user: string, message: string, at: Date): HandoffStatus {
    if (this.status !== 'en_cours') throw new HandoffError(`Dossier terminé (${this.status})`);
    this.exigeMessage(message, 'au rejet'); // motif obligatoire (R7)
    this.status = 'rejete';
    this.trace(at, 'rejet', user, message.trim());
    return this.status;
  }
}
