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

// -- Handoffs inter-écrans. La maquette utilise des variables module-level mutables
//    (PENDING_TEST_LEAD_ID / PENDING_ONBOARD_LEAD_NAME) réassignées entre écrans. Les imports ESM
//    étant en lecture seule, on reproduit le pattern via un objet-conteneur mutable. --
export const PENDING = { testLeadId: null as string | null, onboardName: null as string | null };
