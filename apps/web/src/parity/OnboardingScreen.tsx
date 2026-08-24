import React, { useState, useEffect } from "react";
import { T } from "./tokens";
import { Badge, SectionTitle, KpiCard, StatsToggle, OliveNote } from "./components";
import { RiskFactorsList, LifecycleBadge } from "./components-data";
import { DOC_STRUCTURES, computeRequiredDocs, computeDocsByPerson } from "./preonboarding-support";
import { evalAmlRules } from "./aml";
import { WF_RULE_PARAMS } from "./kyc-support";
import { GED_DOCS } from "./legal-support";
import USERS from "../fixtures/USERS.json";
import PROSPECTS_DATA from "../fixtures/PROSPECTS_DATA.json";

// Source : docs/reference/olive-demo.html 14001-14327 — OnboardingScreen (MOD : entrée en
// relation des prospects — KPI, liste filtrable, parcours d'onboarding animé « pousse d'olivier »,
// modale nouveau prospect avec scoring AML, checklist documents « quatre yeux », génération du set
// documentaire). Porté VERBATIM. Helpers portés verbatim : EnterBankButton (13755),
// DocGenUploadModal (13820), prospectStructId (18198). Props rendues optionnelles + callbacks
// no-op / état local pour rendu autonome ; PENDING_ONBOARD_LEAD_NAME → let module local ;
// pushParamAudit (piste d'audit hors périmètre front) → no-op.

// pushParamAudit : piste d'audit (hors périmètre front) → no-op.
const pushParamAudit = (_actor: string, _msg: string) => {};

// PENDING_ONBOARD_LEAD_NAME : global de démo (pré-remplissage depuis « Prospect à contacter »).
// En parité autonome : let module local initialisé à null.
let PENDING_ONBOARD_LEAD_NAME: string | null = null;

