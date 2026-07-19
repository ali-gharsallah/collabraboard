/**
 * Câblage Gouvernance des paramètres — RQ-01..RQ-06 (R125→R128). Miroir strict de l'amendement.
 * Le questionnaire R-Q devient exécutable : registre typé, changements motivés datés append-only,
 * rejeu à date, activation gated. Faux Prisma en mémoire.
 *
 * Harnais : compiler parametres.service.ts + ce fichier ;
 *   echo "── Câblage paramètres R-Q (RQ-01..06, R125→R128) ──"; run parametres.wiring.spec.js
 */
import { ParametresService, REGISTRE_RQ } from './parametres.service';
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

function fakePrisma() {
  let seq = 0; const id = (p: string) => `${p}-${++seq}`;
  const db = { tenants: [{ id: 't1', name: 'GWB', settings: {}, statut: 'PROVISIONING',
    rqSignePar: null, rqSigneAt: null }], changes: [] as any[], events: [] as any[] };
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
    tenant: table(db.tenants, 'T'), tenantParamChange: table(db.changes, 'C'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);
const CO = { tenantId: 't1', userId: 'i.vernet', role: 'CO' };
const J = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
const mk = () => { const p = fakePrisma(); return { p, s: new ParametresService(p, fakeAudit()) }; };

(async () => {
  // ── RQ-01 (R125) — plus de paramètre sauvage ──
  await it('RQ-01 clé inconnue → refus ; mauvais type → refus ; valide + motif → accepté et matérialisé', async () => {
    const { p, s } = mk();
    await rejects(s.ecrire(CO, 'parametreInvente', 42, 'test'), 'inconnue');
    await rejects(s.ecrire(CO, 'pmsDriftToleranceBp', 'beaucoup', 'test'), 'int');
    await rejects(s.ecrire(CO, 'iaPseudonymise', 'oui', 'test'), 'bool');
    await s.ecrire(CO, 'pmsDriftToleranceBp', 300, 'Comité des risques du 19.07 — tolérance élargie');
    ok((p._db.tenants[0].settings as any).pmsDriftToleranceBp === 300, 'vue courante matérialisée');
  });

  // ── RQ-02 (R125) — le questionnaire se génère du registre ──
  await it('RQ-02 registre() = questionnaire généré : clé, type, défaut, règle Rxx, requis', async () => {
    const { s } = mk();
    const reg: any[] = await s.registre();
    ok(reg.length >= 10, 'au moins les paramètres de la journée');
    ok(reg.every((e) => e.cle && e.type && 'defaut' in e && /^R\d+/.test(e.regle) && typeof e.requis === 'boolean'),
       'chaque entrée : clé, type, défaut, règle de rattachement, requis');
    const drift = reg.find((e) => e.cle === 'pmsDriftToleranceBp');
    ok(drift.regle.includes('R105') && drift.defaut === 200, 'rattachement R105, défaut 200');
    ok(REGISTRE_RQ === reg || Array.isArray(REGISTRE_RQ), 'le registre est LE code, pas un doc');
  });

  // ── RQ-03 (R126) — pas de motif, pas de changement ──
  await it('RQ-03 sans motif → R7 ; motivé → événement avant/après/auteur/date d\'effet', async () => {
    const { p, s } = mk();
    await rejects(s.ecrire(CO, 'pmsBreachDelaiJours', 20, ''), 'R7');
    await s.ecrire(CO, 'pmsBreachDelaiJours', 20, 'Directive interne 2026-07');
    const e = evts(p, 'param.change');
    ok(e.length === 1 && e[0].payload.avant === 30 && e[0].payload.apres === 20
       && e[0].payload.par === 'i.vernet' && !!e[0].payload.effetAt, 'avant(défaut)/après/jeton/effet');
    ok(p._db.changes.length === 1, 'registre append-only alimenté');
  });

  // ── RQ-04 (R126) — effet différé = droit, rétroactif = refus ──
  await it('RQ-04 effet J+30 → valeur effective INCHANGÉE avant l\'échéance (R29) ; rétroactif → refus', async () => {
    const { p, s } = mk();
    await s.ecrire(CO, 'onboardingSlaJours', { COLLECTE: 20, KYC_EN_COURS: 45, DECISION: 10 },
      'Resserrement au 1er août', J(30));
    const now: any = await s.valeurEffective(CO, 'onboardingSlaJours', new Date());
    ok(now.COLLECTE === 30, 'avant l\'échéance : le DÉFAUT reste effectif');
    ok((p._db.tenants[0].settings as any).onboardingSlaJours === undefined, 'vue courante pas matérialisée avant effet');
    const apres: any = await s.valeurEffective(CO, 'onboardingSlaJours', new Date(J(31)));
    ok(apres.COLLECTE === 20, 'à l\'échéance : la nouvelle valeur');
    await rejects(s.ecrire(CO, 'pmsDriftToleranceBp', 100, 'test', J(-5)), 'rétroactif');
  });

  // ── RQ-05 (R127) — la valeur d'alors, pas celle d'aujourd'hui ──
  await it('RQ-05 3 changements datés → à date intermédiaire la valeur d\'alors ; avant tout : le défaut', async () => {
    const { p, s } = mk();
    await s.ecrire(CO, 'pmsDriftToleranceBp', 250, 'v1');
    await s.ecrire(CO, 'pmsDriftToleranceBp', 300, 'v2', J(10));
    await s.ecrire(CO, 'pmsDriftToleranceBp', 350, 'v3', J(20));
    ok(await s.valeurEffective(CO, 'pmsDriftToleranceBp', new Date(J(-1))) === 200, 'avant tout : défaut');
    ok(await s.valeurEffective(CO, 'pmsDriftToleranceBp', new Date()) === 250, 'aujourd\'hui : v1');
    ok(await s.valeurEffective(CO, 'pmsDriftToleranceBp', new Date(J(15))) === 300, 'à J+15 : v2 (pas v3)');
    ok(await s.valeurEffective(CO, 'pmsDriftToleranceBp', new Date(J(25))) === 350, 'à J+25 : v3');
    const cfg: any = await s.configALaDate(CO, new Date(J(15)));
    ok(cfg.pmsDriftToleranceBp === 300 && cfg.iaPseudonymise === true, 'config complète à date (défauts inclus)');
  });

  // ── RQ-06 (R128) — pas de go-live sur un questionnaire troué ──
  await it('RQ-06 REQUIS manquant → refus listé ; complet + signé → ACTIF + événement', async () => {
    const { p, s } = mk();
    const r1: any = await s.activer(CO, 'Direction GWB — M. Weber').catch((e: Error) => e);
    ok(r1 instanceof Error && r1.message.includes('gedDocTypes'), 'manquants listés (gedDocTypes est REQUIS sans défaut suffisant)');
    // renseigner tous les REQUIS
    const reg: any[] = await s.registre();
    for (const e of reg.filter((x) => x.requis)) {
      await s.ecrire(CO, e.cle, e.exemple ?? e.defaut, 'Questionnaire R-Q — réponse validée GWB');
    }
    await s.activer(CO, 'Direction GWB — M. Weber');
    ok(p._db.tenants[0].statut === 'ACTIF' && p._db.tenants[0].rqSignePar === 'Direction GWB — M. Weber', 'ACTIF + signataire');
    ok(evts(p, 'tenant.active').length === 1, 'activation tracée');
  });

  // ── garde transverse ──
  await it('R125 isolation tenant : écrire pour un autre tenant → introuvable', async () => {
    const { s } = mk();
    await rejects(s.ecrire({ ...CO, tenantId: 't2' }, 'pmsDriftToleranceBp', 300, 'test'), 'introuvable');
  });

  console.log(`\nCâblage paramètres R-Q (RQ-01..06, R125→R128) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
