/**
 * Câblage Capture & ingestion GED — IG-01..IG-06 (R137→R139). Miroir strict de l'amendement.
 * Canaux déclarés (R-Q), OCR = port → dérivé jamais l'original, boîte d'arrivée qualifiée.
 * Faux Prisma en mémoire. Écrit AVANT l'implémentation.
 *
 * Harnais : compiler ged-ingestion.service.ts + ce fichier ;
 *   echo "── Câblage Ingestion GED (IG-01..06, R137→R139) ──"; run ged-ingestion.wiring.spec.js
 */
import { GedIngestionService } from './ged-ingestion.service';
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
  const db = { tenants: seed.tenants ?? [], documents: [] as any[], versions: [] as any[],
    ingests: [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
    if (v === null) return row[k] == null;
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    if (v && typeof v === 'object' && 'lte' in v) return row[k] != null && new Date(row[k]) <= new Date(v.lte);
    return row[k] === v;
  });
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((x) => match(x, where)),
    findFirst: async ({ where }: any = {}) => rows.find((x) => match(x, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
  });
  const p: any = { _db: db,
    tenant: table(db.tenants, 'T'), document: table(db.documents, 'D'),
    documentVersion: table(db.versions, 'V'), gedIngestEntry: table(db.ingests, 'IG'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);

const TYPES = [
  { code: 'PASSEPORT', validiteMois: 120, requisPour: ['KYC_VALIDATION'], rolesAutorises: ['RM', 'CO', 'CF'] },
  { code: 'FISCAL', validiteMois: null, requisPour: [], rolesAutorises: ['CF'] },   // CO exclu — pour IG-05
];
const CO = { tenantId: 't1', userId: 'i.vernet', role: 'CO' };
const RM = { tenantId: 't1', userId: 'a.gharsallah', role: 'RM' };
const OCR = { moteur: 'tesseract-5.4', lire: async (contenu: string) =>
  ({ texte: 'TEXTE-EXTRAIT[' + contenu + ']' }) };
const mk = (settings: any = {}, ports: any = { ocr: OCR }) => {
  const p = fakePrisma({ tenants: [{ id: 't1', name: 'GWB',
    settings: { gedDocTypes: TYPES, ...settings } }] });
  return { p, s: new GedIngestionService(p, fakeAudit(), ports) };
};
const ing = (s: GedIngestionService, canal = 'UPLOAD') =>
  s.ingerer(CO, { canal, source: 'poste-CO-04', nomFichier: 'passeport-dupont.pdf', contenu: 'PDF-BRUT-2026' });

(async () => {
  // ── IG-01 (R137) — l'entrée est tracée, le canal inconnu refusé ──
  await it('IG-01 UPLOAD → A_CLASSER + v1 (sha réelle) + fiche d\'origine + événement ; FAX hors registre → refus', async () => {
    const { p, s } = mk();
    const r: any = await ing(s);
    ok(p._db.documents[0].statut === 'A_CLASSER' && p._db.documents[0].typeCode == null, 'quarantaine sans type');
    ok(p._db.versions.length === 1 && p._db.versions[0].sha256 === sha('PDF-BRUT-2026'), 'v1, empreinte réelle');
    const e = p._db.ingests[0];
    ok(e.canal === 'UPLOAD' && e.source === 'poste-CO-04' && e.operateur === 'i.vernet' && !!e.at, 'origine complète, jeton');
    ok(evts(p, 'ged.ingest').length === 1, 'événement');
    await rejects(ing(s, 'FAX'), 'canal');
  });

  // ── IG-02 (R137) — le canal est un paramètre tenant ──
  await it('IG-02 tenant avec FAX au registre → accepté (R-Q fait foi)', async () => {
    const { p, s } = mk({ gedCanauxIngestion: ['SCAN', 'EMAIL', 'UPLOAD', 'API', 'FAX'] });
    await ing(s, 'FAX');
    ok(p._db.ingests[0].canal === 'FAX', 'paramètre R-Q respecté');
  });

  // ── IG-03 (R138) — le dérivé s'attache, l'original ne bouge pas ──
  await it('IG-03 OCR → dérivé (texte+empreinte+moteur), v1 INTACTE ; re-OCR → 2e dérivé, 1er conservé', async () => {
    const { p, s } = mk();
    const r: any = await ing(s);
    const shaAvant = p._db.versions[0].sha256;
    await s.ocriser(CO, p._db.versions[0].id, 'PDF-BRUT-2026');
    const d1 = p._db.versions[0].ocrDerives;
    ok(d1.length === 1 && d1[0].texte.includes('TEXTE-EXTRAIT') && d1[0].moteur === 'tesseract-5.4'
      && d1[0].sha256Derive === sha(d1[0].texte), 'dérivé complet, empreinte du dérivé');
    ok(p._db.versions[0].sha256 === shaAvant, 'ORIGINAL intact au bit près');
    await s.ocriser(CO, p._db.versions[0].id, 'PDF-BRUT-2026');
    ok(p._db.versions[0].ocrDerives.length === 2, 're-OCR = 2e dérivé, le 1er conservé');
    ok(evts(p, 'ged.ocr.derive').length === 2, 'chaque passage tracé');
  });

  // ── IG-04 (R138) — pas de port, pas de simulacre ; contenu altéré, refus ──
  await it('IG-04 sans prestataire OCR → refus explicite (R114) ; contenu ≠ empreinte → refus (R111)', async () => {
    const { p: p0, s: s0 } = mk({}, {});
    await ing(s0);
    await rejects(s0.ocriser(CO, p0._db.versions[0].id, 'PDF-BRUT-2026'), 'prestataire');
    const { p, s } = mk();
    await ing(s);
    await rejects(s.ocriser(CO, p._db.versions[0].id, 'CONTENU-ALTERE'), 'empreinte');
  });

  // ── IG-05 (R139) — le classement est un acte habilité, deux fois ──
  await it('IG-05 RM → arrivée refusée + tracée ; CO classe PASSEPORT/c1 → ACTIF tracé ; CO vers FISCAL (CF seul) → refus R112', async () => {
    const { p, s } = mk();
    const r: any = await ing(s);
    await rejects(s.listerArrivee(RM), 'habilité');
    ok(evts(p, 'ged.inbox.acces.refuse').length === 1 && evts(p, 'ged.inbox.acces.refuse')[0].payload.par === 'a.gharsallah', 'refus tracé');
    const inbox: any[] = await s.listerArrivee(CO);
    ok(inbox.length === 1, 'CO voit l\'arrivée');
    await s.classer(CO, r.documentId, { typeCode: 'PASSEPORT', clientId: 'c1' });
    ok(p._db.documents[0].statut === 'ACTIF' && p._db.documents[0].typeCode === 'PASSEPORT'
      && p._db.documents[0].clientId === 'c1', 'classé, rattaché');
    ok(evts(p, 'ged.classement').length === 1, 'classement tracé');
    const r2: any = await ing(s);
    await rejects(s.classer(CO, r2.documentId, { typeCode: 'FISCAL', clientId: 'c1' }), 'FISCAL');
  });

  // ── IG-06 (R139) — le SLA d'arrivée alerte, ne classe pas ──
  await it('IG-06 A_CLASSER 3 j (SLA 2) → alerte + tâche UNE fois, toujours A_CLASSER', async () => {
    const { p, s } = mk();
    await ing(s);
    p._db.documents[0].ingereAt = new Date(Date.now() - 3 * 86400000).toISOString();
    await s.tickArrivee(CO, new Date());
    await s.tickArrivee(CO, new Date());
    ok(evts(p, 'ged.inbox.sla').length === 1 && evts(p, 'tache.ged.classement').length === 1, 'une fois (R39)');
    ok(p._db.documents[0].statut === 'A_CLASSER', 'rien ne se classe tout seul');
  });

  // ── garde transverse ──
  await it('R137 isolation tenant : arrivée d\'un autre tenant vide', async () => {
    const { s } = mk();
    await ing(s);
    const autres: any[] = await s.listerArrivee({ tenantId: 't2', userId: 'x', role: 'CO' });
    ok(autres.length === 0, 'scopé tenant');
  });

  console.log(`\nCâblage Ingestion GED (IG-01..06, R137→R139) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
