/**
 * Câblage Adaptateur Claude — CL-01..05. AUCUNE règle nouvelle : R44/R121/R138/R188 en
 * CHAIR — le port IA réel, prouvé sans réseau (transport simulé). Résout au passage
 * l'import fantôme de prerevue.schema-controller-adapter. Écrit AVANT l'adaptateur.
 *
 * Harnais : compiler ../adapters/claude-ia.adapter.ts + ce fichier ;
 *   echo "── Câblage Adaptateur Claude (CL-01..05, R44/R138/R188) ──"; run claude-ia.wiring.spec.js
 */
import { claudeIaAdapter } from '../../adapters/claude-ia.adapter';
import { CrmService } from './crm.service';
declare const process: { exit(n: number): void; env: any };

let passed = 0, failed = 0; const fails: string[] = [];
function it(name: string, fn: () => Promise<void>): Promise<void> {
  return fn().then(() => { passed++; }, (e: Error) => { failed++; fails.push(`✗ ${name} — ${e.message}`); });
}
const ok = (c: boolean, m = 'assertion') => { if (!c) throw new Error(m); };
async function rejects(p: Promise<unknown> | (() => unknown), part: string): Promise<string> {
  try { if (typeof p === 'function') await (p as any)(); else await p; }
  catch (e) { const msg = (e as Error).message; if (msg.includes(part)) return msg;
    throw new Error(`attendu «${part}», obtenu «${msg}»`); }
  throw new Error(`refus «${part}» attendu`);
}
function fakePrisma(seed: any = {}) {
  let seq = 0; const id = (p: string) => `${p}-${++seq}`;
  const db = { tenants: seed.tenants ?? [], clients: seed.clients ?? [], documents: [] as any[],
    tasks: [] as any[], crmContacts: [] as any[], events: seed.events ?? [] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => row[k] === v);
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((x) => match(x, where)),
    findFirst: async ({ where }: any = {}) => rows.find((x) => match(x, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
  });
  const p: any = { _db: db, tenant: table(db.tenants, 'T'), client: table(db.clients, 'C'),
    document: table(db.documents, 'D'), task: table(db.tasks, 'K'), crmContact: table(db.crmContacts, 'CT'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const RM = { tenantId: 't1', userId: 'u-rm1', role: 'RM' };
const CLE = 'sk-ant-test-XyZ123';

// ── API Anthropic simulée : capture les requêtes, réponses programmables ──
function fauxAnthropic() {
  const etat = { requetes: [] as any[], reponse: null as any, statut: 200, panne: false };
  const transport = async (url: string, init: any) => {
    etat.requetes.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    if (etat.panne) throw new Error('ETIMEDOUT api.anthropic.com ' + CLE);   // un transport bavard — l'adaptateur doit masquer
    if (etat.statut !== 200) return { status: etat.statut, text: async () => '' };
    return { status: 200, text: async () => JSON.stringify({ model: init ? JSON.parse(init.body).model : '',
      content: [{ type: 'text', text: etat.reponse }] }) };
  };
  return { etat, transport };
}
const ENTRETIENS = [{ type: 'VISITE', champs: ['participants', 'sujets'] }];
const mkCrm = (ia: any) => {
  const p = fakePrisma({
    tenants: [{ id: 't1', name: 'GWB', settings: {
      crmEntretiens: [{ type: 'VISITE', champsObligatoires: ['participants', 'sujets'] }],
      rolesVisibiliteEtendue: ['CO', 'CF'] } }],
    clients: [{ id: 'cli-dupont', tenantId: 't1', name: 'Jean Dupont', rmUserId: 'u-rm1' }],
    events: [{ tenantId: 't1', type: 'kyc.dossier.approuve', aggregateId: 'cli-dupont', payload: {}, at: '2026-06-01T10:00:00Z' }] });
  return { p, s: new CrmService(p, fakeAudit(), { ia }) };
};

(async () => {
  // ── CL-01 (R138) — pas de clé, pas de port ──
  await it('CL-01 sans ANTHROPIC_API_KEY → la factory refuse — jamais de simulation', async () => {
    const avait = process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_API_KEY;
    await rejects(() => claudeIaAdapter({}), 'ANTHROPIC_API_KEY');
    if (avait) process.env.ANTHROPIC_API_KEY = avait;
  });

  // ── CL-02 (R188) — l'appel réel : modèle, en-têtes, champs du type au prompt, JSON parsé ──
  await it('CL-02 preRemplir : x-api-key en EN-TÊTE, champs du type dans le system, JSON fencé parsé, moteur signé', async () => {
    const api = fauxAnthropic();
    api.etat.reponse = '```json\n{"participants": "J. Dupont, RM", "sujets": "Suivi du dossier"}\n```';
    const ia = claudeIaAdapter({ apiKey: CLE, entretiens: ENTRETIENS }, api.transport);
    const contenu = await ia.preRemplir({ clientId: 'cli-dupont', type: 'VISITE', timeline: [], gestes: [] });
    ok(contenu.participants === 'J. Dupont, RM', 'le brouillon est parsé');
    const req = api.etat.requetes[0];
    ok(req.url.endsWith('/v1/messages') && !req.url.includes(CLE), 'endpoint propre, secret jamais dans l\'URL');
    ok(req.headers['x-api-key'] === CLE && !!req.headers['anthropic-version'], 'le secret voyage en en-tête, la version est déclarée');
    ok(req.body.system.includes('participants, sujets') && req.body.system.includes('LSFin'), 'les champs du type et la trace du conseil sont AU PROMPT');
    ok(ia.moteur === 'claude-sonnet-4-6' && !!ia.residence, 'le moteur est signé, la résidence est dite (R121)');
  });

  // ── CL-03 — la réponse inexploitable ne se bricole pas ──
  await it('CL-03 réponse non-JSON → erreur explicite ; champ manquant → erreur explicite — l\'humain reprend', async () => {
    const api = fauxAnthropic();
    const ia = claudeIaAdapter({ apiKey: CLE, entretiens: ENTRETIENS }, api.transport);
    api.etat.reponse = 'Voici un brouillon : bla bla';
    await rejects(ia.preRemplir({ clientId: 'c', type: 'VISITE', timeline: [], gestes: [] }), 'inexploitable');
    api.etat.reponse = '{"participants": "X"}';
    await rejects(ia.preRemplir({ clientId: 'c', type: 'VISITE', timeline: [], gestes: [] }), 'sujets');
  });

  // ── CL-04 — l'indisponibilité est explicite, le secret ne fuit jamais ──
  await it('CL-04 429/panne → « indisponible » explicite ; le secret masqué même si le transport le crache', async () => {
    const api = fauxAnthropic();
    const ia = claudeIaAdapter({ apiKey: CLE, entretiens: ENTRETIENS }, api.transport);
    api.etat.statut = 429;
    const m1 = await rejects(ia.preRemplir({ clientId: 'c', type: 'VISITE', timeline: [], gestes: [] }), 'indisponible');
    ok(m1.includes('saisie manuelle'), 'le chemin humain est rappelé');
    api.etat.statut = 200; api.etat.panne = true;
    const m2 = await rejects(ia.completer('q', []), 'assistant');
    ok(!m2.includes(CLE), 'le secret est masqué dans l\'erreur — même craché par le transport');
  });

  // ── CL-05 (R188/R44) — le CRM RATIFIÉ, tel quel, sur l'adaptateur réel ──
  await it('CL-05 CrmService ratifié + adaptateur Claude : proposition MARQUÉE, validation → IA_VALIDEE', async () => {
    const api = fauxAnthropic();
    api.etat.reponse = '{"participants": "J. Dupont, RM", "sujets": "Suivi — pi\u00E8ce \u00E0 renouveler"}';
    const ia = claudeIaAdapter({ apiKey: CLE, entretiens: ENTRETIENS }, api.transport);
    const { p, s } = mkCrm(ia);
    const prop: any = await s.preRemplir(RM, 'cli-dupont', 'VISITE');
    ok(prop.origine === 'IA' && prop.moteur === 'claude-sonnet-4-6', 'la proposition porte son moteur réel');
    await s.creerCompteRendu(RM, { clientId: 'cli-dupont', type: 'VISITE', contenu: prop.contenu, origineProposition: 'IA' });
    ok(p._db.crmContacts[0].origine === 'IA_VALIDEE', 'l\'humain a signé — l\'assistant n\'a rien décidé');
    ok(api.etat.requetes.length === 1, 'un appel, une proposition — rien en arrière-plan');
  });

  console.log(`\nCâblage Adaptateur Claude (CL-01..05, R44/R138/R188) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
