/**
 * Câblage Couche Shariah — IS-01..IS-15 (R207→R221). Chaque scénario Gherkin en CHAIR :
 * détecteurs (positif + contrôle propre), calculateurs (Zakat/Mudaraba/Waqf/…), puis le
 * service : persistance append-only tenant-scopée, auteur = jeton, blocage maysir (R209),
 * revue humaine sur entité caritative sanctionnée (R216, jamais d'auto-blocage).
 *
 * ⚠ Provenance : tests ÉCRITS depuis le Gherkin (Bloc 49, exception ratifiée) — ils valent ce
 * que vaut le Gherkin. Adaptation minimale : un seul modèle IslamicSignal, calculateurs purs.
 *
 * Harnais : compiler islamic-screening.engine.ts + islamic.service.ts + ce fichier ;
 *   echo "── Câblage Couche Shariah (IS-01..IS-15, R207→R221) ──"; run islamic-screening.wiring.spec.js
 */
import {
  screenClient, detectRiba, blockMaysir, validateGharar, verifySukuk, checkHalalCounterparty,
  reviewIslamicSanction, checkEsgIslamicCert, evaluerIslamic, paramsIslamicDepuisSettings,
  calculerZakat, suiviQard, distribuerMudaraba, auditShariah, validerRetraitWaqf, suiviTakaful,
  alerteSukukMaturite, ISLAMIC_PARAMS_DEFAUT, ContexteIslamic, SignalIslamic,
} from './islamic-screening.engine';
import { IslamicService } from './islamic.service';
declare const process: { exit(n: number): void; env: any };

let passed = 0, failed = 0; const fails: string[] = [];
function it(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve().then(fn).then(() => { passed++; },
    (e: Error) => { failed++; fails.push(`✗ ${name} — ${e.message}`); });
}
const ok = (c: boolean, m = 'assertion') => { if (!c) throw new Error(m); };
async function jette(p: Promise<unknown> | (() => unknown), part: string): Promise<void> {
  try { if (typeof p === 'function') await (p as any)(); else await p; }
  catch (e) { if ((e as Error).message.includes(part)) return; throw new Error(`attendu «${part}», obtenu «${(e as Error).message}»`); }
  throw new Error(`exception «${part}» attendue`);
}
const P = ISLAMIC_PARAMS_DEFAUT;
const estSignal = (s: SignalIslamic | null, type: string, regle: string, niveau: number, opts: { bloquant?: boolean; revue?: boolean } = {}) => {
  ok(s !== null, `signal attendu (${type})`);
  ok(s!.type === type, `type ${type} attendu, obtenu ${s!.type}`);
  ok(s!.regle === regle && s!.niveau === niveau, `${regle}/N${niveau} attendu`);
  ok(s!.bloquant === !!opts.bloquant, `bloquant=${!!opts.bloquant} attendu`);
  ok(!!s!.revueManuelle === !!opts.revue, `revueManuelle=${!!opts.revue} attendu`);
  ok(s!.motif.includes(`(${regle})`), `le motif référence ${regle}`);
};

function fakePrisma(settings: any = {}) {
  let seq = 0; const id = (p: string) => `${p}-${++seq}`;
  const db = { signals: [] as any[], events: [] as any[], zakat: [] as any[], waqf: [] as any[], mudaraba: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => row[k] === v);
  const table = (rows: any[], prefix: string) => ({
    create: async ({ data }: any) => { const r = { id: id(prefix), ...data }; rows.push(r); return r; },
    findMany: async ({ where }: any = {}) => rows.filter((x) => match(x, where)) });
  const p: any = { _db: db,
    tenant: { findFirst: async ({ where }: any) => ({ id: where.id, settings }) },
    islamicSignal: table(db.signals, 'I'),
    zakatCalculation: table(db.zakat, 'Z'),
    waqfDistribution: table(db.waqf, 'W'),
    mudarabaDistribution: table(db.mudaraba, 'M'),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; } } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const MLRO = { tenantId: 't1', userId: 'u-mlro', role: 'MLRO' };

