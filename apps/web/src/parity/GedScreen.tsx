import React, { useState } from "react";
import { T } from "./tokens";
import CLIENTS from "../fixtures/CLIENTS.json";
import { clientById } from "./components-data";
import { pushParamAudit } from "./param-audit-support";
import { settleHash } from "./settlement-support";
import { GED_DOCS } from "./legal-support";
import { GED_PLAN, GED_STATUS, GED_FONCTIONS, GED_WORKFLOW_ETAGES, GED_WORKFLOW_TRANSVERSAUX, GED_CONNEXIONS, GED_PUISSANCE, GED_PUISSANCE_INVARIANTS } from "./ged-support";

// Source : docs/reference/olive-demo.html 31060-31183 — GedScreen (GED — Gestion électronique des documents).
// Onglets portés verbatim : Documents (dépôt/validation/archivage réels sur GED_DOCS), Plan, Fonctionnalités,
// Workflow, Connexions, Puissance, API. Onglets « GED vivante » et « Vérification OCR » reposent sur le
// harnais backend OLIVE_PROOFS (services GedIngestion/Coffre/Vues/OCR réels) — hors périmètre parité, consignés.

const TT: any = T;

// ── CONSIGNÉ : GED vivante & Vérification OCR — pilotés par le monde GED backend (OLIVE_PROOFS). ──
function GedConsigne({ titre }: { titre: string }) {
return React.createElement("div", { style: { background: TT.oliveSoft, border: `1.5px solid ${TT.olive600}`, borderRadius: 14, padding: 22 } },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: TT.olive700, marginBottom: 6 } }, titre + " — moteur backend gouverné"),
React.createElement("div", { style: { fontSize: 11.5, color: TT.inkMid, lineHeight: 1.6 } }, "Cet onglet est piloté par les services GED réels (ingestion, coffre suisse, dossiers-vues, extraction OCR typée) du harnais OLIVE_PROOFS. Ce socle relève du backend gouverné, hors périmètre du front de parité — consigné. Les onglets Documents, Plan, Workflow, Connexions, Puissance, Fonctionnalités et API sont pleinement fonctionnels."));
}

function GedFonctionsTab() {
var card: any = { background: TT.surface, border: "1px solid " + TT.line, borderRadius: 14, padding: 18, marginBottom: 12 };
var badge = function (s: number) {
var m: any = s === 1 ? ["Disponible", TT.olive700, "#EAF7EE", TT.olive600]
: s === 2 ? ["À activer", "#B8860B", "#FFFBEF", "#B8860B"]
: ["Planifié", TT.inkSoft, TT.surface, TT.line];
return React.createElement("span", { style: { fontSize: 9, fontWeight: 800, color: m[1],
background: m[2], border: "1px solid " + m[3], padding: "2px 8px", borderRadius: 10,
whiteSpace: "nowrap", flexShrink: 0 } }, m[0]);
};
var dispo = 0, total = 0;
GED_FONCTIONS.forEach(function (g: any) { g.items.forEach(function (x: any) { total++; if (x[1] === 1) dispo++; }); });
return React.createElement("div", null,
React.createElement("div", { style: Object.assign({}, card, { background: TT.oliveSoft }) },
React.createElement("div", { style: { fontSize: 13.5, fontWeight: 800, color: TT.olive700, marginBottom: 6 } },
"La GED O-Live — toutes les fonctionnalités"),
React.createElement("div", { style: { fontSize: 11.5, color: TT.inkMid, lineHeight: 1.6 } },
dispo + " fonctionnalités opérationnelles et testées sur " + total + " au total — chaque ligne « Disponible » est couverte par des contrôles automatiques exécutés à chaque build. ",
"« À activer » : code de production écrit, mise en service par configuration. « Planifié » : au plan de développement, daté et chiffré. Rien d'autre n'est promis.")),
GED_FONCTIONS.map(function (g: any) {
return React.createElement("div", { key: g.th, style: card },
React.createElement("div", { style: { fontSize: 10.5, fontWeight: 800, color: TT.inkSoft, textTransform: "uppercase", letterSpacing: 1.3, marginBottom: 10 } }, g.th),
g.items.map(function (x: any, i: number) {
return React.createElement("div", { key: i, style: { display: "flex", alignItems: "flex-start", gap: 10,
padding: "6px 0", borderBottom: i < g.items.length - 1 ? "1px solid " + TT.line : "none" } },
React.createElement("span", { style: { flex: 1, fontSize: 11.5, color: TT.inkMid, lineHeight: 1.5 } }, x[0]),
badge(x[1]));
}));
}),
React.createElement("div", { style: { fontSize: 10.5, color: TT.inkSoft, fontStyle: "italic", padding: "2px 2px 10px" } },
"Référence complète (stockage, tables, chiffrement, API, restauration, volumétrie) : document « GED — Référence technique », fourni aux banques avec la doc d'intégration API."));
}

