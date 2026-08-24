/**
 * Câblage personnes — P-01..P-08 (R30→R36) à travers le SERVICE PERSISTANT.
 * Port fidèle du moteur de référence (olive_engine/domain.py, bloc 4, 8/8 verts) :
 * mêmes sémantiques, persistance Prisma, « dossier » = KycFile (porte le RM),
 * tâches et notifications = ÉVÉNEMENTS TRACÉS (invariant n°1 — pas d'effet de bord).
 * Paramètres tenant (R31 cumul, R33 délai) lus dans Tenant.settings (voie R-Q).
 *
 * Harnais : compiler personnes.service.ts + ce fichier ;
 *   echo "── Câblage personnes (P-01..08, R30→R36) ──"; run personnes.wiring.spec.js
 */
import { PersonnesService } from './personnes.service';
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

// ── Faux Prisma : tables mémoire, deleteMany inclus, filtres tenant appliqués ──
function fakePrisma(seed: { tenants?: any[]; kycs?: any[]; clients?: any[] } = {}) {
  let seq = 0; const id = (p: string) => `${p}-${++seq}`;
  const db = { tenants: seed.tenants ?? [], persons: [] as any[], roles: [] as any[],
    relations: [] as any[], kycs: seed.kycs ?? [], clients: seed.clients ?? [], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
    if (k === 'OR') return v.some((w: any) => match(row, w));
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    return row[k] === v;
  });
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((r) => match(r, where)),
    findFirst: async ({ where }: any = {}) => rows.find((r) => match(r, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
    deleteMany: async ({ where }: any = {}) => { const n = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], where)) rows.splice(i, 1);
      return { count: n - rows.length }; },
  });
  const p: any = { _db: db,
    tenant: table(db.tenants, 'T'), person: table(db.persons, 'P'),
    personRole: table(db.roles, 'R'), personRelation: table(db.relations, 'REL'),
    kycFile: table(db.kycs, 'K'), client: table(db.clients, 'C'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; } },
  };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, type: string) => p._db.events.filter((e: any) => e.type === type);

const CTX = { tenantId: 't1', userId: 'central.file', role: 'CO' };
const TENANT = (settings: any = {}) => ({ id: 't1', name: 'GWB', settings });
// Schéma RÉEL (solde A3, 2026-07-28) : le RM vit sur le CLIENT (Client.rmUserId, matrice A.3),
// le dossier ne porte que clientId — l'ancien faux champ kycFile.rmId masquait l'anomalie.
const KYCS5 = ['k1', 'k2', 'k3', 'k4', 'k5'].map((kid, i) =>
  ({ id: kid, tenantId: 't1', code: `KYC-${kid}`, clientId: `c${i + 1}`, riskLevel: 'MEDIUM' }));
const CLIENTS5 = ['c1', 'c2', 'c3', 'c4', 'c5'].map((cid, i) =>
  ({ id: cid, tenantId: 't1', rmUserId: `rm${i + 1}` }));

async function personneDans5Dossiers(settings: any = {}) {
  const p = fakePrisma({ tenants: [TENANT(settings)], kycs: KYCS5.map((k) => ({ ...k })), clients: CLIENTS5.map((c) => ({ ...c })) });
  const s = new PersonnesService(p, fakeAudit());
  const dupont: any = await s.creer(CTX, { nom: 'M. Dupont', donnees: { passeport: 'X-111' } });
  for (const k of KYCS5) await s.lier(CTX, k.id, dupont.id, 'titulaire');
  p._db.events.length = 0;   // on ne mesure que la suite
  return { p, s, dupont };
}