(async () => {
  // ══ IS-01 R207 — client islamique payant un secteur haram ══
  await it('IS-01 client islamique → brasserie + casino → ISLAMIC_PROFILE_VIOLATION (N2)', () => {
    const c: ContexteIslamic = { clientId: 'fatima', clientIslamic: true, transactions: [
      { montantChf: 5000, beneficiaire: 'Brasserie Beaumont', secteurBeneficiaire: 'ALCOOL' },
      { montantChf: 3000, beneficiaire: 'PlayWin Casinos', secteurBeneficiaire: 'JEUX' } ] };
    estSignal(screenClient(c, P), 'ISLAMIC_PROFILE_VIOLATION', 'R207', 2);
  });
  await it('IS-01 négatif : client non islamique → pas de signal de profil', () => {
    ok(screenClient({ clientId: 'x', clientIslamic: false, transactions: [
      { montantChf: 5000, secteurBeneficiaire: 'ALCOOL' }] }, P) === null, 'profil non islamique');
  });

  // ══ IS-02 R208 — Riba ══
  await it('IS-02 revenu intérêt d\'une banque conventionnelle → RIBA_INCOME (N2)', () => {
    const c: ContexteIslamic = { clientId: 'hassan', transactions: [
      { sens: 'ENTREE', montantChf: 100000, libelle: 'Interest on deposited amount', sourceConventionnelle: true }] };
    estSignal(detectRiba(c, P), 'RIBA_INCOME', 'R208', 2);
  });
  await it('IS-02 négatif : virement sans intérêt → pas de Riba', () => {
    ok(detectRiba({ clientId: 'hassan', transactions: [
      { sens: 'ENTREE', montantChf: 100000, libelle: 'Salary', sourceConventionnelle: true }] }, P) === null, 'pas d\'intérêt');
  });

  // ══ IS-03 R209 — Maysir (blocage auto) ══
  await it('IS-03 plateforme spéculative volatile → MAYSIR_SPECULATION (N1) BLOQUANT', () => {
    const c: ContexteIslamic = { clientId: 'samir', transactions: [
      { sens: 'SORTIE', montantChf: 500000, beneficiaire: 'CryptoMax', plateformeSpeculative: true }] };
    estSignal(blockMaysir(c, P), 'MAYSIR_SPECULATION', 'R209', 1, { bloquant: true });
  });
  await it('IS-03 volatilité ≥ seuil déclenche aussi le blocage maysir', () => {
    estSignal(blockMaysir({ clientId: 'samir', transactions: [
      { sens: 'SORTIE', montantChf: 500000, volatilitePct: 85 }] }, P), 'MAYSIR_SPECULATION', 'R209', 1, { bloquant: true });
  });
  await it('IS-03 négatif : transfert non spéculatif → pas de blocage', () => {
    ok(blockMaysir({ clientId: 'samir', transactions: [
      { sens: 'SORTIE', montantChf: 500000, volatilitePct: 10 }] }, P) === null, 'faible volatilité');
  });

  // ══ IS-04 R210 — Gharar ══
  await it('IS-04 contrat dérivé → GHARAR_DETECTED (N2)', () => {
    estSignal(validateGharar({ clientId: 'noor', contrat: { type: 'DERIVE' } }, P), 'GHARAR_DETECTED', 'R210', 2);
  });
  await it('IS-04 négatif : contrat Murabaha (Shariah) → pas de gharar', () => {
    ok(validateGharar({ clientId: 'noor', contrat: { type: 'MURABAHA' } }, P) === null, 'contrat conforme');
  });

  // ══ IS-06 R212 — Sukuk non certifié ══
  await it('IS-06 Sukuk sans certificat Shariah → FAKE_SUKUK (N2)', () => {
    estSignal(verifySukuk({ clientId: 'layla', instrument: { nom: 'Fund XYZ', type: 'SUKUK', certifieShariah: false } }, P),
      'FAKE_SUKUK', 'R212', 2);
  });
  await it('IS-06 négatif : Sukuk certifié AAOIFI → pas d\'alerte', () => {
    ok(verifySukuk({ clientId: 'layla', instrument: { type: 'SUKUK', certifieShariah: true, certificateur: 'AAOIFI' } }, P) === null,
      'certifié');
  });

  // ══ IS-07 R213 — contrepartie haram ══
  await it('IS-07 fournisseur cœur de métier haram → HARAM_COUNTERPARTY (N1)', () => {
    estSignal(checkHalalCounterparty({ clientId: 'amira', fournisseurCoeurMetier: 'PORC' }, P), 'HARAM_COUNTERPARTY', 'R213', 1);
  });
  await it('IS-07 négatif : fournisseur licite → pas de signal', () => {
    ok(checkHalalCounterparty({ clientId: 'amira', fournisseurCoeurMetier: 'TEXTILE' }, P) === null, 'secteur licite');
  });

  // ══ IS-10 R216 — entité islamique caritative sous sanction → revue humaine, PAS d'auto-blocage ══
  await it('IS-10 entité caritative islamique sanctionnée → ISLAMIC_SANCTION_REVIEW (N2) revue, non bloquant', () => {
    estSignal(reviewIslamicSanction({ clientId: 'islamic-relief', beneficiaireEntiteIslamiqueCaritative: true,
      beneficiaireSanctionne: true }, P), 'ISLAMIC_SANCTION_REVIEW', 'R216', 2, { revue: true, bloquant: false });
  });
  await it('IS-10 négatif : sanctionné mais pas entité caritative islamique → R216 ne s\'applique pas', () => {
    ok(reviewIslamicSanction({ clientId: 'x', beneficiaireEntiteIslamiqueCaritative: false, beneficiaireSanctionne: true }, P) === null,
      'pas une entité caritative islamique');
  });

  // ══ IS-15 R221 — ESG sans certif islamique ══
  await it('IS-15 fonds ESG sans certif islamique → MISSING_ISLAMIC_CERT (N1)', () => {
    estSignal(checkEsgIslamicCert({ clientId: 'hassan', fondsEsgCertifie: true, fondsIslamiqueCertifie: false }, P),
      'MISSING_ISLAMIC_CERT', 'R221', 1);
  });
  await it('IS-15 négatif : ESG + certif islamique → pas d\'alerte', () => {
    ok(checkEsgIslamicCert({ clientId: 'hassan', fondsEsgCertifie: true, fondsIslamiqueCertifie: true }, P) === null, 'double certif');
  });

  // ══ IS-05 R211 — Zakat ══
  await it('IS-05 patrimoine 500k > nisab → Zakat 2,5% = 12500, PENDING_PAYMENT', () => {
    const z = calculerZakat(500000, P);
    ok(z.zakatDue === 12500 && z.status === 'PENDING_PAYMENT' && z.totalWealth === 500000, `zakat=${z.zakatDue}/${z.status}`);
  });
  await it('IS-05 négatif : patrimoine ≤ nisab → non assujetti, Zakat 0', () => {
    const z = calculerZakat(50000, P);
    ok(z.zakatDue === 0 && z.status === 'NON_ASSUJETTI', 'sous le nisab');
  });

  // ══ IS-08 R214 — Qard ul Hasan ══
  await it('IS-08 Qard : principal seul, intérêt 0', () => {
    const q = suiviQard(10000);
    ok(q.principalOutstanding === 10000 && q.interet === 0, 'prêt sans intérêt');
  });

  // ══ IS-09 R215 — Mudaraba ══
  await it('IS-09 Mudaraba profit 12k, 70/30 → banque 8400, client 3600', () => {
    const m = distribuerMudaraba(12000, 70, 30);
    ok(m.bankShare === 8400 && m.clientShare === 3600 && m.status === 'POSTED', `bank=${m.bankShare}/client=${m.clientShare}`);
  });
  await it('IS-09 partage ≠ 100% → refus', () => jette(() => distribuerMudaraba(12000, 70, 40), 'R215'));

  // ══ IS-11 R217 — audit Shariah ══
  await it('IS-11 audit : 5000 tx, 10 violations → 99.8% conforme', () => {
    const a = auditShariah({ clientsIslamic: 150, transactions: 5000, violations: 10, zakatDistribueChf: 1200000 });
    ok(a.compliancePct === 99.8, `compliance=${a.compliancePct}`);
  });

  // ══ IS-12 R218 — Waqf : revenu seul, principal immuable ══
  await it('IS-12 Waqf retrait ≤ revenu → autorisé (principal intact)', () => {
    const w = validerRetraitWaqf(200000, 100000);
    ok(w.autorise === true && w.source === 'INCOME_ONLY', 'retrait sur revenu');
  });
  await it('IS-12 Waqf retrait > revenu → refusé (principal immuable)', () => {
    const w = validerRetraitWaqf(200000, 250000);
    ok(w.autorise === false && (w.motif ?? '').includes('R218'), 'principal protégé');
  });

  // ══ IS-13 R219 — Takaful ══
  await it('IS-13 Takaful : prime au pool mutualisé, pas à l\'assureur', () => {
    const t = suiviTakaful(500);
    ok(t.destinataire === 'TAKAFUL_POOL' && t.premium === 500, 'pool mutualisé');
  });

  // ══ IS-14 R220 — Sukuk maturité ══
  await it('IS-14 Sukuk à 90j → alerte + options de refinancement', () => {
    const s = alerteSukukMaturite(90);
    ok(s.alerte === true && s.optionsRefinancement.length > 0, 'alerte de maturité');
  });
  await it('IS-14 négatif : maturité lointaine (120j) → pas d\'alerte', () => {
    ok(alerteSukukMaturite(120).alerte === false, 'pas d\'alerte');
  });

  // ══ Moteur agrégé & paramètres ══
  await it('MOTEUR : contexte propre → aucun signal', () => {
    ok(evaluerIslamic({ clientId: 'x', clientIslamic: true, transactions: [{ montantChf: 100, secteurBeneficiaire: 'TEXTILE' }] }, P).length === 0,
      'rien d\'illicite');
  });
  await it('MOTEUR : contexte multi-risque → plusieurs signaux', () => {
    const s = evaluerIslamic({ clientId: 'x', clientIslamic: true,
      transactions: [{ montantChf: 5000, secteurBeneficiaire: 'ALCOOL' }, { sens: 'SORTIE', montantChf: 9, volatilitePct: 90 }] }, P);
    ok(s.some((x) => x.regle === 'R207') && s.some((x) => x.regle === 'R209'), 'profil + maysir');
    ok(s.filter((x) => x.bloquant).length === 1, 'seul le maysir bloque');
  });
  await it('PARAMS : surcharge tenant lue par-dessus les défauts', () => {
    const p = paramsIslamicDepuisSettings({ islamicNisabChf: 200000, islamicSecteursHaram: ['CRYPTO'] });
    ok(p.nisabChf === 200000 && p.secteursHaram.length === 1 && p.secteursHaram[0] === 'CRYPTO', 'surcharges');
    ok(p.zakatTauxBps === P.zakatTauxBps, 'non-surchargé garde le défaut');
  });
  await it('PARAMS : nisab relevé → un patrimoine intermédiaire n\'est plus assujetti', () => {
    ok(calculerZakat(150000, P).status === 'PENDING_PAYMENT', 'à 100k : assujetti');
    ok(calculerZakat(150000, { ...P, nisabChf: 200000 }).status === 'NON_ASSUJETTI', 'à 200k : non assujetti');
  });

  // ══ Service : persistance, auteur=jeton, blocage, revue, calculateurs ══
  await it('SVC blocage maysir : evaluer persiste, bloque, signé par le jeton (jamais le corps)', async () => {
    const p = fakePrisma(); const s = new IslamicService(p, fakeAudit());
    const r: any = await s.evaluer(MLRO, { clientId: 'samir', transactions: [{ sens: 'SORTIE', montantChf: 500000, plateformeSpeculative: true }], emisPar: 'PIRATE' } as any);
    ok(r.bloque === true, 'maysir bloque');
    ok(p._db.signals.length === 1 && p._db.signals[0].emisPar === 'u-mlro' && p._db.signals[0].emisPar !== 'PIRATE', 'auteur = jeton');
    ok(p._db.events.some((e: any) => e.type === 'islamic.operation.bloquee'), 'blocage tracé');
  });
  await it('SVC R216 : entité caritative sanctionnée → revue humaine, PAS de blocage', async () => {
    const p = fakePrisma(); const s = new IslamicService(p, fakeAudit());
    const r: any = await s.evaluer(MLRO, { clientId: 'ir', beneficiaireEntiteIslamiqueCaritative: true, beneficiaireSanctionne: true } as any);
    ok(r.bloque === false && r.revueManuelle === true, 'jamais d\'auto-blocage sur entité caritative');
    ok(p._db.signals[0].revueManuelle === true, 'signal marqué revue');
  });
  await it('SVC zakat (49b) : calcule, PERSISTE le ledger signé jeton, ne lève aucun signal', async () => {
    const p = fakePrisma(); const s = new IslamicService(p, fakeAudit());
    const z: any = await s.zakat(MLRO, { clientId: 'ahmed', patrimoineChf: 500000, annee: 2026 });
    ok(z.zakatDue === 12500 && !!z.id, 'zakat calculée et persistée');
    ok(p._db.signals.length === 0 && p._db.zakat.length === 1, 'ledger persisté, aucun signal');
    ok(p._db.zakat[0].emisPar === 'u-mlro' && p._db.zakat[0].annee === 2026, 'auteur = jeton, année portée');
    ok(p._db.events.some((e: any) => e.type === 'islamic.zakat.calcule'), 'événement émis');
  });
  await it('SVC zakat historique (49b) : lecture tenant-scopée du ledger', async () => {
    const p = fakePrisma(); const s = new IslamicService(p, fakeAudit());
    await s.zakat(MLRO, { clientId: 'ahmed', patrimoineChf: 500000 });
    ok((await s.zakatHistorique(MLRO, 'ahmed')).length === 1, 'l\'historique du client');
    ok((await s.zakatHistorique(MLRO, 'autre')).length === 0, 'rien pour un autre client');
  });
  await it('SVC mudaraba (49b) : distribution PERSISTÉE, part client tracée, signée jeton', async () => {
    const p = fakePrisma(); const s = new IslamicService(p, fakeAudit());
    const m: any = await s.mudaraba(MLRO, { clientId: 'mariam', profitChf: 12000, bankSharePct: 70, clientSharePct: 30 });
    ok(m.clientShare === 3600 && !!m.id, 'part client 30%');
    ok(p._db.mudaraba.length === 1 && p._db.mudaraba[0].emisPar === 'u-mlro' && p._db.mudaraba[0].clientShare === 3600, 'ledger signé jeton');
  });
  await it('SVC waqf (49b) : retrait autorisé PERSISTÉ (revenu seul) ; refus non persisté', async () => {
    const p = fakePrisma(); const s = new IslamicService(p, fakeAudit());
    const w: any = await s.waqfRetrait(MLRO, { waqfId: 'w1', incomeChf: 200000, retraitChf: 100000 });
    ok(w.autorise === true && !!w.id, 'retrait autorisé persisté');
    ok(p._db.waqf.length === 1 && p._db.waqf[0].source === 'INCOME_ONLY' && p._db.waqf[0].emisPar === 'u-mlro', 'ledger signé jeton');
    await jette(s.waqfRetrait(MLRO, { waqfId: 'w1', incomeChf: 200000, retraitChf: 250000 }), 'R218');
    ok(p._db.waqf.length === 1, 'le refus ne persiste rien');
  });
  await it('SVC tenant param : relever la volatilité maysir fait taire un cas limite', async () => {
    const p = fakePrisma({ islamicMaysirVolatilitePct: 90 }); const s = new IslamicService(p, fakeAudit());
    const r: any = await s.evaluer(MLRO, { clientId: 'samir', transactions: [{ sens: 'SORTIE', montantChf: 1, volatilitePct: 85 }] } as any);
    ok(r.signaux.length === 0, 'seuil tenant (90) : 85 ne bloque plus');
  });
  await it('SVC Waqf : retrait > revenu refusé par le service', async () => {
    const s = new IslamicService(fakePrisma(), fakeAudit());
    await jette(s.waqfRetrait(MLRO, { waqfId: 'w1', incomeChf: 200000, retraitChf: 250000 }), 'R218');
  });
  await it('SVC append-only structurel : aucune API de mutation de signal', () => {
    const s: any = new IslamicService(fakePrisma(), fakeAudit());
    ok(typeof s.evaluer === 'function' && typeof s.signaux === 'function', 'les portes de lecture/écriture');
    ok(s.modifier === undefined && s.supprimer === undefined, 'aucune édition/suppression');
  });

  console.log(`\nCâblage Couche Shariah (IS-01..IS-15, R207→R221) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
