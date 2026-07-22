/**
 * AmlScoringEngine — surveillance AML private banking, R189→R206 (A-69..A-86).
 * Moteur PUR et DÉTERMINISTE : aucune base, aucune horloge, aucun effet de bord. Chaque
 * détecteur lit un contexte typé + les paramètres tenant et rend un SignalAml ou null.
 * La doctrine du bloc : le moteur SIGNALE, il ne décide jamais seul — seul le niveau 1
 * bloquant (sanctions R192, HRI R197 en attente CO, CRS R203) suspend l'opération ;
 * tout le reste est un signal porté à l'humain. Les seuils sont des PARAMÈTRES tenant
 * (registre R-Q, préfixe `aml*`), jamais des constantes cachées — « changer un seuil AML
 * est changer une règle » (R7/R125).
 *
 * ⚠ Provenance : implémentation + tests ÉCRITS depuis le Gherkin A-69..A-86 (Bloc 48),
 * sur ratification explicite d'une exception à la doctrine « canon d'abord » (le zip ne
 * livrait ni service ni test ratifié). Ces tests valent ce que vaut le Gherkin : ils ne
 * remplacent pas un corpus ratifié. Signalé au rapport de lot.
 */

export type NiveauAml = 1 | 2;

export interface SignalAml {
  type: string;        // STRUCTURING, CROSS_BORDER_CIRCULAR, …
  regle: string;       // "R189"
  niveau: NiveauAml;   // 1 = sévère ; 2 = signal
  note: string;        // le fait, en clair
  motif: string;       // la qualification, avec (Rxxx)
  bloquant: boolean;   // suspend l'opération (R192/R197/R203) — sinon simple signal
}

export interface Virement {
  sens: "ENTREE" | "SORTIE";
  montantChf: number;
  at: string;                    // ISO 8601
  pays?: string;                 // pays de la contrepartie
  uboContrepartie?: string;      // bénéficiaire ultime
  compteContrepartie?: string;
  espece?: boolean;              // dépôt/retrait en espèces
}

export interface Paiement { parTitulaire?: boolean; beneficiairePep?: boolean; montantChf?: number; }
export interface Mouvement { de: string; vers: string; montantChf: number; at: string; ubo?: string; }
export interface FactureReglement { factureChf: number; paiementChf: number; }
export interface Compte { type: string; soldeChf: number; }

export interface ContexteAml {
  clientId: string;
  virements?: Virement[];
  paiements?: Paiement[];
  mouvements?: Mouvement[];
  factures?: FactureReglement[];
  comptes?: Compte[];
  patrimoineChf?: number;
  // signalétique / profils
  uboDeclare?: string;
  uboDetecte?: string;
  beneficiaireSanctionne?: boolean;    // résultat du matching listes (R192)
  // R191 — vélocité de réveil
  moyenneMensuelleChf?: number;
  moisHistorique?: number;
  sortiesRecentesChf?: number;
  fenetreRecenteJours?: number;
  // R202 — explosion contrepartie
  contrepartieMoyenneChf?: number;
  contrepartieEcartTypeChf?: number;
  contrepartieMontantChf?: number;
  // R203 — CRS/FATCA
  residenceFiscale?: string;
  soldeChf?: number;
  autoCertificationCrs?: boolean;
  // R204 — fiduciaire
  compteFiduciaire?: boolean;
  depotsClientsChf?: number;
  retraitsPersonnelsChf?: number;
  // R205 — circuit d'optimisation
  circuitPays?: string[];
  fiscalisationDocumentee?: boolean;
}

export interface AmlParams {
  structuringAlertCount: number;
  structuringSeuilChf: number;
  structuringFenetreH: number;
  crossBorderFenetreH: number;
  crossBorderMinPays: number;
  velocityDormantMois: number;
  velocityMultiplicateur: number;
  inOutFenetreH: number;
  circularFenetreJours: number;
  hriPays: string[];
  roundSeuilPct: number;
  cashWirePct: number;
  cashWireFenetreH: number;
  counterpartyFacteurPct: number;
  crsResidences: string[];
  crsSeuilChf: number;
  fiduciaireSeuilPct: number;
  concentrationSeuilPct: number;
  taxHavens: string[];
  listesReglementaires: string[];
}

