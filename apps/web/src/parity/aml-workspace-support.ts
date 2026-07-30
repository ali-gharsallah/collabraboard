// Source : docs/reference/olive-demo.html 14671-14971 — porté verbatim.
// AML Investigation Workspace : seed d'alertes (dérivé du screening KYC), contextualisation IA
// locale déterministe, actions de décision, bibliothèque de scénarios.
import KYCS_DATA from "../fixtures/KYCS_DATA.json";
import CLIENTS from "../fixtures/CLIENTS.json";
import PERSONS_DATA from "../fixtures/PERSONS_DATA.json";
import { T } from "./tokens";
import { amlHash } from "./preonboarding-support";
import { enrichScreening } from "./demo-init";

// Garantit que les hits de screening sont enrichis AVANT la construction de AML_ALERTS,
// indépendamment de l'ordre d'import (idempotent).
enrichScreening();

// NOTE : enrichScreening (mutation des hits de screening) est exécuté au démarrage dans
// demo-init.ts (avant tout écran) — AML_ALERTS lit donc les KYC déjà enrichis. TX_DATA reste
// consigné [] : les alertes transactionnelles (ALT-TX) ne sont pas seedées (idem aml.ts).

export const AML_ALERT_SRC: any = {
  ofac: { type: "SANCTIONS", label: "Sanctions OFAC", source: "OFAC — via LSEG Risk Intelligence" },
  seco: { type: "SANCTIONS", label: "Sanctions SECO", source: "SECO Suisse — via LSEG" },
  pep: { type: "PEP", label: "Personne politiquement exposée", source: "Dow Jones Risk & Compliance" },
  adverse: { type: "ADVERSE_MEDIA", label: "Presse négative", source: "ComplyAdvantage" },
};

export const AML_ALERTS: any[] = (function () {
  const out: any[] = [];
  (KYCS_DATA as any[]).forEach(function (k) {
    const sc = k.screening || {};
    ["ofac", "seco", "pep", "adverse"].forEach(function (key) {
      if (sc[key] === "HIT") {
        const meta = AML_ALERT_SRC[key];
        const conf = 60 + amlHash(k.code + key, 40);
        const age = 1 + amlHash(k.code + key, 71);
        out.push({
          id: "ALT-" + k.code + "-" + key.toUpperCase(),
          clientId: k.clientId, clientName: k.clientName, kycCode: k.code,
          alertType: meta.type, alertLabel: meta.label, source: meta.source,
          matchConfidence: conf, ageHours: age, rulesRiskScore: k.riskScore,
          risk: k.risk, assignee: k.co || "—", status: "NEW",
        });
      }
    });
  });
  return out.sort(function (a, b) { return b.matchConfidence - a.matchConfidence; });
})();

export function amlLookup(alert: any): any {
  const kyc = (KYCS_DATA as any[]).find(function (k) { return k.code === alert.kycCode; }) || {};
  const client = (CLIENTS as any[]).find(function (c) { return c.id === alert.clientId; }) || {};
  return { kyc: kyc, client: client };
}

