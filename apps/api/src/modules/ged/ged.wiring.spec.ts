/**
 * Câblage GED — GD-01..GD-06 (R109→R112) à travers le SERVICE PERSISTANT.
 * Miroir strict des Gherkin de l'amendement R109-R112. Faux Prisma en mémoire.
 * Écrit AVANT l'implémentation. Le contenu des fichiers est représenté par une
 * chaîne (l'empreinte SHA-256 est réelle, calculée par le service via crypto).
 *
 * Harnais : compiler ged.service.ts + ce fichier ;
 *   echo "── Câblage GED (GD-01..06, R109→R112) ──"; run ged.wiring.spec.js
 */
import { GedService } from './ged.service';
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
  const db = { tenants: seed.tenants ?? [], documents: [] as any[], versions: [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
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
    tenant: table(db.tenants, 'T'), document: table(db.documents, 'D'),
    documentVersion: table(db.versions, 'V'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; } } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);

const CO = { tenantId: 't1', userId: 'i.vernet', role: 'CO' };
const RM = { tenantId: 't1', userId: 'a.gharsallah', role: 'RM' };
// Référentiel tenant (R-Q) : ID 120 mois · REGISTRE 12 mois · FORM_CDB sans péremption · FISCAL restreint CO/CF
const TYPES = [
  { code: 'PASSEPORT', validiteMois: 120, requisPour: ['KYC_VALIDATION'], rolesAutorises: ['RM', 'CO', 'CF'] },
  { code: 'REGISTRE', validiteMois: 12, requisPour: ['KYC_VALIDATION'], rolesAutorises: ['RM', 'CO', 'CF'] },
  { code: 'FORM_CDB', validiteMois: null, requisPour: ['KYC_VALIDATION'], rolesAutorises: ['RM', 'CO', 'CF'] },
  { code: 'FISCAL', validiteMois: null, requisPour: [], rolesAutorises: ['CO', 'CF'] },
];
const mk = () => {
  const p = fakePrisma({ tenants: [{ id: 't1', name: 'GWB', settings: { gedDocTypes: TYPES } }] });
  return { p, s: new GedService(p, fakeAudit()) };
};

