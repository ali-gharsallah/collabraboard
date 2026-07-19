import { Injectable } from '@nestjs/common';

/**
 * R86 — Visa qualifié : verdict + message (extension du visa uniforme R15).
 *
 * Apposer un visa rend un verdict — OK (favorable), CONDITIONAL (sous condition)
 * ou NOK (défavorable) — et un message. Un verdict NOK ou CONDITIONAL EXIGE un
 * message justificatif ; OK peut rester sans message. Le visa reste un objet
 * uniforme, apposable/retirable par son seul signataire, entièrement tracé
 * (R48/R49). Un NOK est bloquant. Port fidèle de olive_cpsi/kyc_visa.py.
 */
export type Verdict = 'OK' | 'CONDITIONAL' | 'NOK';
export const VERDICTS: ReadonlySet<Verdict> = new Set(['OK', 'CONDITIONAL', 'NOK']);

export class VisaError extends Error {}

export interface Visa {
  by: string; role: string; verdict: Verdict; message: string; at: string; valid: boolean;
}
export interface VisaLogEntry { at: string; action: string; cle: string; user: string; [k: string]: unknown; }

@Injectable()
export class QualifiedVisaService {
  private readonly visas = new Map<string, Visa>();
  readonly log: VisaLogEntry[] = [];

  apposer(cle: string, user: string, role: string, verdict: Verdict, message: string, at: Date): Visa {
    if (!VERDICTS.has(verdict)) throw new VisaError(`Verdict invalide : ${JSON.stringify(verdict)}`);
    if ((verdict === 'NOK' || verdict === 'CONDITIONAL') && !(message && message.trim())) {
      throw new VisaError(`Un visa ${verdict} exige un message justificatif (R86)`);
    }
    const v: Visa = {
      by: user, role, verdict, message: (message || '').trim(), at: at.toISOString(), valid: true,
    };
    this.visas.set(cle, v);
    this.log.push({ at: at.toISOString(), action: 'visa', cle, user, verdict, message: v.message });
    return v;
  }

  retirer(cle: string, user: string, at: Date): null {
    const v = this.visas.get(cle);
    if (!v) throw new VisaError('Aucun visa à retirer');
    if (v.by !== user) throw new VisaError(`Seul le signataire (${v.by}) peut retirer son visa`);
    this.visas.delete(cle);
    this.log.push({ at: at.toISOString(), action: 'retrait_visa', cle, user });
    return null;
  }

  verdict(cle: string): Verdict | null { return this.visas.get(cle)?.verdict ?? null; }
  bloquant(cle: string): boolean { return this.verdict(cle) === 'NOK'; }
}