export function aiContextualizeAlert(alert: any): any {
  const lk = amlLookup(alert);
  const kyc = lk.kyc, client = lk.client;
  const country = client.country || kyc.country || "—";
  const cc = client.countryCode || kyc.countryCode || "";
  const risk = client.risk || kyc.risk || "MEDIUM";
  const score = (client.score != null ? client.score : kyc.riskScore) || 0;
  const tags = client.tags || kyc.tags || [];
  const pep = !!client.pep || alert.alertType === "PEP" || (kyc.screening && kyc.screening.pep === "HIT");
  const offshore = tags.indexOf("Offshore") >= 0 || ["KY", "PA", "VG", "BS"].indexOf(cc) >= 0;
  const highRiskCountry = ["RU", "KY", "PA", "IR", "KP", "SY"].indexOf(cc) >= 0 || offshore;
  const uboName = kyc.uboName || client.uboName || "—";
  const uboShare = kyc.uboShare || "—";
  const relCount = (PERSONS_DATA as any[]).filter(function (p) { return (p.roles || []).some(function (r: any) { return r.entityId === alert.clientId; }); }).length;
  const conf = alert.matchConfidence;
  const evidence = [
    { label: "Correspondance de nom", value: conf + "% — " + (conf < 80 ? "partielle" : "forte"), signal: (conf < 80 ? "neutral" : "negative") },
    { label: "Pays de résidence", value: country, signal: (highRiskCountry ? "negative" : "positive") },
    { label: "Statut PEP", value: (pep ? "Exposition politique" : "Non-PEP"), signal: (pep ? "negative" : "positive") },
    { label: "Profil de risque KYC", value: risk + " (" + score + "/100)", signal: (risk === "HIGH" ? "negative" : risk === "LOW" ? "positive" : "neutral") },
    { label: "Ayant droit économique", value: uboName + " · " + uboShare, signal: "neutral" },
    { label: "Relations connues", value: relCount + " entité(s) liée(s)", signal: "neutral" },
    { label: "Workflow KYC", value: (kyc.workflow || "—") + " · " + (kyc.wfPhase || "—"), signal: "neutral" },
  ];
  let suggestedAction, aiRiskScore, verdict, summary;
  if (pep || highRiskCountry || (alert.alertType === "SANCTIONS" && conf >= 90)) {
    suggestedAction = "ESCALATE";
    aiRiskScore = Math.min(98, 60 + (pep ? 15 : 0) + (highRiskCountry ? 15 : 0) + Math.round(conf / 10));
    verdict = "Match probablement pertinent";
    summary = "Alerte " + alert.alertLabel + " sur " + alert.clientName + ". Plusieurs facteurs aggravants convergent : " + (pep ? "exposition politique, " : "") + (highRiskCountry ? ("juridiction à risque (" + country + "), ") : "") + "correspondance " + conf + "%. Recommandation : escalade vers investigation renforcée (EDD) et communication MROS si confirmé.";
  }
  else if (alert.alertType === "SANCTIONS" && conf < 80 && risk !== "HIGH") {
    suggestedAction = "CLEAR";
    aiRiskScore = Math.max(4, Math.round(conf / 4) - 5);
    verdict = "Faux positif probable";
    summary = "Alerte " + alert.alertLabel + " sur " + alert.clientName + ". La correspondance (" + conf + "%) est partielle et le contexte réduit fortement la probabilité d'un vrai positif : résidence " + country + ", profil " + risk + ", aucune exposition politique. Recommandation : clôturer avec justification documentée.";
  }
  else if (alert.alertType === "ADVERSE_MEDIA" && risk === "LOW") {
    suggestedAction = "CLEAR";
    aiRiskScore = Math.max(6, Math.round(conf / 4));
    verdict = "Faux positif probable";
    summary = "Alerte presse négative sur " + alert.clientName + ", profil de risque faible et aucune corroboration dans le dossier KYC. Recommandation : clôturer avec note, surveillance passive maintenue.";
  }
  else {
    suggestedAction = "REQUEST_INFO";
    aiRiskScore = Math.round((score + conf) / 2);
    verdict = "Contexte insuffisant";
    summary = "Alerte " + alert.alertLabel + " sur " + alert.clientName + ". Les éléments disponibles ne permettent pas de trancher automatiquement (correspondance " + conf + "%, profil " + risk + "). Recommandation : demander une clarification au RM avant décision.";
  }
  return { evidence: evidence, suggestedAction: suggestedAction, aiRiskScore: aiRiskScore, verdict: verdict, summary: summary, conf: conf, estMinutes: 8 + amlHash(alert.id, 5), relCount: relCount, country: country, pep: pep, highRiskCountry: highRiskCountry, client: client, kyc: kyc };
}

export const AML_ACTIONS: any[] = [
  { id: "CLEAR", label: "Clôturer (faux positif)", icon: "✓", status: "CLEARED" },
  { id: "ESCALATE", label: "Escalader (EDD / MROS)", icon: "▲", status: "ESCALATED" },
  { id: "REQUEST_INFO", label: "Demander clarification RM", icon: "?", status: "PENDING_INFO" },
  { id: "KYC_REFRESH", label: "Déclencher révision KYC", icon: "↻", status: "KYC_TRIGGERED" },
  { id: "AUDIT_NOTE", label: "Générer note d'audit", icon: "▤", status: null },
];
export function amlActionColor(id: string) { return id === "CLEAR" ? T.green : id === "ESCALATE" ? T.red : id === "REQUEST_INFO" ? T.amber : id === "KYC_REFRESH" ? T.blue : T.olive700; }
export function amlStatusStyle(st: string): any {
  if (st === "NEW") return ["Nouveau", T.blue, T.blueSoft];
  if (st === "CLEARED") return ["Clôturé", T.green, T.greenSoft];
  if (st === "ESCALATED") return ["Escaladé", T.red, T.redSoft];
  if (st === "PENDING_INFO") return ["En attente info", T.amber, T.amberSoft];
  if (st === "KYC_TRIGGERED") return ["KYC déclenché", T.gold, T.violetSoft];
  return [st, T.inkSoft, T.lineSoft];
}
export function amlTypeStyle(t: string): any {
  if (t === "SANCTIONS") return ["Sanctions", T.red, T.redSoft];
  if (t === "PEP") return ["PEP", T.violet, T.violetSoft];
  return ["Presse négative", T.amber, T.amberSoft];
}
export function amlSignalColor(sig: string) { return sig === "negative" ? T.red : sig === "positive" ? T.green : T.inkSoft; }