function EnterBankButton({ onClick }) {
const [hover, setHover] = useState(false);
return (React.createElement("button", { onClick: onClick, onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false), title: "Faire entrer le prospect dans la banque", style: { display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 12px 7px 10px", borderRadius: 10, border: `1.5px solid ${T.olive600}`, background: hover ? T.olive600 : T.oliveSoft, color: hover ? "#fff" : T.olive700, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .18s", whiteSpace: "nowrap" } },
React.createElement("svg", { width: "30", height: "22", viewBox: "0 0 30 22", style: { overflow: "visible", flexShrink: 0 } },
React.createElement("rect", { x: "17", y: "1", width: "12", height: "20", rx: "1.5", fill: "none", stroke: hover ? "#fff" : T.olive700, strokeWidth: "1.6" }),
React.createElement("line", { x1: "23", y1: "1", x2: "23", y2: "21", stroke: hover ? "#fff" : T.olive700, strokeWidth: "1", opacity: "0.5" }),
React.createElement("circle", { cx: "20", cy: "11", r: "1", fill: hover ? "#fff" : T.olive700 }),
React.createElement("g", { style: { transform: hover ? "translateX(10px)" : "translateX(0)", opacity: hover ? 0.15 : 1, transition: "all .35s ease" } },
React.createElement("circle", { cx: "6", cy: "6", r: "2.6", fill: hover ? "#fff" : T.olive700 }),
React.createElement("path", { d: "M6 9 L6 15 M6 11 L2 13 M6 11 L10 13 M6 15 L3 20 M6 15 L9 20", stroke: hover ? "#fff" : T.olive700, strokeWidth: "1.8", strokeLinecap: "round", fill: "none" }))),
"Entrer en relation"));
}

function prospectStructId(type) {
if (["PP", "SA", "SARL", "HOLD", "TRUST", "FOND", "FO"].indexOf(type) >= 0)
return type;
return "SA"; // FUND et autres → traités comme entité société
}

function DocGenUploadModal({ structId, title, subtitle, onClose }) {
const set = computeRequiredDocs(structId);
const [viewBy, setViewBy] = useState("doc");
const byPerson = computeDocsByPerson(structId).map(function (p) { return Object.assign({}, p, { name: p.name || title }); });
const [docs, setDocs] = useState(function () { return set.docs.map(function (d) { return { doc: d.doc, where: d.where, account: d.account, present: false, signed: false }; }); });
const upload = function (i) { setDocs(function (prev) { return prev.map(function (d, j) { return j === i ? Object.assign({}, d, { present: true }) : d; }); }); };
const sign = function (i) { setDocs(function (prev) { return prev.map(function (d, j) { return j === i ? Object.assign({}, d, { signed: !d.signed, present: true }) : d; }); }); };
const done = docs.filter(function (d) { return d.present && d.signed; }).length;
const pct = docs.length ? Math.round(done / docs.length * 100) : 0;
return (React.createElement("div", { onClick: onClose, style: { position: "fixed", inset: 0, background: "rgba(20,26,14,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400 } },
React.createElement("div", { onClick: function (e) { e.stopPropagation(); }, style: { background: T.surface, borderRadius: 16, width: 640, maxWidth: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 70px rgba(10,15,8,0.35)", overflow: "hidden" } },
React.createElement("div", { style: { padding: "18px 22px", borderBottom: "1px solid " + T.line, display: "flex", alignItems: "center", gap: 12 } },
React.createElement("span", { style: { width: 40, height: 40, borderRadius: 10, background: T.oliveSoft, color: T.olive700, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 } }, "▤"),
React.createElement("div", { style: { flex: 1, minWidth: 0 } },
React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: T.ink } },
"Documents requis — ",
title),
React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft } },
subtitle,
" · ",
set.struct.name)),
React.createElement("div", { style: { display: "flex", gap: 4, marginRight: 8 } }, [["doc", "▤ Par document"], ["person", "☺ Par intervenant"]].map(function (v) {
return (React.createElement("button", { key: v[0], onClick: function () { setViewBy(v[0]); }, style: { padding: "5px 11px", borderRadius: 7, border: "1px solid " + (viewBy === v[0] ? T.olive600 : T.line), background: viewBy === v[0] ? T.oliveSoft : T.surface, color: viewBy === v[0] ? T.olive700 : T.inkSoft, fontSize: 10.5, fontWeight: 700, cursor: "pointer" } }, v[1]));
})),
React.createElement(Badge, { text: done + "/" + docs.length + " complets", color: done === docs.length && docs.length > 0 ? T.green : T.amber, bg: done === docs.length && docs.length > 0 ? T.greenSoft : T.amberSoft })),
React.createElement("div", { style: { height: 4, background: T.lineSoft } },
React.createElement("div", { style: { height: "100%", width: pct + "%", background: pct === 100 ? T.green : T.olive600, transition: "width 0.2s" } })),
React.createElement("div", { style: { padding: "14px 22px", overflowY: "auto" } },
React.createElement(OliveNote, { style: { fontSize: 11.5, color: T.inkMid, lineHeight: 1.6, marginBottom: 14, background: T.oliveSoft, padding: "10px 12px", borderRadius: 9 } },
"Set dérivé de la matrice documentaire selon la structure ",
React.createElement("strong", null, set.struct.name),
". Chaque exigence est rattachée au ",
React.createElement("strong", { style: { color: T.gold } }, "Compte"),
" ou à une ",
React.createElement("strong", null, "relation"),
". Téléversez puis marquez comme signé."),
viewBy === "person" && byPerson.map(function (p, pi) {
var idxOf = function (type) { return docs.findIndex(function (d) { return d.doc === type; }); };
return (React.createElement("div", { key: pi, style: { border: "1px solid " + T.line, borderRadius: 12, padding: "12px 14px", marginBottom: 12, background: pi === 0 ? T.oliveSoft + "55" : T.surface } },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 8 } },
React.createElement("span", { style: { width: 28, height: 28, borderRadius: "50%", background: T.olive600, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 } }, (p.name || "?").split(/\s+/).map(function (x) { return x[0]; }).join("").slice(0, 2).toUpperCase()),
React.createElement("span", { style: { fontSize: 13, fontWeight: 800, color: T.ink } }, p.name),
p.roles.map(function (r) { var acct = r === "Compte"; return React.createElement("span", { key: r, style: { fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: acct ? T.gold + "20" : T.oliveSoft, color: acct ? T.gold : T.olive700 } }, r); }),
p.roles.length > 1 && React.createElement("span", { style: { fontSize: 9.5, color: T.inkSoft, fontStyle: "italic" } }, "rôles fusionnés — un seul set, sans doublon")),
React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: T.red, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 } },
"Obligatoires (",
p.mandatory.length,
")"),
p.mandatory.map(function (m) {
var i = idxOf(m.doc);
var st = i >= 0 ? docs[i] : null;
var complete = st && st.present && st.signed;
return (React.createElement("div", { key: m.doc, style: { display: "flex", alignItems: "center", gap: 9, padding: "5px 0" } },
React.createElement("span", { style: { width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, background: complete ? T.greenSoft : T.surface, border: "1.5px solid " + (complete ? T.green : T.line), color: complete ? T.green : T.inkSoft } }, complete ? "✓" : ""),
React.createElement("span", { style: { flex: 1, fontSize: 12, color: T.ink } },
m.doc,
" ",
React.createElement("span", { style: { fontSize: 9.5, color: T.inkSoft } },
"via ",
m.via.join(" + "))),
i >= 0 && React.createElement("label", { style: { padding: "4px 9px", borderRadius: 6, border: "1px solid " + T.line, background: st && st.present ? T.lineSoft : T.surface, color: st && st.present ? T.inkSoft : T.olive700, fontSize: 10, fontWeight: 700, cursor: "pointer" } },
st && st.present ? "✓" : "↑",
React.createElement("input", { type: "file", style: { display: "none" }, onChange: function (e) { var f = e.target.files && e.target.files[0]; if (!f)
return; upload(i); } })),
i >= 0 && React.createElement("button", { onClick: function () { sign(i); }, style: { padding: "4px 9px", borderRadius: 6, border: "1px solid " + (st && st.signed ? T.green : T.line), background: st && st.signed ? T.greenSoft : T.surface, color: st && st.signed ? T.green : T.inkMid, fontSize: 10, fontWeight: 700, cursor: "pointer" } }, st && st.signed ? "✓ Signé" : "Signer")));
}),
p.mandatory.length === 0 && React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, fontStyle: "italic", padding: "3px 0" } }, "Aucun document obligatoire pour ces rôles."),
p.optional.length > 0 && (React.createElement("div", null,
React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: T.amber, textTransform: "uppercase", letterSpacing: 0.5, margin: "8px 0 4px" } },
"Optionnels (",
p.optional.length,
")"),
p.optional.map(function (o) { return React.createElement("div", { key: o.doc, style: { fontSize: 11.5, color: T.inkMid, padding: "3px 0 3px 25px" } },
"○ ",
o.doc,
" ",
React.createElement("span", { style: { fontSize: 9.5, color: T.inkSoft } },
"via ",
o.via.join(" + "))); })))));
}),
viewBy === "doc" && docs.map(function (d, i) {
var complete = d.present && d.signed;
return (React.createElement("div", { key: i, style: { display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < docs.length - 1 ? "1px solid " + T.lineSoft : "none" } },
React.createElement("span", { style: { width: 22, height: 22, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: complete ? T.greenSoft : d.present ? T.amberSoft : T.surface, border: "1.5px solid " + (complete ? T.green : d.present ? T.amber : T.line), color: complete ? T.green : d.present ? T.amber : T.inkSoft } }, complete ? "✓" : d.present ? "○" : ""),
React.createElement("div", { style: { flex: 1, minWidth: 0 } },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 600, color: T.ink } }, d.doc),
React.createElement("div", { style: { display: "flex", gap: 4, flexWrap: "wrap", marginTop: 3 } }, d.where.map(function (w) { var acct = w === "Compte"; return (React.createElement("span", { key: w, style: { fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: acct ? T.gold + "20" : T.oliveSoft, color: acct ? T.gold : T.olive700 } }, w)); }))),
React.createElement("label", { style: { padding: "6px 12px", borderRadius: 7, border: "1px solid " + (d.present ? T.line : T.olive600), background: d.present ? T.lineSoft : T.surface, color: d.present ? T.inkSoft : T.olive700, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", display: "inline-block" } },
d.present ? ("✓ " + (d.fileName || "Téléversé")) : "↑ Uploader",
React.createElement("input", { type: "file", style: { display: "none" }, onChange: function (e) { var f = e.target.files && e.target.files[0]; if (!f)
return; setDocs(function (prev) { return prev.map(function (dd, j) { return j === i ? Object.assign({}, dd, { present: true, fileName: f.name, sizeKb: Math.max(1, Math.round(f.size / 1024)) }) : dd; }); }); GED_DOCS.unshift({ id: "DOC-" + (7500 + GED_DOCS.length), clientId: null, name: f.name, code: "01-IDENT", lang: "FR", version: 1, sizeKb: Math.max(1, Math.round(f.size / 1024)), status: "A_VALIDER", uploadedBy: "Onboarding", at: "2026-07-11" }); } })),
React.createElement("button", { onClick: function () { sign(i); }, style: { padding: "6px 12px", borderRadius: 7, border: "1px solid " + (d.signed ? T.green : T.line), background: d.signed ? T.greenSoft : T.surface, color: d.signed ? T.green : T.inkMid, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" } }, d.signed ? "✓ Signé" : "Signer")));
})),
React.createElement("div", { style: { padding: "14px 22px", borderTop: "1px solid " + T.line, display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center" } },
React.createElement("span", { style: { flex: 1, fontSize: 11, color: T.inkSoft } },
set.docs.length,
" documents · ",
set.docs.filter(function (d) { return d.account; }).length,
" au niveau compte · ",
done,
" complets"),
React.createElement("button", { onClick: onClose, style: { padding: "9px 16px", borderRadius: 9, border: "1px solid " + T.line, background: T.surface, color: T.inkMid, fontSize: 13, cursor: "pointer" } }, "Fermer"),
React.createElement("button", { onClick: onClose, style: { padding: "9px 18px", borderRadius: 9, border: "none", background: T.olive600, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" } }, "Enregistrer")))));
}

export default function OnboardingScreen(props: { prospects?: any[]; onEnter?: (p: any) => void; onCreate?: (p: any) => void; onOpenKyc?: (p: any) => void } = {}) {
// Adaptation parité : props optionnelles. `prospects`/`onCreate` par défaut → liste locale (état)
// pour que « Nouveau prospect » fonctionne en démo autonome ; `onEnter`/`onOpenKyc` → no-op.
const [localProspects, setLocalProspects] = useState<any[]>(PROSPECTS_DATA as any[]);
const prospects = props.prospects || localProspects;
const onCreate = props.onCreate || (function (p: any) { setLocalProspects(function (l) { return [p, ...l]; }); });
const onEnter = props.onEnter || (function () {});
const onOpenKyc = props.onOpenKyc || (function () {});
// Animation de pousse : rejouée à chaque montage (ouverture de la page)
const [grown, setGrown] = useState(false);
useEffect(() => { const t = setTimeout(() => setGrown(true), 60); return () => clearTimeout(t); }, []);
const [openProspect, setOpenProspect] = useState(null); // prospect dont on vérifie les docs
const [genProspect, setGenProspect] = useState(null); // prospect pour lequel on génère le set doc
const [docDraft, setDocDraft] = useState([]); // copie éditable de la checklist
const openCheck = (p) => { setOpenProspect(p); setDocDraft(p.docs.map(d => ({ ...d }))); };
const allOk = docDraft.length > 0 && docDraft.every(d => d.present && d.signed);
const missing = docDraft.filter(d => !(d.present && d.signed)).length;
// ── Nouveau prospect ──────────────────────────────────────────────────────
const ONB_COUNTRIES = [
{ country: "Suisse", code: "CH", flag: "🇨🇭" }, { country: "France", code: "FR", flag: "🇫🇷" }, { country: "Allemagne", code: "DE", flag: "🇩🇪" },
{ country: "Autriche", code: "AT", flag: "🇦🇹" }, { country: "Jersey", code: "JE", flag: "🇯🇪" }, { country: "Luxembourg", code: "LU", flag: "🇱🇺" },
{ country: "Royaume-Uni", code: "GB", flag: "🇬🇧" }, { country: "Italie", code: "IT", flag: "🇮🇹" }, { country: "États-Unis", code: "US", flag: "🇺🇸" },
{ country: "Singapour", code: "SG", flag: "🇸🇬" }, { country: "Émirats arabes unis", code: "AE", flag: "🇦🇪" },
];
const [createOpen, setCreateOpen] = useState(false);
const [npName, setNpName] = useState(function () { var n = PENDING_ONBOARD_LEAD_NAME; return n || ""; });
useEffect(function () { if (PENDING_ONBOARD_LEAD_NAME) {
setCreateOpen(true);
PENDING_ONBOARD_LEAD_NAME = null;
} }, []);
const [npStruct, setNpStruct] = useState("PP");
const [npCountry, setNpCountry] = useState("CH");
const [npRm, setNpRm] = useState(((USERS.find(function (u) { return u.role === "RM" || u.role === "ARM"; })) || {}).name || "Sophie Marchand");
const [npSegment, setNpSegment] = useState("Affluent");
const [npAum, setNpAum] = useState("");
const npStructObj = DOC_STRUCTURES.find(function (x) { return x.id === npStruct; }) || DOC_STRUCTURES[0];
const npCountryObj = ONB_COUNTRIES.find(function (c) { return c.code === npCountry; }) || ONB_COUNTRIES[0];
const npEv = evalAmlRules({ name: npName || "—", type: npStruct, countryCode: npCountry, sector: "", aum: npAum, pep: false, uboName: "" }, null);
const npRisk = npEv.score <= WF_RULE_PARAMS.WR0.sdd ? "LOW" : (npEv.score <= WF_RULE_PARAMS.WR0.cdd ? "MEDIUM" : "HIGH");
const npDdl = npRisk === "LOW" ? "SDD" : (npRisk === "MEDIUM" ? "CDD" : "EDD");
const createProspect = function () {
var nm = npName.trim();
if (!nm || !onCreate)
return;
var rnd = Math.floor(1000 + Math.random() * 9000);
var ini = (nm.split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase()) || "NP";
var cdbForm = npStruct === "PP" ? "A" : (npStruct === "TRUST" ? "T" : (npStruct === "FOND" ? "S" : "K"));
var docs = ["Formulaire CDB " + cdbForm, "Contrat d'ouverture de compte", "Conditions générales", "Profil investisseur (LSFin)", "Pièce d'identité certifiée", "Justificatif de domicile", "Auto-certification CRS / FATCA"].map(function (l) { return { label: l, present: false, signed: false }; });
var prospect = { id: "PRO-9" + rnd, name: nm, initials: ini, type: npStruct, typeLabel: npStructObj.name, country: npCountryObj.country, countryCode: npCountryObj.code, countryFlag: npCountryObj.flag,
segment: npSegment, aum: npAum.trim() ? ("CHF " + npAum.trim()) : "CHF —", sector: "—", rm: npRm, score: npEv.score, risk: npRisk, ddl: npDdl, cdbForm: cdbForm, uboName: nm,
firstKyc: { code: "KYC-2026-" + npCountryObj.code + "-" + rnd + "-R1", status: "DRAFT" }, docs: docs, createdAt: "2026-07-05" };
onCreate(prospect);
pushParamAudit(npRm, "Prospect créé : " + nm + " (" + npStructObj.name + ", " + npCountryObj.country + ") — score " + npEv.score + " (" + npDdl + ")");
setCreateOpen(false);
setNpName("");
setNpAum("");
};
// ── Filtre + tri + sélection ────────────────────────────────────────────
const [filter, setFilter] = useState("all"); // all | ready | progress | entered
const list = prospects || [];
const isReady = function (p) { return !p.entered && p.firstKyc.status === "APPROVED"; };
const isEntered = function (p) { return !!p.entered; };
const isProgress = function (p) { return !p.entered && p.firstKyc.status !== "APPROVED"; };
const counts = { all: list.length, ready: list.filter(isReady).length, progress: list.filter(isProgress).length, entered: list.filter(isEntered).length };
const filtered = list.filter(function (p) { return filter === "ready" ? isReady(p) : (filter === "progress" ? isProgress(p) : (filter === "entered" ? isEntered(p) : true)); })
.slice().sort(function (a, b) { var rank = function (p) { return isReady(p) ? 0 : (isProgress(p) ? 1 : 2); }; return rank(a) - rank(b); });
const [selId, setSelId] = useState(null);
const [cardOpen, setCardOpen] = useState(false);
useEffect(function () { if (!selId && filtered.length)
setSelId(filtered[0].id); }, [list.length]);
const selProspect = list.find(function (p) { return p.id === selId; }) || filtered[0] || null;
// ── Parcours dérivé du statut réel du prospect sélectionné ─────────────
const STEP_DEFS = [
{ n: 1, label: "Données collectées", desc: "Identité, coordonnées, structure" },
{ n: 2, label: "Identité vérifiée", desc: "Biométrie + pièce d'identité OK" },
{ n: 3, label: "KYC en cours", desc: "Due diligence en traitement" },
{ n: 4, label: "Screening", desc: "Sanctions, PEP, adverse media" },
{ n: 5, label: "Validation comité", desc: "Approbation finale EDD" },
{ n: 6, label: "Compte ouvert", desc: "Relation active" },
];
const curStepFor = function (p) {
if (!p)
return 1;
if (p.entered)
return 7;
var M = { DRAFT: 1, IN_PROGRESS: 3, UNDER_REVIEW: 4, PENDING_APPROVAL: 5, APPROVED: 6, REJECTED: 0 };
return M[p.firstKyc.status] !== undefined ? M[p.firstKyc.status] : 1;
};
const curStep = curStepFor(selProspect);
const steps = STEP_DEFS.map(function (s) { return Object.assign({}, s, { state: curStep === 7 ? "done" : (s.n < curStep ? "done" : (s.n === curStep ? "current" : "pending")) }); });
const progressPct = curStep === 7 ? 100 : Math.round(((curStep - 1) / 6) * 100);
const slaDaysLeft = selProspect ? Math.max(0, 8 - Math.floor((new Date(2026, 6, 5) - new Date(selProspect.createdAt)) / 86400000)) : null;
const inp = { padding: "9px 12px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 13, width: "100%", boxSizing: "border-box" };
const lbl = { fontSize: 10.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 };
return (React.createElement("div", null,
React.createElement("style", null, `
        @keyframes oliveGrow { 0%{transform:scale(0) rotate(var(--lr)); opacity:0;} 60%{transform:scale(1.12) rotate(var(--lr)); opacity:1;} 100%{transform:scale(1) rotate(var(--lr)); opacity:1;} }
        @keyframes branchDraw { from{transform:scaleY(0);} to{transform:scaleY(1);} }
        @keyframes fadeUp { from{opacity:0; transform:translateY(6px);} to{opacity:1; transform:translateY(0);} }
      `),
React.createElement(StatsToggle, null,
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 } },
React.createElement(KpiCard, { label: "Onboardings en cours", value: String(counts.progress), sub: counts.ready + " prêt(s) à entrer", color: T.olive600, icon: "🌱" }),
React.createElement(KpiCard, { label: "Délai moyen", value: "11 min", sub: "parcours digital", trend: -22, color: T.green, icon: "⏱" }),
React.createElement(KpiCard, { label: "Taux de complétion", value: list.length ? (Math.round((counts.ready + counts.entered) / list.length * 100) + "%") : "—", sub: "prêts ou entrés / total", color: T.leaf, icon: "✓" }),
React.createElement(KpiCard, { label: "Rejetés", value: String(list.filter(function (p) { return p.firstKyc.status === "REJECTED"; }).length), sub: "à relancer ou clôturer", color: T.amber, icon: "↻" }))),
React.createElement("div", { style: { background: T.surface, borderRadius: 14, padding: 24, border: `1px solid ${T.line}`, marginBottom: 18 } },
React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 } },
React.createElement("div", { style: { flex: 1, minWidth: 260 } },
React.createElement(SectionTitle, null, "Prospects — entrée en relation"),
React.createElement("div", { style: { fontSize: 12, color: T.inkSoft, marginTop: 4 } },
"Quand le premier KYC d'un prospect est ",
React.createElement("b", { style: { color: T.olive700 } }, "validé"),
", il peut franchir la porte de la banque. La vérification des documents d'ouverture précède la création du client (règle des quatre yeux).")),
React.createElement("button", { onClick: function () { setCreateOpen(true); }, style: { padding: "9px 16px", borderRadius: 9, border: "none", background: T.olive600, color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" } }, "＋ Nouveau prospect")),
React.createElement("div", { style: { display: "flex", gap: 6, margin: "14px 0", flexWrap: "wrap" } }, [["all", "Tous", counts.all], ["ready", "Prêts à entrer", counts.ready], ["progress", "En cours", counts.progress], ["entered", "Entrés", counts.entered]].map(function (f) {
return (React.createElement("button", { key: f[0], onClick: function () { setFilter(f[0]); }, style: { padding: "6px 13px", borderRadius: 8, border: "1px solid " + (filter === f[0] ? T.olive600 : T.line), background: filter === f[0] ? T.oliveSoft : "transparent", color: filter === f[0] ? T.olive700 : T.inkSoft, fontSize: 11.5, fontWeight: filter === f[0] ? 700 : 500, cursor: "pointer" } },
f[1],
" · ",
f[2]));
})),
React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
filtered.length === 0 && React.createElement("div", { style: { padding: "22px", textAlign: "center", color: T.inkSoft, fontSize: 12.5 } }, "Aucun prospect dans ce filtre."),
filtered.map(p => {
const KSTAT = { IN_PROGRESS: "KYC en cours", UNDER_REVIEW: "KYC en revue", PENDING_APPROVAL: "En attente comité", APPROVED: "KYC validé", REJECTED: "KYC rejeté", DRAFT: "Brouillon" };
const approved = p.firstKyc.status === "APPROVED";
const isSel = selProspect && selProspect.id === p.id;
return (React.createElement("div", { key: p.id, onClick: () => setSelId(p.id), style: { display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 11, cursor: "pointer", border: `1.5px solid ${isSel ? T.olive600 : (p.entered ? T.green + "55" : T.line)}`, background: isSel ? T.oliveSoft : (p.entered ? T.greenSoft : T.cream) } },
React.createElement("div", { style: { width: 38, height: 38, borderRadius: 10, background: T.oliveSoft, color: T.olive700, fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, p.initials),
React.createElement("div", { style: { flex: 1, minWidth: 0 } },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
React.createElement("span", { style: { fontSize: 14, fontWeight: 700, color: T.ink } },
p.countryFlag,
" ",
p.name),
React.createElement("span", { style: { fontSize: 11, color: T.inkSoft } },
p.typeLabel,
" · ",
p.aum)),
React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
p.id,
" · 1er KYC ",
React.createElement("span", { style: { fontFamily: "monospace", whiteSpace: "nowrap" } }, p.firstKyc.code),
" · RM ",
p.rm)),
React.createElement(Badge, { text: KSTAT[p.firstKyc.status] || p.firstKyc.status, color: approved ? T.green : T.amber, bg: approved ? T.greenSoft : T.amberSoft }),
React.createElement(LifecycleBadge, { entity: p }),
(() => {
const pStep = curStepFor(p);
const pPct = p.entered ? 100 : (pStep === 0 ? 0 : Math.round(((pStep - 1) / 6) * 100));
return (React.createElement("div", { style: { width: 64, flexShrink: 0 }, title: pPct + "% du parcours" },
React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: pPct === 100 ? T.green : T.olive700, textAlign: "right", marginBottom: 2 } },
pPct,
"%"),
React.createElement("div", { style: { height: 5, background: T.lineSoft, borderRadius: 3, overflow: "hidden" } },
React.createElement("div", { style: { height: "100%", width: pPct + "%", background: pPct === 100 ? T.green : T.gold, borderRadius: 3 } }))));
})(),
React.createElement("button", { onClick: (e) => { e.stopPropagation(); setSelId(p.id); setCardOpen(true); }, title: "Voir le parcours d'onboarding", style: { width: 30, height: 30, borderRadius: 8, border: "1px solid " + T.line, background: T.surface, fontSize: 14, cursor: "pointer", flexShrink: 0 } }, "🪪"),
React.createElement("button", { onClick: (e) => { e.stopPropagation(); setGenProspect(p); }, style: { padding: "6px 11px", borderRadius: 8, border: `1px solid ${T.olive600}`, background: T.surface, color: T.olive700, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 } }, "▤ Générer doc"),
React.createElement("div", { style: { width: 200, textAlign: "right", flexShrink: 0 }, onClick: (e) => e.stopPropagation() }, p.entered
? React.createElement("span", { style: { fontSize: 12, fontWeight: 700, color: T.green } },
"✓ Client ",
p.newClientId,
" ",
React.createElement("span", { style: { color: T.inkSoft, fontWeight: 500 } }, "· voir Clients"))
: approved
? React.createElement(EnterBankButton, { onClick: () => openCheck(p) })
: React.createElement("span", { style: { fontSize: 11.5, color: T.inkSoft } }, "En attente du 1er KYC validé"))));
}))),
genProspect && React.createElement(DocGenUploadModal, { structId: prospectStructId(genProspect.type), title: genProspect.name, subtitle: genProspect.countryFlag + " KYC " + genProspect.firstKyc.code, onClose: () => setGenProspect(null) }),
createOpen && (React.createElement("div", { onClick: () => setCreateOpen(false), style: { position: "fixed", inset: 0, background: "rgba(20,26,14,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 340, padding: 20 } },
React.createElement("div", { onClick: e => e.stopPropagation(), style: { background: T.surface, borderRadius: 16, width: 520, maxWidth: "94vw", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 70px rgba(10,15,8,0.35)" } },
React.createElement("div", { style: { padding: "18px 22px", borderBottom: "1px solid " + T.line } },
React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: T.ink } }, "🌱 Nouveau prospect"),
React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, marginTop: 2 } }, "4 informations → scoring → aiguillage — identique au principe de création KYC.")),
React.createElement("div", { style: { padding: "16px 22px", display: "flex", flexDirection: "column", gap: 12 } },
React.createElement("div", null,
React.createElement("div", { style: lbl }, "Nom légal du prospect *"),
React.createElement("input", { value: npName, onChange: e => setNpName(e.target.value), placeholder: "ex. Riviera Asset Holding", style: inp })),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } },
React.createElement("div", null,
React.createElement("div", { style: lbl }, "Structure"),
React.createElement("select", { value: npStruct, onChange: e => setNpStruct(e.target.value), style: inp }, DOC_STRUCTURES.filter(function (st) { return st.active !== false; }).map(st => React.createElement("option", { key: st.id, value: st.id }, st.name)))),
React.createElement("div", null,
React.createElement("div", { style: lbl }, "Pays"),
React.createElement("select", { value: npCountry, onChange: e => setNpCountry(e.target.value), style: inp }, ONB_COUNTRIES.map(c => React.createElement("option", { key: c.code, value: c.code },
c.flag,
" ",
c.country))))),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } },
React.createElement("div", null,
React.createElement("div", { style: lbl }, "RM / ARM"),
React.createElement("select", { value: npRm, onChange: e => setNpRm(e.target.value), style: inp }, USERS.filter(u => u.role === "RM" || u.role === "ARM").map(u => React.createElement("option", { key: u.id, value: u.name },
u.name,
" (",
u.role,
")")))),
React.createElement("div", null,
React.createElement("div", { style: lbl }, "Segment"),
React.createElement("select", { value: npSegment, onChange: e => setNpSegment(e.target.value), style: inp }, ["Mass Affluent", "Affluent", "HNWI", "UHNWI"].map(s => React.createElement("option", { key: s, value: s }, s))))),
React.createElement("div", null,
React.createElement("div", { style: lbl }, "AUM estimé (optionnel)"),
React.createElement("input", { value: npAum, onChange: e => setNpAum(e.target.value), placeholder: "ex. 5.0M", style: inp })),
React.createElement("div", { style: { padding: "10px 12px", borderRadius: 10, background: npDdl === "EDD" ? T.redSoft : (npDdl === "CDD" ? T.amberSoft : T.greenSoft), fontSize: 11.5, color: T.inkMid } },
"Score calculé : ",
React.createElement("strong", null,
npEv.score,
"/100"),
" · Diligence ",
React.createElement("strong", null, npDdl),
React.createElement("div", { style: { marginTop: 7, paddingTop: 7, borderTop: "1px solid rgba(0,0,0,0.08)" } },
React.createElement(RiskFactorsList, { client: { name: npName || "—", type: npStruct, countryCode: npCountry, sector: "", aum: npAum, pep: false, uboName: "" }, max: 4, compact: true })))),
React.createElement("div", { style: { padding: "14px 22px", borderTop: "1px solid " + T.line, display: "flex", gap: 10, justifyContent: "flex-end" } },
React.createElement("button", { onClick: () => setCreateOpen(false), style: { padding: "9px 16px", borderRadius: 9, border: "1px solid " + T.line, background: T.surface, color: T.inkMid, fontSize: 12.5, cursor: "pointer" } }, "Annuler"),
React.createElement("button", { onClick: createProspect, disabled: !npName.trim(), style: { padding: "9px 18px", borderRadius: 9, border: "none", background: npName.trim() ? T.olive600 : T.line, color: npName.trim() ? "#fff" : T.inkSoft, fontSize: 12.5, fontWeight: 800, cursor: npName.trim() ? "pointer" : "not-allowed" } }, "Créer le prospect →"))))),
cardOpen && selProspect && (React.createElement("div", { onClick: () => setCardOpen(false), style: { position: "fixed", inset: 0, background: "rgba(10,15,8,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9200, padding: 20 } },
React.createElement("div", { onClick: e => e.stopPropagation(), style: { background: T.cream, borderRadius: 18, width: 920, maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto", padding: 24, boxShadow: "0 24px 70px rgba(10,15,8,0.35)" } },
React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: -8 } },
React.createElement("button", { onClick: () => setCardOpen(false), style: { border: "none", background: "transparent", fontSize: 20, color: T.inkSoft, cursor: "pointer" } }, "✕")),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 340px", gap: 18 } },
React.createElement("div", { style: { background: T.surface, borderRadius: 14, padding: 24, border: `1px solid ${T.line}` } }, selProspect ? (React.createElement(React.Fragment, null,
React.createElement(SectionTitle, null,
"Parcours d'onboarding — ",
selProspect.countryFlag,
" ",
selProspect.name),
React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 } },
React.createElement("span", { style: { fontSize: 10.5, fontFamily: "monospace", fontWeight: 700, color: T.olive700, background: T.oliveSoft, padding: "4px 10px", borderRadius: 8, whiteSpace: "nowrap" } }, selProspect.firstKyc.code),
React.createElement("span", { style: { fontSize: 10.5, color: T.inkMid, background: T.lineSoft, padding: "4px 10px", borderRadius: 8, whiteSpace: "nowrap" } },
"RM ",
selProspect.rm),
React.createElement("span", { style: { fontSize: 10.5, color: T.inkMid, background: T.lineSoft, padding: "4px 10px", borderRadius: 8, whiteSpace: "nowrap" } },
selProspect.typeLabel,
" · ",
selProspect.aum),
React.createElement("span", { style: { fontSize: 10.5, fontWeight: 700, color: selProspect.firstKyc.status === "APPROVED" ? T.green : T.amber, background: selProspect.firstKyc.status === "APPROVED" ? T.greenSoft : T.amberSoft, padding: "4px 10px", borderRadius: 8, whiteSpace: "nowrap" } }, selProspect.firstKyc.status)),
curStep === 0 && React.createElement("div", { style: { marginTop: 12, padding: "12px 14px", borderRadius: 10, background: T.redSoft, border: `1px solid ${T.red}44`, color: T.red, fontSize: 12.5, fontWeight: 600 } }, "✕ KYC rejeté — dossier clos, aucune action d'onboarding en cours pour ce prospect."),
React.createElement("div", { style: { marginTop: 10 } }, steps.map((s, i) => {
const col = s.state === "done" ? T.leaf : s.state === "current" ? T.gold : T.inkSoft;
const filled = s.state !== "pending";
const last = i === steps.length - 1;
const leftSide = i % 2 === 0;
const leafScale = i === 0 ? 0.62 : 0.82;
const lrot = leftSide ? -50 : 50;
const delay = i * 0.4;
const ROW_H = 96; // hauteur d'une ligne
const CY = 30; // y de la pastille dans le SVG
return (React.createElement("div", { key: s.n, style: { display: "flex", gap: 16, position: "relative" } },
!last && React.createElement("div", { style: { position: "absolute", left: 30.75, top: CY, bottom: -CY, width: 2.5, background: s.state === "done" ? T.leaf : "#6B5838", opacity: s.state === "done" ? 1 : 0.5, borderRadius: 2, transformOrigin: "top", animation: `branchDraw 0.8s ease ${delay + 0.2}s both`, zIndex: 0 } }),
React.createElement("div", { style: { width: 64, flexShrink: 0, position: "relative", zIndex: 1 } },
React.createElement("svg", { width: "64", height: last ? CY + 16 : ROW_H, viewBox: `0 0 64 ${last ? CY + 16 : ROW_H}`, style: { overflow: "visible", display: "block" } },
s.state === "current" && React.createElement("ellipse", { cx: leftSide ? 14 : 50, cy: CY - 14, rx: 9, ry: 16, fill: col, opacity: "0.16" },
React.createElement("animate", { attributeName: "opacity", values: "0.16;0.04;0.16", dur: "2.4s", repeatCount: "indefinite" })),
React.createElement("g", { style: { transformOrigin: `32px ${CY}px`,
animation: grown ? `oliveGrow 1.1s cubic-bezier(.34,1.4,.5,1) ${delay}s both` : "none",
transform: grown ? undefined : "scale(0)" } },
React.createElement("line", { x1: "32", y1: CY, x2: leftSide ? 24 : 40, y2: CY - 6, stroke: "#6B5838", strokeWidth: "1.6", opacity: "0.7" }),
React.createElement("g", { transform: `translate(${leftSide ? 24 : 40} ${CY - 6}) rotate(${lrot}) scale(${leafScale})` },
React.createElement("path", { d: "M 0 0 C 11 -6, 11 -34, 0 -42 C -11 -34, -11 -6, 0 0 Z", fill: filled ? col : T.surface, stroke: col, strokeWidth: filled ? 0 : 1.8, opacity: filled ? 1 : 0.7 }),
React.createElement("line", { x1: "0", y1: "0", x2: "0", y2: "-42", stroke: filled ? "#fff" : col, strokeWidth: "1.1", opacity: "0.5" }),
React.createElement("line", { x1: "0", y1: "-16", x2: "6.5", y2: "-10", stroke: filled ? "#fff" : col, strokeWidth: "0.8", opacity: "0.4" }),
React.createElement("line", { x1: "0", y1: "-16", x2: "-6.5", y2: "-10", stroke: filled ? "#fff" : col, strokeWidth: "0.8", opacity: "0.4" }),
React.createElement("line", { x1: "0", y1: "-28", x2: "5.5", y2: "-22", stroke: filled ? "#fff" : col, strokeWidth: "0.8", opacity: "0.4" }),
React.createElement("line", { x1: "0", y1: "-28", x2: "-5.5", y2: "-22", stroke: filled ? "#fff" : col, strokeWidth: "0.8", opacity: "0.4" }))),
React.createElement("circle", { cx: "32", cy: CY, r: "6.5", fill: T.surface, stroke: col, strokeWidth: "2" }),
React.createElement("text", { x: "32", y: CY + 3, textAnchor: "middle", fontSize: "8.5", fontWeight: "700", fill: col }, s.state === "done" ? "✓" : s.n))),
React.createElement("div", { style: { flex: 1, paddingTop: CY - 22, paddingBottom: last ? 0 : 18, animation: `fadeUp 0.5s ease ${delay + 0.3}s both` } },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
React.createElement("span", { style: { fontSize: 14, fontWeight: 700, color: s.state === "pending" ? T.inkSoft : T.ink } }, s.label),
s.state === "current" && React.createElement(Badge, { text: "EN COURS", color: T.gold, bg: T.amberSoft })),
React.createElement("div", { style: { fontSize: 12, color: T.inkSoft, marginTop: 3 } }, s.desc))));
})))) : (React.createElement("div", { style: { padding: "40px 20px", textAlign: "center", color: T.inkSoft, fontSize: 13 } }, "Sélectionnez un prospect dans la liste ci-dessus pour voir son parcours."))),
React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
React.createElement("div", { style: { background: `linear-gradient(135deg,${T.olive700},${T.olive500})`, borderRadius: 14, padding: 20, color: "#fff" } },
React.createElement("div", { style: { fontSize: 11, opacity: 0.85, marginBottom: 6 } }, "Progression globale"),
React.createElement("div", { style: { fontSize: 32, fontWeight: 800 } },
selProspect ? progressPct : 0,
"%"),
React.createElement("div", { style: { height: 8, background: "rgba(255,255,255,0.25)", borderRadius: 4, marginTop: 10, overflow: "hidden" } },
React.createElement("div", { style: { height: "100%", width: (selProspect ? progressPct : 0) + "%", background: "#fff", borderRadius: 4 } })),
React.createElement("div", { style: { fontSize: 12, opacity: 0.85, marginTop: 10 } }, selProspect ? (curStep === 7 ? "Relation active" : (curStep === 0 ? "Dossier rejeté" : "Étape " + curStep + " sur 6 · " + STEP_DEFS[curStep - 1].label)) : "—")),
React.createElement("div", { style: { background: T.amberSoft, borderRadius: 14, padding: 18, border: `1px solid ${T.amber}33` } },
React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 6 } }, "⏱ SLA réglementaire"),
React.createElement("div", { style: { fontSize: 12, color: T.inkMid, lineHeight: 1.6 } }, selProspect
? React.createElement(React.Fragment, null,
"Identification à finaliser sous ",
React.createElement("strong", null, "8 jours"),
" (délai FINMA). ",
slaDaysLeft > 0 ? React.createElement(React.Fragment, null,
React.createElement("strong", null,
slaDaysLeft,
" jour(s)"),
" restant(s).") : React.createElement("span", { style: { color: T.red, fontWeight: 700 } }, "Délai dépassé."))
: "Sélectionnez un prospect."))))))),
openProspect && (React.createElement("div", { onClick: () => setOpenProspect(null), style: { position: "fixed", inset: 0, background: "rgba(10,15,8,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000, padding: 20 } },
React.createElement("div", { onClick: e => e.stopPropagation(), style: { background: T.surface, borderRadius: 16, width: 560, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.3)", border: `1px solid ${T.line}` } },
React.createElement("div", { style: { padding: "20px 24px 14px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 } },
React.createElement("div", null,
React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: T.olive700, textTransform: "uppercase", letterSpacing: 1 } }, "Entrée en relation · documents d'ouverture"),
React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: T.ink, marginTop: 4 } },
openProspect.countryFlag,
" ",
openProspect.name),
React.createElement("div", { style: { fontSize: 12, color: T.inkSoft, marginTop: 2 } },
openProspect.id,
" · 1er KYC ",
React.createElement("b", { style: { color: T.green } }, "validé"),
" · Formulaire CDB ",
openProspect.cdbForm)),
React.createElement("button", { onClick: () => setOpenProspect(null), style: { border: "none", background: "none", fontSize: 20, color: T.inkSoft, cursor: "pointer", lineHeight: 1 } }, "×")),
React.createElement("div", { style: { padding: "16px 24px" } },
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0 14px", alignItems: "center", fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, paddingBottom: 8, borderBottom: `1px solid ${T.line}` } },
React.createElement("span", null, "Document"),
React.createElement("span", null, "Présent"),
React.createElement("span", null, "Signé")),
docDraft.map((d, i) => {
const ok = d.present && d.signed;
const Toggle = ({ on, onClick, label }) => (React.createElement("button", { onClick: onClick, style: { width: 30, height: 24, borderRadius: 7, border: `1.5px solid ${on ? T.green : T.red}`, background: on ? T.greenSoft : T.redSoft, color: on ? T.green : T.red, fontSize: 13, fontWeight: 800, cursor: "pointer" }, title: label }, on ? "✓" : "✕"));
return (React.createElement("div", { key: i, style: { display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0 14px", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement("span", { style: { fontSize: 13, color: ok ? T.ink : T.inkMid, fontWeight: ok ? 500 : 600 } }, d.label),
React.createElement(Toggle, { on: d.present, label: "Présent", onClick: () => setDocDraft(s => s.map((x, j) => j === i ? { ...x, present: !x.present } : x)) }),
React.createElement(Toggle, { on: d.signed, label: "Signé", onClick: () => setDocDraft(s => s.map((x, j) => j === i ? { ...x, signed: !x.signed } : x)) })));
}),
React.createElement("div", { style: { marginTop: 14, padding: "10px 12px", borderRadius: 9, background: allOk ? T.greenSoft : T.amberSoft, border: `1px solid ${allOk ? T.green + "44" : T.amber + "44"}`, fontSize: 12, color: allOk ? T.olive700 : T.ink, display: "flex", alignItems: "center", gap: 8 } }, allOk ? React.createElement("span", null, "✓ Tous les documents sont présents et signés. Le prospect peut devenir client.")
: React.createElement("span", null,
"⚠ ",
missing,
" document(s) incomplet(s) — présence et signature requises avant l'entrée en relation.")),
React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, marginTop: 10, lineHeight: 1.5 } }, "Quatre yeux : la création du client matérialise la propagation au golden record après KYC validé. Action tracée et horodatée.")),
React.createElement("div", { style: { padding: "14px 24px 20px", borderTop: `1px solid ${T.line}`, display: "flex", justifyContent: "flex-end", gap: 10 } },
React.createElement("button", { onClick: () => setOpenProspect(null), style: { padding: "10px 16px", borderRadius: 9, border: `1px solid ${T.line}`, background: T.surface, color: T.inkMid, fontSize: 13, fontWeight: 600, cursor: "pointer" } }, "Annuler"),
onOpenKyc && React.createElement("button", { onClick: () => { onOpenKyc(openProspect); }, style: { padding: "10px 16px", borderRadius: 9, border: "1px solid " + T.olive600, background: T.surface, color: T.olive700, fontSize: 13, fontWeight: 700, cursor: "pointer" } }, "→ Ouvrir le KYC V1"),
React.createElement("button", { disabled: !allOk, onClick: () => { onEnter(openProspect); setOpenProspect(null); }, style: { padding: "10px 18px", borderRadius: 9, border: "none", background: allOk ? T.olive600 : T.line, color: allOk ? "#fff" : T.inkSoft, fontSize: 13, fontWeight: 700, cursor: allOk ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", gap: 8 } }, "Valider le prospect → client →")))))));
}
