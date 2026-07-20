/**
 * Câblage Recherche — RS-01..RS-06 (R148→R151). Miroir strict de l'amendement.
 * L'index est un dérivé rejouable ; l'habilitation s'applique AU RÉSULTAT (l'existence ne
 * fuite pas) ; tenant-scopé structurel + tracé ; l'index suit la vie jusqu'à l'oubli certifié.
 * Faux Prisma en mémoire. Écrit AVANT l'implémentation.
 *
 * Harnais : compiler recherche.service.ts + ce fichier ;
 *   echo "── Câblage Recherche (RS-01..06, R148→R151) ──"; run recherche.wiring.spec.js
 */
import { RechercheService } from './recherche.service';
import { createHash } from 'crypto';
declare const process: { exit(n: number): void };

let passed = 0, failed = 0; const fails: string[] = [];
function it(name: string, fn: () => Promise<void>): Promise<void> {
  return fn().then(() => { passed++; }, (e: Error) => { failed++; fails.push(`✗ ${name} — ${e.message}`); });
}
const ok = (c: boolean, m = 'assertion') => { if (!c) throw new Error(m); };
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function fakePrisma(seed: any = {}) {
  let seq = 0; const id = (p: string) => `${p}-${++seq}`;
  const db = { tenants: seed.tenants ?? [], documents: seed.documents ?? [],
    versions: seed.versions ?? [], entries: [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
    if (v === null) return row[k] == null;
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    if (v && typeof v === 'object' && 'contains' in v)
      return String(row[k] ?? '').toLowerCase().includes(String(v.contains).toLowerCase());
    return row[k] === v;
  });
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((x) => match(x, where)),
    findFirst: async ({ where }: any = {}) => rows.find((x) => match(x, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
    deleteMany: async ({ where }: any = {}) => { const keep = rows.filter((x) => !match(x, where));
      const n = rows.length - keep.length; rows.length = 0; rows.push(...keep); return { count: n }; },
  });
  const p: any = { _db: db, tenant: table(db.tenants, 'T'),
    document: table(db.documents, 'D'), documentVersion: table(db.versions, 'V'),
    searchEntry: table(db.entries, 'SE'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);

const TYPES = [
  { code: 'PASSEPORT', rolesAutorises: ['RM', 'CO', 'CF'] },
  { code: 'FISCAL', rolesAutorises: ['CF'] },
];
const CF = { tenantId: 't1', userId: 'c.fiore', role: 'CF' };
const CO = { tenantId: 't1', userId: 'i.vernet', role: 'CO' };
const RM = { tenantId: 't1', userId: 'a.gharsallah', role: 'RM' };
const doc = (id: string, typeCode: string | null, statut: string) =>
  ({ id, tenantId: 't1', typeCode, statut, nom: id + '.pdf' });
const ver = (id: string, documentId: string, numero: number, texte: string) =>
  ({ id, tenantId: 't1', documentId, numero,
    ocrDerives: [{ texte, sha256Derive: sha(texte), moteur: 'tesseract-5.4', at: '2026-07-20' }] });
const mk = (docs: any[], vers: any[]) => {
  const p = fakePrisma({ tenants: [{ id: 't1', name: 'GWB',
    settings: { gedDocTypes: TYPES, gedInboxRoles: ['CO', 'CF'] } }], documents: docs, versions: vers });
  return { p, s: new RechercheService(p, fakeAudit()) };
};

(async () => {
  // ── RS-01 (R148) — l'entrée référence, la reconstruction reproduit ──
  await it('RS-01 entrée = (doc, version, empreinte du dérivé) ; reindexerTout → empreintes IDENTIQUES', async () => {
    const { p, s } = mk([doc('d1', 'PASSEPORT', 'ACTIF')], [ver('v1', 'd1', 1, 'Passeport de M. Dupont, Genève')]);
    await s.indexer(CO, 'v1');
    const e1 = p._db.entries[0];
    ok(e1.documentId === 'd1' && e1.versionId === 'v1'
      && e1.shaDeriveSource === sha('Passeport de M. Dupont, Genève'), 'référence + empreinte, pas de vérité propre');
    const avant = p._db.entries.map((e: any) => e.shaDeriveSource).sort();
    await s.reindexerTout(CO);
    const apres = p._db.entries.map((e: any) => e.shaDeriveSource).sort();
    ok(JSON.stringify(avant) === JSON.stringify(apres) && p._db.entries.length === 1, 'REJOUABLE : reconstruction identique');
  });

  // ── RS-02 (R148) — la désynchronisation se détecte, ne se répare pas seule ──
  await it('RS-02 entrée orpheline → alerte UNE fois, index non purgé en silence', async () => {
    const { p, s } = mk([doc('d1', 'PASSEPORT', 'ACTIF')], [ver('v1', 'd1', 1, 'Dupont')]);
    await s.indexer(CO, 'v1');
    p._db.documents.length = 0;   // le document disparaît HORS flux
    await s.reconcilierIndex(CO);
    await s.reconcilierIndex(CO);
    ok(evts(p, 'recherche.index.desync').length === 1, 'alerte une fois (R39)');
    ok(p._db.entries.length === 1, 'l\'index n\'est PAS purgé en silence — fait d\'audit');
  });

  // ── RS-03 (R149) — deux chercheurs, deux mondes ──
  await it('RS-03 CF voit 2, RM voit 1 (FISCAL inexistant pour lui) ; A_CLASSER réservé aux rôles d\'arrivée', async () => {
    const { p, s } = mk(
      [doc('d1', 'PASSEPORT', 'ACTIF'), doc('d2', 'FISCAL', 'ACTIF'), doc('d3', null, 'A_CLASSER')],
      [ver('v1', 'd1', 1, 'Passeport Dupont'), ver('v2', 'd2', 1, 'Attestation fiscale Dupont'),
       ver('v3', 'd3', 1, 'Courrier Dupont non classé')]);
    await s.indexer(CO, 'v1'); await s.indexer(CO, 'v2'); await s.indexer(CO, 'v3');
    const rCF: any[] = await s.chercher(CF, 'dupont');
    ok(rCF.length === 3, 'CF (type FISCAL + rôle d\'arrivée) voit tout');
    const rRM: any[] = await s.chercher(RM, 'dupont');
    ok(rRM.length === 1 && rRM[0].documentId === 'd1', 'RM : le FISCAL et l\'A_CLASSER N\'EXISTENT PAS — ni titre ni compteur');
    const rCO: any[] = await s.chercher(CO, 'dupont');
    ok(rCO.length === 2 && rCO.some((h) => h.documentId === 'd3'), 'CO (rôle d\'arrivée) voit l\'A_CLASSER, pas le FISCAL');
  });

  // ── RS-04 (R150) — la trace dit qui cherche ; le tenant est structurel ──
  await it('RS-04 recherche tracée (auteur, requête, nb) SANS contenus ; t2 → 0 structurel', async () => {
    const { p, s } = mk([doc('d1', 'PASSEPORT', 'ACTIF')], [ver('v1', 'd1', 1, 'Dupont Genève')]);
    await s.indexer(CO, 'v1');
    await s.chercher(CO, 'dupont');
    const tr = evts(p, 'recherche.executee');
    ok(tr.length === 1 && tr[0].payload.par === 'i.vernet' && tr[0].payload.requete === 'dupont'
      && tr[0].payload.nbServis === 1 && !JSON.stringify(tr[0]).includes('Genève'), 'trace sans contenus');
    const r2: any[] = await s.chercher({ tenantId: 't2', userId: 'x', role: 'CF' }, 'dupont');
    ok(r2.length === 0, 'cross-tenant : structurel');
  });

  // ── RS-05 (R151) — l'index sert l'état courant ──
  await it('RS-05 v2 indexée → UNE entrée par document, la recherche sert la v2', async () => {
    const { p, s } = mk([doc('d1', 'PASSEPORT', 'ACTIF')],
      [ver('v1', 'd1', 1, 'Ancien passeport Dupont'), ver('v2', 'd1', 2, 'Nouveau passeport Dupont 2026')]);
    await s.indexer(CO, 'v1');
    await s.indexer(CO, 'v2');
    ok(p._db.entries.length === 1 && p._db.entries[0].versionId === 'v2', 'remplacement — une entrée par document');
    const r: any[] = await s.chercher(CO, '2026');
    ok(r.length === 1, 'la recherche sert l\'état courant');
  });

  // ── RS-06 (R151) — détruit = introuvable, retrait tracé ──
  await it('RS-06 destruction certifiée → entrée retirée + retrait tracé + introuvable (empreinte survit ailleurs)', async () => {
    const { p, s } = mk([doc('d1', 'PASSEPORT', 'DETRUIT')], [ver('v1', 'd1', 1, 'Passeport Dupont')]);
    p._db.documents[0].statut = 'ACTIF';
    await s.indexer(CO, 'v1');
    p._db.documents[0].statut = 'DETRUIT';   // la destruction certifiée R115 est passée
    await s.retirer(CO, 'd1');
    ok(p._db.entries.length === 0, 'retirée de l\'index');
    ok(evts(p, 'recherche.index.retrait').length === 1, 'le retrait est un ÉVÉNEMENT');
    const r: any[] = await s.chercher(CO, 'dupont');
    ok(r.length === 0, 'un contenu détruit ne se cherche plus');
    ok(p._db.versions[0].ocrDerives[0].sha256Derive === sha('Passeport Dupont'), 'l\'empreinte, elle, survit en base');
  });

  console.log(`\nCâblage Recherche (RS-01..06, R148→R151) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
