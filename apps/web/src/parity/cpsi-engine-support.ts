// Source : docs/reference/olive-demo.html 25322-25444 + 25795-25969 — porté verbatim.
// Moteur CPSI (Continuous Perpetual Scoring & Investigation) : population enrichie (LCG déterministe),
// score statique+comportemental à demi-vie, bandes, propositions d'aiguillage, liste d'initiés (MAR).
import CLIENTS from "../fixtures/CLIENTS.json";
import KYCS_DATA from "../fixtures/KYCS_DATA.json";
import { AML_ALERTS } from "./aml-workspace-support";
import { pushParamAudit } from "./param-audit-support";
import { CPSI_GROUPES, CPSI_SCENARIOS } from "./cpsi-data-support";

// Utilisateur courant (le screen appelle cpsiSetUser). ESM = bindings en lecture seule → holder local.
let CPSI_USER: any = null;
export function cpsiSetUser(u: any) { CPSI_USER = u || CPSI_USER; }
export function cpsiUserNom() { return (CPSI_USER && CPSI_USER.name) || "Admin"; }
export function cpsiUser() { return CPSI_USER; }
export var CPSI_PAYS_RISQUE = { KY: 3, PA: 3, RU: 3, CN: 2, AE: 2, MX: 2, HK: 2, SG: 1, BR: 2, US: 1, MC: 1, LU: 1, GB: 1, DE: 0, FR: 0, IT: 0, BE: 0, CH: 0 };
export var CPSI_STRUCT_RISQUE = { DOM: 3, TRUST: 2, FOND: 2, HOLD: 2, SCS: 2, SA: 1, SARL: 1, FUND: 1, FO: 1, ASSO: 1, PP: 0 };
// Score de risque par activité (0 = neutre → 3 = élevé). Toute activité DOIT avoir une valeur
// explicite : un secteur absent vaudrait 0 par défaut, ce qui le rendrait invisible au score.
export var CPSI_SECTEUR_META = {}; // libellé → { active, since } : attributs standard, hors moteur de score
export var CPSI_SECTEUR_RISQUE = {
// ── Activités sensibles au sens GAFI (biens de grande valeur, opacité, cash) ──
"Négoce d'art & galeries": 3, "Crypto-actifs & exchanges": 3, "Casinos & gaming": 3,
"Pierres précieuses & diamants": 3, "Antiquités & archéologie": 3, "Négoce de matières premières": 3,
"Courtage de yachts": 2, "Aviation privée": 2, "Football professionnel & transferts": 2,
"Vins fins & spiritueux de collection": 2,
// ── Activités économiques classiques ──
"Négoce matières premières": 2, "Energie": 2, "Immobilier": 2, "Juridique / Conseil": 2,
"Private equity": 1, "Finance & Asset management": 1, "Agriculture": 1, "Media": 1,
"Retail / Distribution": 1, "Technologie": 1, "Industrie": 0, "Santé": 0,
};
export var CPSI_DEFAUTS = {
poids_statique: { pays_risque: 6, structure_risque: 5, pep: 15, secteur_risque: 4 },
poids_signaux: { alerte_fondee: 12, alerte_non_fondee: 2, hit_screening: 8, review_defavorable: 9, coc_sensible: 6, velocite_tx: 5 },
half_life_jours: 180, bandes: [40, 70],
};
export var CPSI = { cfg: JSON.parse(JSON.stringify(CPSI_DEFAUTS)), journal: [], propositions: null, pop: null };
export function cpsiLog(type, payload) { CPSI.journal.unshift(Object.assign({ seq: CPSI.journal.length + 1, type: type }, payload)); }
export function cpsiPopulation() {
if (CPSI.pop)
return CPSI.pop;
var alertes = {};
if (typeof AML_ALERTS !== "undefined")
AML_ALERTS.forEach(function (a) { (alertes[a.clientId] = alertes[a.clientId] || []).push(a); });
CPSI.pop = CLIENTS.map(function (c) {
var sig = (alertes[c.id] || []).map(function (a) {
return { type: a.matchConfidence >= 80 ? "alerte_fondee" : "alerte_non_fondee",
sev: 1 + Math.floor(a.matchConfidence / 45), age: Math.max(1, Math.round(a.ageHours / 24)) };
});
return { id: c.id, name: c.name, _sector: c.sector, _type: c.type, _segment: c.segment,
attr: cpsiEnrichir(c), statique: {
pays_risque: CPSI_PAYS_RISQUE[c.countryCode] != null ? CPSI_PAYS_RISQUE[c.countryCode] : 1,
structure_risque: CPSI_STRUCT_RISQUE[c.type] != null ? CPSI_STRUCT_RISQUE[c.type] : 1,
pep: !!c.pep, secteur_risque: CPSI_SECTEUR_RISQUE[c.sector] || 0,
}, signaux: sig };
});
return CPSI.pop;
}
export function cpsiScore(cl, cfg) {
cfg = cfg || CPSI.cfg;
var drivers = [], s = 0;
Object.keys(cfg.poids_statique).forEach(function (k) {
var v = cl.statique[k];
var num = v === true ? 1 : (v === false ? 0 : (+v || 0));
var contrib = cfg.poids_statique[k] * num;
if (contrib) {
drivers.push(["statique:" + k, Math.round(contrib * 100) / 100]);
s += contrib;
}
});
cl.signaux.forEach(function (g) {
var contrib = cfg.poids_signaux[g.type] * g.sev * Math.pow(2, -g.age / cfg.half_life_jours);
if (contrib > 0.05) {
drivers.push([g.type + "@J-" + g.age, Math.round(contrib * 100) / 100]);
s += contrib;
}
});
s = Math.min(100, Math.round(s * 100) / 100);
var b = s < cfg.bandes[0] ? "LOW" : (s < cfg.bandes[1] ? "MEDIUM" : "HIGH");
return { score: s, bande: b, drivers: drivers };
}
export function cpsiStats(cfg) {
var st = { LOW: 0, MEDIUM: 0, HIGH: 0 };
cpsiPopulation().forEach(function (cl) { st[cpsiScore(cl, cfg).bande]++; });
return st;
}
export function cpsiDecrireRegles(cfg) {
cfg = cfg || CPSI.cfg;
var L = ["Score client = Statique + Comportemental, plafonné à 100.",
"Comportemental = Σ signaux : poids(type) × sévérité × 2^(−âge / half-life).",
"Half-life : " + cfg.half_life_jours + " jours — un signal vieux d'une demi-vie pèse moitié (R64)."];
Object.keys(cfg.poids_statique).forEach(function (k) { L.push("Statique · " + k + " : poids " + cfg.poids_statique[k]); });
Object.keys(cfg.poids_signaux).forEach(function (k) { L.push("Signal · " + k + " : poids " + cfg.poids_signaux[k]); });
L.push("Bandes : LOW < " + cfg.bandes[0] + " ≤ MEDIUM < " + cfg.bandes[1] + " ≤ HIGH — franchissement = événement + proposition, l'humain décide (R66/R44).");
L.push("Chaque score publie ses drivers ; leur somme reconstitue le score (R67).");
return L;
}
export function cpsiSimuler(cand, acteur) {
var fr = [], deltas = 0, n = 0;
cpsiPopulation().forEach(function (cl) {
var a = cpsiScore(cl, CPSI.cfg), b = cpsiScore(cl, cand);
deltas += b.score - a.score;
n++;
if (a.bande !== b.bande)
fr.push({ client: cl.name, avant: a.bande, apres: b.bande, s0: a.score, s1: b.score });
});
var rapport = { clients: n, deltaMoyen: Math.round(deltas / n * 100) / 100, franchissements: fr,
nouveauxHigh: fr.filter(function (f) { return f.apres === "HIGH"; }).length, chargeRevues: fr.length };
cpsiLog("impact_simule", { acteur: acteur || "sandbox", clients: n, franchissements: fr.length, deltaMoyen: rapport.deltaMoyen });
return rapport;
}
export function cpsiAppliquer(cand, acteur, note) {
CPSI.cfg = JSON.parse(JSON.stringify(cand));
cpsiLog("parametre_modifie", { acteur: acteur, note: note || "" });
if (typeof pushParamAudit === "function")
pushParamAudit(acteur, "CPSI — règles de calcul modifiées (" + (note || "paramétrage") + ") — impact simulé au préalable (R70)");
}
export function cpsiPropositions() {
if (CPSI.propositions)
return CPSI.propositions;
CPSI.propositions = [
{ id: "PROP-1", auteur: "Olivia", chemin: "poids_signaux.alerte_fondee", valeur: 18,
justification: "Sur le trimestre, les alertes qualifiées fondées prédisent 3× mieux les revues défavorables que leur poids actuel ne le reflète.", statut: "EN_ATTENTE" },
{ id: "PROP-2", auteur: "Olivia", chemin: "half_life_jours", valeur: 120,
justification: "Les signaux de plus de 4 mois n'apportent plus de pouvoir discriminant mesurable — accélérer l'oubli concentre la revue sur le récent.", statut: "EN_ATTENTE" },
];
return CPSI.propositions;
}
export function cpsiCandidatDeProposition(p) {
var cand = JSON.parse(JSON.stringify(CPSI.cfg));
if (p.chemin.indexOf(".") >= 0) {
var kk = p.chemin.split(".");
cand[kk[0]][kk[1]] = p.valeur;
}
else
cand[p.chemin] = p.valeur;
return cand;
}
export var CPSI_AIG_DECIDES = {}; // clientId -> ADOPTE | REJETE (décisions de la session)
export var CPSI_DERNIER_KYC = null;
export function cpsiDernierKyc() {
if (CPSI_DERNIER_KYC)
return CPSI_DERNIER_KYC;
CPSI_DERNIER_KYC = {};
KYCS_DATA.forEach(function (k) {
var d = CPSI_DERNIER_KYC[k.clientId];
if (!d || k.revision > d.revision)
CPSI_DERNIER_KYC[k.clientId] = k;
});
return CPSI_DERNIER_KYC;
}
export function cpsiPropositionsAiguillage() {
var out = [];
cpsiPopulation().forEach(function (cl) {
if (CPSI_AIG_DECIDES[cl.id])
return;
var r = cpsiScore(cl, CPSI.cfg);
var k = cpsiDernierKyc()[cl.id];
if (!k)
return;
if (r.bande === "HIGH" && k.workflow !== "EDD")
out.push({ cl: cl, k: k, score: r.score, de: k.workflow, vers: "EDD", sens: "durcissement",
motif: "score " + r.score + " en bande HIGH — durcissement proposé (R66)", drivers: r.drivers.slice(0, 3) });
else if (r.bande === "LOW" && k.workflow === "EDD")
out.push({ cl: cl, k: k, score: r.score, de: "EDD", vers: "CDD", sens: "allègement",
motif: "score " + r.score + " en bande LOW — allègement proposé (R66)", drivers: r.drivers.slice(0, 3) });
});
return out;
}
export function cpsiAdopterAiguillage(p, decideur) {
p.k.workflow = p.vers;
if (p.k.tags) {
if (p.vers === "EDD" && p.k.tags.indexOf("EDD") < 0)
p.k.tags.push("EDD");
if (p.vers !== "EDD") {
var ix = p.k.tags.indexOf("EDD");
if (ix >= 0)
p.k.tags.splice(ix, 1);
}
}
if (p.k.trail)
p.k.trail.unshift({ date: "2026-07-13", actor: decideur,
action: "Aiguillage " + p.de + " → " + p.vers + " adopté sur proposition CPSI (" + p.motif + ") — décision humaine (R44)", phase: "WORKFLOW" });
CPSI_AIG_DECIDES[p.cl.id] = "ADOPTE";
cpsiLog("aiguillage_adopte", { client: p.cl.name, de: p.de, vers: p.vers, decideur: decideur });
if (typeof pushParamAudit === "function")
pushParamAudit(decideur, "CPSI — aiguillage " + p.de + " → " + p.vers + " adopté pour " + p.cl.name + " (proposition R66, décision humaine R44)");
}
export function cpsiRejeterAiguillage(p, decideur, motivation) {
CPSI_AIG_DECIDES[p.cl.id] = "REJETE";
cpsiLog("aiguillage_rejete", { client: p.cl.name, decideur: decideur, motivation: motivation });
if (typeof pushParamAudit === "function")
pushParamAudit(decideur, "CPSI — proposition d'aiguillage rejetée pour " + p.cl.name + " : " + motivation);
}
// ══ R71-R74 — Groupes de population : dataset enrichi + bibliothèque étendue ══
// Enrichissement déterministe (LCG par id) : dimensions comportementales pour les prédicats de groupe et les scénarios.
export function cpsiHash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) {
h ^= s.charCodeAt(i);
h = Math.imul(h, 16777619);
} return (h >>> 0); }
export function cpsiLCG(seed) { var s = (seed >>> 0) || 1; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
export function cpsiAumChf(aum) { var m = /([\d.]+)\s*([kM])?/.exec(aum || ""); if (!m)
return 0; var n = parseFloat(m[1]) || 0; return m[2] === "M" ? n * 1e6 : (m[2] === "k" ? n * 1e3 : n); }
export var CPSI_ASSETS = ["Actions", "Obligations", "Crypto", "Produits structurés", "Fonds / ETF", "Penny stocks", "Matières premières", "FX / Dérivés"];
export function cpsiEnrichir(c) {
var r = cpsiLCG(cpsiHash(c.id)), sec = c.sector, type = c.type, seg = c.segment, cc = c.countryCode, hid = cpsiHash(c.id);
var trading = ["Négoce matières premières", "Energie", "Finance & Asset management", "Private equity"].indexOf(sec) >= 0;
var custody = ["FO", "FUND", "HOLD"].indexOf(type) >= 0;
var rich = seg === "UHNWI" ? 4 : seg === "HNWI" ? 3 : seg === "Affluent" ? 2 : 1;
var paysR = CPSI_PAYS_RISQUE[cc] != null ? CPSI_PAYS_RISQUE[cc] : 1;
var anc = Math.max(0, 2026 - parseInt((c.onboardingDate || "2020").slice(0, 4)));
var attr = {
secteur: sec, type: type, aum_band: seg, countryCode: cc, pays_risque: paysR, pep: !!c.pep,
aum_chf: cpsiAumChf(c.aum), risk_band: c.risk, anciennete: anc,
// — activité transactionnelle (after-market) —
tx_par_mois: Math.round((5 + r() * 40) * (trading ? 1.8 : 1) * (rich * 0.4 + 0.6)),
volume_tx_mensuel_chf: Math.round(cpsiAumChf(c.aum) * (0.02 + r() * 0.15)),
ratio_cash: Math.round(r() * (["Retail / Distribution", "Négoce matières premières"].indexOf(sec) >= 0 ? 0.7 : 0.35) * 100) / 100,
ratio_cross_border: Math.round((paysR >= 2 ? 0.4 + r() * 0.5 : r() * 0.35) * 100) / 100,
nb_contreparties: Math.round(3 + r() * 30 * (trading ? 1.5 : 1)),
score_structuration: Math.round(r() * 100 * (paysR >= 2 ? 1.25 : 1)),
rapidite_in_out: Math.round(r() * 100 * (trading ? 1.15 : 1)),
dormance_puis_actif: r() < 0.08 ? 1 : 0,
// — transfer agent / custody —
fop_deliveries: Math.round(r() * (custody ? 13 : 4)),
transferts_in_specie: Math.round(r() * (custody ? 9 : 2)),
reglements_tiers: Math.round(r() * (paysR >= 2 ? 11 : 4)),
rotation_titres: Math.round(r() * (custody ? 3.2 : 1.2) * 100) / 100,
concentration_titre: Math.round(r() * 100) / 100,
// — abus de marché (MAR) —
trades_pre_annonce: (hid % 13 === 0) ? Math.round(3 + r() * 6) : Math.round(r() * 1.4),
ratio_annulation_ordres: (hid % 17 === 0) ? Math.round((0.6 + r() * 0.35) * 100) / 100 : Math.round(r() * 0.4 * 100) / 100,
wash_trade_flags: (hid % 23 === 0) ? Math.round(1 + r() * 4) : 0,
concentration_intraday: (hid % 19 === 0) ? Math.round((0.7 + r() * 0.3) * 100) / 100 : Math.round(r() * 0.5 * 100) / 100,
// — transferts & correspondances —
wires_high_risk_jur: Math.round(r() * (paysR >= 2 ? 9 : 2)),
wires_same_day_inout: (hid % 11 === 0) ? Math.round(4 + r() * 8) : Math.round(r() * 3),
wires_third_party: Math.round(r() * (paysR >= 2 ? 10 : 4)),
wires_structured: (hid % 29 === 0) ? Math.round(3 + r() * 6) : Math.round(r() * 2),
funnel_sources: Math.round(3 + r() * (paysR >= 2 ? 30 : 12)),
// — post-marché & trading —
illiquid_ratio: Math.round(r() * (trading ? 0.7 : 0.35) * 100) / 100,
cross_trades_related: (hid % 31 === 0) ? Math.round(3 + r() * 7) : Math.round(r() * 2),
marking_close_flags: (hid % 37 === 0) ? Math.round(1 + r() * 4) : 0,
profit_zscore: Math.round((r() * 4 - 1) * 100) / 100,
churn_ratio: Math.round(r() * (trading ? 8 : 3) * 100) / 100,
off_market_trades: (hid % 41 === 0) ? Math.round(2 + r() * 6) : Math.round(r() * 1.5),
// — cash & espèces —
cash_deposits: Math.round(r() * (["Retail / Distribution", "Négoce matières premières"].indexOf(sec) >= 0 ? 10 : 4)),
cash_withdrawals: Math.round(r() * (["Retail / Distribution"].indexOf(sec) >= 0 ? 9 : 3)),
// — capital markets / CIB —
capital_calls: (["Private equity", "Finance & Asset management"].indexOf(sec) >= 0) ? Math.round(2 + r() * 8) : Math.round(r() * 2),
private_placements: (sec === "Private equity") ? Math.round(1 + r() * 6) : Math.round(r() * 1.5),
ipo_flows: (["Finance & Asset management", "Technologie"].indexOf(sec) >= 0) ? Math.round(1 + r() * 6) : Math.round(r() * 1.2),
unlisted_investments: (["Private equity", "HOLD"].indexOf(sec) >= 0 || type === "HOLD") ? Math.round(1 + r() * 7) : Math.round(r() * 2),
// — classe d'actifs & pump-and-dump (toutes classes) —
asset_dominant: CPSI_ASSETS[hid % CPSI_ASSETS.length],
recurrence: 1 + (hid % 6), // R80 : proxy de fréquence (récurrences observées du comportement sur la période, 1-6)
pump_dump_score: 0, // calculé ci-dessous (composite)
};
// Pump & dump = accumulation rapide + spike + dump sur actif (peu liquide) concentré.
// Score composite, amplifié pour les classes illiquides (crypto, penny, structurés).
var _liq = { "Crypto": 1.6, "Penny stocks": 1.7, "Produits structurés": 1.35, "Matières premières": 1.2,
"Actions": 1.0, "Fonds / ETF": 0.8, "Obligations": 0.6, "FX / Dérivés": 1.1 };
attr.pump_dump_score = Math.min(100, Math.round((attr.illiquid_ratio * 35 + Math.min(attr.churn_ratio, 10) * 3 + attr.concentration_intraday * 30 + attr.rapidite_in_out * 0.25)
* (_liq[attr.asset_dominant] || 1)));
return attr;
}
export function cpsiAttr(cl, champ) {
if (champ === "score")
return cpsiScore(cl, CPSI.cfg).score;
if (champ === "insider")
return !!cpsiInsiders()[cl.id];
if (cl.attr && (champ in cl.attr))
return cl.attr[champ];
return null;
}
// ── R75 : liste d'initiés surveillée (MAR) — statut sensible, tracé, réservé, réversible ──
export var CPSI_INSIDERS = null;
export var CPSI_ROLES_INSIDER = ["COMPLIANCE", "CO_SR", "CO", "SO", "ADMIN", "CF"];
export function cpsiInsiders() {
if (CPSI_INSIDERS)
return CPSI_INSIDERS;
CPSI_INSIDERS = {};
if (typeof CLIENTS !== "undefined")
CLIENTS.forEach(function (c) {
var h = cpsiHash(c.id);
if (h % 13 === 0 && h % 2 === 0)
CPSI_INSIDERS[c.id] = { motif: "Dirigeant/administrateur d'un émetteur coté — inscrit sur la liste d'initiés", acteur: "Import initial", date: "2026-01-15", instrument: "—" };
});
return CPSI_INSIDERS;
}
export function cpsiPeutInsider() { return !!(CPSI_USER && CPSI_ROLES_INSIDER.indexOf(CPSI_USER.role) >= 0); }
export function cpsiTaggerInsider(id, name, motif, instrument) {
cpsiInsiders()[id] = { motif: motif, acteur: cpsiUserNom(), date: "2026-07-13", instrument: instrument || "—" };
cpsiLog("insider_tague", { client: name, acteur: cpsiUserNom(), motif: motif });
if (typeof pushParamAudit === "function")
pushParamAudit(cpsiUserNom(), "Client «" + name + "» marqué INSIDER (liste d'initiés MAR) — motif : " + motif);
}
export function cpsiLeverInsider(id, name, motif) {
delete cpsiInsiders()[id];
cpsiLog("insider_leve", { client: name, acteur: cpsiUserNom(), motif: motif });
if (typeof pushParamAudit === "function")
pushParamAudit(cpsiUserNom(), "Statut INSIDER levé pour «" + name + "» — motif : " + motif);
}
export var CPSI_OPS = {
eq: function (a, b) { return a === b; }, ne: function (a, b) { return a !== b; },
"in": function (a, b) { return b.indexOf(a) >= 0; }, nin: function (a, b) { return b.indexOf(a) < 0; },
gte: function (a, b) { return a != null && a >= b; }, lte: function (a, b) { return a != null && a <= b; },
gt: function (a, b) { return a != null && a > b; }, lt: function (a, b) { return a != null && a < b; },
};
export var CPSI_OPLIB = { "in": "∈", nin: "∉", eq: "=", ne: "≠", gte: "≥", lte: "≤", gt: ">", lt: "<" };
// ── Bibliothèque de groupes de population, par familles (règles en clair, R71/R74) ──

// Source : 26041-26068 — groupes de population (prédicats).
export function cpsiGroupePredicatVrai(cl, pred) {
var r = pred.conditions.map(function (c) { return CPSI_OPS[c.op](cpsiAttr(cl, c.champ), c.val); });
return pred.logique === "ET" ? r.every(Boolean) : r.some(Boolean);
}
export function cpsiGroupesDe(cl) { return CPSI_GROUPES.filter(function (g) { return cpsiGroupePredicatVrai(cl, g.predicat); }); }
export function cpsiGroupePrimaire(cl) { var m = cpsiGroupesDe(cl); if (!m.length)
return null; return m.slice().sort(function (a, b) { return a.priorite - b.priorite || (a.id < b.id ? -1 : 1); })[0]; }
export function cpsiCfgClient(cl) {
var base = JSON.parse(JSON.stringify(CPSI.cfg));
var g = cpsiGroupePrimaire(cl);
if (g && g.bareme) {
Object.keys(g.bareme).forEach(function (k) {
if (g.bareme[k] && typeof g.bareme[k] === "object" && !Array.isArray(g.bareme[k]))
base[k] = Object.assign({}, base[k], g.bareme[k]);
else
base[k] = g.bareme[k];
});
}
return base;
}
export function cpsiMembres(g) { return cpsiPopulation().filter(function (cl) { return cpsiGroupePredicatVrai(cl, g.predicat); }); }
export function cpsiDecrireGroupes() {
return CPSI_GROUPES.map(function (g) {
var regle = g.predicat.conditions.map(function (c) { return c.champ + " " + CPSI_OPLIB[c.op] + " " + (Array.isArray(c.val) ? "{" + c.val.join(", ") + "}" : c.val); }).join(" " + g.predicat.logique + " ");
return { id: g.id, fam: g.fam, label: g.label, regle: regle, priorite: g.priorite, bareme: g.bareme ? "surchargé" : "hérité (global)", effectif: cpsiMembres(g).length };
});
}
// ── Bibliothèque de scénarios AML/surveillance ciblés par groupe (seuils par groupe, R73) ──
// ── Scénarios AML & signaux — extraction par appariement d'accolades (source blocs 26211+, 27757+) ──
// Seuil d'alerte X, pondérations impact/fréquence, pénalité faux positifs (R80-R82).
export var CPSI_SEUIL_ALERTE = 55; // X paramétrable (tenant/scénario)
export var CPSI_MARGE_NM = 10; // bande near-miss [X-marge, X)
export var CPSI_W_IMPACT = 0.6, CPSI_W_FREQ = 0.4; // pondérations
export var CPSI_FP = {}; // "client|scenario" -> nb de faux positifs déclarés
export var CPSI_FP_ACTIVE = true; // R82 désactivable
export function cpsiImpact(v, s) {
if (typeof v === "boolean")
return v ? 100 : 0;
if (typeof v === "number" && typeof s === "number" && s)
return Math.max(0, Math.min(100, Math.round(100 * (v - s) / Math.abs(s))));
return 50;
}
export function cpsiFreqNorm(cl) { var r = (cl && cl.attr && cl.attr.recurrence) || 1; return Math.min(100, Math.round(100 * r / 6)); }
export function cpsiPenaliteFP(client, sid) { var n = CPSI_FP[client + "|" + sid] || 0; return -10 * n * (n + 1) / 2; }
// R80/R81 : UN signal dédupliqué par (client, scénario), scoré (impact+fréquence), classé vs X.
export function cpsiSignaux(seuil) {
var X = (seuil != null) ? seuil : CPSI_SEUIL_ALERTE, agg = {};
CPSI_SCENARIOS.filter(function (sc) { return sc.on !== false; }).forEach(function (sc) {
Object.keys(sc.groupes_seuils).forEach(function (gid) {
var g = CPSI_GROUPES.find(function (x) { return x.id === gid; });
if (!g)
return;
cpsiMembres(g).forEach(function (cl) {
var v = cpsiAttr(cl, sc.champ), seuil2 = sc.groupes_seuils[gid];
if (CPSI_OPS[sc.sens](v, seuil2)) {
var key = cl.id + "|" + sc.id, imp = cpsiImpact(v, seuil2);
if (!agg[key] || imp > agg[key].impact)
agg[key] = { client: cl.id, clientName: cl.name, scenario: sc.id, scenarioLabel: sc.label, fam: sc.fam, champ: sc.champ, groupe: gid, valeur: v, seuil: seuil2, impact: imp, cl: cl };
}
});
});
});
return Object.keys(agg).map(function (key) {
var a = agg[key], freq = cpsiFreqNorm(a.cl);
var brut = Math.round(CPSI_W_IMPACT * a.impact + CPSI_W_FREQ * freq);
var penal = CPSI_FP_ACTIVE ? cpsiPenaliteFP(a.client, a.scenario) : 0;
var score = Math.max(0, brut + penal);
var statut = score >= X ? "ALERTE" : (score >= X - CPSI_MARGE_NM ? "NEAR_MISS" : "ANALYSE");
return { client: a.client, clientName: a.clientName, scenario: a.scenario, scenarioLabel: a.scenarioLabel, fam: a.fam,
champ: a.champ, groupe: a.groupe, valeur: a.valeur, seuil: a.seuil, impact: a.impact, frequence: freq,
score_brut: brut, penalite_fp: penal, fp_count: (CPSI_FP[a.client + "|" + a.scenario] || 0), score: score, seuilX: X, statut: statut };
}).sort(function (x, y) { return y.score - x.score; });
}
export function cpsiAlertesParScenario() {
return CPSI_SCENARIOS.filter(function (sc) { return sc.on !== false; }).map(function (sc) {
var total = 0, high = 0, medium = 0, effectif = 0, seen = {};
Object.keys(sc.groupes_seuils).forEach(function (gid) {
var g = CPSI_GROUPES.find(function (x) { return x.id === gid; });
if (!g)
return;
cpsiMembres(g).forEach(function (cl) {
if (!seen[cl.id]) {
seen[cl.id] = 1;
effectif++;
}
var v = cpsiAttr(cl, sc.champ), seuil = sc.groupes_seuils[gid];
if (CPSI_OPS[sc.sens](v, seuil)) {
total++;
var dep = (typeof v === "number") ? v - seuil : 0;
if (dep >= Math.max(1, 0.5 * seuil))
high++;
else
medium++;
}
});
});
return { id: sc.id, label: sc.label, fam: sc.fam, champ: sc.champ, desc: sc.desc,
groupes: Object.keys(sc.groupes_seuils), seuils: sc.groupes_seuils,
effectif: effectif, total: total, high: high, medium: medium };
});
}
export function cpsiSimulerScenarios(facteur) {
facteur = facteur || 1;
var total = 0, parDom = {}, parSev = { HIGH: 0, MEDIUM: 0 }, parScen = [];
CPSI_SCENARIOS.forEach(function (sc) {
var n = 0;
Object.keys(sc.groupes_seuils).forEach(function (gid) {
var g = CPSI_GROUPES.find(function (x) { return x.id === gid; });
if (!g)
return;
var seuil = sc.groupes_seuils[gid] * facteur;
cpsiMembres(g).forEach(function (cl) {
var v = cpsiAttr(cl, sc.champ);
if (CPSI_OPS[sc.sens](v, seuil)) {
n++;
total++;
var dep = (typeof v === "number") ? v - seuil : 0;
parSev[dep >= Math.max(1, 0.5 * seuil) ? "HIGH" : "MEDIUM"]++;
}
});
});
parDom[sc.fam] = (parDom[sc.fam] || 0) + n;
parScen.push({ id: sc.id, label: sc.label, fam: sc.fam, n: n });
});
return { total: total, parDom: parDom, parSev: parSev, parScen: parScen.sort(function (a, b) { return b.n - a.n; }) };
}
export function cpsiEvaluerScenario(sc) {
var hits = [], evalues = 0;
Object.keys(sc.groupes_seuils).forEach(function (gid) {
var g = CPSI_GROUPES.find(function (x) { return x.id === gid; });
if (!g)
return;
cpsiMembres(g).forEach(function (cl) {
evalues++;
var v = cpsiAttr(cl, sc.champ);
var seuil = sc.groupes_seuils[gid];
if (CPSI_OPS[sc.sens](v, seuil))
hits.push({ client: cl.name, groupe: gid, valeur: v, seuil: seuil });
});
});
return { evalues: evalues, hits: hits };
}
export var CPSI_CHAMPS = ["secteur", "type", "aum_band", "pays_risque", "pep", "score", "risk_band", "anciennete", "insider",
"tx_par_mois", "ratio_cash", "ratio_cross_border", "score_structuration", "rapidite_in_out", "nb_contreparties",
"fop_deliveries", "transferts_in_specie", "reglements_tiers", "rotation_titres", "concentration_titre",
"trades_pre_annonce", "ratio_annulation_ordres", "wash_trade_flags", "concentration_intraday",
"wires_high_risk_jur", "wires_same_day_inout", "wires_third_party", "wires_structured", "funnel_sources",
"illiquid_ratio", "cross_trades_related", "marking_close_flags", "churn_ratio", "off_market_trades",
"asset_dominant", "pump_dump_score", "transferts_in_specie",
"cash_deposits", "cash_withdrawals", "capital_calls", "private_placements", "ipo_flows", "unlisted_investments"];
export var CPSI_OP_LIST = ["eq", "ne", "in", "nin", "gte", "lte", "gt", "lt"];
export function cpsiCreerGroupe(g) {
CPSI_GROUPES.push(g);
cpsiLog("groupe_cree", { groupe: g.id, label: g.label, acteur: cpsiUserNom() });
if (typeof pushParamAudit === "function")
pushParamAudit(cpsiUserNom(), "Groupe de population créé : «" + g.label + "» (" + g.id + ")");
}
export var CPSI_FAM_GROUPES = ["Type d'entité", "Secteur", "AUM", "Juridiction", "PEP & risque", "Transactionnel", "Custody", "Abus de marché", "Transferts", "Post-marché & trading", "Capital markets", "Classe d'actifs", "Combinés"];
export var CPSI_FAM_SCEN = ["Cash & espèces", "Transferts & transfer agent", "Activité transactionnelle", "Trading & marchés", "Capital markets / CIB", "Abus de marché", "Private banking", "Finance islamique"];