/** Défauts — miroir exact des `Params:` du catalogue R189..R206. Surchargés par tenant.settings. */
export const AML_PARAMS_DEFAUT: AmlParams = {
  structuringAlertCount: 5,
  structuringSeuilChf: 100_000,
  structuringFenetreH: 48,
  crossBorderFenetreH: 48,
  crossBorderMinPays: 2,
  velocityDormantMois: 18,
  velocityMultiplicateur: 5,
  inOutFenetreH: 6,
  circularFenetreJours: 10,
  hriPays: ["Iran", "Syrie", "Corée du Nord", "Cuba"],
  roundSeuilPct: 70,
  cashWirePct: 80,
  cashWireFenetreH: 24,
  counterpartyFacteurPct: 150,
  crsResidences: ["France", "Allemagne", "Italie", "Espagne", "USA", "FR", "DE", "US"],
  crsSeuilChf: 1_000_000,
  fiduciaireSeuilPct: 10,
  concentrationSeuilPct: 80,
  taxHavens: ["Luxembourg", "Jersey", "Guernesey", "Îles Caïmans", "Cayman"],
  listesReglementaires: ["OFAC", "EU", "UN", "SECO"],
};

// ── utilitaires purs ────────────────────────────────────────────────────────
const ms = (iso: string) => Date.parse(iso);
const heures = (a: string, b: string) => Math.abs(ms(a) - ms(b)) / 3_600_000;
const jours = (a: string, b: string) => Math.abs(ms(a) - ms(b)) / 86_400_000;
const sorties = (c: ContexteAml) => (c.virements ?? []).filter((v) => v.sens === "SORTIE");
const spanH = (ats: string[]) => (ats.length < 2 ? 0 : (Math.max(...ats.map(ms)) - Math.min(...ats.map(ms))) / 3_600_000);
const sig = (
  type: string, regle: string, niveau: NiveauAml, note: string, motif: string, bloquant = false,
): SignalAml => ({ type, regle, niveau, note, motif, bloquant });

// ── R189 — Structuring : fractionnement sous le seuil, même bénéficiaire ────
export function detecterStructuring(c: ContexteAml, p: AmlParams): SignalAml | null {
  const parUbo = new Map<string, Virement[]>();
  for (const v of sorties(c)) {
    const k = v.uboContrepartie ?? "?";
    (parUbo.get(k) ?? parUbo.set(k, []).get(k)!).push(v);
  }
  for (const [, vs] of parUbo) {
    if (vs.length < p.structuringAlertCount) continue;
    const somme = vs.reduce((s, v) => s + v.montantChf, 0);
    const span = spanH(vs.map((v) => v.at));
    if (vs.every((v) => v.montantChf < p.structuringSeuilChf)
      && somme >= p.structuringSeuilChf * 0.9
      && span <= p.structuringFenetreH) {
      return sig("STRUCTURING", "R189", 2,
        `${vs.length} virements sous le seuil, Σ ${Math.round(somme)} CHF proche de ${p.structuringSeuilChf} en ${Math.round(span)}h`,
        "Pattern structuring (R189)");
    }
  }
  return null;
}

// ── R190 — Cross-border circular : même UBO, ≥N pays, fenêtre courte ─────────
export function detecterCrossBorder(c: ContexteAml, p: AmlParams): SignalAml | null {
  const parUbo = new Map<string, Virement[]>();
  for (const v of sorties(c)) {
    const k = v.uboContrepartie ?? "?";
    (parUbo.get(k) ?? parUbo.set(k, []).get(k)!).push(v);
  }
  for (const [ubo, vs] of parUbo) {
    if (ubo === "?") continue;
    const pays = new Set(vs.map((v) => v.pays).filter(Boolean));
    if (pays.size >= p.crossBorderMinPays && spanH(vs.map((v) => v.at)) <= p.crossBorderFenetreH) {
      return sig("CROSS_BORDER_CIRCULAR", "R190", 2,
        `Même UBO ${ubo}, ${pays.size} juridictions, ${Math.round(spanH(vs.map((v) => v.at)))}h`,
        `Même UBO, ${pays.size} juridictions, ≤${p.crossBorderFenetreH}h (R190)`);
    }
  }
  return null;
}

