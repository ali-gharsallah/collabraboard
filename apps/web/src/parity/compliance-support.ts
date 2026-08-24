// Source : docs/reference/olive-demo.html — moteur Compliance Center (porté verbatim, appariement d'accolades).
// Gouvernance des règles AML (stats/propositions/versions R44), déclarations MROS (goAML), rapport annuel LBA.
import CLIENTS from "../fixtures/CLIENTS.json";
import KYCS_DATA from "../fixtures/KYCS_DATA.json";
import { T } from "./tokens";
import { AML_SCORING_RULES, evalAmlRules, AML_PARAMS } from "./aml";
import { RULE_PARAM_KEY } from "./aml-catalog-support";
import { amlHash } from "./preonboarding-support";
import { AML_ALERTS } from "./aml-workspace-support";
import { regRelationRow, regFiche } from "./registre-support";
import { STAFF_DATA, staffProfile, trainingCrossChecks } from "./formations-support";
import { CB_RULES } from "./cross-border-support";
import { WF_MGMT_TEMPLATES } from "./wf-mgmt-support";
import { PARAM_AUDIT, pushParamAudit } from "./param-audit-support";

// CONSIGNÉ : TX_DATA (flux transactionnels) non porté → []. Les transactions liées d'une déclaration
// MROS et les corridors HIGH du motif de soupçon restent vides (dégradation fidèle).
const TX_DATA: any[] = [];
// CONSIGNÉ : wfEmit (bus d'événements workflow) → no-op côté parité (effet de bord hors périmètre).
function wfEmit(_type?: any, _def?: any, _patch?: any) { /* consigné */ }

