/**
 * Câblage Workflow gouverné — WF-01..05 (R171→R173). Miroir strict de l'amendement.
 * La définition est versionnée date-effective ; publiée = immuable ; le dossier emporte sa
 * version (grandfathering structurel) ; le brouillon n'existe pas pour le moteur.
 * Faux Prisma en mémoire. Écrit AVANT l'implémentation.
 *
 * Harnais : compiler workflow-def.service.ts + ce fichier ;
 *   echo "── Câblage Workflow gouverné (WF-01..05, R171→R173) ──"; run workflow-def.wiring.spec.js
 */
import { WorkflowDefService } from './workflow-def.service';
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
  const db = { tenants: seed.tenants ?? [], defs: [] as any[], events: [] as any[] };
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
  });
  const p: any = { _db: db, tenant: table(db.tenants, 'T'), workflowDef: table(db.defs, 'W'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);
const CO = { tenantId: 't1', userId: 'i.vernet', role: 'CO' };
const RM = { tenantId: 't1', userId: 'a.gharsallah', role: 'RM' };
const CONTENU_V1 = { etapes: ['SAISIE_RM', 'REVUE_CO', 'APPROBATION'], visas: { AML: ['CO'] } };
const mk = () => {
  const p = fakePrisma({ tenants: [{ id: 't1', name: 'GWB', settings: {} }] });
  return { p, s: new WorkflowDefService(p, fakeAudit()) };
};

(async () => {
  // ── WF-01 (R173) — le cycle : brouillon modifiable → publication acte jeton daté ──
  await it('WF-01 brouillon → modifier → publier (motif, depuisLe) : figé, daté, tracé', async () => {
    const { p, s } = mk();
    const b: any = await s.creerBrouillon(CO, { code: 'WF_KYC_EDD', contenu: CONTENU_V1 });
    await s.modifierBrouillon(CO, b.defId, { etapes: [...CONTENU_V1.etapes, 'COMITE'], visas: CONTENU_V1.visas });
    await s.publier(CO, b.defId, { depuisLe: '2026-01-01', motif: 'Mise en production du workflow EDD' });
    const d = p._db.defs[0];
    ok(d.statut === 'PUBLIEE' && d.depuisLe === '2026-01-01' && d.publiePar === 'i.vernet', 'acte jeton daté');
    ok(d.contenu.etapes.length === 4, 'le contenu figé est celui du brouillon final');
    ok(evts(p, 'workflow.def.publiee').length === 1, 'la publication est un événement');
  });

  // ── WF-02 (R171) — publiée = gravée ; v2 laisse v1 intacte ──
  await it('WF-02 modifier une PUBLIEE → refus ; publier v2 → v1 intacte, lisible, à sa date', async () => {
    const { p, s } = mk();
    const b: any = await s.creerBrouillon(CO, { code: 'WF_KYC_EDD', contenu: CONTENU_V1 });
    await s.publier(CO, b.defId, { depuisLe: '2026-01-01', motif: 'v1' });
    await rejects(s.modifierBrouillon(CO, b.defId, { etapes: [] }), 'R171');
    const b2: any = await s.creerBrouillon(CO, { code: 'WF_KYC_EDD', contenu: { ...CONTENU_V1, etapes: ['SAISIE_RM', 'DOUBLE_REVUE'] } });
    await s.publier(CO, b2.defId, { depuisLe: '2026-07-01', motif: 'Renforcement double revue' });
    ok(p._db.defs.length === 2 && p._db.defs[0].contenu.etapes.length === 3
      && p._db.defs[0].depuisLe === '2026-01-01', 'v1 INTACTE — l\'historique reste lisible (R48)');
    ok(p._db.defs[1].version === 2, 'la version s\'incrémente');
  });

  // ── WF-03 (R172) — le grandfathering est structurel ──
  await it('WF-03 dossier du 15.03 → v1 ; dossier du 15.07 → v2 ; v3 future → personne', async () => {
    const { s } = mk();
    const b1: any = await s.creerBrouillon(CO, { code: 'WF_KYC_EDD', contenu: CONTENU_V1 });
    await s.publier(CO, b1.defId, { depuisLe: '2026-01-01', motif: 'v1' });
    const b2: any = await s.creerBrouillon(CO, { code: 'WF_KYC_EDD', contenu: CONTENU_V1 });
    await s.publier(CO, b2.defId, { depuisLe: '2026-07-01', motif: 'v2' });
    const b3: any = await s.creerBrouillon(CO, { code: 'WF_KYC_EDD', contenu: CONTENU_V1 });
    await s.publier(CO, b3.defId, { depuisLe: '2027-01-01', motif: 'v3 future' });
    ok(((await s.resoudre(CO, 'WF_KYC_EDD', '2026-03-15')) as any).version === 1, 'le dossier de mars vit sous v1 — pour toujours');
    ok(((await s.resoudre(CO, 'WF_KYC_EDD', '2026-07-15')) as any).version === 2, 'le dossier de juillet naît sous v2');
    ok(((await s.resoudre(CO, 'WF_KYC_EDD', '2026-12-31')) as any).version === 2, 'la v3 FUTURE ne s\'applique encore à personne');
  });

  // ── WF-04 (R173) — le brouillon n'existe pas pour le moteur ; habilitation ; motif ──
  await it('WF-04 brouillon invisible à la résolution ; RM publie → refus tracé ; sans motif → R7', async () => {
    const { p, s } = mk();
    const b1: any = await s.creerBrouillon(CO, { code: 'WF_X', contenu: CONTENU_V1 });
    await s.publier(CO, b1.defId, { depuisLe: '2026-01-01', motif: 'v1' });
    await s.creerBrouillon(CO, { code: 'WF_X', contenu: { etapes: ['RIEN'] } });
    ok(((await s.resoudre(CO, 'WF_X', '2026-06-01')) as any).version === 1, 'le brouillon n\'est JAMAIS résolu (R114)');
    const b3: any = await s.creerBrouillon(CO, { code: 'WF_Y', contenu: CONTENU_V1 });
    await rejects(s.publier(RM, b3.defId, { depuisLe: '2026-01-01', motif: 'x' }), 'habilité');
    ok(evts(p, 'workflow.def.acces.refuse').length === 1, 'tentative tracée');
    await rejects(s.publier(CO, b3.defId, { depuisLe: '2026-01-01', motif: '' }), 'R7');
  });

  // ── WF-05 (garde) — tenant structurel ; la publication ne se rejoue pas ──
  await it('WF-05 t2 ne résout pas t1 ; republier une PUBLIEE → refus', async () => {
    const { s } = mk();
    const b: any = await s.creerBrouillon(CO, { code: 'WF_Z', contenu: CONTENU_V1 });
    await s.publier(CO, b.defId, { depuisLe: '2026-01-01', motif: 'v1' });
    await rejects(s.resoudre({ tenantId: 't2', userId: 'x', role: 'CO' }, 'WF_Z', '2026-06-01'), 'Aucune');
    await rejects(s.publier(CO, b.defId, { depuisLe: '2026-02-01', motif: 're' }), 'rejoue');
  });

  console.log(`\nCâblage Workflow gouverné (WF-01..05, R171→R173) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