// ── R191 — Unusual velocity : réveil d'un compte dormant ────────────────────
export function detecterVelocity(c: ContexteAml, p: AmlParams): SignalAml | null {
  if ((c.moisHistorique ?? 0) < p.velocityDormantMois) return null;
  const moyenne = c.moyenneMensuelleChf ?? 0;
  const recent = c.sortiesRecentesChf ?? 0;
  const declenche = moyenne <= 1 ? recent > 0 : recent > moyenne * p.velocityMultiplicateur;
  if (!declenche) return null;
  return sig("UNUSUAL_VELOCITY", "R191", 2,
    `Compte dormant ${c.moisHistorique}m → CHF ${recent} en ${(c.fenetreRecenteJours ?? 0) * 24}h`,
    "Vélocité inhabituelle sur compte dormant (R191)");
}

// ── R192 — Sanctions : liste réglementaire → refus immédiat non révocable ───
export function detecterSanctions(c: ContexteAml, _p: AmlParams): SignalAml | null {
  if (!c.beneficiaireSanctionne) return null;
  return sig("SANCTIONS", "R192", 1,
    "Bénéficiaire présent sur liste réglementaire (OFAC/EU/UN/SECO) — refus immédiat, motif non modifiable",
    "Sanctions OFAC SDN (R192)", true);
}

// ── R193 — UBO mismatch : déclaré ≠ détecté ─────────────────────────────────
export function detecterUboMismatch(c: ContexteAml, _p: AmlParams): SignalAml | null {
  if (!c.uboDeclare || !c.uboDetecte || c.uboDeclare === c.uboDetecte) return null;
  return sig("UBO_MISMATCH", "R193", 2,
    `UBO déclaré «${c.uboDeclare}» ≠ détecté «${c.uboDetecte}» — KYC à renouveler`,
    "UBO déclaré ≠ détecté (R193)");
}

// ── R194 — In/Out same day : entrée puis sortie ≈montant, fenêtre courte ─────
export function detecterInOutSameDay(c: ContexteAml, p: AmlParams): SignalAml | null {
  const vs = c.virements ?? [];
  for (const e of vs.filter((v) => v.sens === "ENTREE")) {
    for (const s of vs.filter((v) => v.sens === "SORTIE")) {
      if (ms(s.at) < ms(e.at)) continue;
      if (heures(e.at, s.at) <= p.inOutFenetreH
        && s.montantChf >= e.montantChf * 0.9
        && e.pays !== s.pays) {
        return sig("PLACEMENT_WITHDRAWAL", "R194", 2,
          `Entrée ${e.montantChf} puis sortie ${s.montantChf} en ${Math.round(heures(e.at, s.at))}h vers juridiction différente`,
          "In/Out même jour, layering (R194)");
      }
    }
  }
  return null;
}

// ── R195 — Third-party payer : le titulaire ne paie jamais ──────────────────
export function detecterThirdPartyPayer(c: ContexteAml, _p: AmlParams): SignalAml | null {
  const ps = c.paiements ?? [];
  if (ps.length === 0 || ps.some((x) => x.parTitulaire === true)) return null;
  return sig("THIRD_PARTY_PAYER", "R195", 1,
    `${ps.length} paiements, 0 par le titulaire — un tiers paie systématiquement`,
    "Titulaire ne paie jamais (R195)");
}

