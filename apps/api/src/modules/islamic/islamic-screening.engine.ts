/**
 * IslamicScreeningEngine — couche de conformité Shariah, R207→R221 (IS-01..IS-15).
 * Moteur PUR et DÉTERMINISTE : aucune base, aucune horloge. Deux familles :
 *   • DÉTECTEURS (R207..R213, R216, R221) → SignalIslamic | null ;
 *   • CALCULATEURS (R211, R214, R215, R217, R218, R219, R220) → rapport (jamais un signal).
 * Doctrine : le moteur SIGNALE et CALCULE, il ne décide jamais seul. Un seul blocage
 * automatique — la spéculation maysir (R209). Les entités caritatives islamiques sous
 * sanction NE sont PAS auto-bloquées (R216) : revue humaine. Les seuils (nisab, taux Zakat,
 * secteurs haram) sont des PARAMÈTRES tenant (registre R-Q, préfixe `islamic`), jamais cachés.
 *
 * ⚠ Provenance : implémentation + tests ÉCRITS depuis le Gherkin IS-01..IS-15 (Bloc 49), sur
 * exception ratifiée (le zip ne livrait ni service ni test ratifié). Ils valent ce que vaut le
 * Gherkin — ils ne remplacent pas un corpus ratifié. Adaptation minimale (option Ali) : un seul
 * modèle IslamicSignal (comme AmlSignal) ; Zakat/Mudaraba/Waqf/Qard/Takaful/Sukuk = calculateurs
 * purs + événements ledger. Pas de modèle Account/enum (inexistant au dépôt).
 */

export type NiveauIslamic = 1 | 2;

export interface SignalIslamic {
  type: string;          // ISLAMIC_PROFILE_VIOLATION, RIBA_INCOME, …
  regle: string;         // "R207"
  niveau: NiveauIslamic; // 1 = sévère ; 2 = signal
  note: string;
  motif: string;         // avec (Rxxx)
  bloquant: boolean;     // R209 uniquement (maysir) — refus automatique
  revueManuelle?: boolean; // R216 — surseoir à l'auto-blocage, décision humaine
}

export interface TxIslamic {
  sens?: "ENTREE" | "SORTIE";
  montantChf: number;
  beneficiaire?: string;
  secteurBeneficiaire?: string;     // ALCOOL, JEUX, CASINO, PORC, …
  libelle?: string;                 // « Interest on deposited amount »
  sourceConventionnelle?: boolean;  // banque non-islamique (R208)
  plateformeSpeculative?: boolean;  // R209
  volatilitePct?: number;           // R209
}
export interface Contrat { type: string; }                       // DERIVE, MURABAHA, …
export interface Instrument { nom?: string; type?: string; certifieShariah?: boolean; certificateur?: string; }

export interface ContexteIslamic {
  clientId: string;
  clientIslamic?: boolean;
  transactions?: TxIslamic[];
  contrat?: Contrat;
  instrument?: Instrument;
  fournisseurCoeurMetier?: string;              // secteur cœur de métier du fournisseur (R213)
  beneficiaireEntiteIslamiqueCaritative?: boolean; // R216
  beneficiaireSanctionne?: boolean;             // R216
  fondsEsgCertifie?: boolean;                   // R221
  fondsIslamiqueCertifie?: boolean;             // R221
}

export interface IslamicParams {
  nisabChf: number;             // seuil d'assujettissement Zakat
  zakatTauxBps: number;         // taux Zakat en points de base (250 = 2.5%)
  secteursHaram: string[];      // secteurs illicites
  ghararTypes: string[];        // familles de contrats à incertitude excessive
  maysirVolatilitePct: number;  // volatilité au-delà de laquelle c'est de la spéculation
}

export const ISLAMIC_PARAMS_DEFAUT: IslamicParams = {
  nisabChf: 100_000,
  zakatTauxBps: 250,
  secteursHaram: ["ALCOOL", "JEUX", "CASINO", "PORC", "TABAC", "ARMES", "ADULTE", "PORNOGRAPHIE"],
  ghararTypes: ["DERIVE", "HEDGING", "OPTION", "FUTURE", "SWAP"],
  maysirVolatilitePct: 80,
};

const sig = (
  type: string, regle: string, niveau: NiveauIslamic, note: string, motif: string,
  opts: { bloquant?: boolean; revueManuelle?: boolean } = {},
): SignalIslamic => ({ type, regle, niveau, note, motif, bloquant: !!opts.bloquant, revueManuelle: opts.revueManuelle });

// ══ DÉTECTEURS ═══════════════════════════════════════════════════════════════

