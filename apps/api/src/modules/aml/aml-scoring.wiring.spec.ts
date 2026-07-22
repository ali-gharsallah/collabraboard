/**
 * Câblage Surveillance AML — A-69..A-86 (R189→R206). Chaque scénario Gherkin en CHAIR :
 * le détecteur lève le bon signal sur la donnée du scénario, et se TAIT sur un contrôle propre
 * (jamais d'invention — R44). Puis le service : persistance append-only tenant-scopée, auteur =
 * jeton (jamais le corps), blocage niveau 1, seuils pilotés par le registre tenant.
 *
 * ⚠ Provenance : tests ÉCRITS depuis le Gherkin (Bloc 48, exception ratifiée) — ils valent ce
 * que vaut le Gherkin, ils ne remplacent pas un corpus ratifié. Signalé au rapport de lot.
 *
 * Harnais : compiler aml-scoring.engine.ts + aml.service.ts + ce fichier ;
 *   echo "── Câblage Surveillance AML (A-69..A-86, R189→R206) ──"; run aml-scoring.wiring.spec.js
 */
import {
  detecterStructuring, detecterCrossBorder, detecterVelocity, detecterSanctions,
  detecterUboMismatch, detecterInOutSameDay, detecterThirdPartyPayer, detecterCircularFlow,
  detecterHri, detecterRoundAmounts, detecterCashWire, detecterPepAdjacent,
  detecterInvoiceUnderpay, detecterCounterpartyVelocity, detecterCrsNonCompliance,
  detecterFiduciaryAbuse, detecterTaxMinimization, detecterConcentration,
  evaluer, paramsDepuisSettings, AML_PARAMS_DEFAUT, ContexteAml, SignalAml,
} from './aml-scoring.engine';
import { AmlService } from './aml.service';
declare const process: { exit(n: number): void; env: any };

let passed = 0, failed = 0; const fails: string[] = [];
function it(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve().then(fn).then(() => { passed++; },
    (e: Error) => { failed++; fails.push(`✗ ${name} — ${e.message}`); });
}
const ok = (c: boolean, m = 'assertion') => { if (!c) throw new Error(m); };
const P = AML_PARAMS_DEFAUT;
const estSignal = (s: SignalAml | null, type: string, regle: string, niveau: number, bloquant = false) => {
  ok(s !== null, `signal attendu (${type})`);
  ok(s!.type === type, `type ${type} attendu, obtenu ${s!.type}`);
  ok(s!.regle === regle, `règle ${regle} attendue, obtenue ${s!.regle}`);
  ok(s!.niveau === niveau, `niveau ${niveau} attendu, obtenu ${s!.niveau}`);
  ok(s!.bloquant === bloquant, `bloquant=${bloquant} attendu`);
  ok(s!.motif.includes(`(${regle})`), `le motif référence ${regle}`);
};

// ── fakes service ────────────────────────────────────────────────────────────
function fakePrisma(settings: any = {}) {
  let seq = 0; const id = (p: string) => `${p}-${++seq}`;
  const db = { signals: [] as any[], events: [] as any[] };
  const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) => row[k] === v);
  const p: any = { _db: db,
    tenant: { findFirst: async ({ where }: any) => ({ id: where.id, settings }) },
    amlSignal: {
      create: async ({ data }: any) => { const r = { id: id('S'), ...data }; db.signals.push(r); return r; },
      findMany: async ({ where }: any = {}) => db.signals.filter((x) => match(x, where)) },
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; } } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const MLRO = { tenantId: 't1', userId: 'u-mlro', role: 'MLRO' };

