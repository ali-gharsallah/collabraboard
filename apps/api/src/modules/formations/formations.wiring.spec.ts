/**
 * Câblage Formations & Certifications — GARDES RÉGLEMENTAIRES ⚠ de la vague R222–R238 (P-L2-2).
 * Portée : R232 (attestation GED obligatoire pour compléter), R234 (certifications/attestations
 * APPEND-ONLY, R49) et R235 (four-eyes de validation : bon rôle, jamais soi-même, R13). Faux-Prisma
 * en mémoire, auteur = jeton. Inverser une de ces gardes doit faire rougir au moins un test (gate L2).
 *
 * Harnais : compiler formations.module.ts + ce fichier ; exécuter le .js émis.
 */
import { FormationsService } from './formations.module';
declare const process: { exit(n: number): void };

let passed = 0, failed = 0; const fails: string[] = [];
function it(name: string, fn: () => Promise<void>): Promise<void> {
  return fn().then(() => { passed++; }, (e: Error) => { failed++; fails.push(`✗ ${name} — ${e.message}`); });
}
const ok = (c: boolean, m = 'assertion') => { if (!c) throw new Error(m); };
async function rejects(p: Promise<unknown>, part: string): Promise<void> {
  try { await p; } catch (e) { if ((e as Error).message.includes(part)) return;
    throw new Error(`attendu «${part}», obtenu «${(e as Error).message}»`); }
  throw new Error(`refus «${part}» attendu`);
}

function fakePrisma(seed: any = {}) {
  let seq = 0; const id = (p: string) => `${p}-${++seq}`;
  const db: any = { tenants: seed.tenants ?? [], assignments: seed.assignments ?? [], attestations: [],
    certifications: seed.certifications ?? [], users: seed.users ?? [], events: [] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]); return row[k] === v; });
  const table = (rows: any[], prefix: string) => ({
    findFirst: async ({ where }: any = {}) => rows.find((r) => match(r, where)) ?? null,
    findMany: async ({ where }: any = {}) => rows.filter((r) => match(r, where ?? {})),
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id); Object.assign(r, data); return r; },
  });
  const p: any = { _db: db,
    tenant: table(db.tenants, 'TEN'), trainingAssignment: table(db.assignments, 'ASG'),
    trainingAttestation: table(db.attestations, 'ATT'), certification: table(db.certifications, 'CERT'),
    user: table(db.users, 'USR'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; } },
  };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => {} } as any);
const tenant = (settings: any) => ({ id: 't1', settings });