// ── Gouvernance des règles AML (source 15173-15310) ──
export let AML_RULE_VERSIONS: any = {};
let AML_PROPOSAL_STATE: any = {};
let AML_RULE_GATES: any = {};
function amlLatestKyc(cid) { var mine = KYCS_DATA.filter(function (k) { return k.clientId === cid; }); return mine.length ? mine[mine.length - 1] : null; }
function amlIsFalsePositiveProxy(c, k) {
if (!c)
return false;
if (c.risk === "LOW")
return true;
if (c.risk === "MEDIUM" && k && k.status === "APPROVED") {
var sc = k.screening || {};
if (sc.ofac !== "HIT" && sc.seco !== "HIT" && sc.pep !== "HIT" && sc.adverse !== "HIT")
return true;
}
return false;
}
function amlAlertOutcome(alert) {
if (alert.risk === "HIGH")
return { outcome: "TP", label: "Vrai positif — investigation confirmée" };
if (alert.risk === "LOW")
return { outcome: "FP", label: "Faux positif — clôturé par l'analyste" };
return (amlHash(alert.id, 10) < 4) ? { outcome: "TP", label: "Vrai positif — SAR/MROS déposée" } : { outcome: "FP", label: "Faux positif — clôturé par l'analyste" };
}
export function amlRuleStats() {
var total = CLIENTS.length;
var out = [];
AML_SCORING_RULES.forEach(function (r) {
var hits = 0, fp = 0;
CLIENTS.forEach(function (c) {
var k = amlLatestKyc(c.id);
var hit = false;
try {
hit = !!r.test(c, k);
}
catch (e) { }
if (hit && AML_RULE_GATES[r.id] && c.risk === "LOW")
hit = false;
if (hit) {
hits++;
if (amlIsFalsePositiveProxy(c, k))
fp++;
}
});
out.push({ id: r.id, cat: r.cat, label: r.label, pts: r.pts, on: r.on !== false, gated: !!AML_RULE_GATES[r.id],
hits: hits, freq: total ? Math.round(100 * hits / total) : 0, fpPct: hits ? Math.round(100 * fp / hits) : 0,
paramKey: RULE_PARAM_KEY[r.id] || null,
version: (AML_RULE_VERSIONS[r.id] && AML_RULE_VERSIONS[r.id].length) ? AML_RULE_VERSIONS[r.id][AML_RULE_VERSIONS[r.id].length - 1].v : "v1.0" });
});
var tp = 0, fpA = 0;
AML_ALERTS.forEach(function (a) { if (amlAlertOutcome(a).outcome === "TP")
tp++;
else
fpA++; });
return { rules: out, totalClients: total, alerts: { total: AML_ALERTS.length, tp: tp, fp: fpA, fpPct: AML_ALERTS.length ? Math.round(100 * fpA / AML_ALERTS.length) : 0 } };
}
function amlSimulateGate(ruleId) {
var r = AML_SCORING_RULES.find(function (x) { return x.id === ruleId; });
if (!r)
return null;
var before = 0, fpBefore = 0, after = 0, fpAfter = 0;
CLIENTS.forEach(function (c) {
var k = amlLatestKyc(c.id);
var hit = false;
try {
hit = !!r.test(c, k);
}
catch (e) { }
if (!hit)
return;
var isFp = amlIsFalsePositiveProxy(c, k);
before++;
if (isFp)
fpBefore++;
if (c.risk !== "LOW") {
after++;
if (isFp)
fpAfter++;
}
});
return { before: before, after: after, fpBefore: before ? Math.round(100 * fpBefore / before) : 0, fpAfter: after ? Math.round(100 * fpAfter / after) : 0, chargeReduction: before ? Math.round(100 * (before - after) / before) : 0 };
}
export function amlProposals() {
var stats = amlRuleStats().rules;
return stats
.filter(function (r) { return r.on && !r.gated && r.hits >= 4 && r.fpPct >= 50; })
.sort(function (a, b) { return (b.freq * b.fpPct) - (a.freq * a.fpPct); })
.slice(0, 4)
.map(function (r) {
var sim = amlSimulateGate(r.id);
return {
id: "PROP-" + r.id, ruleId: r.id, ruleLabel: r.label,
title: "Optimiser " + r.id + " — ajouter la condition « Score de risque ≥ MEDIUM »",
evidence: [
r.hits + " client(s) déclenchent " + r.id + " (" + r.freq + "% du portefeuille)",
r.fpPct + "% sont des faux positifs probables (profil LOW, ou MEDIUM approuvé sans hit screening)",
"Les vrais positifs se concentrent sur les profils MEDIUM/HIGH — pattern identique à l'exemple « Cash > 10 000 »",
],
proposedCondition: "SI [" + r.label + "] ET Score de risque ≥ MEDIUM ALORS déclencher",
sim: sim,
status: AML_PROPOSAL_STATE["PROP-" + r.id] || "PENDING",
};
});
}
export function amlNextVersion(ruleId) {
var vs = AML_RULE_VERSIONS[ruleId] || [];
var minor = vs.length + 1;
return "v1." + minor;
}
export function amlApproveProposal(prop, user) {
AML_RULE_GATES[prop.ruleId] = true;
AML_PROPOSAL_STATE[prop.id] = "ACCEPTED";
if (!AML_RULE_VERSIONS[prop.ruleId])
AML_RULE_VERSIONS[prop.ruleId] = [];
AML_RULE_VERSIONS[prop.ruleId].push({
v: amlNextVersion(prop.ruleId), kind: "GATE_RISK_MEDIUM",
author: "Olivia — AML Learning Engine", approver: (user && user.name) || "—",
justification: "Réduction des faux positifs : " + prop.sim.fpBefore + "% → " + prop.sim.fpAfter + "% ; charge analystes −" + prop.sim.chargeReduction + "%.",
date: new Date().toISOString().slice(0, 10), sim: prop.sim,
});
pushParamAudit((user && user.name) || "—", "AML Studio — proposition " + prop.id + " APPROUVÉE → " + prop.ruleId + " " + AML_RULE_VERSIONS[prop.ruleId][AML_RULE_VERSIONS[prop.ruleId].length - 1].v + " (gate risque ≥ MEDIUM)");
wfEmit("PARAM_CHANGED", null, { subjectId: "AML_RULE/" + prop.ruleId, actor: (user && user.name) || "—", payload: { action: "APPROVE", proposal: prop.id } });
}
export function amlRejectProposal(prop, user) {
AML_PROPOSAL_STATE[prop.id] = "REJECTED";
pushParamAudit((user && user.name) || "—", "AML Studio — proposition " + prop.id + " REJETÉE (" + prop.ruleId + ")");
}
export function amlRevertRule(ruleId, user) {
AML_RULE_GATES[ruleId] = false;
if (!AML_RULE_VERSIONS[ruleId])
AML_RULE_VERSIONS[ruleId] = [];
AML_RULE_VERSIONS[ruleId].push({ v: amlNextVersion(ruleId), kind: "REVERT", author: (user && user.name) || "—", approver: (user && user.name) || "—", justification: "Retour à la version précédente (gate désactivé).", date: new Date().toISOString().slice(0, 10), sim: null });
Object.keys(AML_PROPOSAL_STATE).forEach(function (pid) { if (pid === "PROP-" + ruleId)
delete AML_PROPOSAL_STATE[pid]; });
pushParamAudit((user && user.name) || "—", "AML Studio — " + ruleId + " : REVERT (gate désactivé, règle d'origine restaurée)");
}