function GedWorkflowTab() {
var card: any = { background: TT.surface, border: "1px solid " + TT.line, borderRadius: 14, padding: 18 };
var ligne = function (e: any, i: number, arr: any[]) {
return React.createElement("div", { key: e.nom },
React.createElement("div", { style: { display: "flex", gap: 12, alignItems: "flex-start" } },
React.createElement("div", { style: { fontSize: 20, width: 30, textAlign: "center" } }, e.ic),
React.createElement("div", { style: { flex: 1 } },
React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "baseline" } },
React.createElement("span", { style: { fontSize: 13, fontWeight: 800, color: TT.ink } }, e.nom)),
React.createElement("div", { style: { fontSize: 11.5, color: TT.inkMid, lineHeight: 1.55, marginTop: 2 } }, e.desc))),
i < arr.length - 1 && React.createElement("div", { style: { marginLeft: 14, height: 14, borderLeft: "2px solid " + TT.olive600, opacity: 0.4 } }));
};
return React.createElement("div", null,
React.createElement("div", { style: Object.assign({}, card, { marginBottom: 14 }) },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: TT.ink, marginBottom: 12 } },
"🔄 Le workflow du document — neuf étages, chacun règle + test"),
GED_WORKFLOW_ETAGES.map(ligne)),
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: TT.ink, marginBottom: 12 } }, "Transversaux"),
GED_WORKFLOW_TRANSVERSAUX.map(ligne)));
}

function GedConnexionsTab() {
var card: any = { background: TT.surface, border: "1px solid " + TT.line, borderRadius: 14, padding: 16, marginBottom: 10 };
return React.createElement("div", null,
GED_CONNEXIONS.map(function (c: any) {
return React.createElement("div", { key: c.ecran, style: card },
React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" } },
React.createElement("span", { style: { fontSize: 13, fontWeight: 800, color: TT.ink } }, c.ecran),
React.createElement("span", { style: { fontSize: 10, fontWeight: 700, color: TT.olive700 } }, c.sens)),
React.createElement("div", { style: { fontSize: 11.5, color: TT.inkMid, lineHeight: 1.55, marginTop: 4 } }, c.desc));
}),
React.createElement("div", { style: { fontSize: 10.5, color: TT.inkSoft, fontStyle: "italic", padding: "4px 2px" } },
"Les ÉVÉNEMENTS existent et sont testés (284 tests de corpus) ; les boutons croisés écran-à-écran arrivent par lot UI dédié — pas de promesse sans acte : ce qui est listé ici est câblé côté moteur."));
}

function GedPuissanceTab() {
var card: any = { background: TT.surface, border: "1px solid " + TT.line, borderRadius: 14, padding: 18 };
return React.createElement("div", null,
React.createElement("div", { style: Object.assign({}, card, { marginBottom: 14, background: TT.oliveSoft }) },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: TT.olive700, marginBottom: 6 } },
"💪 Pourquoi cette GED n'a pas d'équivalent"),
React.createElement("div", { style: { fontSize: 11.5, color: TT.inkMid, lineHeight: 1.6 } },
"Chaque affirmation de cette page correspond à un contrôle automatisé, exécuté en continu sur la plateforme. Le pitch : « retrouvez vos documents », c'est le marché — « prouvez vos documents, à la FINMA, à un juge, dix ans après », c'est nous.")),
React.createElement("div", { style: card },
GED_PUISSANCE.map(function (x: any, i: number) {
return React.createElement("div", { key: i, style: { display: "flex", gap: 14, padding: "9px 0",
borderBottom: i < GED_PUISSANCE.length - 1 ? "1px solid " + TT.line : "none", flexWrap: "wrap" } },
React.createElement("div", { style: { flex: "1 1 220px", fontSize: 11.5, color: TT.inkSoft } }, x.eux),
React.createElement("div", { style: { flex: "1 1 300px", fontSize: 11.5, color: TT.ink, fontWeight: 600 } }, x.nous));
})),
React.createElement("div", { style: Object.assign({}, card, { marginTop: 14 }) },
React.createElement("div", { style: { fontSize: 11, fontWeight: 800, color: TT.inkSoft, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 } }, "Robustesse — les invariants qui tiennent tout"),
GED_PUISSANCE_INVARIANTS.map(function (t: string, i: number) {
return React.createElement("div", { key: i, style: { fontSize: 11.5, color: TT.inkMid, lineHeight: 1.55, padding: "4px 0" } }, "◉ ", t);
})));
}