// Source : docs/reference/olive-demo.html 18085-18122 — porté verbatim (dont doublons de codes AML-10/11/12, fidèles à la source).
export const AML_SCENARIOS: any[] = [
    { code: "AML-PB-69", name: "Structuring PB (R189)", logic: "≥ N dépôts sous le seuil de déclaration sur fenêtre glissante — somme > seuil agrégé tenant", threshold: 95000, unit: "CHF agrégé / 7j", on: true, cat: "Bloc 48 — Private Banking", hits: 0 },
    { code: "AML-PB-70", name: "Cross-Border circulaire (R190)", logic: "Flux A→B→C→A transfrontalier sans justification économique documentée au KYC", threshold: 3, unit: "sauts / 30j", on: true, cat: "Bloc 48 — Private Banking", hits: 0 },
    { code: "AML-PB-71", name: "Velocity spike (R191)", logic: "Volume transactionnel > k× la moyenne mobile 90j du compte", threshold: 4, unit: "× moyenne 90j", on: true, cat: "Bloc 48 — Private Banking", hits: 0 },
    { code: "AML-PB-72", name: "Sanctions — blocage auto (R192)", logic: "Contrepartie en liste OFAC/SECO/UE/ONU → transaction BLOQUÉE (Niveau 1)", threshold: 0, unit: "tolérance", on: true, cat: "Bloc 48 — Private Banking", hits: 0 },
    { code: "AML-PB-73", name: "UBO mismatch (R193)", logic: "ADE réel des flux ≠ UBO déclaré au formulaire A/K", threshold: 25, unit: "% divergence", on: true, cat: "Bloc 48 — Private Banking", hits: 0 },
    { code: "AML-PB-74", name: "In-Out same day (R194)", logic: "Dépôt puis retrait ≥ 80% le même jour ouvré (layering)", threshold: 80, unit: "% même jour", on: true, cat: "Bloc 48 — Private Banking", hits: 0 },
    { code: "AML-PB-75", name: "Third-party payer (R195)", logic: "Tiers payeur sans lien documenté (personnes liées / KYC)", threshold: 20000, unit: "CHF", on: true, cat: "Bloc 48 — Private Banking", hits: 0 },
    { code: "AML-PB-76", name: "Circular flow (R196)", logic: "Fonds retournant à la source initiale ≤ 30j via ≥ 2 intermédiaires", threshold: 2, unit: "intermédiaires", on: true, cat: "Bloc 48 — Private Banking", hits: 0 },
    { code: "AML-PB-77", name: "HRI jurisdiction (R197)", logic: "Corridor via juridiction haut risque (liste tenant — Admin → Pays à risque)", threshold: 50000, unit: "CHF / opération", on: true, cat: "Bloc 48 — Private Banking", hits: 0 },
    { code: "AML-PB-78", name: "Round amounts (R198)", logic: "≥ N montants ronds (multiples 50k) sans logique commerciale / 30j", threshold: 3, unit: "opérations / 30j", on: true, cat: "Bloc 48 — Private Banking", hits: 0 },
    { code: "AML-PB-79", name: "Cash-wire pattern (R199)", logic: "Espèces converties en virements sortants ≤ 48h", threshold: 30000, unit: "CHF / 48h", on: true, cat: "Bloc 48 — Private Banking", hits: 0 },
    { code: "AML-PB-80", name: "PEP adjacent (R200)", logic: "Contrepartie Near-PEP (graphe personnes liées) sur flux ≥ seuil", threshold: 50000, unit: "CHF", on: true, cat: "Bloc 48 — Private Banking", hits: 0 },
    { code: "AML-PB-81", name: "Invoice underpay (R201)", logic: "Factures systématiquement sous-payées (écart ≥ x%) — trade-based ML", threshold: 15, unit: "% écart récurrent", on: true, cat: "Bloc 48 — Private Banking", hits: 0 },
    { code: "AML-PB-82", name: "Counterparty velocity (R202)", logic: "≥ N contreparties nouvelles distinctes / 30j sur même compte", threshold: 8, unit: "contreparties / 30j", on: true, cat: "Bloc 48 — Private Banking", hits: 0 },
    { code: "AML-PB-83", name: "CRS non-compliance — blocage (R203)", logic: "Auto-certification CRS/FATCA absente ou expirée → opérations sortantes BLOQUÉES (Niveau 1)", threshold: 0, unit: "tolérance", on: true, cat: "Bloc 48 — Private Banking", hits: 0 },
    { code: "AML-PB-84", name: "Fiduciary abuse (R204)", logic: "Fondé de pouvoir opérant vers ses propres comptes hors mandat", threshold: 10000, unit: "CHF", on: true, cat: "Bloc 48 — Private Banking", hits: 0 },
    { code: "AML-PB-85", name: "Tax minimization scheme (R205)", logic: "Schéma multi-juridictions à finalité fiscale exclusive (signal Niveau 1)", threshold: 100000, unit: "CHF structuré", on: true, cat: "Bloc 48 — Private Banking", hits: 0 },
    { code: "AML-PB-86", name: "Concentration risk (R206)", logic: "≥ x% des flux du compte vers une contrepartie unique / 90j", threshold: 60, unit: "% flux / 90j", on: true, cat: "Bloc 48 — Private Banking", hits: 0 },
{ code: "AML-01", name: "Structuring / smurfing", logic: "N dépôts < seuil unitaire sur fenêtre glissante 7j dont la somme dépasse le seuil agrégé", threshold: 100000, unit: "CHF agrégé / 7j", on: true, cat: "Structuring", hits: 5 },
{ code: "AML-10", name: "CBK — Nested relationships", logic: "Usage d'une relation de correspondance par des banques tierces non déclarées : ≥ 3 BIC ordonnateurs distincts derrière un même correspondant / 30j, MT202COV sans MT103 apparié", threshold: 3, unit: "BIC distincts / 30j", on: true, cat: "Correspondent Banking", hits: 4 },
{ code: "AML-11", name: "CBK — Downstream juridiction à risque", logic: "Correspondant dont les flux aval touchent une juridiction de la liste pays à risque (Admin → Pays à risque)", threshold: 250000, unit: "CHF cumulé / 7j", on: true, cat: "Correspondent Banking", hits: 2 },
{ code: "AML-12", name: "White collar — Détournement", logic: "Dirigeant/signataire transférant vers des comptes personnels des montants incohérents avec la rémunération déclarée au KYC (> 3× salaire mensuel, récurrence ≥ 2)", threshold: 3, unit: "× salaire mensuel", on: true, cat: "White collar", hits: 3 },
{ code: "AML-13", name: "White collar — Délit d'initié", logic: "Achats concentrés d'un titre en fenêtre J-10 avant annonce (croisement Market Abuse), revente < 5j puis sortie de fonds", threshold: 20, unit: "% du mandat", on: true, cat: "White collar", hits: 1 },
{ code: "AML-14", name: "Pays à risque — corridor pondéré", logic: "Flux sortant vers liste GAFI/interne, seuil pondéré par niveau : noire CHF 0 · grise 100k · interne 250k", threshold: 0, unit: "CHF (pondéré)", on: true, cat: "Pays à risque", hits: 9 },
{ code: "AML-15", name: "Réactivation de compte dormant", logic: "Compte sans mouvement > 24 mois recevant soudainement > seuil — alerte enrichie du profil KYC", threshold: 100000, unit: "CHF", on: false, cat: "Comportement", hits: 1 },
{ code: "AML-02", name: "Mouvement rapide de fonds", logic: "Entrée puis sortie ≥ 80% du montant sous 72h (pass-through)", threshold: 250000, unit: "CHF", on: true },
{ code: "AML-03", name: "Corridor à haut risque", logic: "Transaction vers/depuis juridiction FATF grise/noire ou offshore ≥ seuil", threshold: 45000, unit: "CHF", on: true },
{ code: "AML-04", name: "Espèces intensives", logic: "Dépôts espèces cumulés ≥ seuil / 30j", threshold: 15000, unit: "CHF / 30j", on: true },
{ code: "AML-05", name: "Réactivation compte dormant", logic: "Compte inactif > 12 mois avec transaction ≥ seuil", threshold: 50000, unit: "CHF", on: true },
{ code: "AML-06", name: "PEP — afflux important", logic: "Client PEP recevant un montant ≥ seuil en une opération", threshold: 100000, unit: "CHF", on: true },
{ code: "AML-07", name: "Montants ronds répétés", logic: "≥ 5 opérations à montants ronds (multiples de 10k) / 30j", threshold: 5, unit: "opérations / 30j", on: true },
{ code: "AML-08", name: "Financement par tiers", logic: "Apport par un tiers non documenté dans le KYC ≥ seuil", threshold: 25000, unit: "CHF", on: true },
{ code: "AML-09", name: "Proximité sanctions", logic: "Contrepartie à distance Levenshtein ≤ 2 d'une entité sanctionnée", threshold: 2, unit: "distance max", on: true },
{ code: "AML-10", name: "Fréquence inhabituelle", logic: "Volume d'opérations > 3× la moyenne historique du client", threshold: 3, unit: "× moyenne", on: true },
{ code: "AML-11", name: "Crypto on/off-ramp", logic: "Flux vers/depuis exchange crypto ≥ seuil sans profil déclaré", threshold: 10000, unit: "CHF", on: false },
{ code: "AML-12", name: "Incohérence profil transactionnel", logic: "Opération > 2× l'activité attendue déclarée au KYC", threshold: 2, unit: "× profil attendu", on: true },
];
