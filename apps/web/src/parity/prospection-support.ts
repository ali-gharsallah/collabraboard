// Source : docs/reference/olive-demo.html 16551–16617 — porté verbatim.
// MODULE PROSPECTION (MOD-72) : leads du stade 1, moteur de suggestion IA déterministe
// (réseau PERSONS_DATA), ajout manuel RM, décision d'onboardabilité.
import CLIENTS from "../fixtures/CLIENTS.json";
import PERSONS_DATA from "../fixtures/PERSONS_DATA.json";

// pushParamAudit / wfEmit : piste d'audit + bus d'événements (hors périmètre front) → no-op.
const pushParamAudit = (_actor: string, _msg: string) => {};
const wfEmit = (_evt: string, _a: any, _b: any) => {};

export const PROSPECT_LEADS: any[] = [
  { id: "LEAD-001", name: "Château Léman Invest", initials: "CL", rm: "Sophie Marchand", country: "Suisse", countryFlag: "🇨🇭", sector: "Immobilier", note: "Rencontré au forum private banking Genève — intérêt pour gestion discrétionnaire.", createdAt: "2026-07-08", identifiedBy: "RM", onboardableStatus: "PENDING", _isLead: true },
  { id: "LEAD-002", name: "Dr. Marcus Feldman", initials: "MF", rm: "Ralf Kessler", country: "Allemagne", countryFlag: "🇩🇪", sector: "Santé", note: "Introduit par un client existant (Katarina Bergström). Premier appel prévu.", createdAt: "2026-07-09", identifiedBy: "RM", onboardableStatus: "PENDING", _isLead: true },
  { id: "LEAD-003", name: "Aurea Ventures Ltd", initials: "AV", rm: "Valentina Rossi", country: "Royaume-Uni", countryFlag: "🇬🇧", sector: "Private equity", note: "Contact entrant via le site — à qualifier (AUM déclaré ~8M).", createdAt: "2026-07-10", identifiedBy: "IA", onboardableStatus: "PENDING", _isLead: true },
];

const PROSPECTION_ROLE_WEIGHT: Record<string, number> = { "Bénéficiaire": 30, "Co-titulaire": 28, "Ayant droit économique (UBO)": 25, "Administrateur / directeur": 20, "Signataire autorisé": 14, "Représentant légal": 12, "Mandataire (procuration)": 10 };

export function prospectionSuggest() {
  const clientNames: any = {};
  (CLIENTS as any[]).forEach(function (c) { clientNames[c.name] = true; });
  const leadNames: any = {};
  PROSPECT_LEADS.forEach(function (l) { leadNames[l.name] = true; });
  const out: any[] = [];
  (PERSONS_DATA as any[]).forEach(function (p) {
    if (!p.roles || p.roles.length === 0) return; // hors réseau — rien à exploiter
    if (clientNames[p.name] || leadNames[p.name]) return; // déjà client ou déjà dans le pipeline
    let score = 0;
    const links: string[] = [];
    p.roles.forEach(function (r: any) {
      score += PROSPECTION_ROLE_WEIGHT[r.role] || 8;
      links.push(r.role.replace(" (UBO)", "") + " de " + r.entity);
    });
    if (p.roles.length > 1) score += 15; // présent sur plusieurs relations = réseau dense
    const srcClient = (CLIENTS as any[]).find(function (c) { return c.id === p.roles[0].entityId; });
    const pepFlag = p.pep === "PEP" ? "⚠ PEP — EDD requis si onboardé" : (p.pep === "NEAR-PEP" ? "Near-PEP — vigilance" : null);
    out.push({
      personId: p.id, name: p.name, initials: p.initials, country: p.country, countryFlag: p.flag, countryCode: p.countryCode,
      aiScore: Math.min(99, score), pep: p.pep || null, pepFlag,
      rationale: "Réseau existant : " + links.join(" · ") + " — aucune relation en nom propre.",
      suggestedRm: (srcClient && srcClient.rm) || "—",
      sector: (srcClient && srcClient.sector) || "—",
    });
  });
  return out.sort(function (a, b) { return b.aiScore - a.aiScore; });
}
export function addProspectLead(cand: any, identifiedBy: string, user: any) {
  const maxN = PROSPECT_LEADS.reduce(function (m, l) { const n = parseInt((l.id || "").split("-")[1]) || 0; return Math.max(m, n); }, 0);
  const lead = {
    id: "LEAD-" + String(maxN + 1).padStart(3, "0"), name: cand.name, initials: cand.initials || cand.name.slice(0, 2).toUpperCase(),
    rm: cand.suggestedRm || ((user && user.name) || "—"), country: cand.country || "—", countryFlag: cand.countryFlag || "🏳",
    sector: cand.sector || "—", note: cand.rationale || cand.note || "", createdAt: new Date().toISOString().slice(0, 10),
    identifiedBy, onboardableStatus: "PENDING", _isLead: true,
  };
  PROSPECT_LEADS.push(lead);
  pushParamAudit((user && user.name) || "—", "Prospection — lead ajouté (" + identifiedBy + ") : " + lead.name);
  wfEmit("PARAM_CHANGED", null, { subjectId: "LEAD_NEW/" + lead.id, actor: (user && user.name) || "—", payload: { identifiedBy } });
  return lead;
}
export function markLeadDecision(leadId: string, status: string, user: any) {
  const lead = PROSPECT_LEADS.find(function (l) { return l.id === leadId; });
  if (!lead) return;
  lead.onboardableStatus = status;
  pushParamAudit((user && user.name) || "—", "Prospect " + lead.name + " — décision onboardabilité : " + status);
  wfEmit("PARAM_CHANGED", null, { subjectId: "LEAD_DECISION/" + leadId, actor: (user && user.name) || "—", payload: { status } });
}

