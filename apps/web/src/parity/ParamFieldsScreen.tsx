import React, { useState } from "react";
import { T } from "./tokens";
import { wfCarte, wfBouton } from "./wf-styles";
import { pushParamAudit } from "./param-audit-support";
import { WF_KYC_SECTIONS_PARAM, WF_AR_SECTIONS_PARAM, WF_GAR_SECTIONS_PARAM, wfChamps, WF_MODES } from "./section-designer-support";

// Source : docs/reference/olive-demo.html 24775-24832 — ParamFieldsScreen (Paramétrage → Champs & droits).
// Par champ de chaque section : Désactivé / Lecture / Lecture & écriture, appliqué immédiatement (aperçu vivant), journalisé. Porté verbatim.

export default function ParamFieldsScreen() {
const [ctx, setCtx] = useState("KYC");
const [code, setCode] = useState("IDENT");
const [nvChamp, setNvChamp] = useState("");
const [, force] = useState(0);
const re2 = () => force(x => x + 1);
const secs = ctx === "KYC" ? WF_KYC_SECTIONS_PARAM : (ctx === "AR" ? WF_AR_SECTIONS_PARAM : WF_GAR_SECTIONS_PARAM);
const sec = secs.find((s: any) => s.code === code) || secs[0];
const champs = wfChamps(ctx, sec.code);
return React.createElement("div", { style: { maxWidth: 1020 } },
React.createElement("div", { style: wfCarte },
React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: T.olive900, marginBottom: 4 } }, "Champs & droits par section"),
React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, marginBottom: 12 } }, "Chaque champ de chaque section : Désactivé, Lecture, ou Lecture & écriture — appliqué immédiatement (aperçu ci-dessous), journalisé."),
React.createElement("div", { style: { display: "flex", gap: 9, marginBottom: 14 } },
React.createElement("select", { value: ctx, onChange: (e: any) => {
setCtx(e.target.value);
const s2 = (e.target.value === "KYC" ? WF_KYC_SECTIONS_PARAM : e.target.value === "AR" ? WF_AR_SECTIONS_PARAM : WF_GAR_SECTIONS_PARAM);
setCode(s2[0].code);
}, style: { border: `1px solid ${T.sage}`, borderRadius: 6, padding: "6px 9px" } },
React.createElement("option", { value: "KYC" }, "KYC"),
React.createElement("option", { value: "AR" }, "Account Review"),
React.createElement("option", { value: "GAR" }, "Grouped AR")),
React.createElement("select", { value: sec.code, onChange: (e: any) => setCode(e.target.value), style: { border: `1px solid ${T.sage}`, borderRadius: 6, padding: "6px 9px", flex: 1 } }, secs.map((s: any) => React.createElement("option", { key: s.code, value: s.code }, s.label)))),
React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12.5 } },
React.createElement("thead", null,
React.createElement("tr", null, ["Champ", "Mode", "Obligatoire"].map(h => React.createElement("th", { key: h, style: { textAlign: "left", padding: "7px 9px", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", borderBottom: `1px solid ${T.line}` } }, h)))),
React.createElement("tbody", null, champs.map((f: any) => React.createElement("tr", { key: f.name },
React.createElement("td", { style: { padding: "7px 9px", borderBottom: `1px solid ${T.lineSoft}`, color: f.mode === "OFF" ? T.inkSoft : T.ink,
textDecoration: f.mode === "OFF" ? "line-through" : "none" } }, f.name),
React.createElement("td", { style: { padding: "7px 9px", borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement("div", { style: { display: "inline-flex", gap: 4 } }, WF_MODES.map(([m, l]: any) => React.createElement("button", { key: m, onClick: () => {
f.mode = m;
pushParamAudit("Admin", "Champ " + ctx + "/" + sec.code + "/" + f.name + " → " + l);
re2();
}, style: { padding: "4px 11px", borderRadius: 7, fontSize: 11, cursor: "pointer",
border: `1px solid ${f.mode === m ? T.olive600 : T.line}`,
background: f.mode === m ? (m === "OFF" ? T.redSoft : m === "READ" ? T.amberSoft : T.greenSoft) : T.surface,
color: f.mode === m ? (m === "OFF" ? T.red : m === "READ" ? T.amber : T.green) : T.inkMid,
fontWeight: f.mode === m ? 800 : 400 } }, l)))),
React.createElement("td", { style: { padding: "7px 9px", borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement("button", { disabled: f.mode === "OFF", onClick: () => {
f.required = !f.required;
pushParamAudit("Admin", "Champ " + ctx + "/" + sec.code + "/" + f.name + " → " + (f.required ? "obligatoire" : "facultatif") + " (paramétrage motivé, effet daté)");
re2();
}, title: f.mode === "OFF" ? "Un champ désactivé ne peut être obligatoire" : "Basculer obligatoire / facultatif", style: { padding: "4px 11px", borderRadius: 7, fontSize: 11, cursor: f.mode === "OFF" ? "not-allowed" : "pointer",
border: `1px solid ${f.required && f.mode !== "OFF" ? T.red : T.line}`,
background: f.required && f.mode !== "OFF" ? T.redSoft : T.surface,
color: f.mode === "OFF" ? T.inkSoft : (f.required ? T.red : T.inkMid),
opacity: f.mode === "OFF" ? 0.4 : 1, fontWeight: f.required ? 800 : 400 } }, f.required && f.mode !== "OFF" ? "✱ Obligatoire" : "Facultatif")))))),
React.createElement("div", { style: { display: "flex", gap: 9, marginTop: 12, alignItems: "center" } },
React.createElement("input", { value: nvChamp, onChange: (e: any) => setNvChamp(e.target.value), placeholder: "Nouveau champ pour cette section…", style: { flex: 1, padding: "8px 11px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12.5 } }),
React.createElement("button", { disabled: !nvChamp.trim(), style: wfBouton(nvChamp.trim() ? T.olive600 : T.line), onClick: () => {
champs.push({ name: nvChamp.trim(), mode: "RW" });
pushParamAudit("Admin", "Champ ajouté : " + ctx + "/" + sec.code + "/" + nvChamp.trim() + " (RW)");
setNvChamp("");
re2();
} }, "＋ Ajouter un champ"))),
React.createElement("div", { style: wfCarte },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: T.olive900, marginBottom: 10 } }, "Aperçu — la section telle que l'utilisateur la verra"),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } }, champs.filter((f: any) => f.mode !== "OFF").map((f: any) => React.createElement("div", { key: f.name },
React.createElement("div", { style: { fontSize: 10, color: T.inkSoft, marginBottom: 3 } },
f.name,
f.required ? React.createElement("span", { style: { color: T.red, fontWeight: 800 } }, " ✱") : "",
f.mode === "READ" ? " · lecture seule" : ""),
React.createElement("input", { defaultValue: "…", required: !!f.required, readOnly: f.mode === "READ", style: { width: "100%", padding: "7px 10px", borderRadius: 8,
boxSizing: "border-box", fontSize: 12, border: `1px solid ${f.required ? T.red : T.line}`,
background: f.mode === "READ" ? T.lineSoft : T.surface, color: f.mode === "READ" ? T.inkSoft : T.ink } })))),
champs.every((f: any) => f.mode === "OFF") && React.createElement("div", { style: { fontSize: 12, color: T.inkSoft } }, "Tous les champs sont désactivés — la section n'affiche rien.")),
React.createElement("div", { style: { ...wfCarte, background: T.oliveSoft, border: `1px solid ${T.olive600}` } },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.olive700, marginBottom: 6 } }, "Câblage back-end — paramètre gouverné (R-Q)"),
React.createElement("div", { style: { fontSize: 11, color: T.inkMid, lineHeight: 1.6, marginBottom: 8 } },
"Le caractère obligatoire d'un champ est un paramètre gouverné du registre R-Q : ",
React.createElement("code", { style: { fontSize: 10.5, color: T.olive900 } }, "champsObligatoiresParSection"),
". Chaque bascule est un acte ",
React.createElement("b", null, "motivé (R7)"),
", à effet daté (R29), ",
React.createElement("b", null, "append-only"),
" — écrit par ",
React.createElement("code", { style: { fontSize: 10.5, color: T.olive900 } }, "POST /parametres/valeur/champsObligatoiresParSection"),
". Un champ obligatoire manquant est un refus explicite au dépôt du dossier, jamais un blocage silencieux."),
React.createElement("div", { style: { fontSize: 10, color: T.inkSoft, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.4 } }, "Écriture courante pour cette section"),
React.createElement("pre", { style: { fontSize: 11, fontFamily: "monospace", color: T.ink, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 11px", margin: 0, overflowX: "auto" } },
JSON.stringify({ [ctx + "/" + sec.code]: champs.filter((f: any) => f.required && f.mode !== "OFF").map((f: any) => f.name) }, null, 2))));
}
