/**
 * Câblage Annotations & caviardage — AN-01..06 (R156→R159). Miroir strict de l'amendement.
 * Le calque n'effleure pas l'original ; le cercle tient ; le dérivé naît, l'original demeure ;
 * la divulgation ne sert que le caviardé. Faux Prisma en mémoire. Écrit AVANT l'implémentation.
 *
 * Harnais : compiler annotation.service.ts + ce fichier ;
 *   echo "── Câblage Annotations (AN-01..06, R156→R159) ──"; run annotation.wiring.spec.js
 */
import { AnnotationService } from './annotation.service';
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
    versions: seed.versions ?? [], annotations: [] as any[], caviardages: [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
    if (v === null) return row[k] == null;
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    return row[k] === v;
  });
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((x) => match(x, where)),
    findFirst: async ({ where }: any = {}) => rows.find((x) => match(x, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    deleteMany: async ({ where }: any = {}) => { const keep = rows.filter((x) => !match(x, where));
      const n = rows.length - keep.length; rows.length = 0; rows.push(...keep); return { count: n }; },
  });
  const p: any = { _db: db, tenant: table(db.tenants, 'T'), document: table(db.documents, 'D'),
    documentVersion: table(db.versions, 'V'), annotation: table(db.annotations, 'A'),
    caviardageDerive: table(db.caviardages, 'C'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);

const TYPES = [{ code: 'PASSEPORT', rolesAutorises: ['RM', 'CO', 'CF'] }, { code: 'FISCAL', rolesAutorises: ['CF'] }];
const CF = { tenantId: 't1', userId: 'c.fiore', role: 'CF' };
const CO = { tenantId: 't1', userId: 'i.vernet', role: 'CO' };
const RM = { tenantId: 't1', userId: 'a.gharsallah', role: 'RM' };
const STG = { tenantId: 't1', userId: 's.tagger', role: 'STAGIAIRE' };
const CONTENU = 'Contenu original du passeport, page 1';
const mk = (settings: any = {}) => {
  const p = fakePrisma({
    tenants: [{ id: 't1', name: 'GWB', settings: { gedDocTypes: TYPES, ...settings } }],
    documents: [{ id: 'd1', tenantId: 't1', typeCode: 'PASSEPORT', statut: 'ACTIF', nom: 'passeport.pdf' },
                { id: 'd2', tenantId: 't1', typeCode: 'FISCAL', statut: 'ACTIF', nom: 'fiscal.pdf' }],
    versions: [{ id: 'v1', tenantId: 't1', documentId: 'd1', numero: 1, sha256: sha(CONTENU), contenu: CONTENU },
               { id: 'v2', tenantId: 't1', documentId: 'd2', numero: 1, sha256: sha('fiscal secret'), contenu: 'fiscal secret' }],
  });
  return { p, s: new AnnotationService(p, fakeAudit()) };
};

(async () => {
  // ── AN-01 (R156) — le calque n'effleure pas l'original ──
  await it('AN-01 annotation = référence (doc, version, ancre) signée ; empreinte version IDENTIQUE avant/après', async () => {
    const { p, s } = mk();
    const avant = p._db.versions[0].sha256;
    await s.annoter(CO, { versionId: 'v1', type: 'SURLIGNAGE', ancre: { page: 1, x: 10, y: 20 },
      contenu: 'Vérifier la date d\'expiration', cercle: 'DOSSIER' });
    const a = p._db.annotations[0];
    ok(a.documentId === 'd1' && a.versionId === 'v1' && a.auteur === 'i.vernet' && a.ancre.page === 1, 'référence + signature');
    ok(p._db.versions[0].sha256 === avant && p._db.versions[0].contenu === CONTENU, 'l\'original est INTACT au bit près');
    ok(evts(p, 'annotation.posee').length === 1, 'posée = événement');
  });

  // ── AN-02 (R156) — le retrait se motive ──
  await it('AN-02 retrait sans motif → refus (R7) ; motivé → retiré + tracé', async () => {
    const { p, s } = mk();
    await s.annoter(CO, { versionId: 'v1', type: 'NOTE', ancre: { page: 1 }, contenu: 'brouillon', cercle: 'PRIVEE' });
    const aid = p._db.annotations[0].id;
    await rejects(s.retirerAnnotation(CO, aid, ''), 'R7');
    await s.retirerAnnotation(CO, aid, 'Note de travail obsolète');
    ok(p._db.annotations.length === 0, 'retirée');
    const e = evts(p, 'annotation.retiree');
    ok(e.length === 1 && e[0].payload.motif === 'Note de travail obsolète', 'retrait tracé, motivé');
  });

  // ── AN-03 (R157) — habilitation + cercle, l'existence ne fuite pas ──
  await it('AN-03 hors registre → refus tracé ; PRIVEE invisible aux autres ; document hors droits → annotations invisibles', async () => {
    const { p, s } = mk();
    await rejects(s.annoter(STG, { versionId: 'v1', type: 'NOTE', ancre: {}, contenu: 'x', cercle: 'DOSSIER' }), 'habilité');
    ok(evts(p, 'annotation.acces.refuse').length === 1, 'tentative tracée');
    await s.annoter(CO, { versionId: 'v1', type: 'NOTE', ancre: {}, contenu: 'privée du CO', cercle: 'PRIVEE' });
    await s.annoter(CO, { versionId: 'v1', type: 'NOTE', ancre: {}, contenu: 'pour le dossier', cercle: 'DOSSIER' });
    await s.annoter(CF, { versionId: 'v2', type: 'NOTE', ancre: {}, contenu: 'sur le fiscal', cercle: 'DOSSIER' });
    const vuRM: any[] = await s.listerAnnotations(RM, 'd1');
    ok(vuRM.length === 1 && vuRM[0].contenu === 'pour le dossier', 'la PRIVEE d\'autrui n\'existe pas pour le RM');
    const vuCO: any[] = await s.listerAnnotations(CO, 'd1');
    ok(vuCO.length === 2, 'l\'auteur voit sa PRIVEE + la DOSSIER');
    const vuRMfiscal: any[] = await s.listerAnnotations(RM, 'd2');
    ok(vuRMfiscal.length === 0, 'document hors droits (R112/R149) : les annotations n\'existent pas');
  });

  // ── AN-04 (R158) — le dérivé naît, l'original ne bouge pas ──
  await it('AN-04 caviarder 2 zones motivées → dérivé (empreinte propre + source chaînée, zones tracées) ; original IDENTIQUE', async () => {
    const { p, s } = mk();
    const avant = { sha: p._db.versions[0].sha256, contenu: p._db.versions[0].contenu };
    await s.caviarder(CF, { versionId: 'v1', zones: [
      { zone: { page: 1, x: 0, y: 0, w: 100, h: 20 }, motif: 'Données de tiers (LPD art. 6)' },
      { zone: { page: 1, x: 0, y: 40, w: 100, h: 10 }, motif: 'Secret d\'affaires' }] });
    const c = p._db.caviardages[0];
    ok(c.shaSource === avant.sha && c.shaDerive && c.shaDerive !== avant.sha && c.statut === 'CAVIARDE', 'dérivé chaîné à la source');
    ok(c.zones.length === 2 && c.zones.every((z: any) => z.motif), 'zones + motifs portés');
    ok(p._db.versions[0].sha256 === avant.sha && p._db.versions[0].contenu === avant.contenu, 'l\'original n\'a pas bougé d\'un bit');
    const e = evts(p, 'caviardage.produit');
    ok(e.length === 1 && e[0].payload.par === 'c.fiore' && e[0].payload.zones === 2, 'l\'acte est l\'événement');
  });

  // ── AN-05 (R158) — pas de zone muette, pas de main non habilitée ──
  await it('AN-05 zone sans motif → refus ; RM (hors caviardageRoles) → refus tracé', async () => {
    const { p, s } = mk();
    await rejects(s.caviarder(CF, { versionId: 'v1', zones: [{ zone: { page: 1 }, motif: '' }] }), 'motif');
    await rejects(s.caviarder(RM, { versionId: 'v1', zones: [{ zone: { page: 1 }, motif: 'x' }] }), 'habilité');
    ok(evts(p, 'caviardage.refuse').length === 1, 'tentative tracée');
    ok(p._db.caviardages.length === 0, 'rien produit');
  });

  // ── AN-06 (R159) — ce qui sort est prouvé, l'original ne sort pas ──
  await it('AN-06 divulguer le dérivé → événement (destinataire, id, empreinte) ; divulguer l\'original → refus', async () => {
    const { p, s } = mk();
    await s.caviarder(CF, { versionId: 'v1', zones: [{ zone: { page: 1 }, motif: 'LPD' }] });
    const cid = p._db.caviardages[0].id;
    await s.divulguer(CF, { caviardeId: cid, destinataire: 'FINMA — demande du 18.07' });
    const e = evts(p, 'divulgation.executee');
    ok(e.length === 1 && e[0].payload.caviardeId === cid
      && e[0].payload.shaDerive === p._db.caviardages[0].shaDerive
      && e[0].payload.destinataire.includes('FINMA'), 'on prouve APRÈS COUP ce qui est sorti');
    await rejects(s.divulguer(CF, { caviardeId: 'v1', destinataire: 'X' }), 'caviardé');
    ok(evts(p, 'divulgation.refusee').length === 1, 'la voie refuse l\'original — le défaut protège');
  });

  console.log(`\nCâblage Annotations (AN-01..06, R156→R159) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