// ── R196 — Circular flow : cycle A→B→C→A entre comptes du même UBO ──────────
export function detecterCircularFlow(c: ContexteAml, p: AmlParams): SignalAml | null {
  const ms_ = c.mouvements ?? [];
  if (ms_.length < 3) return null;
  const ubos = new Set(ms_.map((m) => m.ubo));
  if (ubos.size !== 1) return null;                         // un seul UBO derrière tout le cycle
  const de = ms_.map((m) => m.de).sort();
  const vers = ms_.map((m) => m.vers).sort();
  const boucle = de.length === vers.length && de.every((x, i) => x === vers[i]);   // chaque compte émet ET reçoit
  const span = jours(
    ms_.reduce((a, m) => (ms(m.at) < ms(a) ? m.at : a), ms_[0].at),
    ms_.reduce((a, m) => (ms(m.at) > ms(a) ? m.at : a), ms_[0].at));
  if (boucle && span <= p.circularFenetreJours) {
    const chaine = [...ms_].sort((a, b) => ms(a.at) - ms(b.at)).map((m) => m.de).concat(ms_[0].de).join("→");
    return sig("CIRCULAR_FLOW", "R196", 2, `Cycle ${chaine} en ${Math.round(span)}j`, "Cycle A→B→C→A (R196)");
  }
  return null;
}

// ── R197 — HRI jurisdiction : pays à haut risque → blocage attente CO ───────
export function detecterHri(c: ContexteAml, p: AmlParams): SignalAml | null {
  const hit = (c.virements ?? []).find((v) => v.pays && p.hriPays.includes(v.pays));
  if (!hit) return null;
  return sig("HRI_JURISDICTION", "R197", 2,
    `Transfert vers ${hit.pays} (juridiction à haut risque) — blocage en attente d'approbation CO`,
    "Juridiction à haut risque — attente approbation CO (R197)", true);
}

// ── R198 — Round amounts : forte proportion de montants ronds ───────────────
export function detecterRoundAmounts(c: ContexteAml, p: AmlParams): SignalAml | null {
  const vs = c.virements ?? [];
  if (vs.length < 5) return null;
  const ronds = vs.filter((v) => v.montantChf % 25_000 === 0).length;
  if (ronds / vs.length >= p.roundSeuilPct / 100) {
    return sig("ROUND_AMOUNTS", "R198", 1,
      `${Math.round((ronds / vs.length) * 100)}% de montants ronds (multiples de 25k)`,
      "Pattern montants ronds (R198)");
  }
  return null;
}

// ── R199 — Cash deposit + wire out : espèces puis virement >X% en <Yh ───────
export function detecterCashWire(c: ContexteAml, p: AmlParams): SignalAml | null {
  const vs = c.virements ?? [];
  for (const d of vs.filter((v) => v.sens === "ENTREE" && v.espece)) {
    for (const s of vs.filter((v) => v.sens === "SORTIE")) {
      if (ms(s.at) < ms(d.at)) continue;
      if (heures(d.at, s.at) <= p.cashWireFenetreH && s.montantChf >= d.montantChf * (p.cashWirePct / 100)) {
        return sig("CASH_WIRE_PATTERN", "R199", 2,
          `Dépôt espèces ${d.montantChf} → virement ${s.montantChf} (${Math.round((s.montantChf / d.montantChf) * 100)}%) en ${Math.round(heures(d.at, s.at))}h`,
          "Dépôt cash → wire out (R199)");
      }
    }
  }
  return null;
}

// ── R200 — PEP adjacent : le client paie un tiers PEP/Near-PEP ──────────────
export function detecterPepAdjacent(c: ContexteAml, _p: AmlParams): SignalAml | null {
  if (!(c.paiements ?? []).some((x) => x.beneficiairePep === true)) return null;
  return sig("PEP_ADJACENT", "R200", 2,
    "Paiement récurrent vers un bénéficiaire PEP/Near-PEP — KYC update + 4-eyes",
    "Paiement vers PEP adjacent (R200)");
}