(async () => {
  // ── P-01 (R30) — propagation par événement CoC, jamais de synchro silencieuse ──
  await it('P-01 nouveau passeport → CoC + tâche GED + 5 RM alertés + 5 propagations', async () => {
    const { p, s, dupont } = await personneDans5Dossiers();
    await s.changementCirconstances(CTX, dupont.id, 'passeport', 'X-222', 'passeport.pdf');
    ok(evts(p, 'personne.coc.cree').length === 1, 'événement CoC créé');
    ok(evts(p, 'tache.maj_ged').length === 1, 'tâche GED générée');
    ok(evts(p, 'personne.coc.propage').length === 5, 'propagé aux 5 dossiers');
    const notifs = evts(p, 'notification');
    ok(new Set(notifs.map((n: any) => n.payload.destinataire)).size === 5, 'les 5 RM alertés');
    const pers = p._db.persons[0];
    ok(pers.donnees.passeport === 'X-222', 'la donnée vit sur la personne unique');
  });
  await it('P-01 aucune donnée modifiée silencieusement dans les dossiers', async () => {
    const { p, s, dupont } = await personneDans5Dossiers();
    const avant = JSON.stringify(p._db.kycs);
    await s.changementCirconstances(CTX, dupont.id, 'passeport', 'X-222', 'passeport.pdf');
    ok(JSON.stringify(p._db.kycs) === avant, 'les dossiers sont intacts — seulement des événements');
  });
  await it('P-01/R42 champ d\'identité (nom) → rescreening déclenché', async () => {
    const { p, s, dupont } = await personneDans5Dossiers();
    await s.changementCirconstances(CTX, dupont.id, 'nom', 'Dupond');
    ok(evts(p, 'personne.rescreening.declenche').length === 1, 'rescreening immédiat (R42)');
  });

  // ── P-02 (R31) — cumul selon politique banque (paramètre tenant) ──
  await it('P-02 politique interdit → settlor+bénéficiaire bloqué avec motif', async () => {
    const p = fakePrisma({ tenants: [TENANT({ cumulRolesAutorise: false })], kycs: [{ ...KYCS5[0] }] });
    const s = new PersonnesService(p, fakeAudit());
    const x: any = await s.creer(CTX, { nom: 'Settlor X' });
    await s.lier(CTX, 'k1', x.id, 'settlor');
    await rejects(s.lier(CTX, 'k1', x.id, 'beneficiaire'), 'Cumul de rôles interdit');
  });
  await it('P-02 politique autorise → accepté AVEC flag insider obligatoire tracé', async () => {
    const p = fakePrisma({ tenants: [TENANT({ cumulRolesAutorise: true })], kycs: [{ ...KYCS5[0] }] });
    const s = new PersonnesService(p, fakeAudit());
    const x: any = await s.creer(CTX, { nom: 'Settlor X' });
    await s.lier(CTX, 'k1', x.id, 'settlor');
    await s.lier(CTX, 'k1', x.id, 'beneficiaire');
    ok(p._db.persons[0].flags.includes('insider'), 'flag insider posé');
    ok(evts(p, 'personne.flag.pose').length === 1, 'pose du flag tracée');
  });

  // ── P-03 (R31) — le flag est exposé aux scénarios AML ──
  await it('P-03 flagsAml expose insider', async () => {
    const p = fakePrisma({ tenants: [TENANT({ cumulRolesAutorise: true })], kycs: [{ ...KYCS5[0] }] });
    const s = new PersonnesService(p, fakeAudit());
    const x: any = await s.creer(CTX, { nom: 'X' });
    await s.lier(CTX, 'k1', x.id, 'settlor'); await s.lier(CTX, 'k1', x.id, 'beneficiaire');
    ok((await s.flagsAml(CTX, x.id)).includes('insider'), 'exposé aux scénarios AML');
  });

  // ── P-04 (R32) — PEPisation contagieuse, aucune bascule silencieuse ──
  await it('P-04 PEP détecté → propagation + tâches de réévaluation ×5, risque intact', async () => {
    const { p, s, dupont } = await personneDans5Dossiers();
    await s.declarerPep(CTX, dupont.id, 'coc');
    ok(evts(p, 'personne.pep.propage').length === 5, 'propagé aux 5 dossiers');
    ok(evts(p, 'tache.reevaluation_pep').length === 5, 'une tâche de réévaluation par dossier');
    ok(p._db.kycs.every((k: any) => k.riskLevel === 'MEDIUM'), 'aucun niveau de risque basculé sans process');
    ok(p._db.persons[0].statutPep === true, 'statut porté par la personne');
  });

  // ── P-05 (R33) — dé-PEPisation humaine, jamais automatique ──
  await it('P-05 délai écoulé → alerte Central File, statut PEP JAMAIS levé automatiquement', async () => {
    const { p, s, dupont } = await personneDans5Dossiers();
    await s.declarerPep(CTX, dupont.id, 'coc');
    await s.finMandatPep(CTX, dupont.id, new Date('2026-01-01'));
    await s.tickPersonnes(CTX, new Date('2026-06-01'));            // avant délai (365j)
    ok(evts(p, 'personne.alerte.depep').length === 0, 'pas d\'alerte avant délai');
    await s.tickPersonnes(CTX, new Date('2027-01-05'));            // délai écoulé
    ok(evts(p, 'personne.alerte.depep').length === 1, 'alerte émise');
    ok(evts(p, 'notification').some((n: any) => n.payload.destinataire === 'central_file'), 'adressée au Central File');
    ok(p._db.persons[0].statutPep === true, 'toujours PEP — jamais levé à l\'échéance');
    await s.tickPersonnes(CTX, new Date('2027-02-01'));
    ok(evts(p, 'personne.alerte.depep').length === 1, 'alerte non répétée');
  });
  await it('P-05 levée = décision humaine tracée (décideur nommé)', async () => {
    const { p, s, dupont } = await personneDans5Dossiers();
    await s.declarerPep(CTX, dupont.id, 'coc');
    await s.leverPep({ ...CTX, userId: 'co.senior' }, dupont.id);
    ok(p._db.persons[0].statutPep === false, 'levé');
    ok(evts(p, 'personne.pep.leve')[0].payload.decideur === 'co.senior', 'décideur tracé');
  });

  // ── P-06 (R34) — bijectivité des relations informelles ──
  await it('P-06 « Dupont père d\'Ali » → réciproque automatique, visible des deux côtés', async () => {
    const p = fakePrisma({ tenants: [TENANT()] });
    const s = new PersonnesService(p, fakeAudit());
    const d: any = await s.creer(CTX, { nom: 'Dupont' }); const a: any = await s.creer(CTX, { nom: 'Ali' });
    await s.declarerRelation(CTX, d.id, a.id, 'pere_de', 'fils_de');
    const deD: any[] = await s.relationsDe(CTX, d.id); const deA: any[] = await s.relationsDe(CTX, a.id);
    ok(deD.some((r) => r.autre === a.id && r.type === 'pere_de'), 'côté Dupont');
    ok(deA.some((r) => r.autre === d.id && r.type === 'fils_de'), 'réciproque côté Ali');
    await s.supprimerRelation(CTX, a.id, d.id);   // suppression par l'AUTRE bout
    ok((await s.relationsDe(CTX, d.id)).length === 0 && (await s.relationsDe(CTX, a.id)).length === 0,
      'la suppression de l\'une supprime l\'autre');
  });

  // ── P-07 (R35) — archivage, conservation LBA, réactivation ──
  await it('P-07 dernier rôle retiré → ARCHIVEE, données conservées, réactivable', async () => {
    const p = fakePrisma({ tenants: [TENANT()], kycs: [{ ...KYCS5[0] }] });
    const s = new PersonnesService(p, fakeAudit());
    const x: any = await s.creer(CTX, { nom: 'M. Dupont', donnees: { passeport: 'X-111' } });
    await s.lier(CTX, 'k1', x.id, 'titulaire');
    await s.retirerRole(CTX, 'k1', x.id, 'titulaire');
    ok(p._db.persons[0].etat === 'ARCHIVEE', 'archivée, pas supprimée');
    ok(p._db.persons[0].donnees.passeport === 'X-111', 'données conservées (LBA)');
    await s.lier(CTX, 'k1', x.id, 'mandataire');
    ok(p._db.persons[0].etat === 'ACTIVE', 'réactivée par un nouveau rôle');
    ok(evts(p, 'personne.reactivee').length === 1, 'réactivation tracée');
  });

  // ── P-08 (R36) — divergence d'identité arbitrée par le Central File ──
  await it('P-08 divergence de naissance → dossier Central File + corroboration RM, données intactes', async () => {
    const p = fakePrisma({ tenants: [TENANT()], kycs: [{ ...KYCS5[0] }, { ...KYCS5[1] }], clients: [{ ...CLIENTS5[0] }, { ...CLIENTS5[1] }] });
    const s = new PersonnesService(p, fakeAudit());
    const x: any = await s.creer(CTX, { nom: 'M. Dupont', donnees: { naissance: '12.03.1965' } });
    await s.lier(CTX, 'k1', x.id, 'titulaire'); await s.lier(CTX, 'k2', x.id, 'titulaire');
    await s.signalerDivergence(CTX, x.id, 'naissance', { k1: '12.03.1965', k2: '21.03.1965' });
    ok(evts(p, 'central_file.dossier.ouvert').length === 1, 'dossier Central File ouvert');
    const corr = evts(p, 'tache.corroboration');
    ok(corr.length === 2 && new Set(corr.map((c: any) => c.payload.rm)).size === 2, 'corroboration auprès des RM des deux dossiers');
    ok(p._db.persons[0].donnees.naissance === '12.03.1965', 'aucune donnée modifiée avant résolution humaine');
  });

  // ── Garde transverse : isolation tenant ──
  await it('R30 isolation : une personne d\'un autre tenant est introuvable', async () => {
    const { s } = await personneDans5Dossiers();
    await rejects(s.flagsAml({ ...CTX, tenantId: 't2' }, 'P-1'), 'introuvable');
  });

  // ── ADR-PEP-001 (P-L4-1) — la décision humaine répond à la proposition, avec TRACE LIANTE ──
  await it('ADR-PEP-001 acceptation : declarerPep(sourceHitId) → statutPep=true + trace liante hit↔décision', async () => {
    const { p, s, dupont } = await personneDans5Dossiers();
    await s.declarerPep(CTX, dupont.id, 'liste PEP (proposition)', 'HIT-42');
    ok(p._db.persons[0].statutPep === true, 'PEPisation décidée par l\'humain');
    const ev = evts(p, 'personne.pep.declare')[0];
    ok(ev && ev.payload.sourceHitId === 'HIT-42' && ev.payload.source === 'liste PEP (proposition)',
      'trace liante sourceHitId portée par l\'événement');
  });
  await it('ADR-PEP-001 rejet : sans motif → refus R7 (jamais un rejet silencieux)', async () => {
    const { s } = await personneDans5Dossiers();
    await rejects(s.rejeterPropositionPep(CTX, 'pep:per1:SAN-1:2026-07-14', ''), 'R7');
  });
  await it('ADR-PEP-001 rejet motivé : événement pep.proposition.rejetee (cle, motif, auteur = jeton), statutPep intact', async () => {
    const { p, s } = await personneDans5Dossiers();
    const cle = 'pep:per1:SAN-1:2026-07-14';
    const r: any = await s.rejeterPropositionPep(CTX, cle, 'Homonymie établie sur pièce d\'identité');
    ok(r.rejetee === true, 'rejet rendu');
    const ev = evts(p, 'pep.proposition.rejetee')[0];
    ok(ev && ev.payload.cle === cle && ev.payload.par === CTX.userId && ev.payload.motif.includes('Homonymie'),
      'rejet motivé, auteur = jeton');
    ok(p._db.persons[0].statutPep === false, 'le rejet ne PEPise pas');
  });

  console.log(`\nCâblage personnes (P-01..08, R30→R36) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