(async () => {
  // ══ A-69 R189 Structuring ══
  await it('A-69 structuring : 5 virements sous seuil, même UBO → STRUCTURING (N2)', () => {
    const c: ContexteAml = { clientId: 'alice', virements: [
      { sens: 'SORTIE', montantChf: 19999, at: '2026-06-01T09:00:00Z', uboContrepartie: 'ubo-x' },
      { sens: 'SORTIE', montantChf: 19999, at: '2026-06-01T12:00:00Z', uboContrepartie: 'ubo-x' },
      { sens: 'SORTIE', montantChf: 19999, at: '2026-06-01T15:00:00Z', uboContrepartie: 'ubo-x' },
      { sens: 'SORTIE', montantChf: 20000, at: '2026-06-02T08:00:00Z', uboContrepartie: 'ubo-x' },
      { sens: 'SORTIE', montantChf: 20000, at: '2026-06-02T09:00:00Z', uboContrepartie: 'ubo-x' } ] };
    estSignal(detecterStructuring(c, P), 'STRUCTURING', 'R189', 2);
  });
  await it('A-69 négatif : 4 virements (< alertCount) → aucun signal', () => {
    const c: ContexteAml = { clientId: 'alice', virements: [1, 2, 3, 4].map((i) => (
      { sens: 'SORTIE' as const, montantChf: 20000, at: `2026-06-0${i}T09:00:00Z`, uboContrepartie: 'ubo-x' })) };
    ok(detecterStructuring(c, P) === null, 'moins de 5 virements ne structure pas');
  });

  // ══ A-70 R190 Cross-border circular ══
  await it('A-70 cross-border : même UBO, 3 pays, 24h → CROSS_BORDER_CIRCULAR (N2)', () => {
    const c: ContexteAml = { clientId: 'bob', virements: [
      { sens: 'SORTIE', montantChf: 250000, at: '2026-06-01T09:00:00Z', pays: 'UK', uboContrepartie: 'acme' },
      { sens: 'SORTIE', montantChf: 250000, at: '2026-06-01T18:00:00Z', pays: 'DE', uboContrepartie: 'acme' },
      { sens: 'SORTIE', montantChf: 250000, at: '2026-06-02T08:00:00Z', pays: 'FR', uboContrepartie: 'acme' } ] };
    estSignal(detecterCrossBorder(c, P), 'CROSS_BORDER_CIRCULAR', 'R190', 2);
  });
  await it('A-70 négatif : même pays → pas de signal cross-border', () => {
    const c: ContexteAml = { clientId: 'bob', virements: [
      { sens: 'SORTIE', montantChf: 250000, at: '2026-06-01T09:00:00Z', pays: 'UK', uboContrepartie: 'acme' },
      { sens: 'SORTIE', montantChf: 250000, at: '2026-06-01T18:00:00Z', pays: 'UK', uboContrepartie: 'acme' } ] };
    ok(detecterCrossBorder(c, P) === null, 'une seule juridiction');
  });

  // ══ A-71 R191 Unusual velocity ══
  await it('A-71 vélocité : dormant 18m puis CHF 10M en 72h → UNUSUAL_VELOCITY (N2)', () => {
    const c: ContexteAml = { clientId: 'alice', moisHistorique: 18, moyenneMensuelleChf: 0,
      sortiesRecentesChf: 10_000_000, fenetreRecenteJours: 3 };
    estSignal(detecterVelocity(c, P), 'UNUSUAL_VELOCITY', 'R191', 2);
  });
  await it('A-71 négatif : compte non dormant (6 mois) → pas de signal', () => {
    ok(detecterVelocity({ clientId: 'alice', moisHistorique: 6, moyenneMensuelleChf: 0,
      sortiesRecentesChf: 10_000_000 }, P) === null, 'pas dormant');
  });

  // ══ A-72 R192 Sanctions (blocage non révocable) ══
  await it('A-72 sanctions : bénéficiaire OFAC SDN → SANCTIONS (N1) BLOQUANT', () => {
    estSignal(detecterSanctions({ clientId: 'carol', beneficiaireSanctionne: true }, P), 'SANCTIONS', 'R192', 1, true);
  });
  await it('A-72 négatif : bénéficiaire propre → pas de signal', () => {
    ok(detecterSanctions({ clientId: 'carol', beneficiaireSanctionne: false }, P) === null, 'pas de match liste');
  });

  // ══ A-73 R193 UBO mismatch ══
  await it('A-73 UBO mismatch : déclaré ≠ détecté → UBO_MISMATCH (N2)', () => {
    estSignal(detecterUboMismatch({ clientId: 'alice', uboDeclare: 'Alice', uboDetecte: 'Xavier' }, P),
      'UBO_MISMATCH', 'R193', 2);
  });
  await it('A-73 négatif : UBO cohérent → pas de signal', () => {
    ok(detecterUboMismatch({ clientId: 'alice', uboDeclare: 'Alice', uboDetecte: 'Alice' }, P) === null, 'UBO cohérent');
  });

  // ══ A-74 R194 In/Out same day ══
  await it('A-74 in/out : entrée 1M puis sortie 980k en 4h, juridiction diff → PLACEMENT_WITHDRAWAL (N2)', () => {
    const c: ContexteAml = { clientId: 'dave', virements: [
      { sens: 'ENTREE', montantChf: 1_000_000, at: '2026-06-01T10:00:00Z', pays: 'CH' },
      { sens: 'SORTIE', montantChf: 980_000, at: '2026-06-01T14:00:00Z', pays: 'LU' } ] };
    estSignal(detecterInOutSameDay(c, P), 'PLACEMENT_WITHDRAWAL', 'R194', 2);
  });
  await it('A-74 négatif : même juridiction → pas de layering', () => {
    const c: ContexteAml = { clientId: 'dave', virements: [
      { sens: 'ENTREE', montantChf: 1_000_000, at: '2026-06-01T10:00:00Z', pays: 'CH' },
      { sens: 'SORTIE', montantChf: 980_000, at: '2026-06-01T14:00:00Z', pays: 'CH' } ] };
    ok(detecterInOutSameDay(c, P) === null, 'même pays');
  });

  // ══ A-75 R195 Third-party payer ══
  await it('A-75 tiers payeur : 12 paiements, 0 par le titulaire → THIRD_PARTY_PAYER (N1)', () => {
    const c: ContexteAml = { clientId: 'eve', paiements: Array.from({ length: 12 }, () => ({ parTitulaire: false })) };
    estSignal(detecterThirdPartyPayer(c, P), 'THIRD_PARTY_PAYER', 'R195', 1);
  });
  await it('A-75 négatif : au moins un paiement du titulaire → pas de signal', () => {
    const c: ContexteAml = { clientId: 'eve', paiements: [{ parTitulaire: false }, { parTitulaire: true }] };
    ok(detecterThirdPartyPayer(c, P) === null, 'le titulaire paie parfois');
  });

  // ══ A-76 R196 Circular flow ══
  await it('A-76 flux circulaire : A→B→C→A même UBO en 3j → CIRCULAR_FLOW (N2)', () => {
    const c: ContexteAml = { clientId: 'frank', mouvements: [
      { de: 'A', vers: 'B', montantChf: 500000, at: '2026-06-01T00:00:00Z', ubo: 'u' },
      { de: 'B', vers: 'C', montantChf: 490000, at: '2026-06-02T00:00:00Z', ubo: 'u' },
      { de: 'C', vers: 'A', montantChf: 480000, at: '2026-06-03T00:00:00Z', ubo: 'u' } ] };
    estSignal(detecterCircularFlow(c, P), 'CIRCULAR_FLOW', 'R196', 2);
  });
  await it('A-76 négatif : chaîne ouverte (pas de retour) → pas de cycle', () => {
    const c: ContexteAml = { clientId: 'frank', mouvements: [
      { de: 'A', vers: 'B', montantChf: 500000, at: '2026-06-01T00:00:00Z', ubo: 'u' },
      { de: 'B', vers: 'C', montantChf: 490000, at: '2026-06-02T00:00:00Z', ubo: 'u' },
      { de: 'C', vers: 'D', montantChf: 480000, at: '2026-06-03T00:00:00Z', ubo: 'u' } ] };
    ok(detecterCircularFlow(c, P) === null, 'aucun retour à l\'origine');
  });

  // ══ A-77 R197 HRI jurisdiction (blocage attente CO) ══
  await it('A-77 HRI : transfert vers Iran → HRI_JURISDICTION (N2) BLOQUANT', () => {
    const c: ContexteAml = { clientId: 'grace', virements: [
      { sens: 'SORTIE', montantChf: 100000, at: '2026-06-01T09:00:00Z', pays: 'Iran' } ] };
    estSignal(detecterHri(c, P), 'HRI_JURISDICTION', 'R197', 2, true);
  });
  await it('A-77 négatif : juridiction non HRI → pas de signal', () => {
    ok(detecterHri({ clientId: 'grace', virements: [
      { sens: 'SORTIE', montantChf: 100000, at: '2026-06-01T09:00:00Z', pays: 'France' } ] }, P) === null, 'pays non HRI');
  });

  // ══ A-78 R198 Round amounts ══
  await it('A-78 montants ronds : 80% de montants ronds → ROUND_AMOUNTS (N1)', () => {
    const ronds = [100000, 50000, 25000, 100000, 50000, 25000, 100000, 25000];
    const c: ContexteAml = { clientId: 'helen', virements: [...ronds, 26543, 13217].map((m) => (
      { sens: 'SORTIE' as const, montantChf: m, at: '2026-06-01T09:00:00Z' })) };
    estSignal(detecterRoundAmounts(c, P), 'ROUND_AMOUNTS', 'R198', 1);
  });
  await it('A-78 négatif : montants majoritairement non ronds → pas de signal', () => {
    const c: ContexteAml = { clientId: 'helen', virements: [26543, 13217, 88881, 12399, 44417].map((m) => (
      { sens: 'SORTIE' as const, montantChf: m, at: '2026-06-01T09:00:00Z' })) };
    ok(detecterRoundAmounts(c, P) === null, 'pas de pattern rond');
  });

  // ══ A-79 R199 Cash deposit + wire out ══
  await it('A-79 cash→wire : dépôt espèces 200k puis virement 195k en 6h → CASH_WIRE_PATTERN (N2)', () => {
    const c: ContexteAml = { clientId: 'ivan', virements: [
      { sens: 'ENTREE', montantChf: 200000, at: '2026-06-01T10:00:00Z', espece: true },
      { sens: 'SORTIE', montantChf: 195000, at: '2026-06-01T16:00:00Z', pays: 'Cayman' } ] };
    estSignal(detecterCashWire(c, P), 'CASH_WIRE_PATTERN', 'R199', 2);
  });
  await it('A-79 négatif : entrée non-espèces → pas de signal cash→wire', () => {
    const c: ContexteAml = { clientId: 'ivan', virements: [
      { sens: 'ENTREE', montantChf: 200000, at: '2026-06-01T10:00:00Z', espece: false },
      { sens: 'SORTIE', montantChf: 195000, at: '2026-06-01T16:00:00Z' } ] };
    ok(detecterCashWire(c, P) === null, 'pas d\'espèces');
  });

  // ══ A-80 R200 PEP adjacent ══
  await it('A-80 PEP adjacent : paiement vers un bénéficiaire PEP → PEP_ADJACENT (N2)', () => {
    estSignal(detecterPepAdjacent({ clientId: 'jack', paiements: [{ beneficiairePep: true, montantChf: 30000 }] }, P),
      'PEP_ADJACENT', 'R200', 2);
  });
  await it('A-80 négatif : bénéficiaire non PEP → pas de signal', () => {
    ok(detecterPepAdjacent({ clientId: 'jack', paiements: [{ beneficiairePep: false }] }, P) === null, 'pas de PEP');
  });

  // ══ A-81 R201 Invoice underpay ══
  await it('A-81 sous-paiement : 3 factures sous-payées de −0.1% → INVOICE_UNDERPAY (N1)', () => {
    const c: ContexteAml = { clientId: 'supplier', factures: [
      { factureChf: 50000, paiementChf: 49950 },
      { factureChf: 75000, paiementChf: 74925 },
      { factureChf: 100000, paiementChf: 99900 } ] };
    estSignal(detecterInvoiceUnderpay(c, P), 'INVOICE_UNDERPAY', 'R201', 1);
  });
  await it('A-81 négatif : factures payées en plein → pas de signal', () => {
    const c: ContexteAml = { clientId: 'supplier', factures: [
      { factureChf: 50000, paiementChf: 50000 },
      { factureChf: 75000, paiementChf: 75000 },
      { factureChf: 100000, paiementChf: 100000 } ] };
    ok(detecterInvoiceUnderpay(c, P) === null, 'aucun sous-paiement');
  });

  // ══ A-82 R202 Counterparty velocity ══
  await it('A-82 explosion contrepartie : 2M contre 10k moyen → COUNTERPARTY_VELOCITY (N2)', () => {
    const c: ContexteAml = { clientId: 'kate', contrepartieMoyenneChf: 10000,
      contrepartieEcartTypeChf: 2000, contrepartieMontantChf: 2_000_000 };
    estSignal(detecterCounterpartyVelocity(c, P), 'COUNTERPARTY_VELOCITY', 'R202', 2);
  });
  await it('A-82 négatif : montant dans la norme → pas de signal', () => {
    ok(detecterCounterpartyVelocity({ clientId: 'kate', contrepartieMoyenneChf: 10000,
      contrepartieEcartTypeChf: 2000, contrepartieMontantChf: 15000 }, P) === null, 'sous le seuil');
  });

  // ══ A-83 R203 CRS/FATCA non-compliance (block) ══
  await it('A-83 CRS : résidence UE, solde >1M, pas d\'auto-cert → CRS_NON_COMPLIANCE (N2) BLOQUANT', () => {
    const c: ContexteAml = { clientId: 'lisa', residenceFiscale: 'France', soldeChf: 1_500_000, autoCertificationCrs: false };
    estSignal(detecterCrsNonCompliance(c, P), 'CRS_NON_COMPLIANCE', 'R203', 2, true);
  });
  await it('A-83 négatif : auto-certification fournie → pas de blocage', () => {
    ok(detecterCrsNonCompliance({ clientId: 'lisa', residenceFiscale: 'France', soldeChf: 1_500_000,
      autoCertificationCrs: true }, P) === null, 'auto-cert présente');
  });

  // ══ A-84 R204 Fiduciary abuse ══
  await it('A-84 fiduciaire : retraits perso 40% des dépôts clients → FIDUCIARY_ABUSE (N2)', () => {
    const c: ContexteAml = { clientId: 'pierre', compteFiduciaire: true,
      depotsClientsChf: 50_000_000, retraitsPersonnelsChf: 20_000_000 };
    estSignal(detecterFiduciaryAbuse(c, P), 'FIDUCIARY_ABUSE', 'R204', 2);
  });
  await it('A-84 négatif : retrait perso 2% → pas de signal', () => {
    ok(detecterFiduciaryAbuse({ clientId: 'pierre', compteFiduciaire: true,
      depotsClientsChf: 50_000_000, retraitsPersonnelsChf: 1_000_000 }, P) === null, 'sous le seuil');
  });

  // ══ A-85 R205 Tax minimization circuit ══
  await it('A-85 optimisation : circuit CH→Luxembourg→CH sans fiscalisation → TAX_MINIMIZATION (N1)', () => {
    const c: ContexteAml = { clientId: 'olivier', circuitPays: ['Suisse', 'Luxembourg', 'Suisse'], fiscalisationDocumentee: false };
    estSignal(detecterTaxMinimization(c, P), 'TAX_MINIMIZATION', 'R205', 1);
  });
  await it('A-85 négatif : fiscalisation documentée → pas de signal', () => {
    ok(detecterTaxMinimization({ clientId: 'olivier', circuitPays: ['Suisse', 'Luxembourg', 'Suisse'],
      fiscalisationDocumentee: true }, P) === null, 'circuit fiscalisé');
  });

  // ══ A-86 R206 Portfolio concentration ══
  await it('A-86 concentration : 90% du patrimoine sur 1 compte courant → CONCENTRATION_RISK (N1)', () => {
    const c: ContexteAml = { clientId: 'nathalie', patrimoineChf: 50_000_000, comptes: [
      { type: 'COURANT', soldeChf: 45_000_000 }, { type: 'TITRES', soldeChf: 5_000_000 } ] };
    estSignal(detecterConcentration(c, P), 'CONCENTRATION_RISK', 'R206', 1);
  });
  await it('A-86 négatif : patrimoine diversifié → pas de signal', () => {
    const c: ContexteAml = { clientId: 'nathalie', patrimoineChf: 50_000_000, comptes: [
      { type: 'COURANT', soldeChf: 20_000_000 }, { type: 'TITRES', soldeChf: 30_000_000 } ] };
    ok(detecterConcentration(c, P) === null, 'diversifié');
  });

  // ══ Moteur agrégé & paramètres ══
  await it('MOTEUR : contexte propre → aucun signal (jamais d\'invention, R44)', () => {
    ok(evaluer({ clientId: 'x', virements: [{ sens: 'SORTIE', montantChf: 500, at: '2026-06-01T09:00:00Z' }] }, P).length === 0,
      'un virement anodin ne lève rien');
  });
  await it('MOTEUR : contexte multi-risque → plusieurs signaux agrégés', () => {
    const s = evaluer({ clientId: 'x', beneficiaireSanctionne: true,
      virements: [{ sens: 'SORTIE', montantChf: 100000, at: '2026-06-01T09:00:00Z', pays: 'Iran' }] }, P);
    ok(s.some((x) => x.regle === 'R192') && s.some((x) => x.regle === 'R197'), 'sanctions ET HRI levés');
    ok(s.filter((x) => x.bloquant).length === 2, 'les deux sont bloquants');
  });
  await it('PARAMS : surcharge tenant lue par-dessus les défauts', () => {
    const p = paramsDepuisSettings({ amlStructuringAlertCount: 6, amlHriPays: ['Testland'] });
    ok(p.structuringAlertCount === 6 && p.hriPays.length === 1 && p.hriPays[0] === 'Testland', 'surcharges appliquées');
    ok(p.structuringSeuilChf === P.structuringSeuilChf, 'les non-surchargés gardent le défaut');
  });
  await it('PARAMS : relever alertCount à 6 fait taire un structuring de 5', () => {
    const c: ContexteAml = { clientId: 'alice', virements: Array.from({ length: 5 }, (_, i) => (
      { sens: 'SORTIE' as const, montantChf: 19999, at: `2026-06-01T0${i}:00:00Z`, uboContrepartie: 'ubo-x' })) };
    ok(detecterStructuring(c, P) !== null, 'à 5 (défaut) : signal');
    ok(detecterStructuring(c, { ...P, structuringAlertCount: 6 }) === null, 'à 6 : plus de signal');
  });

  // ══ Service : persistance, auteur=jeton, blocage, tenant-scope, append-only ══
  await it('SVC auteur=jeton : evaluer persiste le signal signé par ctx, jamais par le corps', async () => {
    const p = fakePrisma(); const s = new AmlService(p, fakeAudit());
    const r: any = await s.evaluer(MLRO, { clientId: 'cli-1', beneficiaireSanctionne: true, emisPar: 'PIRATE' } as any);
    ok(r.bloque === true, 'un signal bloquant bloque l\'opération');
    ok(p._db.signals.length === 1 && p._db.signals[0].emisPar === 'u-mlro', 'auteur = jeton');
    ok(p._db.signals[0].emisPar !== 'PIRATE', 'le corps ne décide pas de l\'auteur');
    ok(p._db.events.some((e: any) => e.type === 'aml.operation.bloquee'), 'blocage tracé en événement');
  });
  await it('SVC signal N2 : evaluer persiste sans bloquer, émet l\'événement', async () => {
    const p = fakePrisma(); const s = new AmlService(p, fakeAudit());
    const r: any = await s.evaluer(MLRO, { clientId: 'cli-2', uboDeclare: 'Alice', uboDetecte: 'Xavier' });
    ok(r.bloque === false && p._db.signals.length === 1, 'signal levé, pas de blocage');
    ok(p._db.events.some((e: any) => e.type === 'aml.signal.leve'), 'signal tracé');
  });
  await it('SVC tenant-scope : les seuils viennent du tenant (settings)', async () => {
    const p = fakePrisma({ amlStructuringAlertCount: 6 }); const s = new AmlService(p, fakeAudit());
    const virements = Array.from({ length: 5 }, (_, i) => (
      { sens: 'SORTIE' as const, montantChf: 19999, at: `2026-06-01T0${i}:00:00Z`, uboContrepartie: 'ubo-x' }));
    const r: any = await s.evaluer(MLRO, { clientId: 'cli-3', virements } as any);
    ok(r.signaux.length === 0, 'le seuil tenant (6) fait taire le structuring de 5');
  });
  await it('SVC lecture : signaux(client) tenant-scopé et chronologique', async () => {
    const p = fakePrisma(); const s = new AmlService(p, fakeAudit());
    await s.evaluer(MLRO, { clientId: 'cli-4', beneficiaireSanctionne: true } as any);
    const liste: any = await s.signaux(MLRO, 'cli-4');
    ok(liste.length === 1 && liste[0].clientId === 'cli-4', 'signal du bon client');
    ok((await s.signaux(MLRO, 'autre')).length === 0, 'aucun signal pour un autre client');
  });
  await it('SVC append-only structurel : aucune API de mutation de signal n\'existe', () => {
    const s: any = new AmlService(fakePrisma(), fakeAudit());
    ok(typeof s.evaluer === 'function' && typeof s.signaux === 'function', 'les deux seules portes');
    ok(s.modifier === undefined && s.supprimer === undefined && s.corriger === undefined, 'aucune édition/suppression');
  });

  console.log(`\nCâblage Surveillance AML (A-69..A-86, R189→R206) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
