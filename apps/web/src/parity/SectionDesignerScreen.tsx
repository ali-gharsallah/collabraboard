import React, { useState } from "react";
import { T } from "./tokens";
import { wfCarte, wfBouton } from "./wf-styles";
import { pushParamAudit } from "./param-audit-support";
import { WF_KYC_SECTIONS_PARAM, WF_AR_SECTIONS_PARAM, WF_GAR_SECTIONS_PARAM, WF_SD_KINDS, wfChamps, sdEnsureAnatomy, WF_SD_KEYROLES, WF_KYC_ROLES, WF_SECTION_PHASES, WF_SECTION_RIGHTS, sdRights, sdToggleRight, WF_RIGHT_C } from "./section-designer-support";

// Source : docs/reference/olive-demo.html 24613-24735 — SectionDesignerScreen (Section Designer KYC/AR/GAR).
// Onglet « Sections & visas » porté verbatim (R78 : section = questionnaire + droits + owner + validateur +
// échange, motorisé par workflow ; réordonnancement drag&drop). L'onglet « Questionnaire Builder »
// (QuestionnaireBuilderScreen, DnD complet) est consigné neutrement — port ultérieur.

function QuestConsigne() {
return React.createElement("div", { style: { ...wfCarte, background: T.oliveSoft, border: `1.5px solid ${T.olive600}` } },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: T.olive700, marginBottom: 6 } }, "Questionnaire Builder — éditeur drag & drop"),
React.createElement("div", { style: { fontSize: 11.5, color: T.inkMid, lineHeight: 1.6 } }, "Le Questionnaire Builder (palette de types de questions, glisser-déposer entre sections, panneau de propriétés, aperçu vivant, export JSON) est un sous-écran dédié — consigné pour l'instant. L'onglet « Sections & visas » (anatomie R78, droits par rôle, visas nommés R2, réordonnancement) est pleinement fonctionnel."));
}

