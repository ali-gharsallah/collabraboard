/**
 * Câblage Dossiers-vues — VU-01..05 (R164→R166). Miroir strict de l'amendement.
 * La vue est une requête, jamais une copie ; elle s'évalue au résultat ; elle suit la vie.
 * Faux Prisma en mémoire. Écrit AVANT l'implémentation.
 *
 * Harnais : compiler vues.service.ts + ce fichier ;
 *   echo "── Câblage Dossiers-vues (VU-01..05, R164→R166) ──"; run vues.wiring.spec.js
 */
import { VuesService } from './vues.service';
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
  const db = { tenants: seed.tenants ?? [], documents: seed.documents ?? [],
    vues: [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
    if (v === null) return row[k] == null;
    if (v && typeof v === 'object' && 'lte' in v) return row[k] != null && String(row[k]) <= String(v.lte);
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
    gedVue: table(db.vues, 'VU'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);

const CF = { tenantId: 't1', userId: 'c.fiore', role: 'CF' };
const RM = { tenantId: 't1', userId: 'a.gharsallah', role: 'RM' };
const STG = { tenantId: 't1', userId: 's.tagger', role: 'STAGIAIRE' };
const mk = () => {
  const p = fakePrisma({ tenants: [{ id: 't1', name: 'GWB', settings: { gedDocTypes: [
    { code: 'PASSEPORT', rolesAutorises: ['RM', 'CO', 'CF'] }, { code: 'FISCAL', rolesAutorises: ['CF'] }],
    gedInboxRoles: ['CO', 'CF'] } }],
    documents: [
      { id: 'd1', tenantId: 't1', clientId: 'cli-1', typeCode: 'PASSEPORT', statut: 'ACTIF', nom: 'passeport.pdf', expireAt: '2026-11-01' },
      { id: 'd2', tenantId: 't1', clientId: 'cli-1', typeCode: 'FISCAL', statut: 'ACTIF', nom: 'fiscal.pdf', expireAt: null }] });
  return { p, s: new VuesService(p, fakeAudit()) };
};

(async () => {
  // ── VU-01 (R164) — N vues, un document, zéro copie ; le retrait ne détruit rien ──
  await it('VU-01 2 vues montrent le même passeport, la base n\'en porte qu\'UN ; retirer la vue (motivé) laisse le doc intact', async () => {
    const { p, s } = mk();
    await s.creerVue(CF, { code: 'expire-2026', label: 'Passeports expirant 2026',
      critere: { typeCode: 'PASSEPORT', expireAvant: '2027-01-01' } });
    await s.creerVue(CF, { code: 'client-x', label: 'Tout le client X', critere: { clientId: 'cli-1' } });
    const v1: any[] = await s.evaluer(CF, 'expire-2026');
    const v2: any[] = await s.evaluer(CF, 'client-x');
    ok(v1.some((d) => d.id === 'd1') && v2.some((d) => d.id === 'd1'), 'le passeport apparaît dans les DEUX vues');
    ok(p._db.documents.filter((d: any) => d.id === 'd1').length === 1, 'la base n\'en porte qu\'UN — zéro copie');
    await rejects(s.retirerVue(CF, 'expire-2026', ''), 'R7');
    await s.retirerVue(CF, 'expire-2026', 'Vue obsolète — campagne 2026 close');
    ok(p._db.vues.length === 1 && p._db.documents.length === 2, 'la vue est partie, les documents sont INTACTS');
    ok(evts(p, 'ged.vue.retiree').length === 1, 'retrait tracé');
  });

  // ── VU-02 (R165) — même vue, deux rôles, deux contenus ──
  await it('VU-02 la vue « client X » : CF voit 2, RM voit 1 (le FISCAL n\'existe pas) ; évaluation tracée sans contenus', async () => {
    const { p, s } = mk();
    await s.creerVue(CF, { code: 'client-x', label: 'Client X', critere: { clientId: 'cli-1' } });
    const vCF: any[] = await s.evaluer(CF, 'client-x');
    const vRM: any[] = await s.evaluer(RM, 'client-x');
    ok(vCF.length === 2, 'CF : les deux');
    ok(vRM.length === 1 && vRM[0].id === 'd1', 'RM : le FISCAL n\'y apparaît ni en titre ni en compteur');
    const tr = evts(p, 'ged.vue.evaluee');
    ok(tr.length === 2 && tr[1].payload.par === 'a.gharsallah' && tr[1].payload.nbServis === 1
      && !JSON.stringify(tr).includes('fiscal.pdf'), 'la trace dit qui a regardé quoi — jamais les contenus');
  });

  // ── VU-03 (R166) — l'oubli traverse les vues ──
  await it('VU-03 document DETRUIT → il disparaît de toutes les vues, sans action', async () => {
    const { p, s } = mk();
    await s.creerVue(CF, { code: 'client-x', label: 'Client X', critere: { clientId: 'cli-1' } });
    ok((await s.evaluer(CF, 'client-x') as any[]).length === 2, 'avant : 2');
    await p.document.update({ where: { id: 'd1' }, data: { statut: 'DETRUIT' } });
    const apres: any[] = await s.evaluer(CF, 'client-x');
    ok(apres.length === 1 && apres[0].id === 'd2', 'le détruit n\'apparaît plus — la vue est une requête, l\'état fait foi');
  });

  // ── VU-04 (R164) — habilitation + code unique ──
  await it('VU-04 STAGIAIRE crée → refus tracé ; code en doublon → refus', async () => {
    const { p, s } = mk();
    await rejects(s.creerVue(STG, { code: 'x', label: 'X', critere: {} }), 'habilité');
    ok(evts(p, 'ged.vue.acces.refuse').length === 1, 'tentative tracée');
    await s.creerVue(CF, { code: 'client-x', label: 'Client X', critere: { clientId: 'cli-1' } });
    await rejects(s.creerVue(CF, { code: 'client-x', label: 'Doublon', critere: {} }), 'existe');
  });

  // ── VU-05 (garde) — tenant structurel + vue inconnue ──
  await it('VU-05 t2 évalue la vue de t1 → introuvable ; vue inconnue → introuvable', async () => {
    const { s } = mk();
    await s.creerVue(CF, { code: 'client-x', label: 'Client X', critere: { clientId: 'cli-1' } });
    await rejects(s.evaluer({ tenantId: 't2', userId: 'x', role: 'CF' }, 'client-x'), 'introuvable');
    await rejects(s.evaluer(CF, 'fantome'), 'introuvable');
  });

  console.log(`\nCâblage Dossiers-vues (VU-01..05, R164→R166) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
