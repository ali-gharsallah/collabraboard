/**
 * Câblage CRM Relation — CR-01..05 (R186→R188). Miroir strict de l'amendement, écrit AVANT
 * l'implémentation. La timeline projette, le geste se motive, le conseil se trace —
 * l'IA propose par un port déclaré, l'humain signe.
 *
 * Harnais : compiler crm.service.ts + ce fichier ;
 *   echo "── Câblage CRM Relation (CR-01..05, R186→R188) ──"; run crm.wiring.spec.js
 */
import { CrmService } from './crm.service';
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
  const db = { tenants: seed.tenants ?? [], clients: seed.clients ?? [], documents: seed.documents ?? [],
    tasks: seed.tasks ?? [], crmContacts: [] as any[], events: seed.events ?? [] };
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
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);
const RM = { tenantId: 't1', userId: 'u-rm1', role: 'RM' };
const RM2 = { tenantId: 't1', userId: 'u-rm2', role: 'RM' };
const CO = { tenantId: 't1', userId: 'u-co', role: 'CO' };
const J = (d: string) => d + 'T10:00:00.000Z';
const mk = () => {
  const p = fakePrisma({
    tenants: [{ id: 't1', name: 'GWB', settings: {
      crmEntretiens: [{ type: 'CONSEIL_PLACEMENT', champsObligatoires: ['participants', 'produitsDiscutes', 'risquesExpliques', 'suites'] },
                      { type: 'VISITE', champsObligatoires: ['participants', 'sujets'] }],
      rolesVisibiliteEtendue: ['CO', 'CF'] } }],
    clients: [{ id: 'cli-dupont', tenantId: 't1', name: 'Jean Dupont', rmUserId: 'u-rm1' }],   // ÉCART lot 40 : fixture alignée sur le champ ratifié Client.rmUserId (le zip semait rmId) — intention du test inchangée
    documents: [{ id: 'doc-1', tenantId: 't1', clientId: 'cli-dupont', nomFichier: 'passeport-dupont.pdf', statut: 'ACTIF', expireAt: '2026-09-15' }],
    tasks: [{ id: 'k1', tenantId: 't1', clientId: 'cli-dupont', assigneeId: 'u-rm1', type: 'ACCOUNT_REVIEW', statut: 'OUVERTE', createdAt: J('2026-07-01'), dueAt: '2026-07-10' }],
    events: [
      { tenantId: 't1', type: 'kyc.dossier.approuve', aggregateId: 'cli-dupont', payload: { code: 'KYC-2026-CH-0044-R2' }, at: J('2026-06-01') },
      { tenantId: 't1', type: 'ged.document.classe', aggregateId: 'cli-dupont', payload: { nom: 'passeport-dupont.pdf' }, at: J('2026-06-10') },
      { tenantId: 't1', type: 'aml.signal.qualifie', aggregateId: 'cli-dupont', payload: { verdict: 'FAUX_POSITIF' }, at: J('2026-07-02') }],
  });
  return { p, s: new CrmService(p, fakeAudit(), {}) };
};

(async () => {
  // ── CR-01 (R186) — la timeline projette le journal, elle ne copie rien ──
  await it('CR-01 timeline multi-modules, ordonnée, chaque entrée dit sa source — zéro table propre', async () => {
    const { p, s } = mk();
    const tl: any = await s.timeline(RM, 'cli-dupont');
    ok(tl.length === 3, 'trois modules, une chronologie');
    ok(tl[0].at < tl[1].at && tl[1].at < tl[2].at, 'ordonnée');
    ok(tl.every((e: any) => e.source && e.at), 'chaque entrée dit sa source et sa date');
    ok(!('crmTimeline' in p._db), 'aucun stockage propre — une projection');
  });

  // ── CR-02 (R186) — les droits du lecteur ──
  await it('CR-02 le RM lit SES clients ; visibilité étendue lit tout ; RM tiers refusé tracé', async () => {
    const { p, s } = mk();
    await s.timeline(RM, 'cli-dupont');
    await s.timeline(CO, 'cli-dupont');
    await rejects(s.timeline(RM2, 'cli-dupont'), 'client');
    ok(evts(p, 'crm.acces.refuse').length === 1, 'le refus est tracé');
  });

  // ── CR-03 (R187) — le geste dérive du signal, et meurt avec lui ──
  await it('CR-03 suggestions motivées par des signaux réels ; signal résolu → suggestion disparue', async () => {
    const { p, s } = mk();
    const g1: any = await s.prochainsGestes(RM, 'cli-dupont');
    ok(g1.length === 2, 'pièce expirante + revue en retard');
    ok(g1.every((x: any) => x.geste && x.signal && x.source), 'chaque suggestion NOMME son signal');
    p._db.tasks[0].statut = 'FAITE';
    const g2: any = await s.prochainsGestes(RM, 'cli-dupont');
    ok(g2.length === 1 && g2[0].source === 'document', 'le signal résolu emporte sa suggestion — recalcul pur');
  });

  // ── CR-04 (R188) — la trace du conseil : obligatoire veut dire obligatoire ──
  await it('CR-04 champ obligatoire du type manquant → refus ; créé = append-only + événement', async () => {
    const { p, s } = mk();
    await rejects(s.creerCompteRendu(RM, { clientId: 'cli-dupont', type: 'CONSEIL_PLACEMENT',
      contenu: { participants: 'J. Dupont, RM', produitsDiscutes: 'Fonds obligataire CHF' } }), 'risquesExpliques');
    await s.creerCompteRendu(RM, { clientId: 'cli-dupont', type: 'CONSEIL_PLACEMENT',
      contenu: { participants: 'J. Dupont, RM', produitsDiscutes: 'Fonds obligataire CHF',
        risquesExpliques: 'Risque de taux et de change expliqués', suites: 'Proposition écrite sous 5 jours' } });
    ok(p._db.crmContacts.length === 1 && p._db.crmContacts[0].origine === 'MANUEL', 'créé, origine dite');
    ok(evts(p, 'crm.contact.cree').length === 1, 'l\'acte est un événement');
    await rejects(s.creerCompteRendu(RM, { clientId: 'cli-dupont', type: 'INCONNU', contenu: {} }), 'type');
  });

  // ── CR-05 (R188/R44) — l'IA propose par un port, l'humain signe ──
  await it('CR-05 sans port IA → refus explicite ; avec port → proposition MARQUÉE, validation humaine crée', async () => {
    const { p, s } = mk();
    await rejects(s.preRemplir(RM, 'cli-dupont', 'VISITE'), 'port');
    const s2 = new CrmService(p, fakeAudit(), { ia: { moteur: 'claude-demo-1.0',
      preRemplir: async (ctx2: any) => ({ participants: 'J. Dupont, RM', sujets: 'Suivi du dossier — pièce à renouveler avant le 15.09' }) } });
    const prop: any = await s2.preRemplir(RM, 'cli-dupont', 'VISITE');
    ok(prop.origine === 'IA' && prop.moteur === 'claude-demo-1.0', 'la proposition est MARQUÉE de son origine');
    await s2.creerCompteRendu(RM, { clientId: 'cli-dupont', type: 'VISITE', contenu: prop.contenu, origineProposition: 'IA' });
    ok(p._db.crmContacts[0].origine === 'IA_VALIDEE', 'validée par l\'humain — l\'IA n\'a rien signé');
  });

  console.log(`\nCâblage CRM Relation (CR-01..05, R186→R188) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