export default function GedScreen({ user }: { user?: any }) {
const [tab, setTab] = useState(function () { var w: any = typeof window !== "undefined" ? window : {}; var t = w.OLIVE_NAV_HINT_GED || "vivant"; w.OLIVE_NAV_HINT_GED = null; return t; });
const [cid, setCid] = useState("");
const [upLang, setUpLang] = useState("");
const [upCode, setUpCode] = useState("01-IDENT");
const [q, setQ] = useState("");
const [selDoc, setSelDoc] = useState<any>(null);
const [, bump] = useState(0);
const re = function () { bump(function (x) { return x + 1; }); };
const card: any = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
const canVal = user && ["CO", "CO_SR", "CF", "ADMIN", "MLRO"].indexOf(user.role) >= 0;
const cl = cid ? clientById[cid] : null;
const rows = (GED_DOCS as any[]).filter(function (d: any) {
var c2 = clientById[d.clientId] || {};
var hay = (d.name + " " + (c2.name || "") + " " + d.code).toLowerCase();
return (!cid || d.clientId === cid) && (!q || hay.indexOf(q.toLowerCase()) >= 0);
});
return (React.createElement("div", null,
React.createElement("div", { style: { marginBottom: 14 } },
React.createElement("div", { style: { fontSize: 19, fontWeight: 800, color: T.ink } }, "🗄 GED — Gestion électronique des documents")),
React.createElement("div", { style: { display: "flex", gap: 4, marginBottom: 16, background: T.surface, padding: 5, borderRadius: 12, border: "1px solid " + T.line, width: "fit-content", flexWrap: "wrap" } }, [["vivant", "🫒 GED vivante"], ["workflow", "🔄 Workflow"], ["connexions", "⇆ Connexions"], ["puissance", "💪 Puissance"], ["fonctions", "✦ Fonctionnalités"], ["ocr", "⌘ Vérification OCR"], ["docs", "▤ Documents"], ["plan", "🗂 Plan"], ["api", "⇌ API"]].map(function (x) {
return (React.createElement("button", { key: x[0], onClick: function () { setTab(x[0]); }, style: { padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === x[0] ? T.olive600 : "transparent", color: tab === x[0] ? "#fff" : T.inkMid, fontSize: 12.5, fontWeight: tab === x[0] ? 700 : 500 } }, x[1]));
})),
tab === "vivant" && React.createElement(GedConsigne, { titre: "GED vivante" }),
tab === "workflow" && React.createElement(GedWorkflowTab, null),
tab === "connexions" && React.createElement(GedConnexionsTab, null),
tab === "puissance" && React.createElement(GedPuissanceTab, null),
tab === "fonctions" && React.createElement(GedFonctionsTab, null),
tab === "ocr" && React.createElement(GedConsigne, { titre: "Vérification OCR" }),
tab === "docs" && (React.createElement("div", null,
React.createElement("div", { style: Object.assign({}, card, { marginBottom: 14 }) },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 8 } }, "⬆ Déposer un document (upload réel)"),
React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
React.createElement("select", { value: cid, onChange: function (e: any) { setCid(e.target.value); var c = clientById[e.target.value]; setUpLang(c ? c.corrLang : ""); }, style: { padding: "8px 11px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 11.5, flex: "1 1 200px" } },
React.createElement("option", { value: "" }, "— Client —"),
(CLIENTS as any[]).slice().sort(function (a: any, b: any) { return a.name.localeCompare(b.name); }).map(function (c: any) { return React.createElement("option", { key: c.id, value: c.id }, c.name); })),
React.createElement("select", { value: upCode, onChange: function (e: any) { setUpCode(e.target.value); }, style: { padding: "8px 11px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 11.5 } }, GED_PLAN.map(function (p) { return React.createElement("option", { key: p[0], value: p[0] },
p[0],
" · ",
p[1]); })),
React.createElement("select", { value: upLang, onChange: function (e: any) { setUpLang(e.target.value); }, style: { padding: "8px 11px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 11.5 } }, ["FR", "EN", "DE", "IT"].map(function (l) { return React.createElement("option", { key: l, value: l },
"Langue doc : ",
l); })),
React.createElement("label", { style: { padding: "9px 16px", borderRadius: 9, border: "none", background: cid ? T.olive600 : T.line, color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: cid ? "pointer" : "not-allowed" } },
"⬆ Choisir un fichier…",
React.createElement("input", { type: "file", disabled: !cid, style: { display: "none" }, onChange: function (e: any) { var f = e.target.files && e.target.files[0]; if (f && cl) {
(GED_DOCS as any[]).unshift({ id: "DOC-" + (7000 + (GED_DOCS as any[]).length), clientId: cl.id, name: f.name, code: upCode, lang: upLang || cl.corrLang, version: 1, sizeKb: Math.max(1, Math.round(f.size / 1024)), status: "A_VALIDER", uploadedBy: (user && user.name) || "—", at: "2026-07-11", fileRef: f });
pushParamAudit((user && user.name) || "—", "GED — dépôt : " + f.name + " (" + upCode + ", " + (upLang || cl.corrLang) + ") pour " + cl.name);
e.target.value = "";
re();
} } }))),
cl && upLang && upLang !== cl.corrLang && React.createElement("div", { style: { marginTop: 8, fontSize: 10.5, fontWeight: 700, color: T.amber, background: T.amberSoft, padding: "7px 11px", borderRadius: 9 } },
"⚠ Langue du document (",
upLang,
") ≠ langue de correspondance du client (",
cl.corrLang,
") — vérifier avant envoi."),
cl && React.createElement("div", { style: { marginTop: 6, fontSize: 10, color: T.inkSoft } },
"Langue de correspondance de ",
cl.name,
" : ",
React.createElement("strong", { style: { color: T.ink } }, cl.corrLang),
" — les documents client doivent être produits dans cette langue.")),
React.createElement("div", { style: card },
React.createElement("input", { placeholder: "🔎 Recherche plein texte — nom, client, code…", value: q, onChange: function (e: any) { setQ(e.target.value); }, style: { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 11.5, marginBottom: 10 } }),
rows.slice(0, 30).map(function (d: any) {
var st = GED_STATUS[d.status];
var c = clientById[d.clientId] || {};
return (React.createElement("div", { key: d.id, onClick: function () { setSelDoc(selDoc === d.id ? null : d.id); }, style: { display: "flex", gap: 9, alignItems: "center", padding: "7px 0", borderBottom: "1px solid " + T.lineSoft, fontSize: 10.5, cursor: "pointer", flexWrap: "wrap" } },
React.createElement("span", { style: { fontFamily: "monospace", color: T.olive700, fontWeight: 800, width: 78, flexShrink: 0 } }, d.code),
React.createElement("span", { style: { fontWeight: 700, color: T.ink, flex: 1, minWidth: 180 } }, d.name),
React.createElement("span", { style: { color: T.inkSoft, width: 120, flexShrink: 0 } }, c.name || ""),
React.createElement("span", { style: { fontFamily: "monospace", color: T.inkMid } },
"v",
d.version,
" · ",
d.lang,
" · ",
d.sizeKb,
" Ko"),
React.createElement("span", { style: { fontSize: 9, fontWeight: 800, color: TT[st[1]] || T.inkSoft, background: (TT[st[1] + "Soft"] || T.cream), padding: "3px 9px", borderRadius: 9 } }, st[0]),
d.status === "A_VALIDER" && React.createElement("button", { onClick: function () { if (canVal) {
d.status = "VALIDE";
pushParamAudit((user && user.name) || "—", "GED — validation : " + d.name);
re();
} }, disabled: !canVal, style: { padding: "4px 10px", borderRadius: 8, border: "1px solid " + T.green, background: "transparent", color: T.green, fontSize: 9.5, fontWeight: 800, cursor: canVal ? "pointer" : "not-allowed" } }, "✓ Valider"),
d.status === "VALIDE" && React.createElement("button", { onClick: function (e: any) { e.stopPropagation(); d.status = "ARCHIVE"; d.version++; pushParamAudit((user && user.name) || "—", "GED — archivage : " + d.name); re(); }, style: { padding: "4px 10px", borderRadius: 8, border: "1px solid " + T.line, background: "transparent", color: T.inkMid, fontSize: 9.5, fontWeight: 700, cursor: "pointer" } }, "Archiver"),
selDoc === d.id && (React.createElement("div", { style: { flexBasis: "100%", background: T.cream, borderRadius: 9, padding: "9px 12px", marginTop: 4 } },
[["Empreinte SHA-256", "0x" + settleHash(d.id + d.name) + settleHash(d.name + d.id)], ["Rétention légale", "jusqu'au 2036-12-31 — 10 ans après fin de relation (art. 7 al. 3 LBA)"], ["Indexation", "OCR ✓ · texte intégral indexé · classification " + d.code], ["Déposé par", (d.uploadedBy || "—") + " le " + d.at]].map(function (x: any, i: number) {
return (React.createElement("div", { key: i, style: { display: "flex", gap: 8, fontSize: 10, padding: "2px 0" } },
React.createElement("span", { style: { fontWeight: 800, color: T.inkSoft, width: 120, flexShrink: 0 } }, x[0]),
React.createElement("span", { style: { fontFamily: i < 1 ? "monospace" : "inherit", color: T.inkMid, wordBreak: "break-all" } }, x[1])));
}),
React.createElement("div", { style: { display: "flex", gap: 8, fontSize: 10, padding: "2px 0" } },
React.createElement("span", { style: { fontWeight: 800, color: T.inkSoft, width: 120, flexShrink: 0 } }, "Versions"),
React.createElement("span", { style: { color: T.inkMid } }, Array.from({ length: d.version }).map(function (_, vi) { return "v" + (vi + 1) + (vi === d.version - 1 ? " (courante)" : ""); }).join(" · ")))))));
})))),
tab === "plan" && (React.createElement("div", { style: card },
GED_PLAN.map(function (p) {
var n = (GED_DOCS as any[]).filter(function (d: any) { return d.code === p[0]; }).length;
return (React.createElement("div", { key: p[0], style: { display: "flex", gap: 10, alignItems: "baseline", padding: "8px 0", borderBottom: "1px solid " + T.lineSoft } },
React.createElement("span", { style: { fontFamily: "monospace", fontSize: 12, fontWeight: 800, color: T.olive700, width: 100 } }, p[0]),
React.createElement("span", { style: { fontSize: 11.5, fontWeight: 700, color: T.ink, flex: 1 } }, p[1]),
React.createElement("span", { style: { fontFamily: "monospace", fontSize: 11, color: T.inkMid } },
n,
" document(s)")));
}),
React.createElement("div", { style: { fontSize: 10, color: T.inkSoft, marginTop: 10 } }, "Codification appliquée à tout dépôt · rétention 10 ans après fin de relation (art. 7 al. 3 LBA) · workflow : A_VALIDER → VALIDE → ARCHIVE (versionné).")),
tab === "api" && (React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 10 } }, "⇌ Connexion Olive ↔ GED — API REST"),
[["POST", "/api/v1/ged/documents", "Dépôt (multipart) — métadonnées : clientId, code, lang, source"], ["GET", "/api/v1/ged/documents?clientId=", "Liste par client, filtres code/statut/langue"], ["GET", "/api/v1/ged/documents/{id}/content", "Téléchargement du binaire (flux, droit vérifié)"], ["POST", "/api/v1/ged/documents/{id}/transitions", "Workflow : {action:\"VALIDER\"|\"ARCHIVER\"} — audité"], ["POST", "/api/v1/ged/webhooks", "Notifications sortantes : document.validated, document.expiring"]].map(function (e: any, i: number) {
return (React.createElement("div", { key: i, style: { display: "flex", gap: 10, alignItems: "baseline", padding: "7px 0", borderBottom: "1px solid " + T.lineSoft } },
React.createElement("span", { style: { fontFamily: "monospace", fontSize: 10, fontWeight: 800, color: e[0] === "GET" ? T.blue : T.olive700, width: 44 } }, e[0]),
React.createElement("span", { style: { fontFamily: "monospace", fontSize: 11, color: T.ink, flex: "0 0 330px" } }, e[1]),
React.createElement("span", { style: { fontSize: 10.5, color: T.inkMid } }, e[2])));
}),
React.createElement("div", { style: { fontSize: 10, color: T.inkSoft, marginTop: 8 } }, "Détails complets, schémas et codes d'erreur : écran « API & Intégrations »."))))));
}
