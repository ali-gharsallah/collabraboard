import { Injectable } from '@nestjs/common';

/**
 * R84 — Édition exclusive du dossier KYC (« la main » / checkout).
 *
 * Un dossier KYC en édition est détenu par UN SEUL intervenant à la fois. Les
 * autres ne peuvent le consulter que s'il est libéré (release). Sinon ils
 * demandent la main (requête tracée) ; le détenteur peut libérer ou passer la
 * main. Tout est journalisé (R48/R49). Port fidèle de olive_cpsi/kyc_lock.py.
 */
export class KycLockError extends Error {}

export interface LockLogEntry { at: string; action: string; [k: string]: unknown; }

@Injectable()
export class KycLockService {
  private readonly holders = new Map<string, string | null>();
  private readonly requests = new Map<string, string[]>();
  readonly log: LockLogEntry[] = [];

  private trace(at: Date, action: string, kw: Record<string, unknown> = {}): void {
    this.log.push({ at: at.toISOString(), action, ...kw });
  }

  // ── état ──
  detenteur(kycId: string): string | null { return this.holders.get(kycId) ?? null; }
  estLibere(kycId: string): boolean { return (this.holders.get(kycId) ?? null) === null; }
  peutConsulter(kycId: string, user: string): boolean {
    const h = this.holders.get(kycId) ?? null;
    return h === null || h === user;
  }
  demandeurs(kycId: string): string[] { return [...(this.requests.get(kycId) ?? [])]; }

  // ── actions ──
  prendreLaMain(kycId: string, user: string, at: Date): string {
    const h = this.holders.get(kycId) ?? null;
    if (h !== null && h !== user) throw new KycLockError(`Dossier détenu par ${h} — demandez la main`);
    this.holders.set(kycId, user);
    this.requests.set(kycId, (this.requests.get(kycId) ?? []).filter((u) => u !== user));
    this.trace(at, 'prise_de_main', { kyc: kycId, user });
    return user;
  }

  liberer(kycId: string, user: string, at: Date): null {
    const h = this.holders.get(kycId) ?? null;
    if (h !== user) throw new KycLockError(`Seul le détenteur (${h}) peut libérer`);
    this.holders.set(kycId, null);
    this.trace(at, 'liberation', { kyc: kycId, user });
    return null;
  }

  demanderLaMain(kycId: string, user: string, at: Date): { detenteur: string; demandeurs: string[] } {
    const h = this.holders.get(kycId) ?? null;
    if (h === null) throw new KycLockError('Dossier libre — prenez la main directement');
    if (h === user) throw new KycLockError('Vous détenez déjà le dossier');
    const reqs = this.requests.get(kycId) ?? [];
    if (!reqs.includes(user)) reqs.push(user);
    this.requests.set(kycId, reqs);
    this.trace(at, 'demande_de_main', { kyc: kycId, user, detenteur: h });
    return { detenteur: h, demandeurs: [...reqs] };
  }

  passerLaMain(kycId: string, de: string, a: string, at: Date): string {
    const h = this.holders.get(kycId) ?? null;
    if (h !== de) throw new KycLockError(`Seul le détenteur (${h}) peut passer la main`);
    this.holders.set(kycId, a);
    this.requests.set(kycId, (this.requests.get(kycId) ?? []).filter((u) => u !== a));
    this.trace(at, 'passage_de_main', { kyc: kycId, de, a });
    return a;
  }
}
