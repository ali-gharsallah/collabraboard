// P-L6-3 (« le front dit la vérité ») — l'ancien moteur local d'édition de distance et la confiance
// fabriquée par hachage sont SUPPRIMÉS : tout score et toute décomposition viennent du VRAI
// moteur @olive/screening-engine (R408/R411 — le même que le serveur). amlHash ne sert plus qu'à
// CHOISIR un record de démo dans la base publique, JAMAIS à fabriquer un score.
// File de hits dérivée des dossiers KYC, qualification TP/FP (four-eyes ≥ 80%), re-screening batch.
import KYCS_DATA from "../fixtures/KYCS_DATA.json";
import { scorer, scorerDetail, normaliser } from "@olive/screening-engine";
import { amlHash } from "./preonboarding-support";
import { clientById } from "./components-data";
import { AML_ALERTS } from "./aml-workspace-support";
import { pushParamAudit } from "./param-audit-support";

export const SANCTIONS_DB = [
{ id: "SDN-36418", name: "DERIPASKA, Oleg Vladimirovich", aliases: ["Oleg Deripaska"], type: "PERSON", dob: "1968-01-02", country: "RU", list: "ofac", program: "UKRAINE-EO13661 / CAATSA", ref: "OFAC SDN 24327" },
{ id: "SDN-36420", name: "SECHIN, Igor Ivanovich", aliases: ["Igor Sechin"], type: "PERSON", dob: "1960-09-07", country: "RU", list: "ofac", program: "UKRAINE-EO13661", ref: "OFAC SDN 16880" },
{ id: "EU-1428", name: "USMANOV, Alisher Burkhanovich", aliases: ["Alisher Usmanov"], type: "PERSON", dob: "1953-09-09", country: "RU", list: "seco", program: "UE 269/2014 — repris SECO", ref: "SESAM 47063" },
{ id: "SDN-31129", name: "BOUT, Viktor Anatolyevich", aliases: ["Viktor Bout", "Victor But"], type: "PERSON", dob: "1967-01-13", country: "RU", list: "ofac", program: "TCO — trafic d'armes", ref: "OFAC SDN 10708" },
{ id: "SDN-38217", name: "KADYROV, Ramzan Akhmatovich", aliases: ["Ramzan Kadyrov"], type: "PERSON", dob: "1976-10-05", country: "RU", list: "ofac", program: "GLOMAG (Magnitsky)", ref: "OFAC SDN 22437" },
{ id: "SDN-40651", name: "PRIGOZHIN, Yevgeniy Viktorovich", aliases: ["Evgeny Prigozhin", "Yevgeny Prigozhin"], type: "PERSON", dob: "1961-06-01", country: "RU", list: "ofac", program: "CYBER2 / SDGT", ref: "OFAC SDN 20696" },
{ id: "UN-KP-12", name: "KIM, Yo Jong", aliases: ["Kim Yo-jong"], type: "PERSON", dob: "1987-09-26", country: "KP", list: "seco", program: "ONU DPRK — repris SECO", ref: "SESAM 51230" },
{ id: "SDN-E-101", name: "SBERBANK OF RUSSIA", aliases: ["Sberbank", "Sberbank Rossii PAO"], type: "ENTITY", dob: null, country: "RU", list: "ofac", program: "RUSSIA-EO14024", ref: "OFAC SDN 35213" },
{ id: "SDN-E-102", name: "VTB BANK PUBLIC JOINT STOCK COMPANY", aliases: ["VTB Bank", "Vneshtorgbank"], type: "ENTITY", dob: null, country: "RU", list: "ofac", program: "RUSSIA-EO14024", ref: "OFAC SDN 35148" },
{ id: "SSI-E-201", name: "ROSNEFT OIL COMPANY", aliases: ["Rosneft", "NK Rosneft PAO"], type: "ENTITY", dob: null, country: "RU", list: "seco", program: "Directive sectorielle — repris SECO", ref: "SESAM 43310" },
{ id: "SSI-E-202", name: "NOVATEK PAO", aliases: ["Novatek", "OAO Novatek"], type: "ENTITY", dob: null, country: "RU", list: "seco", program: "Directive sectorielle 2 (dette) — repris SECO", ref: "SESAM 43377" },
{ id: "SDN-E-103", name: "PMC WAGNER", aliases: ["Wagner Group", "Groupe Wagner", "ChVK Wagner"], type: "ENTITY", dob: null, country: "RU", list: "ofac", program: "SDGT / GLOMAG", ref: "OFAC SDN 42630" },
{ id: "SDN-E-104", name: "ISLAMIC REVOLUTIONARY GUARD CORPS", aliases: ["IRGC", "Pasdaran"], type: "ENTITY", dob: null, country: "IR", list: "ofac", program: "SDGT / IRAN", ref: "OFAC SDN 10979" },
{ id: "SDN-E-105", name: "KOREA MINING DEVELOPMENT TRADING CORPORATION", aliases: ["KOMID"], type: "ENTITY", dob: null, country: "KP", list: "ofac", program: "DPRK — prolifération", ref: "OFAC SDN 8894" },
{ id: "SDN-E-106", name: "LAZARUS GROUP", aliases: ["Hidden Cobra", "APT38"], type: "ENTITY", dob: null, country: "KP", list: "ofac", program: "DPRK3 — cyber", ref: "OFAC SDN 26465" },
{ id: "SDN-E-107", name: "TORNADO CASH", aliases: ["Tornado.Cash"], type: "ENTITY", dob: null, country: "—", list: "ofac", program: "CYBER2 — mixeur crypto", ref: "OFAC SDN 39751" },
{ id: "SDN-E-108", name: "GARANTEX EUROPE OU", aliases: ["Garantex"], type: "ENTITY", dob: null, country: "EE", list: "ofac", program: "CYBER2", ref: "OFAC SDN 39752" },
{ id: "SDN-E-109", name: "ALFA-BANK JOINT STOCK COMPANY", aliases: ["Alfa Bank", "Alfa-Bank AO"], type: "ENTITY", dob: null, country: "RU", list: "ofac", program: "RUSSIA-EO14024", ref: "OFAC SDN 38199" },
{ id: "EU-E-310", name: "SYRIATEL MOBILE TELECOM", aliases: ["Syriatel"], type: "ENTITY", dob: null, country: "SY", list: "seco", program: "UE Syrie — repris SECO", ref: "SESAM 30988" },
{ id: "EU-E-311", name: "MYANMAR ECONOMIC HOLDINGS LIMITED", aliases: ["MEHL"], type: "ENTITY", dob: null, country: "MM", list: "seco", program: "UE Myanmar — repris SECO", ref: "SESAM 52114" },
];
// Adaptation d'un record de la base publique vers la forme du moteur.
function entreeMoteur(e) {
  return { uid: e.id, nom_complet: e.name, alias: e.aliases || [], date_naissance: e.dob || null,
    type: e.type === "ENTITY" ? "entite" : "individu" };
}
/** Normalisation d'AFFICHAGE — délègue au moteur (aucune règle locale). */
export function screenNorm(x) { return normaliser(String(x || "")).toUpperCase(); }
/** Similarité rendue par LE MOTEUR (composite 0-100) — plus aucun calcul de confiance côté front. */
export function screenSim(qn, cn) {
  return Math.round(scorer({ nom: String(qn || "") }, { uid: "q", nom_complet: String(cn || "") }, { phonetique: true }));
}
export function screenMatch(query, opts) {
  opts = opts || {};
  if (!String(query || "").trim()) return [];
  var out = [];
  SANCTIONS_DB.forEach(function (e) {
    var det = scorerDetail({ nom: String(query) }, entreeMoteur(e), { phonetique: true });
    if (det.score >= (opts.min || 60)) out.push({ entry: e, score: Math.round(det.score), via: det.via, detail: det });
  });
  out.sort(function (a, b) { return b.score - a.score; });
  return out.slice(0, opts.limit || 5);
}
export const SCREEN_PROG_SEVERITY = [["SDGT", "CRITIQUE"], ["DPRK", "CRITIQUE"], ["IRAN", "CRITIQUE"], ["TCO", "CRITIQUE"], ["EO14024", "ÉLEVÉE"], ["EO13661", "ÉLEVÉE"], ["CYBER", "ÉLEVÉE"], ["GLOMAG", "ÉLEVÉE"], ["Magnitsky", "ÉLEVÉE"], ["sectorielle", "MODÉRÉE"], ["PEP", "MODÉRÉE"]];
export function aiScreeningAnalyze(hit) {
var sev = "MODÉRÉE";
var prog = (hit.entry && hit.entry.program) || "";
SCREEN_PROG_SEVERITY.forEach(function (x) { if (prog.indexOf(x[0]) >= 0)
sev = x[1]; });
var facts = [], pro = 0, con = 0;
hit.attrs.forEach(function (a) {
if (a.state === "MATCH" || a.state === "PROCHE") {
pro++;
facts.push("✓ " + a.label + " concordant (" + a.dossier + ")");
}
else if (a.state === "DIVERGENT") {
con++;
facts.push("✗ " + a.label + " divergent : dossier « " + a.dossier + " » vs liste « " + a.liste + " »");
}
else
facts.push("? " + a.label + " non renseigné côté " + (a.dossier === "—" ? "dossier" : "liste"));
});
facts.push("Programme : " + prog + " — sévérité " + sev + " (" + ((hit.entry && hit.entry.ref) || "") + ")");
var rec, why;
if (hit.conf >= 80 || sev === "CRITIQUE") {
rec = "ESCALADER";
why = "Confiance " + hit.conf + "% " + (sev === "CRITIQUE" ? "et programme à sévérité critique " : "") + "— les concordances (" + pro + " attribut(s)) l'emportent sur les divergences (" + con + "). Ne pas lever sans clarification documentée (art. 6 al. 2 LBA).";
}
else if (con >= 2 && hit.conf < 70) {
rec = "PROPOSER LA LEVÉE";
why = con + " attributs divergents et confiance " + hit.conf + "% : profil typique d'homonymie. Documenter les divergences (pièce d'identité / registre) puis lever — four-eyes si la confiance remonte à 80%+.";
}
else {
rec = "CLARIFIER";
why = "Signal mixte (" + pro + " concordants / " + con + " divergents, confiance " + hit.conf + "%). Demander une pièce discriminante (date de naissance certifiée, extrait de registre) avant décision.";
}
return { source: "Inférence 100% locale — aucune donnée ne quitte la banque", severity: sev, facts: facts, recommendation: rec, rationale: why };
}
export function aiPrioritizeQueue(hits) {
return hits.filter(function (h) { return !h.q; }).map(function (h) {
var a = aiScreeningAnalyze(h);
var p = (a.severity === "CRITIQUE" ? 40 : a.severity === "ÉLEVÉE" ? 25 : 10) + Math.round(h.conf * 0.4) + (h.c.risk === "HIGH" ? 15 : h.c.risk === "MEDIUM" ? 7 : 0);
return { h: h, ai: a, prio: p };
}).sort(function (x, y) { return y.prio - x.prio; });
}
export const SCREEN_LISTS = { ofac: ["OFAC SDN", "2026-07-09"], seco: ["SECO SESAM", "2026-07-10"], pep: ["Dow Jones PEP", "2026-07-08"], adverse: ["LexisNexis Adverse Media", "2026-07-10"] };
export let SCREEN_QUALIF: any = {}; // "kycCode|list" -> {decision:"TP"|"FP", by, note}
export let SCREEN_BATCH_RUNS = 0;
export let SCREEN_BATCH_LAST: any = null;
export function screenHits() {
var out = [];
KYCS_DATA.forEach(function (k) {
var sc = k.screening || {};
["ofac", "seco", "pep", "adverse"].forEach(function (list) {
if (sc[list] !== "HIT")
return;
var c = clientById[k.clientId] || {};
var target = (list === "pep" || list === "adverse") ? (c.uboName || c.name || "—") : (c.name || "—");
// Le hit est lié à un VRAI record de la base (extrait public) pour les listes sanctions ;
// PEP/adverse restent des profils fournisseur. amlHash ne fait que CHOISIR le record de démo.
var pool = SANCTIONS_DB.filter(function (e) { return e.list === list; });
var entry = pool.length ? pool[amlHash(k.code + list + "DBE", pool.length)] : { id: list.toUpperCase() + "-" + (1000 + amlHash(k.code, 9000)), name: target, aliases: [], type: "PERSON", dob: null, country: c.countryCode || "—", list: list, program: list === "pep" ? "PEP — fonction publique (" + (c.country || "") + ")" : "Adverse media — presse " + (2020 + amlHash(k.code, 6)), ref: (list === "pep" ? "DJ-PEP " : "LN-AM ") + (40000 + amlHash(k.code, 50000)) };
// Score + DÉCOMPOSITION rendus par LE MOTEUR (R408/R411) — Jaro-Winkler + jetons IDF + phonétique
// + discriminants type/DOB/nationalité. La « confiance » n'est plus fabriquée : c'est det.score.
var det = scorerDetail({ nom: target, est_entite: !!(c.typeLabel && c.typeLabel.indexOf("physique") < 0) },
  entreeMoteur(entry), { phonetique: true });
var conf = Math.round(det.score);
var attrs = [
  { label: "Nom — moteur (JW + jetons + phonétique)", dossier: target, liste: det.via,
    state: det.nameScore >= 90 ? "MATCH" : det.nameScore >= 70 ? "PROCHE" : "DIVERGENT", pts: Math.round(det.nameScore) },
  { label: "Date de naissance (discriminant)", dossier: "—", liste: entry.dob || "—",
    state: det.dobContribution > 0 ? "MATCH" : det.dobContribution < 0 ? "DIVERGENT" : "INCONNUE", pts: det.dobContribution },
  { label: "Qualité personne/entité (discriminant)", dossier: c.typeLabel || "—",
    liste: entry.type === "ENTITY" ? "Entité" : "Personne physique",
    state: det.typePenalty < 0 ? "DIVERGENT" : "MATCH", pts: det.typePenalty },
  { label: "Nationalité (R417)", dossier: c.country || "—", liste: entry.country || "—",
    state: det.natContribution > 0 ? "MATCH" : "INCONNUE", pts: det.natContribution },
];
var q = SCREEN_QUALIF[k.code + "|" + list];
var alert = AML_ALERTS.find(function (a) { return a.clientId === k.clientId && a.status === "NEW"; });
out.push({ key: k.code + "|" + list, k: k, c: c, list: list, listMeta: SCREEN_LISTS[list], target: target, conf: conf, attrs: attrs,
entry: entry, q: q || null, alert: alert || null });
});
});
return out.sort(function (a, b) { return b.conf - a.conf; });
}
export function screenQualify(hit, decision, note, user) {
if (decision === "FP" && hit.conf >= 80) {
// Levée à haute confiance : DEUX signatures. La première propose, la
// cascade n'a lieu qu'à la confirmation par un second CO.
SCREEN_QUALIF[hit.key] = { decision: "FP_PENDING", by: (user && user.name) || "—", note: note || null };
pushParamAudit((user && user.name) || "—", "Screening — levée PROPOSÉE (confiance " + hit.conf + "% ≥ 80 → four-eyes requis) : " + hit.c.name + " × " + hit.listMeta[0]);
return;
}
SCREEN_QUALIF[hit.key] = { decision: decision, by: (user && user.name) || "—", note: note || null };
if (decision === "FP") {
hit.k.screening[hit.list] = "CLEAR";
if (hit.alert && hit.alert.status === "NEW") {
hit.alert.status = "DISMISSED";
}
pushParamAudit((user && user.name) || "—", "Screening — FAUX POSITIF levé : " + hit.c.name + " × " + hit.listMeta[0] + " (" + (note || "sans note") + ") — dossier " + hit.k.code + " nettoyé");
}
else {
if (hit.alert && hit.alert.status === "NEW") {
hit.alert.status = "INVESTIGATING";
}
pushParamAudit((user && user.name) || "—", "Screening — VRAI POSITIF confirmé : " + hit.c.name + " × " + hit.listMeta[0] + " → escalade Compliance (alerte en investigation)");
}
}
export function screenConfirmFp(hit, user) {
var q = SCREEN_QUALIF[hit.key];
if (!q || q.decision !== "FP_PENDING")
return { err: "Aucune levée en attente" };
if (q.by === ((user && user.name) || ""))
return { err: "Four-eyes : le confirmateur doit différer du proposant (" + q.by + ")" };
SCREEN_QUALIF[hit.key] = { decision: "FP", by: q.by + " + " + ((user && user.name) || "—"), note: q.note };
hit.k.screening[hit.list] = "CLEAR";
if (hit.alert && hit.alert.status === "NEW") {
hit.alert.status = "DISMISSED";
}
pushParamAudit((user && user.name) || "—", "Screening — levée CONFIRMÉE (four-eyes " + q.by + " → " + ((user && user.name) || "—") + ") : " + hit.c.name + " × " + hit.listMeta[0] + " — dossier " + hit.k.code + " nettoyé");
return { ok: true };
}
export function screenRescreenOne(k, user) {
var sc = k.screening || {};
var c = clientById[k.clientId] || {};
var h = amlHash(k.code + "RS1" + (SCREEN_BATCH_RUNS + 1), 100);
var res;
var anyHit = ["ofac", "seco", "pep", "adverse"].some(function (x) { return sc[x] === "HIT"; });
if (!anyHit && h < 10) {
k.screening = sc;
sc.adverse = "HIT";
res = "NOUVEAU HIT adverse media — à qualifier dans l'atelier";
}
else if (anyHit && sc.adverse === "HIT" && h >= 88) {
sc.adverse = "CLEAR";
SCREEN_QUALIF[k.code + "|adverse"] = { decision: "FP", by: "Re-screening", note: "Entrée retirée par le fournisseur" };
res = "LEVÉE AUTOMATIQUE — l'entrée adverse media a disparu des listes";
}
else
res = "RAS — aucun nouveau hit contre les listes du jour";
pushParamAudit((user && user.name) || "—", "Screening — re-screening unitaire " + k.code + " (" + c.name + ") : " + res);
return res;
}
export function screenBatchRun(user) {
SCREEN_BATCH_RUNS++;
var seed = SCREEN_BATCH_RUNS;
var added = [], lifted = [];
var clean = KYCS_DATA.filter(function (k) { var sc = k.screening || {}; return sc.ofac !== "HIT" && sc.seco !== "HIT" && sc.pep !== "HIT" && sc.adverse !== "HIT"; });
clean.forEach(function (k) {
if (added.length >= 3)
return;
if (amlHash(k.code + "BATCH" + seed, 100) < 4) {
k.screening = k.screening || {};
k.screening.adverse = "HIT";
var c = clientById[k.clientId] || {};
added.push({ k: k, c: c, list: "adverse" });
}
});
var hits = screenHits().filter(function (h) { return !h.q; });
hits.forEach(function (h) {
if (lifted.length >= 2)
return;
if (h.list === "adverse" && amlHash(h.key + "LIFT" + seed, 100) < 8) {
h.k.screening[h.list] = "CLEAR";
lifted.push(h);
SCREEN_QUALIF[h.key] = { decision: "FP", by: "Batch", note: "Entrée retirée de la liste par le fournisseur" };
}
});
SCREEN_BATCH_LAST = { run: seed, at: "2026-07-11", added: added, lifted: lifted };
pushParamAudit((user && user.name) || "—", "Screening — re-screening du portefeuille (run #" + seed + ") : " + added.length + " nouveau(x) hit(s), " + lifted.length + " levée(s) automatique(s)");
return SCREEN_BATCH_LAST;
}