(async () => {
  // ── GD-01 (R109) — le nouveau passeport succède ──
  await it('GD-01 second dépôt → version 2, version 1 consultable, événement, empreinte réelle', async () => {
    const { p, s } = mk();
    const d: any = await s.deposer(RM, { clientId: 'c1', typeCode: 'PASSEPORT', nom: 'Passeport Dupont', contenu: 'PDF-PASSEPORT-2016' });
    await s.deposer(RM, { documentId: d.id, contenu: 'PDF-PASSEPORT-2026' });
    const versions = p._db.versions.filter((v: any) => v.documentId === d.id);
    ok(versions.length === 2 && versions.map((v: any) => v.numero).join(',') === '1,2', 'v1 et v2 présentes');
    ok(versions[0].sha256 === sha('PDF-PASSEPORT-2016') && versions[1].sha256 === sha('PDF-PASSEPORT-2026'), 'empreintes réelles au dépôt');
    ok(versions.every((v: any) => v.deposePar === 'a.gharsallah'), 'déposant = jeton');
    ok(evts(p, 'ged.version.creee').length === 2, 'chaque dépôt tracé');
  });

  // ── GD-02 (R109) — archivage motivé, restitution survit ──
  await it('GD-02 archivage sans motif → refus R7 ; avec motif → ARCHIVE tracé, doc restituable', async () => {
    const { p, s } = mk();
    const d: any = await s.deposer(RM, { clientId: 'c1', typeCode: 'PASSEPORT', nom: 'P', contenu: 'X1' });
    await rejects(s.archiver(CO, d.id, ''), 'R7');
    await s.archiver(CO, d.id, 'Pièce remplacée — relation clôturée, conservation LBA');
    ok(p._db.documents[0].statut === 'ARCHIVE' && p._db.documents[0].archivePar === 'i.vernet', 'motivé, auteur = jeton');
    const r: any = await s.restituer(CO, d.id, 'X1');
    ok(r.integrite === 'OK', 'document archivé RESTE restituable (LBA)');
    ok(p._db.documents.length === 1, 'aucune suppression physique');
  });

  // ── GD-03 (R110) — expiration : constatée, jamais bloquante, une fois ──
  await it('GD-03 registre 13 mois → événement + tâche UNE fois, rien de bloqué', async () => {
    const { p, s } = mk();
    const d: any = await s.deposer(RM, { clientId: 'c1', typeCode: 'REGISTRE', nom: 'Extrait RC', contenu: 'RC' });
    p._db.versions[0].deposeAt = new Date(Date.now() - 13 * 30.44 * 86400000).toISOString();  // ~13 mois
    await s.tickPeremptions(CO, new Date());
    ok(evts(p, 'ged.expiration.detectee').length === 1, 'expiration constatée');
    ok(evts(p, 'tache.ged.renouvellement').length === 1, 'tâche de renouvellement');
    await s.tickPeremptions(CO, new Date());
    ok(evts(p, 'ged.expiration.detectee').length === 1, 'une alerte, pas une boucle');
    ok(p._db.documents[0].statut === 'ACTIF', 'rien de bloqué ni archivé par le tick (R39)');
  });

  // ── GD-04 (R110) — complétude au point de passage ──
  await it('GD-04 passage KYC_VALIDATION : FORM_CDB manquant + PASSEPORT expiré listés, trace émise', async () => {
    const { p, s } = mk();
    const d: any = await s.deposer(RM, { clientId: 'c1', typeCode: 'PASSEPORT', nom: 'P', contenu: 'PP' });
    p._db.versions[0].deposeAt = new Date(Date.now() - 130 * 30.44 * 86400000).toISOString(); // > 120 mois
    const r: any = await s.verifierCompletude(CO, 'c1', 'KYC_VALIDATION');
    ok(r.manquants.includes('FORM_CDB') && r.manquants.includes('REGISTRE'), 'types requis absents listés');
    ok(r.expires.includes('PASSEPORT'), 'type expiré listé');
    ok(r.complet === false, 'verdict : incomplet — le moteur APPELANT bloque, la GED constate');
    ok(evts(p, 'ged.completude.verifiee').length === 1, 'vérification tracée');
  });
  await it('GD-04 tout déposé et valide → complet', async () => {
    const { p, s } = mk();
    await s.deposer(RM, { clientId: 'c1', typeCode: 'PASSEPORT', nom: 'P', contenu: 'PP' });
    await s.deposer(RM, { clientId: 'c1', typeCode: 'REGISTRE', nom: 'RC', contenu: 'RC' });
    await s.deposer(RM, { clientId: 'c1', typeCode: 'FORM_CDB', nom: 'A', contenu: 'FA' });
    const r: any = await s.verifierCompletude(CO, 'c1', 'KYC_VALIDATION');
    ok(r.complet === true && r.manquants.length === 0 && r.expires.length === 0, 'complet');
  });

  // ── GD-05 (R111) — l'altération se détecte à la restitution ──
  await it('GD-05 contenu conforme → servi avec preuve ; altéré → ged.integrite.alerte + refus', async () => {
    const { p, s } = mk();
    const d: any = await s.deposer(CO, { clientId: 'c1', typeCode: 'FISCAL', nom: 'Attestation', contenu: 'CONTENU-AUTHENTIQUE' });
    const okR: any = await s.restituer(CO, d.id, 'CONTENU-AUTHENTIQUE');
    ok(okR.integrite === 'OK' && okR.sha256 === sha('CONTENU-AUTHENTIQUE'), 'preuve d\'intégrité servie');
    await rejects(s.restituer(CO, d.id, 'CONTENU-ALTERE'), 'altération');
    ok(evts(p, 'ged.integrite.alerte').length === 1, 'altération tracée');
  });

  // ── GD-06 (R112) — accès habilité (default-deny) et tracé ──
  await it('GD-06 FISCAL : RM refusé (refus TRACÉ) ; CO servi (accès tracé lecteur/version)', async () => {
    const { p, s } = mk();
    const d: any = await s.deposer(CO, { clientId: 'c1', typeCode: 'FISCAL', nom: 'Attestation', contenu: 'F' });
    await rejects(s.restituer(RM, d.id, 'F'), 'non autorisé');
    ok(evts(p, 'ged.acces.refuse').length === 1 && evts(p, 'ged.acces.refuse')[0].payload.lecteur === 'a.gharsallah', 'refus default-deny tracé');
    await s.restituer(CO, d.id, 'F');
    const acces = evts(p, 'ged.acces');
    ok(acces.length === 1 && acces[0].payload.lecteur === 'i.vernet' && acces[0].payload.version === 1, 'qui a vu quoi : lecteur (jeton) + version');
  });
  await it('GD-06 type inconnu du référentiel → default-deny aussi', async () => {
    const { p, s } = mk();
    const d: any = await s.deposer(CO, { clientId: 'c1', typeCode: 'INCONNU', nom: 'X', contenu: 'Y' });
    await rejects(s.restituer(CO, d.id, 'Y'), 'non autorisé');
  });

  // ── garde transverse ──
  await it('R109 isolation tenant : document d\'un autre tenant introuvable', async () => {
    const { s } = mk();
    await rejects(s.restituer({ ...CO, tenantId: 't2' }, 'D-1', 'X'), 'introuvable');
  });

  console.log(`\nCâblage GED (GD-01..06, R109→R112) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
