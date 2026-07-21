/**
 * Câblage Surface de consultation GED — GS-01..05. AUCUNE règle nouvelle : ce corpus
 * expose des règles RATIFIÉES par une surface de lecture — R110 (rôles de lecture par
 * type), R112 (vues), R125 (le registre est relu À CHAQUE ACTE), R145 (le contenu ne
 * passe que par la relecture vérifiée du coffre). Écrit AVANT le service.
 *
 * Harnais : compiler ged-consultation.service.ts + ce fichier ;
 *   echo "── Câblage Surface consultation GED (GS-01..05, R110/R112/R125/R145) ──"; run ged-consultation.wiring.spec.js
 */
import { GedConsultationService } from './ged-consultation.service';
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
  const db = { tenants: seed.tenants ?? [], documents: seed.documents ?? [], versions: seed.versions ?? [], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => row[k] === v);
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((x) => match(x, where)),
    findFirst: async ({ where }: any = {}) => rows.find((x) => match(x, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
  });
  const p: any = { _db: db, tenant: table(db.tenants, 'T'), document: table(db.documents, 'D'),
    documentVersion: table(db.versions, 'V'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; } } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const CO = { tenantId: 't1', userId: 'u-co', role: 'CO' };
const RM = { tenantId: 't1', userId: 'u-rm', role: 'RM' };
const mk = () => {
  const p = fakePrisma({
    tenants: [{ id: 't1', name: 'GWB', settings: { gedDocTypes: [
      { code: 'PASSEPORT', label: 'Passeport', rolesAutorises: ['CO', 'CF'] },
      { code: 'CONTRAT', label: 'Contrat', rolesAutorises: ['RM', 'CO', 'CF'] }] } }],
    documents: [
      { id: 'd1', tenantId: 't1', typeCode: 'PASSEPORT', nom: 'passeport-dupont.pdf', statut: 'ACTIF', clientId: 'cli-1' },
      { id: 'd2', tenantId: 't1', typeCode: 'CONTRAT', nom: 'mandat-dupont.pdf', statut: 'ACTIF', clientId: 'cli-1' },
      { id: 'd3', tenantId: 't2', typeCode: 'CONTRAT', nom: 'autre-tenant.pdf', statut: 'ACTIF', clientId: 'cli-9' }],
    versions: [
      { id: 'v1', documentId: 'd1', no: 1, empreinte: 'aaa', creeAt: '2026-07-01T10:00:00Z', contenuRef: 'coffre://x1' },
      { id: 'v2', documentId: 'd1', no: 2, empreinte: 'bbb', creeAt: '2026-07-10T10:00:00Z', contenuRef: 'coffre://x2' }],
  });
  return { p, s: new GedConsultationService(p, fakeAudit()) };
};

(async () => {
  // ── GS-01 (R110) — lister : scopé tenant, filtré aux types lisibles par le rôle ──
  await it('GS-01 lister = mon tenant, mes types lisibles — le RM ne voit pas les passeports', async () => {
    const { s } = mk();
    const co: any = await s.listerDocuments(CO, {});
    ok(co.length === 2 && !co.some((d: any) => d.id === 'd3'), 'CO : 2 documents, jamais l\'autre tenant');
    const rm: any = await s.listerDocuments(RM, {});
    ok(rm.length === 1 && rm[0].typeCode === 'CONTRAT', 'RM : le contrat seulement — R110 au filtre');
  });

  // ── GS-02 (R125) — le registre est relu à CHAQUE acte ──
  await it('GS-02 registre modifié → effet immédiat au prochain lister — rien n\'est mis en cache', async () => {
    const { p, s } = mk();
    p._db.tenants[0].settings.gedDocTypes[0].rolesAutorises.push('RM');
    const rm: any = await s.listerDocuments(RM, {});
    ok(rm.length === 2, 'le RM voit le passeport dès que le registre le dit — R125 vivant');
  });

  // ── GS-03 (R110) — la fiche d'un type non lisible : refus tracé ──
  await it('GS-03 fiche interdite → refus explicite + événement de refus', async () => {
    const { p, s } = mk();
    await rejects(s.fiche(RM, 'd1'), 'lecture');
    ok(p._db.events.some((e: any) => e.type === 'ged.consultation.refusee'), 'le refus est tracé');
    await rejects(s.fiche(CO, 'd3'), 'introuvable');   // l'autre tenant N'EXISTE PAS pour moi
  });

  // ── GS-04 — la fiche : document + versions ordonnées, métadonnées seulement ──
  await it('GS-04 fiche = document + versions ordonnées (no croissant), avec empreintes', async () => {
    const { s } = mk();
    const f: any = await s.fiche(CO, 'd1');
    ok(f.document.id === 'd1' && f.versions.length === 2, 'document + 2 versions');
    ok(f.versions[0].no === 1 && f.versions[1].no === 2, 'ordonnées');
    ok(f.versions.every((v: any) => v.empreinte), 'les empreintes se voient — la confiance se vérifie');
  });

  // ── GS-05 (R145) — la consultation ne livre JAMAIS le contenu ──
  await it('GS-05 ni lister ni fiche ne portent de contenu — le contenu ne passe que par le coffre vérifié', async () => {
    const { s } = mk();
    const docs: any = await s.listerDocuments(CO, {});
    const f: any = await s.fiche(CO, 'd1');
    const plat = JSON.stringify([docs, f]);
    ok(!plat.includes('contenuRef') && !plat.includes('coffre://'), 'aucune référence de contenu ne fuit — la lecture vérifiée (R145) reste le seul chemin');
  });

  console.log(`\nCâblage Surface consultation GED (GS-01..05, R110/R112/R125/R145) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