// R207 — Client islamique payant un secteur haram
export function screenClient(c: ContexteIslamic, p: IslamicParams): SignalIslamic | null {
  if (!c.clientIslamic) return null;
  const hits = (c.transactions ?? []).filter((t) => t.secteurBeneficiaire && p.secteursHaram.includes(t.secteurBeneficiaire));
  if (hits.length === 0) return null;
  const noms = hits.map((t) => t.beneficiaire ?? t.secteurBeneficiaire).join(", ");
  return sig("ISLAMIC_PROFILE_VIOLATION", "R207", 2,
    `Client islamique, virements non-Shariah : ${noms}`,
    "Client Islamic, pattern non-Shariah (R207)");
}

// R208 — Riba : revenu d'intérêt d'une banque conventionnelle
export function detectRiba(c: ContexteIslamic, _p: IslamicParams): SignalIslamic | null {
  const t = (c.transactions ?? []).find((x) => x.sens === "ENTREE" && x.sourceConventionnelle
    && /interest|int[ée]r[êe]t|riba/i.test(x.libelle ?? ""));
  if (!t) return null;
  return sig("RIBA_INCOME", "R208", 2,
    `Revenu d'intérêt CHF ${t.montantChf} d'une source conventionnelle — proposer profit-sharing ou don Zakat`,
    "Revenu intérêt détecté, Shariah non-compliant (R208)");
}

// R209 — Maysir : spéculation → BLOCAGE automatique (seul blocage auto du bloc)
export function blockMaysir(c: ContexteIslamic, p: IslamicParams): SignalIslamic | null {
  const t = (c.transactions ?? []).find((x) => x.plateformeSpeculative === true
    || (x.volatilitePct !== undefined && x.volatilitePct >= p.maysirVolatilitePct));
  if (!t) return null;
  return sig("MAYSIR_SPECULATION", "R209", 1,
    `Transfert CHF ${t.montantChf} vers plateforme de spéculation (volatilité ≥ ${p.maysirVolatilitePct}%) — Shariah refuse`,
    "Plateforme spéculation maysir (R209)", { bloquant: true });
}

// R210 — Gharar : contrat à incertitude excessive
export function validateGharar(c: ContexteIslamic, p: IslamicParams): SignalIslamic | null {
  if (!c.contrat || !p.ghararTypes.includes(c.contrat.type)) return null;
  return sig("GHARAR_DETECTED", "R210", 2,
    `Contrat ${c.contrat.type} = gharar (incertitude excessive) — suggérer Murabaha/Musharaka/Ijarah`,
    "Contrat dérivé = gharar (R210)");
}

// R212 — Sukuk : instrument non certifié Shariah
export function verifySukuk(c: ContexteIslamic, _p: IslamicParams): SignalIslamic | null {
  if (!c.instrument || c.instrument.type !== "SUKUK") return null;
  if (c.instrument.certifieShariah === true && (c.instrument.certificateur ?? "").length > 0) return null;
  return sig("FAKE_SUKUK", "R212", 2,
    `Sukuk «${c.instrument.nom ?? "?"}» sans certificat Shariah (AAOIFI/ISRA) — refuser ou alternative authentique`,
    "Instrument non-certifié Shariah (R212)");
}

// R213 — Contrepartie haram : fournisseur au cœur de métier illicite
export function checkHalalCounterparty(c: ContexteIslamic, p: IslamicParams): SignalIslamic | null {
  if (!c.fournisseurCoeurMetier || !p.secteursHaram.includes(c.fournisseurCoeurMetier)) return null;
  return sig("HARAM_COUNTERPARTY", "R213", 1,
    `Fournisseur au cœur de métier haram (${c.fournisseurCoeurMetier}) — suggérer alternatives halal-certifiées`,
    "Supplier cœur de métier haram (R213)");
}

// R216 — Entité islamique caritative sous sanction → PAS d'auto-blocage, revue humaine
export function reviewIslamicSanction(c: ContexteIslamic, _p: IslamicParams): SignalIslamic | null {
  if (!c.beneficiaireSanctionne || !c.beneficiaireEntiteIslamiqueCaritative) return null;
  return sig("ISLAMIC_SANCTION_REVIEW", "R216", 2,
    "Entité islamique caritative sur liste de sanction — peut être un faux positif : revue Head of Compliance",
    "Islamic entity sur sanction list — peut être exception (R216)", { revueManuelle: true });
}

// R221 — Fonds ESG sans certification islamique
export function checkEsgIslamicCert(c: ContexteIslamic, _p: IslamicParams): SignalIslamic | null {
  if (c.fondsEsgCertifie !== true || c.fondsIslamiqueCertifie === true) return null;
  return sig("MISSING_ISLAMIC_CERT", "R221", 1,
    "Fonds ESG sans certification islamique (obligatoire) — pas de secteur haram vérifié",
    "ESG fund non-Islamic certified (R221)");
}

export const DETECTEURS_ISLAMIC: Array<(c: ContexteIslamic, p: IslamicParams) => SignalIslamic | null> = [
  screenClient, detectRiba, blockMaysir, validateGharar,
  verifySukuk, checkHalalCounterparty, reviewIslamicSanction, checkEsgIslamicCert,
];

