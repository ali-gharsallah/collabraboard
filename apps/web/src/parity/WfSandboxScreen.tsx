import React, { useState } from "react";
import { T } from "./tokens";
import { wfCarte, wfBouton } from "./wf-styles";
import { WF_ENGINE, WF_IDS, WF_ACTEURS, WF_TITULAIRES, WfBranche, WfPuce, wfSections, wfVisaDe } from "./olive-wf-engine";

// Source : docs/reference/olive-demo.html 24472-24566 — WfSandboxScreen (bac à sable Workflow — moteur R2/R13 live).
// GlobalSandboxScreen (24567) = wrapper : return React.createElement(WfSandboxScreen, null).
// Moteur réel WF_ENGINE + dossiers de démo : signer sans être le validateur ⇒ R2, refuser sans motif ⇒ R7,
// finale sans engagement ⇒ R14. Composants/helpers portés dans olive-wf-engine (verbatim).

export default function WfSandboxScreen() {
const [sel, setSel] = useState("D-2026-003");
const [modal, setModal] = useState<any>(null);
const [acteur, setActeur] = useState(WF_ACTEURS[3]);
const [eng, setEng] = useState(false);
const [refus, setRefus] = useState(false);
const [motif, setMotif] = useState("");
const [msg, setMsg] = useState<any>(null);
const [errV, setErrV] = useState<any>(null);
const [, force] = useState(0);
const maj = () => force(x => x + 1);
const commande = (fn: any, okTexte: any) => {
setErrV(null);
try {
fn();
setModal(null);
setRefus(false);
setMotif("");
setEng(false);
setMsg({ ok: true, texte: okTexte });
maj();
}
catch (x: any) {
setErrV(String(x.message || x));
}
};
const dossiers = WF_IDS.map(id => WF_ENGINE.d(id));
return React.createElement("div", { style: { maxWidth: 1020 } },
React.createElement("div", { style: { fontSize: 12, color: T.inkSoft, marginBottom: 10 } }, "Moteur réel, dossiers de démo — signer sans être le validateur ⇒ R2 · refuser sans motif ⇒ R7 · finale sans engagement ⇒ R14. Feuille = section, olive = finale."),
msg && React.createElement("div", { style: { borderRadius: 8, padding: "9px 14px", marginBottom: 12, fontSize: 13,
background: msg.ok ? T.greenSoft : T.redSoft, border: `1px solid ${msg.ok ? T.green : T.red}`,
color: msg.ok ? T.olive900 : T.red }, onClick: () => setMsg(null) }, msg.texte),
dossiers.map((d: any) => React.createElement("div", { key: d.id, style: { ...wfCarte, cursor: "pointer",
border: `1px solid ${sel === d.id ? T.olive600 : T.line}` }, onClick: () => setSel(d.id) },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
React.createElement("b", { style: { color: T.olive900 } }, d.id),
React.createElement("span", { style: { color: T.inkMid } }, WF_TITULAIRES[d.id]),
React.createElement("span", { style: { fontSize: 11, color: T.inkSoft } },
"· ",
"" + WF_ENGINE.audit().filter((e: any) => e.dossierId === d.id).slice(-1)[0].at)),
React.createElement(WfBranche, { d: d }),
sel === d.id && React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 8 } },
React.createElement("thead", null,
React.createElement("tr", null, ["Section", "État", "Visa", "Validateur (R2)", "Préparateurs (R13)", ""].map(h => React.createElement("th", { key: h, style: { textAlign: "left", fontSize: 11, color: T.inkSoft, textTransform: "uppercase",
padding: "5px 8px", borderBottom: `2px solid ${T.line}` } }, h)))),
React.createElement("tbody", null, wfSections(d).map((s: any) => React.createElement("tr", { key: s.id },
React.createElement("td", { style: { padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}` } },
s.id === "__FINAL__" ? "🫒 " : "",
s.label),
React.createElement("td", { style: { padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement(WfPuce, { v: s.state })),
React.createElement("td", { style: { padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement(WfPuce, { v: wfVisaDe(s) }),
s.visa && s.visa.motivation ? React.createElement("div", { style: { fontSize: 11, color: T.inkSoft } },
"motif : ",
s.visa.motivation) : null),
React.createElement("td", { style: { padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontSize: 12 } }, (s.visa && s.visa.assignee) || s.validator || "—"),
React.createElement("td", { style: { padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontSize: 12 } }, Array.from(s.preparers || []).join(", ") || "—"),
React.createElement("td", { style: { padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}` } }, wfVisaDe(s) === "EN_ATTENTE" && React.createElement("button", { style: wfBouton(T.olive600), onClick: (ev: any) => {
ev.stopPropagation();
setModal({ dossier: d.id, section: s.id, finale: s.id === "__FINAL__" });
setErrV(null);
setRefus(false);
setActeur(s.id === "__FINAL__" ? "H. Brunner (Head PB)" : ((s.visa && s.visa.assignee) || s.validator));
} }, "Écran de visa")))))))),
modal && React.createElement("div", { style: { position: "fixed", inset: 0, background: "#1a241088", display: "flex",
alignItems: "center", justifyContent: "center", zIndex: 60 }, onClick: () => setModal(null) },
React.createElement("div", { style: { background: T.surface, borderRadius: 12, padding: "20px 24px", width: 530, maxWidth: "92vw",
boxShadow: "0 12px 40px #0005" }, onClick: (ev: any) => ev.stopPropagation() },
React.createElement("div", { style: { fontSize: 16, fontWeight: 700, color: T.olive900 } },
"Écran de visa — ",
modal.section === "__FINAL__" ? "Validation finale" : modal.section),
React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, marginBottom: 10 } },
modal.dossier,
" · ",
WF_TITULAIRES[modal.dossier]),
React.createElement("div", { style: { display: "flex", gap: 9, alignItems: "center", margin: "8px 0" } },
"Signer en tant que :",
React.createElement("select", { value: acteur, onChange: (e: any) => setActeur(e.target.value), style: { border: `1px solid ${T.sage}`, borderRadius: 6, padding: "6px 9px" } }, WF_ACTEURS.map((a: any) => React.createElement("option", { key: a }, a)))),
modal.finale && React.createElement("div", { style: { background: "#FDF6E3", border: "1px solid #E3CE8B", borderRadius: 8,
padding: "11px 13px", margin: "10px 0", fontSize: 13 } },
React.createElement("b", null, "Engagement de responsabilité (R14)"),
React.createElement("label", { style: { display: "flex", gap: 9, marginTop: 6, cursor: "pointer", alignItems: "flex-start" } },
React.createElement("input", { type: "checkbox", checked: eng, onChange: (e: any) => setEng(e.target.checked) }),
React.createElement("span", null, "Je confirme que les processus de la banque ont été respectés sur l'ensemble du dossier et j'engage ma responsabilité."))),
React.createElement("div", { style: { display: "flex", gap: 9, margin: "10px 0" } },
React.createElement("button", { style: wfBouton(T.olive600), onClick: () => commande(() => WF_ENGINE.grantVisa(acteur, modal.dossier, modal.section, "", { engagement: eng }), "Visa accordé — journalisé (R49).") }, "✔ Accorder"),
React.createElement("button", { style: wfBouton(T.red), onClick: () => setRefus(true) }, "✖ Refuser"),
React.createElement("button", { style: { ...wfBouton(T.surface), color: T.olive700, border: `1px solid ${T.olive600}` }, onClick: () => setModal(null) }, "Annuler")),
refus && React.createElement("div", { style: { margin: "8px 0" } },
React.createElement("textarea", { value: motif, onChange: (e: any) => setMotif(e.target.value), rows: 2, placeholder: "Motivation du refus — obligatoire (R7)", style: { width: "100%", border: `1px solid ${T.sage}`, borderRadius: 6, padding: 8, fontSize: 13 } }),
React.createElement("button", { style: { ...wfBouton(T.red), marginTop: 6 }, onClick: () => commande(() => WF_ENGINE.refuseVisa(acteur, modal.dossier, modal.section, motif), "Refus motivé enregistré (R7) — la section repasse En préparation.") }, "Confirmer")),
errV && React.createElement("div", { style: { background: T.redSoft, border: `1px solid ${T.red}`, color: T.red,
borderRadius: 8, padding: "9px 12px", fontSize: 13, marginTop: 6 } }, errV))));
}
