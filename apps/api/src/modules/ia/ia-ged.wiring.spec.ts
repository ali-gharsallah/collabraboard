/**
 * Câblage IA au service du dossier — AI-01..06 (R160→R163). Miroir strict de l'amendement.
 * L'IA emprunte l'habilitation ; toute production est un dérivé signé ; elle propose et
 * l'humain dispose ; le prestataire est un port à résidence contrôlée.
 * Faux Prisma en mémoire. Écrit AVANT l'implémentation.
 *
 * Harnais : compiler ia-ged.service.ts + ce fichier ;
 *   echo "── Câblage IA dossier (AI-01..06, R160→R163) ──"; run ia-ged.wiring.spec.js
 */
import { IaGedService } from './ia-ged.service';
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
  const db = { tenants: seed.tenants ?? [], documents: seed.documents ?? [],
    versions: seed.versions ?? [], productions: [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
    if (v === null) return row[k] == null;
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    if (v && typeof v === 'object' && 'not' in v) return row[k] !== v.not && row[k] != null;
    return row[k] === v;
  });
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((x) => match(x, where)),
    findFirst: async ({ where }: any = {}) => rows.find((x) => match(x, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
  });
  const p: any = { _db: db, tenant: table(db.tenants, 'T'), document: table(db.documents, 'D'),
    documentVersion: table(db.versions, 'V'), iaProduction: table(db.productions, 'P'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
function fakePort(residence = 'CH') {
  const appels: any[] = [];
  return { _appels: appels, modele: 'claude-sonnet-4-6', version: '2026-06', residence,
    completer: async (question: string, contexte: string[]) => {
      appels.push({ question, contexte });
      return { texte: `RÉPONSE[${contexte.length} docs]`, confiance: 0.87 };
    } };
}
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);

const CF = { tenantId: 't1', userId: 'c.fiore', role: 'CF' };
const RM = { tenantId: 't1', userId: 'a.gharsallah', role: 'RM' };
const seedDocs = () => ({
  tenants: [{ id: 't1', name: 'GWB', settings: { gedDocTypes: [
    { code: 'PASSEPORT', rolesAutorises: ['RM', 'CO', 'CF'] },
    { code: 'FISCAL', rolesAutorises: ['CF'] }], gedInboxRoles: ['CO', 'CF'] } }],
  documents: [
    { id: 'd1', tenantId: 't1', clientId: 'cli-1', typeCode: 'PASSEPORT', statut: 'ACTIF', nom: 'passeport.pdf' },
    { id: 'd2', tenantId: 't1', clientId: 'cli-1', typeCode: 'FISCAL', statut: 'ACTIF', nom: 'fiscal.pdf' },
    { id: 'd3', tenantId: 't1', clientId: 'cli-1', typeCode: null, statut: 'A_CLASSER', nom: 'courrier.pdf' }],
  versions: [
    { id: 'v1', tenantId: 't1', documentId: 'd1', numero: 1, ocrDerives: [{ texte: 'Passeport Dupont expire 2031', sha256Derive: sha('p') }] },
    { id: 'v2', tenantId: 't1', documentId: 'd2', numero: 1, ocrDerives: [{ texte: 'Attestation fiscale Dupont', sha256Derive: sha('f') }] },
    { id: 'v3', tenantId: 't1', documentId: 'd3', numero: 1, ocrDerives: [{ texte: 'Courrier entrant Dupont', sha256Derive: sha('c') }] }],
});
const mk = (port?: any, residence = 'CH') => {
  const p = fakePrisma(seedDocs());
  if (residence !== 'CH') (p as any)._db.tenants[0].settings.iaResidence = residence;
  const s = new IaGedService(p, fakeAudit(), port === null ? {} : { ia: port ?? fakePort() });
  return { p, s };
};

(async () => {
  // ── AI-01 (R163) — pas de port, pas de réponse ; mauvaise résidence, refus tracé ──
  await it('AI-01 sans port → refus R163 ; port US vs tenant CH → refus tracé, RIEN servi au modèle', async () => {
    const { s } = mk(null);
    await rejects(s.interroger(CF, 'cli-1', 'Le passeport expire quand ?'), 'R163');
    const portUS = fakePort('US');
    const w = mk(portUS);
    await rejects(w.s.interroger(CF, 'cli-1', 'question'), 'résidence');
    ok(portUS._appels.length === 0, 'RIEN n\'a été servi au modèle');
    ok(evts(w.p, 'ia.acces.refuse').length === 1, 'le refus de résidence est un fait de conformité, tracé');
  });

  // ── AI-02 (R160) — deux rôles, deux contextes, deux réponses ──
  await it('AI-02 CF : le modèle reçoit 3 docs ; RM même question : 1 seul — le FISCAL n\'existe pas pour son IA non plus', async () => {
    const port = fakePort();
    const { p, s } = mk(port);
    await s.interroger(CF, 'cli-1', 'Résume le dossier');
    await s.interroger(RM, 'cli-1', 'Résume le dossier');
    ok(port._appels[0].contexte.length === 3, 'CF : PASSEPORT + FISCAL + A_CLASSER (rôle d\'arrivée)');
    ok(port._appels[1].contexte.length === 1
      && port._appels[1].contexte[0].includes('Passeport'), 'RM : le passeport SEUL');
    ok(p._db.productions[0].shaContexte !== p._db.productions[1].shaContexte, 'deux contextes, deux empreintes');
    ok(!JSON.stringify(evts(p, 'ia.production')).includes('Attestation'), 'la trace référence, elle ne recopie pas');
  });

  // ── AI-03 (R161) — la production se vérifie ──
  await it('AI-03 production = (modèle, version, shaContexte, shaSortie) recalculables ; même contexte ⇒ même empreinte', async () => {
    const port = fakePort();
    const { p, s } = mk(port);
    const r1: any = await s.interroger(CF, 'cli-1', 'Q1');
    const prod = p._db.productions[0];
    ok(prod.modele === 'claude-sonnet-4-6' && prod.versionModele === '2026-06', 'le modèle est signé');
    ok(prod.shaSortie === sha(prod.sortie), 'l\'empreinte de sortie se recalcule');
    ok(prod.shaContexte === sha(port._appels[0].contexte.join('\n---\n')), 'l\'empreinte du contexte se recalcule');
    await s.interroger(CF, 'cli-1', 'Q2');
    ok(p._db.productions[1].shaContexte === prod.shaContexte, 'même dossier, même rôle ⇒ même contexte, même empreinte');
    ok(r1.productionId === prod.id, 'la réponse porte sa référence de production');
  });

  // ── AI-04 (R162) — la proposition ne touche pas le monde ──
  await it('AI-04 proposerClassement : proposition tracée (type, confiance), le document RESTE A_CLASSER', async () => {
    const { p, s } = mk();
    const r: any = await s.proposerClassement(CF, 'd3');
    ok(r.propositionId && p._db.productions[0].type === 'PROPOSITION', 'proposition enregistrée');
    ok(p._db.productions[0].confiance === 0.87, 'la confiance est portée');
    ok(p._db.documents[2].statut === 'A_CLASSER' && p._db.documents[2].typeCode === null, 'le document n\'a PAS bougé');
    ok(evts(p, 'ia.proposition').length === 1, 'tracée');
  });

  // ── AI-05 (R162) — la décision est humaine, l'écart est mesuré ──
  await it('AI-05 accepter = acte jeton ; rejeter sans motif → R7 ; motivé → rejet tracé + écart mesuré UNE fois', async () => {
    const { p, s } = mk();
    const r: any = await s.proposerClassement(CF, 'd3');
    await s.decider(CF, r.propositionId, 'ACCEPTEE');
    ok(p._db.productions[0].decision === 'ACCEPTEE' && p._db.productions[0].decidePar === 'c.fiore', 'l\'acte est humain, jeton');
    const r2: any = await s.proposerClassement(CF, 'd3');
    await rejects(s.decider(CF, r2.propositionId, 'REJETEE', ''), 'R7');
    await s.decider(CF, r2.propositionId, 'REJETEE', 'Type erroné — c\'est un courrier client');
    ok(evts(p, 'ia.ecart').length === 1, 'l\'écart humain-vs-IA est MESURÉ (R39 — jamais coercé)');
    await rejects(s.decider(CF, r2.propositionId, 'ACCEPTEE'), 'déjà décidée');
  });

  // ── AI-06 (garde R160) — le tenant est structurel ──
  await it('AI-06 t2 interroge : contexte VIDE — structurel, pas filtré', async () => {
    const port = fakePort();
    const { s } = mk(port);
    await s.interroger({ tenantId: 't2', userId: 'x', role: 'CF' }, 'cli-1', 'question');
    ok(port._appels[0].contexte.length === 0, 'aucun document d\'un autre tenant, jamais');
  });

  console.log(`\nCâblage IA dossier (AI-01..06, R160→R163) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
