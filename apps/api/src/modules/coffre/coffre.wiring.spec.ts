/**
 * Câblage Coffre — CV-01..CV-06 (R144→R147). Miroir strict de l'amendement.
 * Le contenu vit au coffre (clé déterministe, jamais en base), la lecture re-vérifie toujours,
 * l'isolation tenant est structurelle, l'effacement n'existe que par R115, l'inventaire mesure.
 * Faux Prisma + faux StoragePort en mémoire. Écrit AVANT l'implémentation.
 *
 * Harnais : compiler coffre.service.ts + ce fichier ;
 *   echo "── Câblage Coffre (CV-01..06, R144→R147) ──"; run coffre.wiring.spec.js
 */
import { CoffreService } from './coffre.service';
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
    versions: seed.versions ?? [], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
    if (v === null) return row[k] == null;
    if (v && typeof v === 'object' && 'not' in v) return row[k] !== v.not && row[k] != null;
    return row[k] === v;
  });
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((x) => match(x, where)),
    findFirst: async ({ where }: any = {}) => rows.find((x) => match(x, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
  });
  const p: any = { _db: db, tenant: table(db.tenants, 'T'),
    document: table(db.documents, 'D'), documentVersion: table(db.versions, 'V'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);

function fakeStorage() {
  const coffre = new Map<string, string>();
  const appels: any[] = [];
  return { coffre, appels,
    port: {
      ecrire: async (cle: string, contenu: string, opts: any) => { appels.push({ op: 'ecrire', cle, opts }); coffre.set(cle, contenu); },
      lire: async (cle: string) => { appels.push({ op: 'lire', cle });
        if (!coffre.has(cle)) throw new Error(`clé absente du coffre : ${cle}`); return coffre.get(cle)!; },
      supprimer: async (cle: string) => { appels.push({ op: 'supprimer', cle }); coffre.delete(cle); },
      lister: async (prefixe: string) => [...coffre.keys()].filter((k) => k.startsWith(prefixe)),
    } };
}
const CO = { tenantId: 't1', userId: 'i.vernet', role: 'CO' };
const V1 = { id: 'v1', tenantId: 't1', documentId: 'd1', numero: 1, sha256: sha('CONTENU-2026'), storageKey: null };
const mk = (settings: any = {}, storage: any = fakeStorage()) => {
  const p = fakePrisma({ tenants: [{ id: 't1', name: 'GWB', settings }],
    documents: [{ id: 'd1', tenantId: 't1', statut: 'ACTIF', legalHold: false, destructionProposee: false }],
    versions: [{ ...V1 }] });
  return { p, st: storage, s: new CoffreService(p, fakeAudit(), { storage: storage.port }) };
};

(async () => {
  // ── CV-01 (R144) — le coffre reçoit, la base ne garde que la preuve ──
  await it('CV-01 dépôt → clé déterministe t1/d1/v1 au port, base = empreinte + clé, AUCUN contenu ; sans port → refus', async () => {
    const { p, st, s } = mk();
    await s.ecrire(CO, 'v1', 'CONTENU-2026');
    ok(st.appels[0].op === 'ecrire' && st.appels[0].cle === 't1/d1/v1', 'clé déterministe');
    ok(st.coffre.get('t1/d1/v1') === 'CONTENU-2026', 'le contenu vit AU COFFRE');
    const v = p._db.versions[0];
    ok(v.storageKey === 't1/d1/v1' && !JSON.stringify(v).includes('CONTENU-2026'), 'base : clé + empreinte, jamais le contenu');
    ok(evts(p, 'coffre.ecrit').length === 1, 'écriture tracée');
    const sans = new CoffreService(fakePrisma({ tenants: [{ id: 't1', settings: {} }], versions: [{ ...V1 }] }), fakeAudit(), {});
    await rejects(sans.ecrire(CO, 'v1', 'X'), 'coffre');
  });

  // ── CV-02 (R144) — la résidence est un paramètre du registre ──
  await it('CV-02 storageRegion tenant ch-dk-2 → transmise au port ; défaut ch-gva-2', async () => {
    const a = mk();
    await a.s.ecrire(CO, 'v1', 'CONTENU-2026');
    ok(a.st.appels[0].opts.region === 'ch-gva-2', 'défaut Genève');
    const b = mk({ storageRegion: 'ch-dk-2' });
    await b.s.ecrire(CO, 'v1', 'CONTENU-2026');
    ok(b.st.appels[0].opts.region === 'ch-dk-2', 'R-Q fait foi');
  });

  // ── CV-03 (R145) — l'altération au coffre ne sert RIEN ──
  await it('CV-03 lecture conforme → servie ; coffre altéré → REFUS + non servi + alerte tracée', async () => {
    const { p, st, s } = mk();
    await s.ecrire(CO, 'v1', 'CONTENU-2026');
    const lu: any = await s.lire(CO, 'v1');
    ok(lu === 'CONTENU-2026', 'conforme → servi');
    st.coffre.set('t1/d1/v1', 'CONTENU-ALTERE-AU-COFFRE');
    await rejects(s.lire(CO, 'v1'), 'intégrité');
    ok(evts(p, 'coffre.integrite.alerte').length === 1, 'alerte tracée');
  });

  // ── CV-04 (R146) — isolation structurelle + chiffrement transmis ──
  await it('CV-04 clé d\'un autre tenant → refus structurel (préfixe) ; chiffrementRef du tenant transmis', async () => {
    const { st, s } = mk({ storageChiffrement: 'kms:t1-enveloppe' });
    await s.ecrire(CO, 'v1', 'CONTENU-2026');
    ok(st.appels[0].opts.chiffrementRef === 'kms:t1-enveloppe', 'chiffrement par tenant transmis');
    await rejects(s.lire({ tenantId: 't2', userId: 'x', role: 'CO' }, 'v1'), 'introuvable');
    const svc: any = s;
    ok(typeof svc.lireParCle === 'function' ? await svc.lireParCle({ tenantId: 't2', userId: 'x', role: 'CO' }, 't1/d1/v1')
      .then(() => false, (e: Error) => /tenant/.test(e.message)) : true, 'préfixe vérifié structurellement');
  });

  // ── CV-05 (R146/R115) — on n'efface qu'en certifiant ──
  await it('CV-05 purge hors destruction certifiée → refus ; certifiée → coffre purgé, empreinte + certificat SURVIVENT', async () => {
    const { p, st, s } = mk();
    await s.ecrire(CO, 'v1', 'CONTENU-2026');
    await rejects(s.purgerCertifie(CO, 'v1', ''), 'R7');
    p._db.documents[0].statut = 'ACTIF';
    await rejects(s.purgerCertifie(CO, 'v1', 'Rétention échue'), 'R115');
    p._db.documents[0].statut = 'DETRUIT';   // la destruction certifiée R115 est passée côté GED
    await s.purgerCertifie(CO, 'v1', 'Destruction certifiée GD — rétention échue');
    ok(!st.coffre.has('t1/d1/v1'), 'coffre purgé');
    const v = p._db.versions[0];
    ok(v.sha256 === sha('CONTENU-2026') && v.storageKey === null, 'empreinte SURVIT, clé effacée');
    ok(evts(p, 'coffre.purge.certifiee').length === 1, 'certificat tracé');
  });

  // ── CV-06 (R147) — l'inventaire alerte, ne touche à rien ──
  await it('CV-06 orphelin coffre → alerte ; version sans contenu → alerte CRITIQUE + tâche ; UNE fois, rien touché', async () => {
    const { p, st, s } = mk();
    await s.ecrire(CO, 'v1', 'CONTENU-2026');
    st.coffre.set('t1/dX/v9', 'ORPHELIN');                       // au coffre, pas en base
    p._db.versions.push({ id: 'v2', tenantId: 't1', documentId: 'd1', numero: 2,
      sha256: sha('JAMAIS-ECRIT'), storageKey: 't1/d1/v2' });    // en base, pas au coffre
    await s.reconcilier(CO);
    await s.reconcilier(CO);
    ok(evts(p, 'coffre.reconciliation.orphelin').length === 1, 'orphelin : alerte une fois');
    ok(evts(p, 'coffre.reconciliation.manquant').length === 1 && evts(p, 'tache.coffre.reconciliation').length === 1, 'manquant : CRITIQUE + tâche une fois');
    ok(st.coffre.has('t1/dX/v9') && st.coffre.has('t1/d1/v1'), 'RIEN supprimé ni recréé (R39)');
  });

  console.log(`\nCâblage Coffre (CV-01..06, R144→R147) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
