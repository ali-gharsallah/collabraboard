/**
 * Câblage des chaînes — CB-01..06. AUCUNE RÈGLE NOUVELLE : ces tests prouvent les clauses de
 * câblage DÉJÀ ratifiées et documentées aux amendements — R151 (classement/OCR → indexation,
 * destruction → retrait), R144 (le dérivé caviardé se dépose au coffre), R148 (les caviardés
 * ne sont JAMAIS indexés). Les services ratifiés ne sont pas modifiés : la chaîne est un
 * COMPOSEUR (chaines.service.ts). Faux Prisma unifié. Écrit AVANT l'implémentation.
 *
 * Harnais : compiler chaines.service.ts + ce fichier (avec ged-ingestion, ged-avance,
 * recherche, coffre, annotation déjà compilés) ;
 *   echo "── Câblage Chaînes (CB-01..06, clauses R144/R148/R151) ──"; run chaines.wiring.spec.js
 */
import { ChainesService } from './chaines.service';
import { GedIngestionService } from '../ged/ged-ingestion.service';
import { GedAvanceService } from '../ged/ged-avance.service';
import { RechercheService } from '../recherche/recherche.service';
import { CoffreService } from '../coffre/coffre.service';
import { AnnotationService } from '../annotations/annotation.service';
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
    versions: seed.versions ?? [], entries: [] as any[], annotations: [] as any[],
    caviardages: [] as any[], ingests: [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
    if (v === null) return row[k] == null;
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    if (v && typeof v === 'object' && 'contains' in v)
      return String(row[k] ?? '').toLowerCase().includes(String(v.contains).toLowerCase());
    if (v && typeof v === 'object' && 'not' in v) return row[k] !== v.not && row[k] != null;
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
  const p: any = { _db: db, tenant: table(db.tenants, 'T'), document: table(db.documents, 'D'),
    documentVersion: table(db.versions, 'V'), searchEntry: table(db.entries, 'SE'),
    gedIngestEntry: table(db.ingests, 'IG'),
    annotation: table(db.annotations, 'A'), caviardageDerive: table(db.caviardages, 'C'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const fakeOcr = () => ({ moteur: 'tesseract-5.4', lire: async (contenu: string) => ({ texte: `TEXTE:${contenu}` }) });
function fakeStorage() {
  const objets = new Map<string, string>();
  return { _objets: objets,
    ecrire: async (cle: string, contenu: string) => { objets.set(cle, contenu); },
    lire: async (cle: string) => { const c = objets.get(cle); if (c === undefined) throw new Error('objet absent du coffre'); return c; },
    supprimer: async (cle: string) => { objets.delete(cle); },
    lister: async (prefixe: string) => [...objets.keys()].filter((k) => k.startsWith(prefixe)) };
}
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);

const CO = { tenantId: 't1', userId: 'i.vernet', role: 'CO' };
const CF = { tenantId: 't1', userId: 'c.fiore', role: 'CF' };
const CONTENU = 'Passeport de M. Dupont, Genève, expire 2031';
function monde() {
  const p = fakePrisma({ tenants: [{ id: 't1', name: 'GWB', settings: {
    gedDocTypes: [{ code: 'PASSEPORT', rolesAutorises: ['RM', 'CO', 'CF'] }],
    gedInboxRoles: ['CO', 'CF'] } }] });
  const storage = fakeStorage();
  const audit = fakeAudit();
  const ged = new GedIngestionService(p, audit, { ocr: fakeOcr() } as any);
  const gedAvance = new GedAvanceService(p, audit);
  const recherche = new RechercheService(p, audit);
  const coffre = new CoffreService(p, audit, { storage } as any);
  const annotations = new AnnotationService(p, audit);
  const s = new ChainesService(ged, gedAvance, recherche, coffre, annotations, { storage } as any, p);
  return { p, storage, s, ged, coffre };
}
async function docActif(w: any) {
  const r: any = await w.ged.ingerer(CO, { canal: 'SCAN', source: 'scanner-01', nomFichier: 'passeport.pdf', contenu: CONTENU });
  const v = await w.p.documentVersion.findFirst({ where: { documentId: r.documentId, numero: 1 } });
  await w.s.ocriserEtIndexer(CO, v.id, CONTENU);
  await w.s.classerEtIndexer(CO, r.documentId, { typeCode: 'PASSEPORT', clientId: 'cli-1' }, v.id);
  return { ...r, versionId: v.id };
}

(async () => {
  // ── CB-01 (clause R151) — le classement déclenche l'indexation ──
  await it('CB-01 ingérer → OCR → classer : la chaîne indexe, la recherche trouve', async () => {
    const w = monde();
    const r = await docActif(w);
    ok(w.p._db.entries.length === 1 && w.p._db.entries[0].versionId === r.versionId, 'indexé au classement');
    const hits: any[] = await w.s['recherche'].chercher(CO, 'dupont');
    ok(hits.length === 1, 'la recherche trouve — la promesse « classer → indexer » est un acte');
  });

  // ── CB-02 (clause R151) — l'OCR d'une nouvelle version réindexe l'état courant ──
  await it('CB-02 nouvelle version OCRisée → l\'index sert la v2, une seule entrée', async () => {
    const w = monde();
    const r = await docActif(w);
    const C2 = 'Passeport RENOUVELÉ de M. Dupont, expire 2036';
    const v2 = await w.p.documentVersion.create({ data: { tenantId: 't1', documentId: r.documentId,
      numero: 2, sha256: sha(C2), ocrDerives: [] } });
    await w.s.ocriserEtIndexer(CO, v2.id, C2);
    ok(w.p._db.entries.length === 1 && w.p._db.entries[0].versionId === v2.id, 'UNE entrée, la v2');
    const hits: any[] = await w.s['recherche'].chercher(CO, 'renouvelé');
    ok(hits.length === 1, 'l\'état courant est servi');
  });

  // ── CB-03 (clause R151/R115) — la destruction retire de l'index ET purge le coffre ──
  await it('CB-03 detruireComplet : statut DETRUIT + coffre purgé (empreinte survit) + index retiré + introuvable', async () => {
    const w = monde();
    const r = await docActif(w);
    await w.coffre.ecrire(CO, r.versionId, CONTENU);
    ok(w.storage._objets.size === 1, 'le contenu vit au coffre');
    await w.s.detruireComplet(CO, r.documentId, 'Fin de rétention CDB — 10 ans échus');
    ok(w.p._db.documents[0].statut === 'DETRUIT', 'destruction certifiée');
    ok(w.storage._objets.size === 0, 'le coffre est purgé');
    ok(w.p._db.versions[0].sha256 === sha(CONTENU), 'l\'EMPREINTE survit au contenu');
    ok(w.p._db.entries.length === 0 && evts(w.p, 'recherche.index.retrait').length === 1, 'retiré de l\'index, retrait tracé');
    const hits: any[] = await w.s['recherche'].chercher(CO, 'dupont');
    ok(hits.length === 0, 'introuvable — l\'oubli certifié est complet');
  });

  // ── CB-04 (clause R144/R158) — le dérivé caviardé se dépose au coffre ──
  await it('CB-04 caviarderEtDeposer : dérivé au coffre sous clé tenant, empreinte du dépôt = shaDerive', async () => {
    const w = monde();
    const r = await docActif(w);
    const CAV = 'Passeport de M. ████, ██████, expire 2031';
    const res: any = await w.s.caviarderEtDeposer(CF, { versionId: r.versionId,
      zones: [{ zone: { page: 1 }, motif: 'Données de tiers (LPD)' }], contenuCaviarde: CAV });
    const cle = `t1/${r.documentId}/caviarde-${res.caviardeId}`;
    ok(await w.storage.lire(cle) === CAV, 'le dérivé vit au coffre, préfixe tenant structurel');
    ok(evts(w.p, 'cablage.caviarde.depose').length === 1
      && evts(w.p, 'cablage.caviarde.depose')[0].payload.cle === cle, 'le dépôt est un événement (clé prouvée)');
  });

  // ── CB-05 (clause R148) — le caviardé n'entre JAMAIS à l'index ──
  await it('CB-05 après caviardage : aucune entrée d\'index ne référence le dérivé — il sert la sortie, pas la consultation', async () => {
    const w = monde();
    const r = await docActif(w);
    const res: any = await w.s.caviarderEtDeposer(CF, { versionId: r.versionId,
      zones: [{ zone: { page: 1 }, motif: 'LPD' }], contenuCaviarde: 'Passeport ████' });
    ok(w.p._db.entries.length === 1 && w.p._db.entries[0].versionId === r.versionId, 'l\'index ne connaît que l\'original');
    ok(!w.p._db.entries.some((e: any) => JSON.stringify(e).includes(res.caviardeId)), 'AUCUNE entrée ne référence le dérivé');
  });

  // ── CB-06 (garde) — la chaîne refuse net si un maillon manque ──
  await it('CB-06 classer un document jamais OCRisé → la chaîne refuse (R148 : rien à indexer), rien d\'indexé à moitié', async () => {
    const w = monde();
    const r: any = await w.ged.ingerer(CO, { canal: 'SCAN', source: 'scanner-01', nomFichier: 'x.pdf', contenu: 'brut' });
    const v = await w.p.documentVersion.findFirst({ where: { documentId: r.documentId, numero: 1 } });
    await rejects(w.s.classerEtIndexer(CO, r.documentId, { typeCode: 'PASSEPORT', clientId: 'cli-1' }, v.id), 'R148');
    ok(w.p._db.entries.length === 0, 'pas de demi-état : rien d\'indexé');
  });

  console.log(`\nCâblage Chaînes (CB-01..06, clauses R144/R148/R151) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