(async () => {
  // ── R232 ⚠ — compléter EXIGE une attestation (GED) ──
  await it('R232 : compléter sans attestation (GED) → refus R232', async () => {
    const p = fakePrisma({ tenants: [tenant({})],
      assignments: [{ id: 'A1', tenantId: 't1', userId: 'u1', formationCode: 'F1', statut: 'ASSIGNED' }] });
    const s = new FormationsService(p, fakeAudit());
    await rejects(s.completer({ tenantId: 't1', userId: 'u1', role: 'CO' }, 'A1', {} as any), 'R232');
  });
  await it('R232 : compléter avec attestation → événement + attestation persistée', async () => {
    const p = fakePrisma({ tenants: [tenant({ trainingCompletionValidation: { mode: 'AUTO' } })],
      assignments: [{ id: 'A2', tenantId: 't1', userId: 'u1', formationCode: 'F1', statut: 'ASSIGNED' }] });
    const s = new FormationsService(p, fakeAudit());
    const maj: any = await s.completer({ tenantId: 't1', userId: 'u1', role: 'CO' }, 'A2', { attestationDocId: 'DOC-1' });
    ok(maj.statut === 'COMPLETED' && p._db.attestations.length === 1, 'attestation créée + AUTO → COMPLETED');
    ok(p._db.events.some((e: any) => e.type === 'training.completed'), 'événement training.completed émis');
  });

  // ── R234 ⚠ — certifications APPEND-ONLY : un renouvellement AJOUTE, n'écrase jamais (R49) ──
  await it('R234 : renouveler une certification → deux lignes, la première intacte (append-only)', async () => {
    const p = fakePrisma({ tenants: [tenant({})] });
    const s = new FormationsService(p, fakeAudit());
    const CTX = { tenantId: 't1', userId: 'admin', role: 'CO' };
    await s.certifier(CTX, { userId: 'u1', code: 'AML', obtenueLe: '2026-01-01', expireLe: '2027-01-01' });
    await s.certifier(CTX, { userId: 'u1', code: 'AML', obtenueLe: '2027-01-01', expireLe: '2028-01-01' });
    ok(p._db.certifications.length === 2, 'deux lignes (jamais d\'écrasement)');
    const v1 = p._db.certifications.find((c: any) => c.expireLe === '2027-01-01');
    ok(!!v1, 'la première certification reste intacte (expireLe 2027-01-01 conservé)');
  });

  // ── R235 ⚠ — validation en mode VALIDATED : bon rôle exigé, jamais soi-même (four-eyes, R13) ──
  await it('R235 : valider sa PROPRE complétion → refus (four-eyes)', async () => {
    const p = fakePrisma({ tenants: [tenant({ trainingCompletionValidation: { mode: 'VALIDATED' } })],
      assignments: [{ id: 'A3', tenantId: 't1', userId: 'val', formationCode: 'F1', statut: 'IN_PROGRESS', visaStatut: 'PENDING' }] });
    const s = new FormationsService(p, fakeAudit());
    await rejects(s.validerCompletion({ tenantId: 't1', userId: 'val', role: 'CO' }, 'A3'), 'TRAINING_SELF_VALIDATION_FORBIDDEN');
  });
  await it('R235 : valider avec un rôle non habilité → refus R235', async () => {
    const p = fakePrisma({ tenants: [tenant({ trainingCompletionValidation: { mode: 'VALIDATED', role: 'CO' } })],
      assignments: [{ id: 'A4', tenantId: 't1', userId: 'someone', formationCode: 'F1', statut: 'IN_PROGRESS', visaStatut: 'PENDING' }] });
    const s = new FormationsService(p, fakeAudit());
    await rejects(s.validerCompletion({ tenantId: 't1', userId: 'val', role: 'DIR' }, 'A4'), 'R235');
  });
  await it('R235 : bon rôle, un autre que l\'auteur → complétion validée (visa signé)', async () => {
    const p = fakePrisma({ tenants: [tenant({ trainingCompletionValidation: { mode: 'VALIDATED', role: 'CO' } })],
      assignments: [{ id: 'A5', tenantId: 't1', userId: 'someone', formationCode: 'F1', statut: 'IN_PROGRESS', visaStatut: 'PENDING' }] });
    const s = new FormationsService(p, fakeAudit());
    const maj: any = await s.validerCompletion({ tenantId: 't1', userId: 'val', role: 'CO' }, 'A5');
    ok(maj.visaStatut === 'SIGNED' && maj.statut === 'COMPLETED' && maj.visePar === 'val', 'validation four-eyes réussie, auteur = jeton');
  });

  // ── R231 — le catalogue est 100% tenant (aucun type en dur) ──
  await it('R231 : le catalogue reflète trainingCatalog du tenant (aucun type codé en dur)', async () => {
    const cat = [{ code: 'F1', libelle: 'AML' }, { code: 'F2', libelle: 'LSFin' }];
    const p = fakePrisma({ tenants: [tenant({ trainingCatalog: cat })] });
    const s = new FormationsService(p, fakeAudit());
    const r: any = await s.catalogue({ tenantId: 't1', userId: 'u1', role: 'CO' });
    ok(Array.isArray(r) && r.length === 2 && r[0].code === 'F1', 'catalogue = trainingCatalog du tenant');
  });

  // ── R233/R39 — rappels J-x informatifs (aucun blocage) ──
  await it('R233 : certif expirant à un seuil de rappel → événement training.reminder (jamais bloquant)', async () => {
    const p = fakePrisma({ tenants: [tenant({ trainingReminderDays: [30, 7] })],
      certifications: [{ id: 'C9', tenantId: 't1', userId: 'u1', code: 'AML', obtenueLe: '2025-01-31', expireLe: '2026-01-31' }] });
    const s = new FormationsService(p, fakeAudit());
    const r: any = await s.tickRappels({ tenantId: 't1', userId: 'sys', role: 'CO' }, '2026-01-01');   // J-30
    ok(r.rappels === 1 && p._db.events.some((e: any) => e.type === 'training.reminder' && e.payload.joursRestants === 30), 'un rappel J-30 émis');
  });

  // ── R236 — visibilité par profil : habilité voit tout, non habilité voit son périmètre ──
  await it('R236 : rôle habilité voit toutes les assignations ; non habilité ne voit que les siennes', async () => {
    const seed = { tenants: [tenant({ trainingVisibiliteRoles: ['CO'] })],
      assignments: [{ id: 'A6', tenantId: 't1', userId: 'u1', formationCode: 'F1', statut: 'ASSIGNED' },
                    { id: 'A7', tenantId: 't1', userId: 'u2', formationCode: 'F1', statut: 'ASSIGNED' }] };
    const pTout = fakePrisma(seed); const sTout = new FormationsService(pTout, fakeAudit());
    const tout: any[] = await sTout.assignations({ tenantId: 't1', userId: 'u9', role: 'CO' }, {});
    ok(tout.length === 2, 'habilité (CO) : voit les 2 assignations');
    const pMoi = fakePrisma(seed); const sMoi = new FormationsService(pMoi, fakeAudit());
    const moi: any[] = await sMoi.assignations({ tenantId: 't1', userId: 'u1', role: 'USER' }, {});
    ok(moi.length === 1 && moi[0].userId === 'u1', 'non habilité : ne voit que son périmètre (soi)');
  });

  // ── R238 — rejeu certifiant : « qui était certifié X au JJ » depuis l'historique append-only ──
  await it('R238 : certifications(asOf) répond la couverture à la date (true avant expiration, false après)', async () => {
    const p = fakePrisma({ tenants: [tenant({})],
      certifications: [{ id: 'C10', tenantId: 't1', userId: 'u1', code: 'AML', obtenueLe: '2026-01-01', expireLe: '2026-06-01' }] });
    const s = new FormationsService(p, fakeAudit());
    const dedans: any = await s.certifications({ tenantId: 't1', userId: 'x', role: 'CO' } as any, 'u1', '2026-03-01');
    const dehors: any = await s.certifications({ tenantId: 't1', userId: 'x', role: 'CO' } as any, 'u1', '2026-08-01');
    ok(dedans.certifie === true && dehors.certifie === false, 'couverture résolue à asOf depuis l\'historique');
  });

  console.log(`\nCâblage Formations (vague R231–R238, gardes ⚠ + cycle) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