export function evaluerIslamic(c: ContexteIslamic, p: IslamicParams = ISLAMIC_PARAMS_DEFAUT): SignalIslamic[] {
  return DETECTEURS_ISLAMIC.map((d) => d(c, p)).filter((s): s is SignalIslamic => s !== null);
}

// ══ CALCULATEURS (non-signaux — rapports + ledger) ═══════════════════════════

// R211 — Zakat annuelle : 2.5% du patrimoine au-delà du nisab
export interface RapportZakat { totalWealth: number; nisab: number; zakatDue: number; taux: string; status: string; }
export function calculerZakat(patrimoineChf: number, p: IslamicParams = ISLAMIC_PARAMS_DEFAUT): RapportZakat {
  const assujetti = patrimoineChf > p.nisabChf;
  const zakatDue = assujetti ? Math.round((patrimoineChf * p.zakatTauxBps) / 10_000) : 0;
  return { totalWealth: patrimoineChf, nisab: p.nisabChf, zakatDue,
    taux: `${p.zakatTauxBps / 100}%`, status: assujetti ? "PENDING_PAYMENT" : "NON_ASSUJETTI" };
}

// R214 — Qard ul Hasan : prêt sans intérêt, principal seul
export interface RapportQard { principalOutstanding: number; interet: number; }
export function suiviQard(principalChf: number): RapportQard {
  return { principalOutstanding: principalChf, interet: 0 };
}

// R215 — Mudaraba : distribution trimestrielle du profit selon le partage
export interface RapportMudaraba { profit: number; bankShare: number; clientShare: number; status: string; }
export function distribuerMudaraba(profitChf: number, bankSharePct: number, clientSharePct: number): RapportMudaraba {
  if (bankSharePct + clientSharePct !== 100) throw new Error("R215 : partage Mudaraba doit totaliser 100%");
  return { profit: profitChf,
    bankShare: Math.round((profitChf * bankSharePct) / 100),
    clientShare: Math.round((profitChf * clientSharePct) / 100), status: "POSTED" };
}

// R217 — Audit Shariah annuel : taux de conformité du portefeuille islamique
export interface RapportAudit { clientsIslamic: number; transactions: number; violations: number; compliancePct: number; zakatDistribueChf: number; }
export function auditShariah(x: { clientsIslamic: number; transactions: number; violations: number; zakatDistribueChf: number }): RapportAudit {
  const compliancePct = x.transactions > 0 ? Math.round(((x.transactions - x.violations) / x.transactions) * 1000) / 10 : 100;
  return { ...x, compliancePct };
}

// R218 — Waqf : retrait sur le revenu SEUL, principal immuable
export interface RapportWaqf { autorise: boolean; income: number; retrait: number; source: string; motif?: string; }
export function validerRetraitWaqf(incomeChf: number, retraitChf: number): RapportWaqf {
  const autorise = retraitChf <= incomeChf;
  return { autorise, income: incomeChf, retrait: retraitChf, source: "INCOME_ONLY",
    motif: autorise ? undefined : "R218 : retrait refusé — le principal du Waqf est immuable (revenu seul)" };
}

// R219 — Takaful : prime mutualisée (pool, pas assureur)
export interface RapportTakaful { premium: number; destinataire: string; partageProfit: string; }
export function suiviTakaful(premiumChf: number): RapportTakaful {
  return { premium: premiumChf, destinataire: "TAKAFUL_POOL", partageProfit: "TRIMESTRIEL_PARTICIPANTS" };
}

// R220 — Sukuk : alerte de maturité + options de refinancement
export interface RapportSukukMaturite { alerte: boolean; joursAvantMaturite: number; optionsRefinancement: string[]; }
export function alerteSukukMaturite(joursAvantMaturite: number, seuilJours = 90): RapportSukukMaturite {
  const alerte = joursAvantMaturite <= seuilJours;
  return { alerte, joursAvantMaturite,
    optionsRefinancement: alerte ? ["Sukuk alternatif", "Fonds islamique", "Compte profit-sharing"] : [] };
}

export function paramsIslamicDepuisSettings(settings: any): IslamicParams {
  const s = settings ?? {};
  const n = (cle: string, d: number) => (Number.isFinite(s[cle]) ? s[cle] : d);
  const a = (cle: string, d: string[]) => (Array.isArray(s[cle]) ? s[cle] : d);
  const D = ISLAMIC_PARAMS_DEFAUT;
  return {
    nisabChf: n("islamicNisabChf", D.nisabChf),
    zakatTauxBps: n("islamicZakatTauxBps", D.zakatTauxBps),
    secteursHaram: a("islamicSecteursHaram", D.secteursHaram),
    ghararTypes: a("islamicGhararTypes", D.ghararTypes),
    maysirVolatilitePct: n("islamicMaysirVolatilitePct", D.maysirVolatilitePct),
  };
}
