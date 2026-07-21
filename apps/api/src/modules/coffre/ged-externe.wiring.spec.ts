/**
 * Câblage Port GED externe — GX-01..05 (R180→R182). Miroir strict de l'amendement, écrit
 * AVANT l'implémentation. L'hébergeur est un choix (paramètre tenant gouverné) ; la preuve
 * n'en est pas un : le CoffreService RATIFIÉ tourne tel quel sur l'adaptateur externe —
 * mêmes refus, mêmes alertes, même restitution.
 *
 * Harnais : compiler storage-resolver.service.ts + ged-externe.adapter.ts + ce fichier ;
 *   echo "── Câblage Port GED externe (GX-01..05, R180→R182) ──"; run ged-externe.wiring.spec.js
 */
import { createHash } from 'crypto';
import { StorageResolverService } from './storage-resolver.service';
import { GedExterneAdapter, TiersIndisponibleError } from './ged-externe.adapter';
import { CoffreService } from './coffre.service';
import { ParametresService, REGISTRE_RQ } from '../parametres/parametres.service';
declare const process: { exit(n: number): void; env: any };

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
  const db = { tenants: seed.tenants ?? [], versions: seed.versions ?? [],
    changes: [] as any[], tasks: [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => row[k] === v);
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((x) => match(x, where)),
    findFirst: async ({ where }: any = {}) => rows.find((x) => match(x, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
  });
  const p: any = { _db: db, tenant: table(db.tenants, 'T'), documentVersion: table(db.versions, 'V'),
    tenantParamChange: table(db.changes, 'C'), task: table(db.tasks, 'K'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);
const CO = { tenantId: 't1', userId: 'i.vernet', role: 'CO' };
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

// Client tiers fake : une GED de banque qui range PAR CLÉ (contrat d'intégration)
function fakeTiers() {
  const docs: Record<string, string> = {};
  return { docs,
    deposer: async (cle: string, contenu: string) => { docs[cle] = contenu; },
    obtenir: async (cle: string) => { if (!(cle in docs)) throw new Error('introuvable chez le tiers'); return docs[cle]; },
    retirer: async (cle: string) => { delete docs[cle]; },
    parPrefixe: async (pfx: string) => Object.keys(docs).filter((k) => k.startsWith(pfx)) };
}
const mk = (docStorage: any = null) => {
  const p = fakePrisma({
    tenants: [{ id: 't1', name: 'GWB', settings: docStorage ? { docStorage } : {} }],
    versions: [{ id: 'v-1', tenantId: 't1', documentId: 'd-1', numero: 1, sha256: sha('CONTRAT SIGNE — GWB/DUPONT') }] });
  const tiers = fakeTiers();
  const interne: Record<string, string> = {};
  const portInterne = {
    ecrire: async (cle: string, contenu: string) => { interne[cle] = contenu; },
    lire: async (cle: string) => interne[cle],
    supprimer: async (cle: string) => { delete interne[cle]; },
    lister: async (pfx: string) => Object.keys(interne).filter((k) => k.startsWith(pfx)) };
  const externe = new GedExterneAdapter(tiers);
  const resolver = new StorageResolverService(p, { COFFRE_INTERNE: portInterne, GED_EXTERNE: externe });
  return { p, tiers, interne, resolver, portInterne, externe };
};

(async () => {
  // ── GX-01 (R180) — le registre, la résolution par tenant, le défaut interne ──
  await it('GX-01 registre docStorage déclaré ; sans réglage → coffre interne ; résolution par tenant', async () => {
    const { p, resolver, portInterne } = mk();
    const reg = (REGISTRE_RQ as any[]).find((r: any) => r.cle === 'docStorage');
    ok(!!reg && !!reg.description, 'docStorage vit au registre R-Q');
    const port = await resolver.resolve(CO);
    await port.ecrire('t1/sonde/v1', 'SONDE', { region: 'ch-gva-2' });
    ok((await portInterne.lire('t1/sonde/v1')) === 'SONDE', 'défaut = coffre interne — on ne devine pas un tiers (comportement, pas identité : le résolveur instrumente)');
    await rejects(new StorageResolverService(p, {}).resolve(CO), 'adaptateur');
  });

  // ── GX-02 (R180) — basculer est un acte ; les nouvelles écritures suivent ──
  await it('GX-02 bascule motivée vers GED_EXTERNE → nouvelles écritures chez le tiers, acte tracé', async () => {
    const { p, resolver, tiers, interne } = mk();
    const params = new ParametresService(p, fakeAudit());
    await params.ecrire(CO, 'docStorage', { adaptateur: 'GED_EXTERNE' },
      'La banque conserve sa GED — O-Live y dépose par contrat, les preuves restent chez O-Live');
    const coffre = new CoffreService(p, fakeAudit(), { storage: await resolver.resolve(CO) });
    await coffre.ecrire(CO, 'v-1', 'CONTRAT SIGNE — GWB/DUPONT');
    ok(Object.keys(tiers.docs).length === 1 && Object.keys(interne).length === 0, 'le dépôt vit chez le tiers, pas au coffre interne');
    ok(Object.keys(tiers.docs)[0].startsWith('t1/'), 'l\'isolation par préfixe voyage avec la clé');
    ok(p._db.changes.filter((c: any) => c.cle === 'docStorage').length === 1, 'la bascule est un acte au journal des paramètres');
  });

  // ── GX-03 (R181) — mêmes preuves chez le tiers : l'altération est refusée ──
  await it('GX-03 contenu altéré chez le tiers → refus + alerte (le coffre RATIFIÉ, tel quel, autre hébergeur)', async () => {
    const { p, resolver, tiers } = mk({ adaptateur: 'GED_EXTERNE' });
    const coffre = new CoffreService(p, fakeAudit(), { storage: await resolver.resolve(CO) });
    await coffre.ecrire(CO, 'v-1', 'CONTRAT SIGNE — GWB/DUPONT');
    const lu: any = await coffre.lire(CO, 'v-1');
    ok((lu.contenu ?? lu) === 'CONTRAT SIGNE — GWB/DUPONT', 'relecture conforme servie');
    tiers.docs[Object.keys(tiers.docs)[0]] = 'CONTRAT FALSIFIE';
    await rejects(coffre.lire(CO, 'v-1'), 'intégrité');   // le message du coffre ratifié fait foi
  });

  // ── GX-04 (R182) — la panne est un refus explicite + un signal, jamais un contournement ──
  await it('GX-04 tiers en panne → erreur explicite + événement, rien d\'écrit ailleurs', async () => {
    const { p, resolver, interne, externe } = mk({ adaptateur: 'GED_EXTERNE' });
    externe.simulerPanne(true);
    const coffre = new CoffreService(p, fakeAudit(), { storage: await resolver.resolve(CO) });
    await rejects(coffre.ecrire(CO, 'v-1', 'CONTRAT SIGNE — GWB/DUPONT'), 'indisponible');
    ok(evts(p, 'ged.externe.indisponible').length === 1, 'la panne est un SIGNAL');
    ok(Object.keys(interne).length === 0, 'aucune écriture de contournement — la disponibilité se traite au contrat, pas en silence');
  });

  // ── GX-05 (R181) — la restitution ne dépend pas de l'hébergeur ──
  await it('GX-05 lister/relire par préfixe tenant via l\'externe — la restitution est identique', async () => {
    const { resolver, tiers } = mk({ adaptateur: 'GED_EXTERNE' });
    const port = await resolver.resolve(CO);
    await port.ecrire('t1/d-1/v1', 'A', { region: 'ch-gva-2' });
    await port.ecrire('t1/d-2/v1', 'B', { region: 'ch-gva-2' });
    await port.ecrire('t2/d-9/v1', 'X', { region: 'ch-gva-2' });
    const cles = await port.lister('t1/');
    ok(cles.length === 2 && (await port.lire('t1/d-2/v1')) === 'B', 'tout le périmètre t1, rien que t1');
  });

  console.log(`\nCâblage Port GED externe (GX-01..05, R180→R182) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