// ── MROS (art. 9 LBA · goAML) + Rapport annuel LBA (art. 25a OBA-FINMA) (source 28623-28791) ──
export let MROS_REPORTS: any[] = [];
let MROS_SEQ = 100;
function mrosNextRef() { return "MROS-2026-" + String(++MROS_SEQ).padStart(4, "0"); }
export function mrosDraftFromAlert(alert, user) {
var client = CLIENTS.find(function (c) { return c.id === alert.clientId; }) || {};
var kyc = KYCS_DATA.find(function (k) { return k.code === alert.kycCode; }) || {};
var ev = evalAmlRules(client, kyc);
var ruleHits = ev.rules.filter(function (r) { return r.hit; }).slice(0, 6);
var txs = TX_DATA.filter(function (t) { return t.client === client.name; }).slice(0, 8);
var suspicion = ["Alerte " + alert.alertType + " — " + alert.alertLabel + " (source : " + alert.source + ", confiance " + alert.matchConfidence + "%)"]
.concat(ruleHits.map(function (r) { return "Règle " + r.id + " déclenchée : " + r.label + " (+" + r.pts + " pts)"; }));
if (txs.some(function (t) { return t.risk === "HIGH"; }))
suspicion.push("Flux transactionnels à risque élevé vers " + txs.filter(function (t) { return t.risk === "HIGH"; }).map(function (t) { return t.to; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(", "));
var rep = {
ref: mrosNextRef(), status: "DRAFT", createdAt: "2026-07-11", createdBy: (user && user.name) || "—",
alertId: alert.id, clientId: client.id || alert.clientId, clientName: client.name || alert.clientName,
kycCode: alert.kycCode, risk: alert.risk,
legalBasis: "Art. 9 al. 1 let. a LBA — soupçon fondé que les valeurs patrimoniales ont un lien avec une infraction (art. 305bis CP)",
reportingEntity: "Banque Olive Suisse — Genève · IDE CHE-xxx.xxx.xxx · MLRO",
subject: { name: client.name || alert.clientName, country: client.country || "—", structure: client.typeLabel || "—", ubo: client.uboName || kyc.uboName || "—", aum: client.aum || "—" },
suspicionGrounds: suspicion,
linkedTx: txs.map(function (t) { return { id: t.id, date: t.date, corridor: t.from + " → " + t.to, amt: t.amt + "M " + t.cur, risk: t.risk }; }),
deadlineNote: "Communication sans délai dès le soupçon fondé (art. 9 LBA). Ne pas informer le client (art. 10a LBA — interdiction d'information).",
blockingNote: "Blocage des avoirs (art. 10 LBA) : à activer uniquement si le MROS notifie la transmission aux autorités de poursuite — 5 jours ouvrables au maximum.",
submittedAt: null, submittedBy: null, ackAt: null,
};
MROS_REPORTS.unshift(rep);
pushParamAudit((user && user.name) || "—", "MROS — brouillon " + rep.ref + " préparé par Olivia depuis l'alerte " + alert.id + " (" + rep.clientName + ")");
return rep;
}
export function mrosValidate(rep, user) {
rep.status = "SUBMITTED";
rep.submittedAt = "2026-07-11";
rep.submittedBy = (user && user.name) || "—";
var a = AML_ALERTS.find(function (x) { return x.id === rep.alertId; });
if (a)
a.status = "REPORTED";
pushParamAudit((user && user.name) || "—", "MROS — " + rep.ref + " VALIDÉE et TRANSMISE au MROS (goAML) par " + ((user && user.name) || "—") + " — alerte " + rep.alertId + " clôturée REPORTED");
wfEmit("PARAM_CHANGED", null, { subjectId: "MROS/" + rep.ref, actor: (user && user.name) || "—", payload: { action: "SUBMIT", alert: rep.alertId } });
}
function xmlEsc(v) { return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function mrosGoamlXml(rep) {
var L = [];
L.push('<?xml version="1.0" encoding="UTF-8"?>');
L.push('<report xmlns="urn:goaml:report" schema_version="5.2">');
L.push('  <report_code>STR</report_code>');
L.push('  <ref>' + xmlEsc(rep.ref) + '</ref>');
L.push('  <submission_date>' + xmlEsc(rep.submittedAt || rep.createdAt) + '</submission_date>');
L.push('  <legal_basis>' + xmlEsc(rep.legalBasis) + '</legal_basis>');
L.push('  <reporting_entity>');
L.push('    <name>Banque Olive Suisse</name><location>Genève, CH</location><mlro>' + xmlEsc(rep.submittedBy || rep.createdBy) + '</mlro>');
L.push('  </reporting_entity>');
L.push('  <subject>');
L.push('    <name>' + xmlEsc(rep.subject.name) + '</name><structure>' + xmlEsc(rep.subject.structure) + '</structure><country>' + xmlEsc(rep.subject.country) + '</country>');
L.push('    <ubo>' + xmlEsc(rep.subject.ubo) + '</ubo><kyc_ref>' + xmlEsc(rep.kycCode) + '</kyc_ref><risk>' + xmlEsc(rep.risk) + '</risk>');
L.push('  </subject>');
L.push('  <reason>');
rep.suspicionGrounds.forEach(function (g) { L.push('    <ground>' + xmlEsc(g) + '</ground>'); });
L.push('  </reason>');
L.push('  <transactions count="' + rep.linkedTx.length + '">');
rep.linkedTx.forEach(function (t) { L.push('    <transaction id="' + xmlEsc(t.id) + '" date="' + xmlEsc(t.date) + '" corridor="' + xmlEsc(t.corridor) + '" amount="' + xmlEsc(t.amt) + '" risk="' + xmlEsc(t.risk) + '"/>'); });
L.push('  </transactions>');
L.push('  <confidentiality>Art. 10a LBA — no tipping-off. Asset freeze per Art. 10 LBA upon MROS forwarding notice.</confidentiality>');
L.push('</report>');
return L.join("\n");
}
export function mrosDownloadXml(rep) {
var blob = new Blob([mrosGoamlXml(rep)], { type: "application/xml;charset=utf-8" });
var a = document.createElement("a");
a.href = URL.createObjectURL(blob);
a.download = rep.ref + "-goAML.xml";
a.click();
URL.revokeObjectURL(a.href);
}
export let MROS_POLICY: any = { relance: 10, escalade: 20 }; // paramétrable — Admin → Certifications & délais
export function mrosAckAge(rep) {
if (rep.status !== "SUBMITTED" || !rep.submittedAt)
return null;
var d = Math.round((new Date("2026-07-11") - new Date(rep.submittedAt)) / 86400000);
return { days: d, level: d > MROS_POLICY.escalade ? "ESC" : d > MROS_POLICY.relance ? "RELANCE" : "OK" };
}
export const MROS_STATUS_META: any = { DRAFT: ["Brouillon — préparé par Olivia", T.amber, "amberSoft"], SUBMITTED: ["Transmise au MROS (goAML)", T.olive700, "oliveSoft"], ACKNOWLEDGED: ["Accusé de réception MROS", T.green, "greenSoft"] };
export function lbaAnnualReport() {
var rels = CLIENTS.map(regRelationRow);
var byRisk = { HIGH: 0, MEDIUM: 0, LOW: 0 };
CLIENTS.forEach(function (c) { byRisk[c.risk] = (byRisk[c.risk] || 0) + 1; });
var edd = rels.filter(function (r) { return r.wn.code[0] === "H" || r.wn.code[0] === "P"; }).length;
var verd = {};
rels.forEach(function (r) { var v = regFiche(r).verdict; verd[v] = (verd[v] || 0) + 1; });
var late = rels.filter(function (r) { return r.reviewLate; }).length;
var st = amlRuleStats();
var byType = {};
AML_ALERTS.forEach(function (a) { byType[a.alertType] = (byType[a.alertType] || 0) + 1; });
var alNew = AML_ALERTS.filter(function (a) { return a.status === "NEW"; }).length;
var mrosPend = MROS_REPORTS.filter(function (r) { var a = mrosAckAge(r); return a && a.level !== "OK"; });
var profiles = STAFF_DATA.map(staffProfile);
var susp = profiles.filter(function (x) { return x.suspended; });
var tcc = trainingCrossChecks();
var cbChecks = PARAM_AUDIT.filter(function (e) { return String(e.what).indexOf("Cross-Border") >= 0; }).length;
var reco = [];
if (alNew > 0)
reco.push("Qualifier les " + alNew + " alertes AML au statut NEW (objectif : zéro alerte non triée > 30 jours).");
if (susp.length)
reco.push("Recycler sans délai : " + susp.map(function (x) { return x.p.name + " (" + x.expired.map(function (c) { return c.code; }).join(", ") + ")"; }).join(" · ") + " — habilitations suspendues.");
if (mrosPend.length)
reco.push("Relancer le MROS sur " + mrosPend.length + " communication(s) sans accusé (politique interne J+10 / J+20).");
if (late > 0)
reco.push("Résorber les " + late + " revues périodiques en retard (plan de rattrapage trimestriel).");
if ((verd["NON CONFORME"] || 0) > 0)
reco.push("Plan de remédiation sur les " + (verd["NON CONFORME"] || 0) + " relations NON CONFORMES du registre art. 7.");
reco.push("Poursuivre l'optimisation des règles via l'Intelligence Studio (validation humaine systématique, réversibilité garantie).");
return {
period: "Exercice 2026 (arrêté au 11 juillet)", entity: "Banque Olive Suisse — service spécialisé LBA", author: "Nadia Keller, MLRO",
relations: { total: CLIENTS.length, byRisk: byRisk, edd: edd, verd: verd, late: late },
dispositif: { rules: AML_SCORING_RULES.filter(function (r) { return r.on !== false; }).length, rulesTotal: AML_SCORING_RULES.length, params: Object.keys(AML_PARAMS).length, wf: WF_MGMT_TEMPLATES.filter(function (t) { return t.active; }).length },
screening: { hits: rels.filter(function (r) { return r.hits.length > 0; }).length, alerts: AML_ALERTS.length, byType: byType, alNew: alNew, fpPct: Math.round(st.alerts.fp / Math.max(1, st.alerts.total) * 100) },
mros: { total: MROS_REPORTS.length, submitted: MROS_REPORTS.filter(function (r) { return r.status !== "DRAFT"; }).length, pending: mrosPend.length },
formations: { staff: STAFF_DATA.length, susp: susp.length, checks: tcc.length },
crossborder: { juris: CB_RULES.length, checks: cbChecks },
reco: reco,
};
}
function lbaReportMd(r) {
var L = [];
L.push("# Rapport annuel LBA à la Direction — " + r.period);
L.push("_" + r.entity + " · " + r.author + " · art. 25a OBA-FINMA_\n");
L.push("## 1. Portefeuille de relations d'affaires");
L.push("- " + r.relations.total + " relations actives — HIGH " + r.relations.byRisk.HIGH + " · MEDIUM " + r.relations.byRisk.MEDIUM + " · LOW " + r.relations.byRisk.LOW);
L.push("- " + r.relations.edd + " relations en diligence renforcée (gabarits H*/P*)");
L.push("- Registre art. 7 : " + (r.relations.verd["CONFORME"] || 0) + " conformes · " + (r.relations.verd["RÉSERVES"] || 0) + " avec réserves · " + (r.relations.verd["NON CONFORME"] || 0) + " non conformes · " + r.relations.late + " revues en retard\n");
L.push("## 2. Dispositif de surveillance");
L.push("- " + r.dispositif.rules + "/" + r.dispositif.rulesTotal + " règles AML actives · " + r.dispositif.params + " seuils paramétrés · " + r.dispositif.wf + " gabarits de workflow actifs\n");
L.push("## 3. Screening & alertes");
L.push("- " + r.screening.hits + " dossiers avec hit de screening · " + r.screening.alerts + " alertes (" + Object.keys(r.screening.byType).map(function (k) { return k + " " + r.screening.byType[k]; }).join(" · ") + ")");
L.push("- " + r.screening.alNew + " alertes NEW à qualifier · taux de faux positifs estimé " + r.screening.fpPct + "%\n");
L.push("## 4. Communications MROS (art. 9 LBA)");
L.push("- " + r.mros.total + " déclarations au registre, dont " + r.mros.submitted + " transmises (goAML) · " + r.mros.pending + " en attente d'accusé au-delà de la politique interne\n");
L.push("## 5. Formations & habilitations");
L.push("- " + r.formations.staff + " collaborateurs exposés · " + r.formations.susp + " habilitations suspendues (certification échue) · " + r.formations.checks + " contrôles de cohérence ouverts\n");
L.push("## 6. Cross-border");
L.push("- Country manual : " + r.crossborder.juris + " juridictions couvertes · " + r.crossborder.checks + " check(s) pré-voyage tracés sur la période\n");
L.push("## 7. Recommandations à la Direction");
r.reco.forEach(function (x, i) { L.push((i + 1) + ". " + x); });
L.push("\n_Généré par Olive — données consolidées en direct, piste d'audit immuable._");
return L.join("\n");
}
export function lbaDownloadReport(user) {
var r = lbaAnnualReport();
var blob = new Blob([lbaReportMd(r)], { type: "text/markdown;charset=utf-8" });
var a = document.createElement("a");
a.href = URL.createObjectURL(blob);
a.download = "rapport-annuel-LBA-direction-2026.md";
a.click();
URL.revokeObjectURL(a.href);
pushParamAudit((user && user.name) || "—", "Rapport annuel LBA à la Direction — généré et téléchargé (art. 25a OBA-FINMA)");
}
