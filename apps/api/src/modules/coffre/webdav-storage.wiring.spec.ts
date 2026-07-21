/**
 * Câblage Adaptateur WebDAV — WD-01..05. AUCUNE règle nouvelle : R180→R182 + R145 en
 * CHAIR — le CoffreService RATIFIÉ tourne tel quel sur un serveur WebDAV (simulé aux
 * preuves, réel en production : le transport est injectable). Écrit AVANT l'adaptateur.
 *
 * Harnais : compiler webdav-storage.adapter.ts + ce fichier ;
 *   echo "── Câblage Adaptateur WebDAV (WD-01..05, R180→R182/R145) ──"; run webdav-storage.wiring.spec.js
 */
import { createHash } from 'crypto';
import { URL } from 'url';
import { WebDavStorageAdapter } from './webdav-storage.adapter';
import { TiersIndisponibleError } from './ged-externe.adapter';
import { StorageResolverService } from './storage-resolver.service';
import { CoffreService } from './coffre.service';
declare const process: { exit(n: number): void };

let passed = 0, failed = 0; const fails: string[] = [];
function it(name: string, fn: () => Promise<void>): Promise<void> {
  return fn().then(() => { passed++; }, (e: Error) => { failed++; fails.push(`✗ ${name} — ${e.message}`); });
}
const ok = (c: boolean, m = 'assertion') => { if (!c) throw new Error(m); };
async function rejects(p: Promise<unknown>, part: string): Promise<string> {
  try { await p; } catch (e) { const msg = (e as Error).message;
    if (msg.includes(part)) return msg;
    throw new Error(`attendu «${part}», obtenu «${msg}»`); }
  throw new Error(`refus «${part}» attendu`);
}
function fakePrisma(seed: any = {}) {
  let seq = 0; const id = (p: string) => `${p}-${++seq}`;
  const db = { tenants: seed.tenants ?? [], versions: seed.versions ?? [], tasks: [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => row[k] === v);
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((x) => match(x, where)),
    findFirst: async ({ where }: any = {}) => rows.find((x) => match(x, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
  });
  const p: any = { _db: db, tenant: table(db.tenants, 'T'), documentVersion: table(db.versions, 'V'), task: table(db.tasks, 'K'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const CO = { tenantId: 't1', userId: 'i.vernet', role: 'CO' };
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

// ── Serveur WebDAV en mémoire : PUT/GET/MKCOL, modes panne & falsification ──
function serveurWebDav() {
  const objets: Record<string, string> = {};
  const etat = { panne: false, requetes: [] as { method: string; url: string; auth?: string }[] };
  const transport = async (url: string, init: any) => {
    etat.requetes.push({ method: init.method, url, auth: init.headers?.Authorization });
    if (etat.panne) throw new Error('ECONNREFUSED 10.0.0.9:443');
    const chemin = decodeURIComponent(new URL(url).pathname);
    if (init.method === 'MKCOL') return { status: objets['COL:' + chemin] ? 405 : (objets['COL:' + chemin] = '1', 201), text: async () => '' };
    if (init.method === 'PUT') { objets[chemin] = init.body; return { status: 201, text: async () => '' }; }
    if (init.method === 'GET') {
      if (!(chemin in objets)) return { status: 404, text: async () => '' };
      return { status: 200, text: async () => objets[chemin] };
    }
    if (init.method === 'DELETE') { const y = chemin in objets; delete objets[chemin]; return { status: y ? 204 : 404, text: async () => '' }; }
    if (init.method === 'PROPFIND') {
      const sous = Object.keys(objets).filter((k) => !k.startsWith('COL:') && k.startsWith(chemin));
      if (!sous.length && !objets['COL:' + chemin]) return { status: 404, text: async () => '' };
      const corps = '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">' +
        sous.map((k) => '<d:response><d:href>' + k.split('/').map(encodeURIComponent).join('/') + '</d:href></d:response>').join('') +
        '</d:multistatus>';
      return { status: 207, text: async () => corps };
    }
    return { status: 405, text: async () => '' };
  };
  return { objets, etat, transport };
}
const mk = () => {
  const p = fakePrisma({
    tenants: [{ id: 't1', name: 'GWB', settings: { docStorage: { adaptateur: 'GED_EXTERNE' } } }],
    versions: [{ id: 'v-1', tenantId: 't1', documentId: 'd-1', numero: 1, sha256: sha('CONTRAT SIGNE — GWB/DUPONT') }] });
  const srv = serveurWebDav();
  const dav = new WebDavStorageAdapter(
    { baseUrl: 'https://ged.banque.ch/dav', user: 'olive', password: 'S3cret!', prefixe: 'olive' }, srv.transport);
  const resolver = new StorageResolverService(p, { GED_EXTERNE: dav });
  return { p, srv, dav, resolver };
};

(async () => {
  // ── WD-01 (R181) — le coffre RATIFIÉ, tel quel, sur WebDAV ──
  await it('WD-01 dépôt + relecture vérifiée par le coffre ratifié — l\'objet vit chez le tiers', async () => {
    const { p, srv, resolver } = mk();
    const coffre = new CoffreService(p, fakeAudit(), { storage: await resolver.resolve(CO) });
    await coffre.ecrire(CO, 'v-1', 'CONTRAT SIGNE — GWB/DUPONT');
    const chemins = Object.keys(srv.objets).filter((k) => !k.startsWith('COL:'));
    ok(chemins.length === 1 && chemins[0].startsWith('/dav/olive/t1/'), 'l\'objet vit chez le tiers, préfixé olive/tenant');
    const lu: any = await coffre.lire(CO, 'v-1');
    ok((lu.contenu ?? lu) === 'CONTRAT SIGNE — GWB/DUPONT', 'relecture conforme servie');
    const cles = await (await resolver.resolve(CO)).lister('t1');
    ok(cles.length === 1 && cles[0].startsWith('t1/'), 'lister restitue les clés relatives — le port est complet');
  });

  // ── WD-02 (R145/R181) — la falsification chez le tiers se voit ──
  await it('WD-02 objet falsifié côté serveur → le coffre refuse « intégrité » — l\'hébergeur n\'a pas à être de confiance', async () => {
    const { p, srv, resolver } = mk();
    const coffre = new CoffreService(p, fakeAudit(), { storage: await resolver.resolve(CO) });
    await coffre.ecrire(CO, 'v-1', 'CONTRAT SIGNE — GWB/DUPONT');
    const chemin = Object.keys(srv.objets).filter((k) => !k.startsWith('COL:'))[0];
    srv.objets[chemin] = 'CONTRAT FALSIFIE';
    await rejects(coffre.lire(CO, 'v-1'), 'intégrité');
  });

  // ── WD-03 (R182) — la panne est explicite et signalée, jamais silencieuse ──
  await it('WD-03 panne réseau → TiersIndisponibleError + événement ged.externe.indisponible ; 404 → explicite aussi', async () => {
    const { p, srv, resolver, dav } = mk();
    const port = await resolver.resolve(CO);   // instrumenté par le résolveur
    srv.etat.panne = true;
    await rejects(port.lire('t1/x/y'), 'indisponible');
    ok(p._db.events.some((e: any) => e.type === 'ged.externe.indisponible'), 'le signal R182 est émis');
    srv.etat.panne = false;
    const e404 = await rejects(dav.lire('t1/jamais/depose'), 'absent');
    ok(e404.includes('404'), 'l\'absence est dite, pas maquillée');
  });

  // ── WD-04 — la sûreté du chemin ──
  await it('WD-04 clés traversantes refusées ; caractères spéciaux encodés dans l\'URL', async () => {
    const { srv, dav } = mk();
    await rejects(dav.lire('t1/../autre-tenant/doc'), 'invalide');
    await dav.ecrire('t1/dossier 2026/pi\u00E8ce#1', 'X', { region: 'ch-gva-2' });
    const put = srv.etat.requetes.find((r) => r.method === 'PUT');
    ok(!!put && put.url.includes('dossier%202026') && put.url.includes('pi%C3%A8ce%231'), 'chaque segment est encodé — rien ne s\'interprète');
  });

  // ── WD-05 — le secret voyage en en-tête, jamais ailleurs ──
  await it('WD-05 Authorization présent sur chaque requête ; le secret n\'apparaît ni dans l\'URL ni dans les erreurs', async () => {
    const { srv, dav } = mk();
    await dav.ecrire('t1/a/b', 'X', { region: 'ch-gva-2' });
    ok(srv.etat.requetes.every((r) => (r.auth ?? '').startsWith('Basic ')), 'Basic sur chaque requête');
    ok(srv.etat.requetes.every((r) => !r.url.includes('S3cret')), 'jamais dans l\'URL');
    srv.etat.panne = true;
    const msg = await rejects(dav.lire('t1/a/b'), 'indisponible');
    ok(!msg.includes('S3cret'), 'jamais dans un message d\'erreur');
  });

  console.log(`\nCâblage Adaptateur WebDAV (WD-01..05, R180→R182/R145) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