// ── Pré-prospection (ProspectionScreen, source 31370–31404) ──
import { aumMOf, runExoticOverlay } from "./demo-init";
import { pmsPortfolio } from "./pms-support";
import { CONTACT_REPORTS } from "./contactreports-support";
import { amlHash } from "./preonboarding-support";
runExoticOverlay(); // garantit c.exotic même si la Pré-prospection est le premier écran ouvert.

export const PROSPECTION_CHANNELS = [
  { id: "APPORTEURS", icon: "🤝", label: "Apporteurs d'affaires", how: "Avocats, fiduciaires, MFO sous convention — rémunération rétrocédée, déclarée LSFin.", stats: "12 apporteurs actifs · 9 leads / 12 mois · conversion 33%" },
  { id: "EVENTS", icon: "🎪", label: "Événements & salons", how: "Présence ciblée UHNWI : art, horlogerie, philanthropie. Objectif : 10 contacts qualifiés / événement.", stats: "6 événements / an · 41 contacts · 7 ouvertures" },
  { id: "LIQUIDITY", icon: "📰", label: "Liquidity events (presse M&A)", how: "Veille cessions d'entreprises romandes & alémaniques — approche du cédant à J+30.", stats: "18 signaux détectés · 5 approches · 2 mandats" },
  { id: "RESEAUX", icon: "🕸", label: "Réseaux professionnels", how: "Chambres de commerce, clubs services, alumni — cartographie des cercles par RM.", stats: "RM mappés sur 14 cercles · 6 leads" },
  { id: "REFERRAL", icon: "👥", label: "Recommandation clients", how: "Programme de parrainage discret — clients promoteurs identifiés au CRM (NPS implicite).", stats: "23 clients promoteurs · 4 parrainages signés" },
  { id: "CROSSSELL", icon: "⤴", label: "Cross-selling base existante", how: "Offres dérivées des données Olive : mandat, Lombard, succession, ESG — voir onglet dédié.", stats: "dérivé en direct des 84 relations" },
];
export const PROSPECTION_EVENTS = [
  { date: "2026-09-17", label: "Art Basel — VIP preview", cible: "Collectionneurs UHNWI", rm: "S. Marchand", status: "Inscrit", todo: "Liste d'invités croisée avec la veille M&A" },
  { date: "2026-08-28", label: "Geneva Watch Days", cible: "Entrepreneurs horlogerie", rm: "R. Kessler", status: "Inscrit", todo: "3 RDV pré-bookés" },
  { date: "2026-10-06", label: "Zurich Private Wealth Forum", cible: "Family offices", rm: "A. Gharsallah", status: "À confirmer", todo: "Proposer un speaking slot compliance IA" },
  { date: "2026-11-12", label: "Trophée de golf — Genève", cible: "Clients promoteurs + invités", rm: "S. Marchand", status: "Organisateur", todo: "Chaque client invite un prospect" },
];
export const PROSPECTION_LOG = [
  { at: "2026-07-02", who: "R. Kessler", what: "EPHJ Genève — 14 contacts, 4 cartes qualifiées, 1 RDV fixé (négoce horloger)" },
  { at: "2026-06-19", who: "S. Marchand", what: "Signal presse : cession PME vaudoise (CHF 40M) — approche du cédant via fiduciaire apporteur" },
  { at: "2026-06-05", who: "A. Gharsallah", what: "Dîner philanthropie — 2 family offices rencontrés, suivi CRM créé" },
];
export function crossSellFor(_user: any) {
  const out: any[] = [];
  // clientVisibleTo non portée côté parité → tous les clients visibles (garde iso-fonctionnelle).
  (CLIENTS as any[]).forEach(function (c) {
    const aumM = aumMOf(c);
    const h = amlHash(c.id + "XS", 100);
    if (aumM >= 30 && h < 40) out.push({ c, offer: "Crédit Lombard", why: "AUM " + c.aum + " nanti disponible — ligne indicative " + Math.round(aumM * 0.45) + "M (LTV 45%)", link: "Octopulse OppRisk : scoring collatéral" });
    if (pmsPortfolio(c).drift >= 10) out.push({ c, offer: "Mandat discrétionnaire", why: "Dérive d'allocation " + pmsPortfolio(c).drift + "% en advisory — le mandat supprime la dérive", link: null });
    if (c.exotic) out.push({ c, offer: "Conseil patrimonial spécialisé", why: "Secteur " + c.sector + " — structuration, assurance œuvres/actifs, due diligence renforcée incluse", link: null });
    if (aumM >= 50 && h >= 40 && h < 60) out.push({ c, offer: "Planification successorale", why: "Patrimoine " + c.aum + " sans structure de transmission documentée au dossier", link: null });
  });
  return out.slice(0, 24);
}
export { CONTACT_REPORTS };

// -- Handoffs inter-écrans. La maquette utilise des variables module-level mutables
//    (PENDING_TEST_LEAD_ID / PENDING_ONBOARD_LEAD_NAME) réassignées entre écrans. Les imports ESM
//    étant en lecture seule, on reproduit le pattern via un objet-conteneur mutable. --
export const PENDING = { testLeadId: null as string | null, onboardName: null as string | null };
