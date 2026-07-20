/**
 * Câblage GED avancée — GD-07..GD-14 (R113→R116). Miroir strict de l'amendement.
 * Ports factices : TSA (horodatage), QES (signature), IA (classification).
 * Le Merkle est RÉEL : le test reconstruit la racine de son côté et confronte.
 *
 * Harnais : compiler ged-avance.service.ts + ce fichier ;
 *   echo "── Câblage GED avancée (GD-07..14, R113→R116) ──"; run ged-avance.wiring.spec.js
 */
import { GedAvanceService } from './ged-avance.service';
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
    versions: seed.versions ?? [], anchors: [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => {
    if (v === null) return row[k] == null;
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    if (v && typeof v === 'object' && 'lte' in v) return row[k] != null && new Date(row[k]) <= new Date(v.lte);
    return row[k] === v;
  });
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where, orderBy }: any = {}) => {
      let r = rows.filter((x) => match(x, where));
      if (orderBy?.numero === 'desc') r = r.slice().sort((a, b) => b.numero - a.numero);
      return r;
    },
    findFirst: async ({ where, orderBy }: any = {}) => {
      let r = rows.filter((x) => match(x, where));
      if (orderBy?.numero === 'desc') r = r.slice().sort((a, b) => b.numero - a.numero);
      return r[0] ?? null;
    },
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
  });
  const p: any = { _db: db,
    tenant: table(db.tenants, 'T'), document: table(db.documents, 'D'),
    documentVersion: table(db.versions, 'V'), anchorBatch: table(db.anchors, 'A'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; } } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);

const CO = { tenantId: 't1', userId: 'i.vernet', role: 'CO' };
const TSA = { timestamp: async (racine: string) => ({ token: 'TSA-' + racine.slice(0, 8), at: '2026-07-19T18:00:00Z' }) };
const QES = { signer: async (sha256: string, signataire: string) =>
  ({ evidenceId: 'AIS-' + sha256.slice(0, 8), contenuSigne: 'SIGNED[' + sha256 + ']par[' + signataire + ']' }) };
const IA = { classifier: async (_c: string) => ({ type: 'REGISTRE', expirationDetectee: '2027-07-01' }) };

function seedDoc(over: any = {}) {
  return { id: 'd1', tenantId: 't1', clientId: 'c1', typeCode: over.typeCode ?? 'FORM_CDB',
    nom: 'Doc', statut: 'ACTIF', legalHold: false, destructionProposee: false,
    retentionUntil: over.retentionUntil ?? null };
}
const V = (docId: string, numero: number, contenu: string) =>
  ({ id: 'v' + docId + numero, tenantId: 't1', documentId: docId, numero,
     sha256: sha(contenu), deposePar: 'x', deposeAt: '2026-07-19T09:00:00Z', anchorBatchId: null });
const mk = (opts: any = {}) => {
  const p = fakePrisma({ tenants: [{ id: 't1', name: 'GWB', settings: {} }],
    documents: opts.documents ?? [], versions: opts.versions ?? [] });
  const s = new GedAvanceService(p, fakeAudit(), opts.ports ?? { tsa: TSA, qes: QES, ia: IA });
  return { p, s };
};