export default function SectionDesignerScreen({ kind }: { kind: string }) {
const [tab, setTab] = useState("sections");
const [expSec, setExpSec] = useState<any>(null);
const [nvSec, setNvSec] = useState("");
const [sdMsg, setSdMsg] = useState<any>(null);
const [dragCode, setDragCode] = useState<any>(null);
const [dragOver, setDragOver] = useState<any>(null);
const [, force] = useState(0);
const re2 = () => force(x => x + 1);
const data = kind === "KYC" ? WF_KYC_SECTIONS_PARAM : (kind === "AR" ? WF_AR_SECTIONS_PARAM : WF_GAR_SECTIONS_PARAM);
const meta = WF_SD_KINDS[kind];
return React.createElement("div", { style: { maxWidth: 1020 } },
React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 14 } }, [["sections", "§ Sections & visas"], ["quest", "⊞ Questionnaire Builder"]].map(([k, l]: any) => React.createElement("button", { key: k, onClick: () => setTab(k), style: { padding: "8px 15px", borderRadius: 8, fontSize: 13, cursor: "pointer",
border: `1px solid ${tab === k ? T.olive600 : T.line}`, background: tab === k ? T.oliveSoft : T.surface,
color: tab === k ? T.olive900 : T.inkMid, fontWeight: tab === k ? 700 : 400 } }, l))),
tab === "sections" && React.createElement("div", { style: wfCarte },
React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: T.olive900, marginBottom: 4 } }, meta.titre),
React.createElement("div", { style: { fontSize: 11.5, color: T.inkMid, marginBottom: 6, lineHeight: 1.55 } },
"Une section n'est pas qu'un visa. C'est un ",
React.createElement("b", null, "objet complet (R78)"),
" : un ",
React.createElement("b", null, "questionnaire"),
", des ",
React.createElement("b", null, "droits par rôle"),
" sur ce questionnaire, un ",
React.createElement("b", null, "préparateur (owner)"),
", un ",
React.createElement("b", null, "validateur (visa nommé, R2)"),
" et un ",
React.createElement("b", null, "échange"),
" entre intervenants — le tout ",
React.createElement("b", null, "motorisé par un workflow"),
". Dépliez une section (⌄) pour son anatomie."),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 12 } },
meta.note,
" Le paramétrage fin des champs vit dans Paramétrage → Champs & droits. ",
React.createElement("b", { style: { color: T.olive700 } }, "⢿ Glissez une ligne pour réordonner les sections.")),
React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } },
React.createElement("thead", null,
React.createElement("tr", null, ["", "Section", "Préparateur", "Questionnaire", "Visa / validateur", "Workflow"].map(h => React.createElement("th", { key: h, style: { textAlign: "left", padding: "7px 9px", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", borderBottom: `1px solid ${T.line}` } }, h)))),
React.createElement("tbody", null, data.map(function (sec: any) {
sdEnsureAnatomy(sec);
const nq = wfChamps(kind, sec.code).length;
const open = expSec === sec.code;
return [
React.createElement("tr", { key: sec.code, draggable: true, onDragStart: (e: any) => { setDragCode(sec.code); e.dataTransfer.effectAllowed = "move"; }, onDragOver: (e: any) => { e.preventDefault(); if (dragOver !== sec.code)
setDragOver(sec.code); }, onDragLeave: () => { if (dragOver === sec.code)
setDragOver(null); }, onDrop: (e: any) => { e.preventDefault(); if (dragCode && dragCode !== sec.code) {
const fi = data.findIndex((x: any) => x.code === dragCode), ti = data.findIndex((x: any) => x.code === sec.code);
if (fi >= 0 && ti >= 0) {
const m = data.splice(fi, 1)[0];
data.splice(ti, 0, m);
pushParamAudit("Admin", "Sections " + kind + " réordonnées — " + m.label + " déplacée en position " + (ti + 1));
}
} setDragCode(null); setDragOver(null); re2(); }, style: { background: dragOver === sec.code ? T.oliveSoft : (dragCode === sec.code ? T.cream : "transparent"), cursor: "grab", transition: "background .12s" } },
React.createElement("td", { style: { padding: "7px 9px", borderBottom: `1px solid ${T.lineSoft}`, width: 44, whiteSpace: "nowrap" } },
React.createElement("span", { title: "Glisser pour réordonner", style: { cursor: "grab", color: T.inkSoft, fontSize: 13, marginRight: 2, userSelect: "none" } }, "⢿"),
React.createElement("button", { onClick: () => setExpSec(open ? null : sec.code), title: "Anatomie de la section", style: { border: "none", background: "none", cursor: "pointer", fontSize: 13, color: T.olive700, transform: open ? "rotate(180deg)" : "none" } }, "⌄")),
React.createElement("td", { style: { padding: "7px 9px", borderBottom: `1px solid ${T.lineSoft}`, fontWeight: 700, color: T.ink } }, sec.label),
React.createElement("td", { style: { padding: "7px 9px", borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement("select", { value: sec.owner, onChange: (e: any) => { sec.owner = e.target.value; pushParamAudit("Admin", "Section " + kind + " " + sec.code + " — préparateur : " + e.target.value); re2(); }, style: { padding: "5px 8px", borderRadius: 7, border: `1px solid ${T.line}`, fontSize: 11 } }, WF_SD_KEYROLES.map(r => React.createElement("option", { key: r }, r)))),
React.createElement("td", { style: { padding: "7px 9px", borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement("button", { onClick: () => setTab("quest"), title: "Ouvrir le Questionnaire Builder", style: { border: `1px solid ${T.line}`, background: T.surface, borderRadius: 7, padding: "4px 9px", fontSize: 11, cursor: "pointer", color: T.olive700, fontWeight: 700 } },
nq,
" question",
nq > 1 ? "s" : "",
" ✎")),
React.createElement("td", { style: { padding: "7px 9px", borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement("label", { style: { display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" } },
React.createElement("input", { type: "checkbox", checked: sec.visa, onChange: (e: any) => { sec.visa = e.target.checked; pushParamAudit("Admin", "Section " + kind + " " + sec.code + " — visa " + (e.target.checked ? "activé" : "désactivé")); re2(); }, style: { accentColor: T.olive600 } }),
React.createElement("select", { value: sec.val, disabled: !sec.visa, onChange: (e: any) => { sec.val = e.target.value; pushParamAudit("Admin", "Section " + kind + " " + sec.code + " — validateur : " + e.target.value); re2(); }, style: { padding: "4px 7px", borderRadius: 7, border: `1px solid ${T.line}`, fontSize: 11, opacity: sec.visa ? 1 : 0.4 } }, WF_KYC_ROLES.map(r => React.createElement("option", { key: r }, r))))),
React.createElement("td", { style: { padding: "7px 9px", borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement("select", { value: sec.wfPhase, onChange: (e: any) => { sec.wfPhase = e.target.value; pushParamAudit("Admin", "Section " + kind + " " + sec.code + " — phase workflow : " + e.target.value); re2(); }, style: { padding: "5px 8px", borderRadius: 7, border: `1px solid ${T.line}`, fontSize: 11 } }, WF_SECTION_PHASES.map(ph => React.createElement("option", { key: ph }, ph))))),
open && React.createElement("tr", { key: sec.code + "-x" },
React.createElement("td", { colSpan: 6, style: { padding: "0 9px 12px 33px", borderBottom: `1px solid ${T.lineSoft}`, background: T.cream } },
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, paddingTop: 10 } },
React.createElement("div", null,
React.createElement("div", { style: { fontSize: 10.5, fontWeight: 800, color: T.olive900, textTransform: "uppercase", marginBottom: 6 } }, "Droits par rôle sur le questionnaire"),
React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 11 } },
React.createElement("tbody", null, WF_SD_KEYROLES.map(r => React.createElement("tr", { key: r },
React.createElement("td", { style: { padding: "3px 6px", color: T.inkMid, fontWeight: r === sec.owner ? 800 : 400 } },
r,
r === sec.owner ? " · owner" : "",
r === sec.val && sec.visa ? " · visa" : ""),
React.createElement("td", { style: { padding: "3px 6px" } },
React.createElement("div", { style: { display: "inline-flex", gap: 3 } }, WF_SECTION_RIGHTS.map(function (rt: any) {
var on = sdRights(sec.droits[r]).indexOf(rt[0]) >= 0;
return React.createElement("button", { key: rt[0], onClick: () => { sdToggleRight(sec, r, rt[0]); pushParamAudit("Admin", "Section " + kind + " " + sec.code + " — droits " + r + " : " + sdRights(sec.droits[r]).join("+")); re2(); }, style: { padding: "2px 8px", borderRadius: 6, fontSize: 9.5, cursor: "pointer", border: `1px solid ${on ? WF_RIGHT_C[rt[0]] : T.line}`, background: on ? WF_RIGHT_C[rt[0]] + "1E" : "#fff", color: on ? WF_RIGHT_C[rt[0]] : T.inkSoft, fontWeight: on ? 800 : 400 } },
on ? "✓ " : "",
rt[1]);
})))))))),
React.createElement("div", null,
React.createElement("div", { style: { fontSize: 10.5, fontWeight: 800, color: T.olive900, textTransform: "uppercase", marginBottom: 6 } }, "Échange & workflow"),
React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: T.inkMid, marginBottom: 8, cursor: "pointer" } },
React.createElement("input", { type: "checkbox", checked: sec.exchange, onChange: (e: any) => { sec.exchange = e.target.checked; pushParamAudit("Admin", "Section " + kind + " " + sec.code + " — échange " + (e.target.checked ? "activé" : "désactivé")); re2(); }, style: { accentColor: T.olive600 } }),
"Messagerie entre intervenants ",
sec.exchange ? "active" : "désactivée"),
React.createElement("div", { style: { fontSize: 11, color: T.inkMid, lineHeight: 1.6 } },
"Préparateur : ",
React.createElement("b", null, sec.owner),
" · Validateur : ",
React.createElement("b", null, sec.visa ? sec.val : "—"),
" (remplaçant ",
sec.sup || "—",
") · Phase : ",
React.createElement("b", null, sec.wfPhase)),
React.createElement("div", { style: { fontSize: 10, color: T.inkSoft, marginTop: 8, lineHeight: 1.5 } }, "Le workflow motorise l'enchaînement : le préparateur remplit, l'échange trace les demandes de clarification, le validateur appose le visa (R2 nommé, 4-yeux R13), la phase gouverne l'ordre.")))))
];
}))),
React.createElement("div", { style: { display: "flex", gap: 9, marginTop: 12, alignItems: "center" } },
React.createElement("input", { value: nvSec, onChange: (e: any) => setNvSec(e.target.value), placeholder: "Nouvelle section…", style: { flex: 1, padding: "8px 11px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12.5 } }),
React.createElement("button", { disabled: !nvSec.trim(), style: wfBouton(nvSec.trim() ? T.olive600 : T.line), onClick: () => {
const code = kind + "-S" + (data.length + 1);
data.push({ code, label: nvSec.trim(), visa: true, val: WF_KYC_ROLES[0], sup: WF_KYC_ROLES[1] });
pushParamAudit("Admin", "Section " + kind + " créée : " + code + " « " + nvSec.trim() + " »");
setNvSec("");
setSdMsg("Section créée — visas ci-dessus, champs dans Paramétrage → Champs & droits.");
re2();
} }, "＋ Ajouter une section")),
sdMsg && React.createElement("div", { style: { borderRadius: 8, padding: "8px 12px", marginTop: 8, fontSize: 12.5, background: T.greenSoft,
border: `1px solid ${T.green}`, color: T.olive900 }, onClick: () => setSdMsg(null) }, sdMsg)),
tab === "quest" && React.createElement(QuestConsigne, null));
}