// ── R201 — Invoice underpay : sous-paiement systématique des factures ───────
export function detecterInvoiceUnderpay(c: ContexteAml, _p: AmlParams): SignalAml | null {
  const fs = c.factures ?? [];
  if (fs.length < 3) return null;
  const ratios = fs.map((f) => (f.factureChf - f.paiementChf) / f.factureChf);
  const tousSousPayes = fs.every((f) => f.paiementChf < f.factureChf);
  const systematique = ratios.every((r) => r > 0 && r < 0.05) && (Math.max(...ratios) - Math.min(...ratios)) < 0.01;
  if (tousSousPayes && systematique) {
    return sig("INVOICE_UNDERPAY", "R201", 1,
      `${fs.length} factures sous-payées d'un écart constant (~${(ratios[0] * 100).toFixed(2)}%)`,
      "Sous-paiement systématique (R201)");
  }
  return null;
}

// ── R202 — Counterparty velocity : montant > facteur × (moyenne + σ) ────────
export function detecterCounterpartyVelocity(c: ContexteAml, p: AmlParams): SignalAml | null {
  if (c.contrepartieMontantChf === undefined || c.contrepartieMoyenneChf === undefined) return null;
  const seuil = (c.contrepartieMoyenneChf + (c.contrepartieEcartTypeChf ?? 0)) * (p.counterpartyFacteurPct / 100);
  if (c.contrepartieMontantChf > seuil) {
    const facteur = c.contrepartieMoyenneChf > 0 ? Math.round(c.contrepartieMontantChf / c.contrepartieMoyenneChf) : 0;
    return sig("COUNTERPARTY_VELOCITY", "R202", 2,
      `Montant ${c.contrepartieMontantChf} contre une moyenne de ${c.contrepartieMoyenneChf} (×${facteur})`,
      "Explosion du montant contrepartie (R202)");
  }
  return null;
}

// ── R203 — CRS/FATCA non-compliance : périmètre CRS, gros solde, pas d'auto-cert ──
export function detecterCrsNonCompliance(c: ContexteAml, p: AmlParams): SignalAml | null {
  if (!c.residenceFiscale || !p.crsResidences.includes(c.residenceFiscale)) return null;
  if ((c.soldeChf ?? 0) <= p.crsSeuilChf || c.autoCertificationCrs !== false) return null;
  return sig("CRS_NON_COMPLIANCE", "R203", 2,
    `Résidence fiscale ${c.residenceFiscale}, solde ${c.soldeChf} sans auto-certification — blocage des opérations`,
    "CRS/FATCA non conforme — blocage opérations (R203)", true);
}

// ── R204 — Fiduciary abuse : retrait personnel > X% des dépôts clients ──────
export function detecterFiduciaryAbuse(c: ContexteAml, p: AmlParams): SignalAml | null {
  if (!c.compteFiduciaire || !c.depotsClientsChf) return null;
  const ratio = (c.retraitsPersonnelsChf ?? 0) / c.depotsClientsChf;
  if (ratio > p.fiduciaireSeuilPct / 100) {
    return sig("FIDUCIARY_ABUSE", "R204", 2,
      `Retraits personnels ${c.retraitsPersonnelsChf} = ${Math.round(ratio * 100)}% des dépôts clients — audit immédiat`,
      "Abus de compte fiduciaire — audit immédiat (R204)");
  }
  return null;
}

// ── R205 — Tax minimization : circuit CH → paradis → CH sans fiscalisation ──
export function detecterTaxMinimization(c: ContexteAml, p: AmlParams): SignalAml | null {
  const circuit = c.circuitPays ?? [];
  const estCh = (x: string) => x === "Suisse" || x === "CH";
  const haven = circuit.some((x, i) => i > 0 && i < circuit.length - 1 && p.taxHavens.includes(x)
    && estCh(circuit[i - 1]) && circuit.slice(i + 1).some(estCh));
  if (haven && c.fiscalisationDocumentee === false) {
    return sig("TAX_MINIMIZATION", "R205", 1,
      `Circuit ${circuit.join("→")} sans fiscalisation documentée`,
      "Pattern optimisation fiscale (R205)");
  }
  return null;
}

