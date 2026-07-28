/**
 * Câblage Personnes liées — PL-01..04 + gardes (R152→R155). Miroir strict de l'amendement.
 * Le lien est un acte habilité ; le référentiel est un registre cumulable ; le non-officiel
 * est bijectif atomique ; chercher-ou-créer sans doublon silencieux.
 * Faux Prisma en mémoire. Écrit AVANT l'implémentation.
 *
 * Harnais : compiler personne-lien.service.ts + ce fichier ;
 *   echo "── Câblage Personnes liées (PL-01..04, R152→R155) ──"; run personne-lien.wiring.spec.js
 */
import { PersonneLienService } from './personne-lien.service';
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
  const db = { tenants: seed.tenants ?? [], personnes: seed.personnes ?? [],
    liens: [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
    if (v === null) return row[k] == null;
    if (v && typeof v === 'object' && 'contains' in v)
      return String(row[k] ?? '').toLowerCase().includes(String(v.contains).toLowerCase());
    return row[k] === v;
  });
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((x) => match(x, where)),
    findFirst: async ({ where }: any = {}) => rows.find((x) => match(x, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    deleteMany: async ({ where }: any = {}) => { const keep = rows.filter((x) => !match(x, where));
      const n = rows.length - keep.length; rows.length = 0; rows.push(...keep); return { count: n }; },
  });
  const p: any = { _db: db, tenant: table(db.tenants, 'T'),
    person: table(db.personnes, 'P'), personneLien: table(db.liens, 'L'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);

const CO = { tenantId: 't1', userId: 'i.vernet', role: 'CO' };
const STG = { tenantId: 't1', userId: 's.tagger', role: 'STAGIAIRE' };
const mk = (settings: any = {}, personnes: any[] = [{ id: 'p1', tenantId: 't1', nom: 'Jean Dupont', type: 'PHYSIQUE' }]) => {
  const p = fakePrisma({ tenants: [{ id: 't1', name: 'GWB', settings }], personnes });
  return { p, s: new PersonneLienService(p, fakeAudit()) };
};
const CIBLE = { cibleType: 'COMPTE', cibleId: 'acc-9' };

(async () => {
  // ── PL-01 (R152) — habilité pose, non-habilité tracé ──
  await it('PL-01 STAGIAIRE → refus + tentative tracée ; CO → lien posé + événement (auteur, type, cible)', async () => {
    const { p, s } = mk();
    await rejects(s.lier(STG, { personneId: 'p1', typeCode: 'TRUSTEE', ...CIBLE }), 'habilité');
    ok(evts(p, 'personne.lien.acces.refuse').length === 1, 'tentative tracée');
    await s.lier(CO, { personneId: 'p1', typeCode: 'TRUSTEE', ...CIBLE });
    ok(p._db.liens.length === 1 && p._db.liens[0].categorie === 'OFFICIEL', 'posé, catégorisé');
    const e = evts(p, 'personne.lien.pose');
    ok(e.length === 1 && e[0].payload.par === 'i.vernet' && e[0].payload.typeCode === 'TRUSTEE', 'événement jeton');
  });

  // ── PL-02 (R153) — cumul oui, doublon non, hors-référentiel non ──
  await it('PL-02 TRUSTEE + SIGNATAIRE cumulés ; re-TRUSTEE → refus doublon ; GOUROU → refus référentiel', async () => {
    const { p, s } = mk();
    await s.lier(CO, { personneId: 'p1', typeCode: 'TRUSTEE', ...CIBLE });
    await s.lier(CO, { personneId: 'p1', typeCode: 'SIGNATAIRE', ...CIBLE });
    ok(p._db.liens.length === 2, 'le CUMUL est la règle');
    await rejects(s.lier(CO, { personneId: 'p1', typeCode: 'TRUSTEE', ...CIBLE }), 'doublon');
    await rejects(s.lier(CO, { personneId: 'p1', typeCode: 'GOUROU', ...CIBLE }), 'référentiel');
  });

  // ── PL-03 (R154) — le miroir existe dès la pose, disparaît au retrait ──
  await it('PL-03 « père de » X→Y pose « fils/fille de » Y→X atomiquement ; retrait motivé retire LES DEUX', async () => {
    const { p, s } = mk({}, [
      { id: 'p1', tenantId: 't1', nom: 'Jean Dupont', type: 'PHYSIQUE' },
      { id: 'p2', tenantId: 't1', nom: 'Marc Dupont', type: 'PHYSIQUE' }]);
    const r: any = await s.lier(CO, { personneId: 'p1', typeCode: 'PERE_DE', cibleType: 'PERSONNE', cibleId: 'p2' });
    ok(p._db.liens.length === 2, 'la paire, atomique');
    const inverse = p._db.liens.find((l: any) => l.personneId === 'p2');
    ok(inverse.typeCode === 'FILS_FILLE_DE' && inverse.cibleId === 'p1' && inverse.paireId === r.lienId, 'miroir chaîné');
    ok(evts(p, 'personne.lien.pose').length === 1, 'UN événement pour la paire');
    await rejects(s.retirer(CO, r.lienId, ''), 'R7');
    await s.retirer(CO, r.lienId, 'Erreur de saisie — mauvaise personne');
    ok(p._db.liens.length === 0, 'les DEUX côtés disparaissent');
    ok(evts(p, 'personne.lien.retrait').length === 1, 'retrait tracé');
  });

  // ── PL-04 (R155) — exister = lier ; créer = signaler + compléter ──
  await it('PL-04 existante → liée sans création ; inconnue → créée minimale + tâche ; homonyme → signal, pas de blocage', async () => {
    const { p, s } = mk();
    const r1: any = await s.chercherOuCreerEtLier(CO, { nom: 'Jean Dupont', type: 'PHYSIQUE', typeCode: 'SIGNATAIRE', ...CIBLE });
    ok(r1.personneId === 'p1' && p._db.personnes.length === 1, 'existante : liée, pas créée');
    const r2: any = await s.chercherOuCreerEtLier(CO, { nom: 'Alice Weber', type: 'PHYSIQUE', typeCode: 'BENEFICIAIRE', ...CIBLE, creer: true });
    ok(p._db.personnes.length === 2 && p._db.liens.some((l: any) => l.personneId === r2.personneId), 'créée minimale + liée, même transaction');
    ok(evts(p, 'tache.personne.completion').length === 1, 'une fiche minimale n\'est pas une fiche finie');
    const r3: any = await s.chercherOuCreerEtLier(CO, { nom: 'Jean Dupont', type: 'PHYSIQUE', typeCode: 'TITULAIRE', cibleType: 'COMPTE', cibleId: 'acc-2', creer: true });
    ok(p._db.personnes.length === 3, 'création acceptée (l\'humain décide)');
    ok(evts(p, 'personne.homonymie.signal').length === 1, 'MAIS l\'homonymie est SIGNALÉE (R39)');
  });

  // ── gardes transverses ──
  await it('R152 registre tenant : rôle ajouté au R-Q → habilité ; R153 typesDisponibles sert le référentiel (les boutons du popup)', async () => {
    const { p, s } = mk({ lienRolesOfficiels: ['CO', 'CF', 'RM', 'STAGIAIRE'] });
    await s.lier(STG, { personneId: 'p1', typeCode: 'TRUSTEE', ...CIBLE });
    ok(p._db.liens.length === 1, 'le R-Q fait foi');
    const t: any = await s.typesDisponibles(CO);
    ok(t.officiels.some((x: any) => x.code === 'POWER_OF_ATTORNEY') && t.nonOfficiels.some((x: any) => x.code === 'PERE_DE'), 'référentiel servi à l\'UI');
  });
  await it('R152 isolation tenant : lier une personne d\'un autre tenant introuvable', async () => {
    const { s } = mk();
    await rejects(s.lier({ tenantId: 't2', userId: 'x', role: 'CO' }, { personneId: 'p1', typeCode: 'TRUSTEE', ...CIBLE }), 'introuvable');
  });

  console.log(`\nCâblage Personnes liées (PL-01..04, R152→R155) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
