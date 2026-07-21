/**
 * Câblage KYC ↔ Workflow gouverné — KW-01..05. AUCUNE RÈGLE NOUVELLE : ces tests prouvent
 * la clause R172 (« le dossier emporte sa version ») appliquée au dossier KYC réel, via un
 * COMPOSEUR (kyc-workflow.chaine.ts) — aucun service ratifié modifié. Le KYC entre par un
 * port (KycPort — le vrai KycService y est compatible ; injection documentée à la note de
 * câblage). Le timbre est un ÉVÉNEMENT append-only (pattern maison : l'état par l'événement).
 * Écrit AVANT l'implémentation.
 *
 * Harnais : compiler kyc-workflow.chaine.ts + workflow-def.service.ts + ce fichier ;
 *   echo "── Câblage KYC↔Workflow (KW-01..05, clause R172) ──"; run kyc-workflow.chaine.wiring.spec.js
 */
import { KycWorkflowChaine } from './kyc-workflow.chaine';
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
    if (v && typeof v === 'object' && 'path' in v) return true;
    return row[k] === v;
  });
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((x) => match(x, where)),
    findFirst: async ({ where }: any = {}) => rows.find((x) => match(x, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
  });
  const p: any = { _db: db, tenant: table(db.tenants, 'T'), workflowDef: table(db.defs, 'W'),
    domainEvent: { create: async ({ data }: any) => { db.events.push({ id: id('E'), ...data }); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
// Le port KYC : structurellement compatible avec KycService.create/get — trivial ici.
function fakeKyc() {
  let n = 0; const dossiers: any[] = [];
  return { _dossiers: dossiers,
    create: async (ctx: any, dto: any) => { const d = { code: `KYC-2026-${++n}`,
      workflow: dto.legalStructure === 'TRUST' ? 'EDD' : 'KYC_STD', clientId: dto.clientId,
      sections: [{ code: 'IDENTITE' }, { code: 'ORIGINE_FONDS' }] }; dossiers.push(d); return d; },
    get: async (ctx: any, code: string) => dossiers.find((d) => d.code === code) ?? null };
}
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);
const CO = { tenantId: 't1', userId: 'i.vernet', role: 'CO' };
const mk = () => {
  const p = fakePrisma({ tenants: [{ id: 't1', name: 'GWB', settings: {} }] });
  const wf = new WorkflowDefService(p, fakeAudit());
  const kyc = fakeKyc();
  const s = new KycWorkflowChaine(kyc as any, wf, p);
  return { p, wf, kyc, s };
};
const CONT = (etapes: string[]) => ({ etapes, visas: { AML: ['CO'] } });

(async () => {
  // ── KW-01 — l'ouverture gouvernée timbre le dossier ──
  await it('KW-01 déf publiée applicable → dossier créé + timbre GOUVERNE (code, version) + lecture', async () => {
    const { p, wf, s } = mk();
    const b: any = await wf.creerBrouillon(CO, { code: 'EDD', contenu: CONT(['SAISIE_RM', 'REVUE_CO', 'APPROBATION']) });
    await wf.publier(CO, b.defId, { depuisLe: '2026-01-01', motif: 'v1' });
    const r: any = await s.ouvrirGouverne(CO, { clientId: 'cli-1', legalStructure: 'TRUST' });
    ok(r.dossierCode.startsWith('KYC-') && r.workflowVersion === 1 && r.source === 'GOUVERNE', 'timbré v1');
    ok(evts(p, 'kyc.dossier.workflow').length === 1, 'le timbre est un événement');
    const v: any = await s.versionDuDossier(CO, r.dossierCode);
    ok(v.version === 1 && v.source === 'GOUVERNE', 'le dossier SAIT sa version');
  });

  // ── KW-02 — le grandfathering RÉEL (clause R172) ──
  await it('KW-02 dossier A sous v1 ; v2 publiée ; dossier B sous v2 — A garde v1, ses étapes aussi', async () => {
    const { wf, s } = mk();
    const b1: any = await wf.creerBrouillon(CO, { code: 'EDD', contenu: CONT(['SAISIE_RM', 'REVUE_CO', 'APPROBATION']) });
    await wf.publier(CO, b1.defId, { depuisLe: '2026-01-01', motif: 'v1' });
    const A: any = await s.ouvrirGouverne(CO, { clientId: 'cli-1', legalStructure: 'TRUST' });
    const b2: any = await wf.creerBrouillon(CO, { code: 'EDD', contenu: CONT(['SAISIE_RM', 'DOUBLE_REVUE', 'COMITE', 'APPROBATION']) });
    await wf.publier(CO, b2.defId, { depuisLe: '2026-07-20', motif: 'v2 — datée hier : la plus récente applicable' });
    const B: any = await s.ouvrirGouverne(CO, { clientId: 'cli-2', legalStructure: 'TRUST' });
    ok(B.workflowVersion === 2, 'le NOUVEAU dossier naît sous v2');
    ok(((await s.versionDuDossier(CO, A.dossierCode)) as any).version === 1, 'A garde v1 — POUR TOUJOURS');
    const eA: any = await s.etapesDuDossier(CO, A.dossierCode);
    const eB: any = await s.etapesDuDossier(CO, B.dossierCode);
    ok(eA.etapes.length === 3 && eB.etapes.length === 4, 'chacun est servi selon SA version — même table, deux mondes');
  });

  // ── KW-03 — le repli template est TRACÉ, rien ne casse ──
  await it('KW-03 aucune déf publiée → dossier créé quand même, timbre TEMPLATE (version null) tracé', async () => {
    const { p, s } = mk();
    const r: any = await s.ouvrirGouverne(CO, { clientId: 'cli-1', legalStructure: 'SA' });
    ok(r.source === 'TEMPLATE' && r.workflowVersion === null, 'repli explicite — le comportement historique, mais TRACÉ');
    ok(evts(p, 'kyc.dossier.workflow')[0].payload.source === 'TEMPLATE', 'l\'événement dit la source');
    const e: any = await s.etapesDuDossier(CO, r.dossierCode);
    ok(e.source === 'TEMPLATE' && e.etapes.length === 2, 'les sections du dossier font foi en repli');
  });

  // ── KW-04 — la lecture sert la version DU DOSSIER, jamais l'état courant ──
  await it('KW-04 après v2, etapesDuDossier(A) sert TOUJOURS v1 ; dossier inconnu → refus', async () => {
    const { wf, s } = mk();
    const b1: any = await wf.creerBrouillon(CO, { code: 'EDD', contenu: CONT(['A', 'B', 'C']) });
    await wf.publier(CO, b1.defId, { depuisLe: '2026-01-01', motif: 'v1' });
    const A: any = await s.ouvrirGouverne(CO, { clientId: 'cli-1', legalStructure: 'TRUST' });
    const b2: any = await wf.creerBrouillon(CO, { code: 'EDD', contenu: CONT(['A', 'B', 'C', 'D', 'E']) });
    await wf.publier(CO, b2.defId, { depuisLe: '2026-07-20', motif: 'v2' });
    ok(((await s.etapesDuDossier(CO, A.dossierCode)) as any).etapes.length === 3, 'la version du DOSSIER, pas celle du jour');
    await rejects(s.etapesDuDossier(CO, 'KYC-FANTOME'), 'introuvable');
  });

  // ── KW-05 — le timbre ne se rejoue pas ──
  await it('KW-05 re-timbrer un dossier → refus (le dossier emporte sa version — UNE fois)', async () => {
    const { wf, s } = mk();
    const b: any = await wf.creerBrouillon(CO, { code: 'EDD', contenu: CONT(['A']) });
    await wf.publier(CO, b.defId, { depuisLe: '2026-01-01', motif: 'v1' });
    const A: any = await s.ouvrirGouverne(CO, { clientId: 'cli-1', legalStructure: 'TRUST' });
    await rejects(s.timbrer(CO, A.dossierCode, 'EDD'), 'déjà');
  });

  console.log(`\nCâblage KYC↔Workflow (KW-01..05, clause R172) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
