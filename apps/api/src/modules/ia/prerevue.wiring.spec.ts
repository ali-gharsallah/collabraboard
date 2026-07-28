/**
 * Câblage Agent de pré-revue IA — AG-01..AG-06 (R121→R124). Miroir strict de l'amendement.
 * Le FAUX PORT IA CAPTURE son entrée : c'est lui qui prouve la minimisation/pseudonymisation.
 * Réflexe R119 : les statuts KYC copiés depuis l'enum réelle (UNDER_REVIEW, VALIDATED…).
 *
 * Harnais : compiler prerevue.service.ts + ce fichier ;
 *   echo "── Câblage pré-revue IA (AG-01..06, R121→R124) ──"; run prerevue.wiring.spec.js
 */
import { PreRevueService } from './prerevue.service';
import { createHash } from 'crypto';
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
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function fakePrisma(seed: any = {}) {
  let seq = 0; const id = (p: string) => `${p}-${++seq}`;
  const db = { tenants: seed.tenants ?? [], kycs: seed.kycs ?? [], sections: seed.sections ?? [],
    clients: seed.clients ?? [], prerevues: [] as any[], prompts: [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
    if (v === null) return row[k] == null;
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    return row[k] === v;
  });
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where, orderBy }: any = {}) => {
      let r = rows.filter((x) => match(x, where));
      if (orderBy?.numero === 'desc') r = r.slice().sort((a, b) => b.numero - a.numero);
      return r;
    },
    findFirst: async ({ where, orderBy }: any = {}) => {
      let r = rows.filter((x) => match(x, where));
      if (orderBy?.numero === 'desc') r = r.slice().sort((a, b) => b.numero - a.numero);
      return r[0] ?? null;
    },
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
  });
  const p: any = { _db: db,
    tenant: table(db.tenants, 'T'), kycFile: table(db.kycs, 'K'), kycSection: table(db.sections, 'S'),
    client: table(db.clients, 'C'),
    iaPrerevue: table(db.prerevues, 'PR'), iaPromptVersion: table(db.prompts, 'PV'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);

const CO = { tenantId: 't1', userId: 'i.vernet', role: 'CO' };
/** Faux port IA : CAPTURE l'instantané reçu, rend des points typés. */
function fakeIa() {
  const recus: any[] = [];
  return { _recus: recus,
    prerevue: async (snapshot: any, prompt: string) => {
      recus.push({ snapshot, prompt });
      return { modele: 'claude-sonnet-4-6', points: [
        { type: 'MANQUANT', section: 'SOURCE_FONDS', detail: 'Justificatif d\'origine absent' },
        { type: 'CONTRADICTION', section: 'ACTIVITE', detail: 'CA déclaré incohérent avec la taille' },
        { type: 'QUESTION', section: 'BENEF_EFF', detail: 'Confirmer le contrôle effectif >25%' },
      ] };
    } };
}
// Enum KYC RÉELLE (réflexe R119) : IN_PROGRESS | UNDER_REVIEW | VALIDATED | REJECTED
const mk = (opts: any = {}) => {
  const p = fakePrisma({
    tenants: [{ id: 't1', name: 'GWB', settings: opts.settings ?? {} }],
    // Schéma RÉEL (solde A3, 2026-07-28) : le nom vit sur le CLIENT (Client.name), les
    // réponses sur les QUESTIONS des sections — les champs fantômes masquaient l'anomalie.
    kycs: [{ id: 'k1', tenantId: 't1', clientId: 'c1', status: 'UNDER_REVIEW', riskLevel: 'MEDIUM' }],
    clients: [{ id: 'c1', tenantId: 't1', name: 'Dupont Holding SA' }],
    sections: [
      { id: 's1', tenantId: 't1', kycFileId: 'k1', code: 'SOURCE_FONDS',
        questions: [{ code: 'SF-Q1', answer: 'héritage' }] },
      { id: 's2', tenantId: 't1', kycFileId: 'k1', code: 'ACTIVITE',
        questions: [{ code: 'AC-Q1', answer: '80M CHF' }] }],
  });
  const ia = opts.sansPort ? undefined : fakeIa();
  return { p, ia, s: new PreRevueService(p, fakeAudit(), { ia }) };
};
const snap = (p: any) => JSON.stringify(p._db.kycs[0]) + JSON.stringify(p._db.sections);

(async () => {
  // ── AG-01 (R121) — l'IA lit, le dossier ne bouge pas ──
  await it('AG-01 pré-revue → port appelé, points typés rattachés aux sections, dossier INTACT', async () => {
    const { p, ia, s } = mk();
    const avant = snap(p);
    const r: any = await s.demander(CO, 'k1');
    ok(ia!._recus.length === 1, 'port appelé');
    ok(r.points.length === 3 && r.points.every((x: any) => ['MANQUANT','CONTRADICTION','QUESTION'].includes(x.type) && !!x.section), 'points typés + sections');
    ok(evts(p, 'ia.prerevue.produite').length === 1, 'événement');
    ok(snap(p) === avant, 'dossier STRICTEMENT intact (statut, sections)');
    ok(p._db.prerevues.length === 1, 'trace append-only créée');
  });

  // ── AG-02 (R121) — pas de port, pas de fonction ──
  await it('AG-02 sans port IA → refus explicite, AUCUNE trace', async () => {
    const { p, s } = mk({ sansPort: true });
    await rejects(s.demander(CO, 'k1'), 'port IA');
    ok(p._db.prerevues.length === 0 && evts(p, 'ia.prerevue.produite').length === 0, 'aucune trace');
  });

  // ── AG-03 (R122) — la trace se relit telle quelle, sans appel au port ──
  await it('AG-03 relire → empreinte entrée + modèle + version prompt + sortie + latence, port NON rappelé', async () => {
    const { p, ia, s } = mk();
    await s.versionnerPrompt(CO, 'Tu es le pré-lecteur compliance…');
    const r: any = await s.demander(CO, 'k1');
    const lu: any = await s.relire(CO, r.prerevueId);
    ok(ia!._recus.length === 1, 'relire ne rappelle PAS le port');
    ok(/^[0-9a-f]{64}$/.test(lu.snapshotSha256), 'empreinte de l\'entrée');
    ok(lu.modele === 'claude-sonnet-4-6' && lu.promptVersion === 1, 'modèle + version du prompt');
    ok(lu.points.length === 3 && typeof lu.latenceMs === 'number', 'sortie intégrale + latence');
  });

  // ── AG-04 (R123) — écarter se motive ──
  await it('AG-04 point ÉCARTÉ sans motif → R7 ; motivé et TRAITÉ → tracés (jeton)', async () => {
    const { p, s } = mk();
    const r: any = await s.demander(CO, 'k1');
    await rejects(s.traiterPoint(CO, r.prerevueId, 0, 'ECARTE', ''), 'R7');
    await s.traiterPoint(CO, r.prerevueId, 0, 'ECARTE', 'Justificatif reçu hors GED, classé au dossier papier — à numériser');
    await s.traiterPoint(CO, r.prerevueId, 1, 'TRAITE');
    ok(evts(p, 'ia.point.ecarte').length === 1 && evts(p, 'ia.point.ecarte')[0].payload.par === 'i.vernet', 'écart motivé, jeton');
    ok(evts(p, 'ia.point.traite').length === 1, 'traitement tracé');
  });

  // ── AG-05 (R123) — bloquant seulement si la banque le veut ──
  await it('AG-05 défaut (false) : points ouverts → rien n\'empêche le visa', async () => {
    const { s } = mk();
    const r: any = await s.demander(CO, 'k1');
    const v: any = await s.verifierTraitement(CO, 'k1');
    ok(v.bloquant === false && v.ouverts.length === 3, 'constate sans bloquer (R39)');
  });
  await it('AG-05 tenant l\'exige (true) : points ouverts listés, bloquant=true — le moteur appelant bloque', async () => {
    const { s } = mk({ settings: { iaPrerevueTraitementRequis: true } });
    const r: any = await s.demander(CO, 'k1');
    await s.traiterPoint(CO, r.prerevueId, 0, 'TRAITE');
    const v: any = await s.verifierTraitement(CO, 'k1');
    ok(v.bloquant === true && v.ouverts.length === 2, 'la GED-mécanique : constat ici, blocage chez l\'appelant');
  });

  // ── AG-06 (R124) — le nom ne sort pas, le prompt ne change pas en silence ──
  await it('AG-06 pseudonymisation (défaut) : le snapshot transmis ne contient PAS le nom réel', async () => {
    const { ia, s } = mk();
    await s.demander(CO, 'k1');
    const transmis = JSON.stringify(ia!._recus[0].snapshot);
    ok(!transmis.includes('Dupont Holding SA'), 'nom réel absent de ce qui part au port');
    ok(/CLIENT-[0-9a-f]{8}/.test(transmis), 'alias stable présent');
  });
  await it('AG-06 pseudonymisation désactivable (tenant) + prompt versionné = événement', async () => {
    const { p, ia, s } = mk({ settings: { iaPseudonymise: false } });
    await s.versionnerPrompt(CO, 'v1 du prompt');
    await s.versionnerPrompt(CO, 'v2 du prompt — ton plus prudent');
    ok(evts(p, 'ia.prompt.versionne').length === 2, 'chaque changement de prompt tracé');
    ok(p._db.prompts.map((x: any) => x.numero).join(',') === '1,2', 'registre append-only versionné');
    await s.demander(CO, 'k1');
    ok(JSON.stringify(ia!._recus[0].snapshot).includes('Dupont Holding SA'), 'tenant peut désactiver (R-Q)');
    ok(ia!._recus[0].prompt === 'v2 du prompt — ton plus prudent', 'la DERNIÈRE version du prompt est utilisée');
  });

  // ── garde transverse ──
  await it('R121 isolation tenant : dossier d\'un autre tenant introuvable', async () => {
    const { s } = mk();
    await rejects(s.demander({ ...CO, tenantId: 't2' }, 'k1'), 'introuvable');
  });

  console.log(`\nCâblage pré-revue IA (AG-01..06, R121→R124) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