(async () => {
  // ── GD-07 (R113) — le lot du jour s'ancre, une fois ──
  await it('GD-07 3 versions → 1 lot (racine Merkle RÉELLE + jeton TSA), versions rattachées, 2e tick vide', async () => {
    const { p, s } = mk({ documents: [seedDoc()],
      versions: [V('d1', 1, 'AAA'), V('d1', 2, 'BBB'), V('d1', 3, 'CCC')] });
    await s.tickAncrage(CO);
    ok(p._db.anchors.length === 1, 'un lot');
    // racine recalculée CÔTÉ TEST : feuilles triées, appariement sha(g+d), impair → duplication
    const feuilles = [sha('AAA'), sha('BBB'), sha('CCC')].sort();
    let niveau = feuilles.slice();
    while (niveau.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < niveau.length; i += 2) next.push(sha(niveau[i] + (niveau[i + 1] ?? niveau[i])));
      niveau = next;
    }
    ok(p._db.anchors[0].racineMerkle === niveau[0], 'racine Merkle conforme au recalcul indépendant');
    ok(p._db.anchors[0].tsaToken.startsWith('TSA-'), 'horodatage du tiers');
    ok(p._db.versions.every((v: any) => v.anchorBatchId === p._db.anchors[0].id), 'les 3 versions rattachées');
    ok(evts(p, 'ged.ancrage.cree').length === 1, 'tracé');
    await s.tickAncrage(CO);
    ok(p._db.anchors.length === 1, 'rien à ancrer → pas de lot vide');
  });

  // ── GD-08 (R113) — la preuve se vérifie, la falsification échoue ──
  await it('GD-08 preuve de Merkle : version ancrée → OK ; empreinte étrangère → KO', async () => {
    const { p, s } = mk({ documents: [seedDoc()],
      versions: [V('d1', 1, 'AAA'), V('d1', 2, 'BBB'), V('d1', 3, 'CCC')] });
    await s.tickAncrage(CO);
    const r: any = await s.verifierPreuve(CO, p._db.versions[1].id);
    ok(r.valide === true && r.racine === p._db.anchors[0].racineMerkle, 'appartenance prouvée');
    // falsification : même chemin, empreinte étrangère
    const faux = s.verifierChemin(sha('INTRUS'), r.chemin, r.racine);
    ok(faux === false, 'la preuve ne se transfère pas à une empreinte étrangère');
  });

  // ── GD-09/GD-10 (R114) — la signature est une version ; pas de prestataire, pas de simulacre ──
  await it('GD-09 QES sur v1 → v2 signée (empreinte du contenu signé, preuve, signataire), v1 consultable', async () => {
    const { p, s } = mk({ documents: [seedDoc()], versions: [V('d1', 1, 'FORM-A')] });
    await s.demanderSignature(CO, 'd1', 'M. Dupont');
    const vs = p._db.versions.filter((v: any) => v.documentId === 'd1');
    ok(vs.length === 2 && vs[1].numero === 2, 'version 2 créée — succession R109');
    ok(vs[1].sha256 === sha('SIGNED[' + sha('FORM-A') + ']par[M. Dupont]'), 'empreinte du contenu signé');
    ok(vs[1].signature.signataire === 'M. Dupont' && vs[1].signature.evidenceId.startsWith('AIS-'), 'preuve du prestataire portée');
    ok(vs[0].sha256 === sha('FORM-A'), 'la version non signée subsiste');
    ok(evts(p, 'ged.signature.qualifiee').length === 1, 'tracé');
  });
  await it('GD-10 sans prestataire QES → refus explicite, aucune version, aucun événement', async () => {
    const { p, s } = mk({ documents: [seedDoc()], versions: [V('d1', 1, 'FORM-A')], ports: { tsa: TSA } });
    await rejects(s.demanderSignature(CO, 'd1', 'M. Dupont'), 'prestataire QES');
    ok(p._db.versions.length === 1 && evts(p, 'ged.signature.qualifiee').length === 0, 'aucun simulacre');
  });

  // ── GD-11 (R115) — l'échéance propose, ne détruit pas ──
  await it('GD-11 rétention échue → destruction PROPOSÉE (une fois), rien détruit', async () => {
    const { p, s } = mk({ documents: [seedDoc({ retentionUntil: '2026-01-01' })], versions: [V('d1', 1, 'X')] });
    await s.tickRetention(CO, new Date('2026-07-19'));
    ok(evts(p, 'ged.destruction.proposee').length === 1 && evts(p, 'tache.ged.destruction').length === 1, 'proposée + tâche');
    ok(p._db.documents[0].statut === 'ACTIF', 'rien détruit');
    await s.tickRetention(CO, new Date('2026-07-20'));
    ok(evts(p, 'ged.destruction.proposee').length === 1, 'une fois');
  });

  // ── GD-12 (R115) — destruction certifiée, la preuve subsiste ──
  await it('GD-12 destruction sans motif → R7 ; avec motif → DETRUIT, certificat, empreintes conservées', async () => {
    const { p, s } = mk({ documents: [seedDoc({ retentionUntil: '2026-01-01' })], versions: [V('d1', 1, 'X')] });
    await rejects(s.detruire(CO, 'd1', ''), 'R7');
    await s.detruire(CO, 'd1', 'Rétention LBA échue — décision du comité du 19.07');
    ok(p._db.documents[0].statut === 'DETRUIT' && p._db.documents[0].destructionPar === 'i.vernet', 'décision humaine, auteur = jeton');
    const cert = evts(p, 'ged.destruction.certifiee');
    ok(cert.length === 1 && cert[0].payload.empreintes[0] === sha('X'), 'certificat avec empreintes conservées');
    ok(p._db.versions.length === 1 && p._db.versions[0].sha256 === sha('X'), 'le registre des versions SUBSISTE');
  });

  // ── GD-13 (R115) — le legal hold gèle tout ──
  await it('GD-13 hold actif → tick muet + destruction refusée ; levée motivée tracée', async () => {
    const { p, s } = mk({ documents: [seedDoc({ retentionUntil: '2026-01-01' })], versions: [V('d1', 1, 'X')] });
    await s.poserHold(CO, 'c1', 'Litige successoral — instruction du juge');
    await s.tickRetention(CO, new Date('2026-07-19'));
    ok(evts(p, 'ged.destruction.proposee').length === 0, 'le tick ne propose pas sous hold');
    await rejects(s.detruire(CO, 'd1', 'motif quelconque'), 'legal hold');
    await rejects(s.leverHold(CO, 'c1', ''), 'R7');
    await s.leverHold(CO, 'c1', 'Litige clos — jugement du 15.07');
    ok(evts(p, 'ged.hold.leve').length === 1 && p._db.documents[0].legalHold === false, 'levée motivée, tracée');
  });

  // ── GD-14 (R116) — l'IA propose, l'humain applique ──
  await it('GD-14 classification : proposition IA tracée, type INCHANGÉ, puis confirmation humaine appliquée', async () => {
    const { p, s } = mk({ documents: [seedDoc({ typeCode: 'INCONNU' })], versions: [V('d1', 1, 'EXTRAIT RC 2026')] });
    const prop: any = await s.classifier(CO, 'd1', 'EXTRAIT RC 2026');
    ok(prop.type === 'REGISTRE' && evts(p, 'ged.classification.proposee').length === 1, 'proposition tracée (IA)');
    ok(p._db.documents[0].typeCode === 'INCONNU', 'RIEN appliqué avant décision humaine (R44)');
    await s.confirmerClassification(CO, 'd1', 'REGISTRE');
    ok(p._db.documents[0].typeCode === 'REGISTRE', 'appliqué après confirmation');
    ok(evts(p, 'ged.classification.confirmee')[0].payload.par === 'i.vernet', 'confirmateur = jeton');
  });
  await it('GD-14 sans port IA → fonction absente, refus propre', async () => {
    const { s } = mk({ documents: [seedDoc()], versions: [V('d1', 1, 'X')], ports: {} });
    await rejects(s.classifier(CO, 'd1', 'X'), 'port IA');
  });

  console.log(`\nCâblage GED avancée (GD-07..14, R113→R116) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