// ── R206 — Concentration risk : >X% du patrimoine sur 1-2 comptes courants ──
export function detecterConcentration(c: ContexteAml, p: AmlParams): SignalAml | null {
  if (!c.patrimoineChf) return null;
  const courants = (c.comptes ?? []).filter((x) => x.type === "COURANT").sort((a, b) => b.soldeChf - a.soldeChf);
  const top = courants.slice(0, 2).reduce((s, x) => s + x.soldeChf, 0);
  if (top / c.patrimoineChf >= p.concentrationSeuilPct / 100) {
    return sig("CONCENTRATION_RISK", "R206", 1,
      `${Math.round((top / c.patrimoineChf) * 100)}% du patrimoine sur ≤2 comptes courants`,
      "Portefeuille non diversifié (R206)");
  }
  return null;
}

/** Tous les détecteurs R189→R206, dans l'ordre du catalogue. */
export const DETECTEURS: Array<(c: ContexteAml, p: AmlParams) => SignalAml | null> = [
  detecterStructuring, detecterCrossBorder, detecterVelocity, detecterSanctions,
  detecterUboMismatch, detecterInOutSameDay, detecterThirdPartyPayer, detecterCircularFlow,
  detecterHri, detecterRoundAmounts, detecterCashWire, detecterPepAdjacent,
  detecterInvoiceUnderpay, detecterCounterpartyVelocity, detecterCrsNonCompliance,
  detecterFiduciaryAbuse, detecterTaxMinimization, detecterConcentration,
];

/** Passe l'ensemble du contexte au crible — rend les signaux levés (jamais d'invention). */
export function evaluer(c: ContexteAml, p: AmlParams = AML_PARAMS_DEFAUT): SignalAml[] {
  return DETECTEURS.map((d) => d(c, p)).filter((s): s is SignalAml => s !== null);
}

/** Lit les surcharges tenant (tenant.settings, préfixe `aml*`) par-dessus les défauts. */
export function paramsDepuisSettings(settings: any): AmlParams {
  const s = settings ?? {};
  const n = (cle: string, d: number) => (Number.isFinite(s[cle]) ? s[cle] : d);
  const a = (cle: string, d: string[]) => (Array.isArray(s[cle]) ? s[cle] : d);
  const D = AML_PARAMS_DEFAUT;
  return {
    structuringAlertCount: n("amlStructuringAlertCount", D.structuringAlertCount),
    structuringSeuilChf: n("amlStructuringSeuilChf", D.structuringSeuilChf),
    structuringFenetreH: n("amlStructuringFenetreH", D.structuringFenetreH),
    crossBorderFenetreH: n("amlCrossBorderFenetreH", D.crossBorderFenetreH),
    crossBorderMinPays: n("amlCrossBorderMinPays", D.crossBorderMinPays),
    velocityDormantMois: n("amlVelocityDormantMois", D.velocityDormantMois),
    velocityMultiplicateur: n("amlVelocityMultiplicateur", D.velocityMultiplicateur),
    inOutFenetreH: n("amlInOutFenetreH", D.inOutFenetreH),
    circularFenetreJours: n("amlCircularFenetreJours", D.circularFenetreJours),
    hriPays: a("amlHriPays", D.hriPays),
    roundSeuilPct: n("amlRoundSeuilPct", D.roundSeuilPct),
    cashWirePct: n("amlCashWirePct", D.cashWirePct),
    cashWireFenetreH: n("amlCashWireFenetreH", D.cashWireFenetreH),
    counterpartyFacteurPct: n("amlCounterpartyFacteurPct", D.counterpartyFacteurPct),
    crsResidences: a("amlCrsResidences", D.crsResidences),
    crsSeuilChf: n("amlCrsSeuilChf", D.crsSeuilChf),
    fiduciaireSeuilPct: n("amlFiduciaireSeuilPct", D.fiduciaireSeuilPct),
    concentrationSeuilPct: n("amlConcentrationSeuilPct", D.concentrationSeuilPct),
    taxHavens: a("amlTaxHavens", D.taxHavens),
    listesReglementaires: a("amlListesReglementaires", D.listesReglementaires),
  };
}
