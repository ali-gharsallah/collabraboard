/**
 * Câblage OCR typé — OC-01..06 (R174→R176). Miroir strict de l'amendement, écrit AVANT
 * l'implémentation. Le moteur extrait par gabarit, contrôle sans juger, propose sans
 * disposer — l'humain qualifie et accepte. Faux Prisma en mémoire, port OCR fake, FormPort fake.
 *
 * Harnais : compiler ocr-extraction.service.ts + ce fichier ;
 *   echo "── Câblage OCR typé (OC-01..06, R174→R176) ──"; run ocr-extraction.wiring.spec.js
 */
import { OcrExtractionService } from './ocr-extraction.service';
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
    versions: seed.versions ?? [], extractions: [] as any[], propositions: [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => row[k] === v);
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((x) => match(x, where)),
    findFirst: async ({ where }: any = {}) => rows.find((x) => match(x, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
  });
  const p: any = { _db: db, tenant: table(db.tenants, 'T'), document: table(db.documents, 'D'),
    documentVersion: table(db.versions, 'V'), ocrExtraction: table(db.extractions, 'X'),
    ocrProposition: table(db.propositions, 'P'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((e) => match(e, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);
const CO = { tenantId: 't1', userId: 'i.vernet', role: 'CO' };
const GABARIT = { version: 1,
  champs: [{ nom: 'nom', indice: 'ligne:NOM', format: 'texte', obligatoire: true },
           { nom: 'numero', indice: 'ligne:NO', format: 'texte', obligatoire: true },
           { nom: 'expiration', indice: 'ligne:EXP', format: 'date', obligatoire: true }],
  controles: ['CHAMPS_OBLIGATOIRES', 'EXPIRATION_FUTURE'],
  mapping: [{ champ: 'nom', cible: { form: 'KYC', section: 'IDENTITE', question: 'NOM_LEGAL' } },
            { champ: 'numero', cible: { form: 'KYC', section: 'IDENTITE', question: 'NO_PIECE' } }] };
const CONTENU_OK = 'NOM: DUPONT JEAN\nNO: X123456\nEXP: 2031-05-01';
const CONTENU_EXPIRE = 'NOM: VASQUEZ ELENA\nNO: Y999\nEXP: 2020-01-01';
const mk = (contenu = CONTENU_OK, avecGabarit = true) => {
  const types = [{ code: 'PASSEPORT', rolesAutorises: ['RM', 'CO', 'CF'],
    ...(avecGabarit ? { extraction: GABARIT } : {}) }];
  const p = fakePrisma({
    tenants: [{ id: 't1', name: 'GWB', settings: { gedDocTypes: types } }],
    documents: [{ id: 'doc-1', tenantId: 't1', typeCode: 'PASSEPORT', statut: 'ACTIF' },
                { id: 'doc-nc', tenantId: 't1', typeCode: null, statut: 'RECU' }],
    versions: [{ id: 'v-1', tenantId: 't1', documentId: 'doc-1', sha256: 'sha-src-1' },
               { id: 'v-nc', tenantId: 't1', documentId: 'doc-nc', sha256: 'sha-src-2' }] });
  const ocrPort = { moteur: 'tesseract-5.4', lire: async () => ({ texte: contenu }) };
  const ecrits: any[] = [];
  const formPort = { ecrireChamp: async (c: any, cible: any, valeur: string) => { ecrits.push({ cible, valeur }); } };
  const s = new OcrExtractionService(p, fakeAudit(), { ocr: ocrPort, form: formPort });
  return { p, s, ecrits };
};

(async () => {
  // ── OC-01 (R174) — le gabarit produit des champs candidats, en dérivé signé ──
  await it('OC-01 extraction typée → champs {nom,valeur,confiance} + dérivé signé + événement', async () => {
    const { p, s } = mk();
    const r: any = await s.extraireTypee(CO, 'doc-1', 'v-1', 'contenu-b64');
    ok(r.champs.length === 3 && r.champs.every((c: any) => c.valeur && c.confiance > 0), 'champs candidats');
    ok(r.champs.find((c: any) => c.nom === 'nom').valeur === 'DUPONT JEAN', 'la valeur trouvée LÀ où le gabarit le dit');
    const x = p._db.extractions[0];
    ok(x.shaSource === 'sha-src-1' && x.shaDerive && x.gabaritVersion === 1 && x.moteur === 'tesseract-5.4', 'dérivé signé, gabarit versionné');
    ok(evts(p, 'ocr.extraction.produite').length === 1, 'événement');
  });

  // ── OC-02 (R174) — non classé = refus ; sans gabarit = brut tracé ──
  await it('OC-02 document non classé → refus ; type sans gabarit → extraction brute tracée', async () => {
    const { s } = mk();
    await rejects(s.extraireTypee(CO, 'doc-nc', 'v-nc', 'x'), 'classé');
    const { p: p2, s: s2 } = mk(CONTENU_OK, false);
    const r: any = await s2.extraireTypee(CO, 'doc-1', 'v-1', 'x');
    ok(r.mode === 'BRUT' && r.champs.length === 0 && r.texte.includes('DUPONT'), 'brut assumé, jamais deviné');
    ok(p2._db.extractions[0].gabaritVersion === null, 'la trace dit : sans gabarit');
  });

  // ── OC-03 (R175) — les contrôles rapportent, signalent, ne bloquent pas ──
  await it('OC-03 pièce expirée → contrôle ECHEC + signal tracé, extraction servie quand même', async () => {
    const { p, s } = mk(CONTENU_EXPIRE);
    const r: any = await s.extraireTypee(CO, 'doc-1', 'v-1', 'x');
    const ctrl = r.controles.find((c: any) => c.controle === 'EXPIRATION_FUTURE');
    ok(ctrl.resultat === 'ECHEC', 'le contrôle dit ECHEC');
    ok(r.controles.find((c: any) => c.controle === 'CHAMPS_OBLIGATOIRES').resultat === 'PASSE', 'les autres passent');
    ok(evts(p, 'ocr.controle.echec').length === 1, 'l\'échec est un SIGNAL');
    ok(r.champs.length === 3, 'rien n\'est bloqué — l\'humain qualifiera');
  });

  // ── OC-04 (R176) — la digitalisation propose ; l'acte humain écrit par le port ──
  await it('OC-04 propositions mappées ; accepter écrit par FormPort avec provenance ; refuser trace', async () => {
    const { p, s, ecrits } = mk();
    const r: any = await s.extraireTypee(CO, 'doc-1', 'v-1', 'x');
    const props: any = await s.proposer(CO, r.extractionId, { form: 'KYC', dossierCode: 'KYC-2026-1' });
    ok(props.length === 2 && props.every((x: any) => x.statut === 'EN_ATTENTE'), '2 propositions mappées, rien d\'écrit');
    ok(ecrits.length === 0, 'le formulaire est intact avant l\'acte');
    await s.accepter(CO, props[0].propositionId);
    ok(ecrits.length === 1 && ecrits[0].valeur === 'DUPONT JEAN' && ecrits[0].cible.question === 'NOM_LEGAL', 'l\'acte écrit par le port');
    ok(p._db.propositions[0].statut === 'ACCEPTEE' && p._db.propositions[0].decidePar === 'i.vernet', 'provenance et décideur gravés');
    await s.refuser(CO, props[1].propositionId, 'Illisible sur l\'original');
    ok(p._db.propositions[1].statut === 'REFUSEE' && evts(p, 'ocr.proposition.refusee').length === 1, 'le refus est tracé');
  });

  // ── OC-05 (R174) — le gabarit se gouverne par les paramètres ; les dérivés gardent leur version ──
  await it('OC-05 gabarit v2 via settings → nouvelles extractions v2, l\'ancienne garde v1', async () => {
    const { p, s } = mk();
    await s.extraireTypee(CO, 'doc-1', 'v-1', 'x');
    const t = p._db.tenants[0];
    t.settings.gedDocTypes[0].extraction = { ...GABARIT, version: 2 };
    p._db.documents.push({ id: 'doc-2', tenantId: 't1', typeCode: 'PASSEPORT', statut: 'ACTIF' });
    p._db.versions.push({ id: 'v-2', tenantId: 't1', documentId: 'doc-2', sha256: 'sha-src-9' });
    await s.extraireTypee(CO, 'doc-2', 'v-2', 'x');
    ok(p._db.extractions[0].gabaritVersion === 1 && p._db.extractions[1].gabaritVersion === 2, 'chaque dérivé garde À VIE sa version');
  });

  // ── OC-06 (R175) — l'idempotence : jamais deux fois le même travail ──
  await it('OC-06 re-extraire même version+gabarit → refus « déjà »', async () => {
    const { s } = mk();
    await s.extraireTypee(CO, 'doc-1', 'v-1', 'x');
    await rejects(s.extraireTypee(CO, 'doc-1', 'v-1', 'x'), 'déjà');
  });

  console.log(`\nCâblage OCR typé (OC-01..06, R174→R176) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
