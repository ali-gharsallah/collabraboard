import React, { useState } from "react";
import { T } from "./tokens";
import { wfCarte, wfBouton } from "./wf-styles";
import { WF_ENGINE, WF_IDS, WF_TITULAIRES, WfBranche, wfRejoue, wfPreuve4Yeux, OliveWfEngine } from "./olive-wf-engine";

// Source : docs/reference/olive-demo.html 24338-24419 — WfAuditScreen (Audit du workflow).
// Export scellé R62 (SHA-256 chaîné, vérifiable hors ligne), rejeu à date X-02 (état reconstruit depuis
// le journal append-only R48/R49), preuve du 4-yeux X-05 (préparateurs vs signataire, R13). Porté verbatim.
// currentUser (identité de l'auditeur) non disponible en parité → garde typeof → « Auditeur ».

declare const currentUser: any;

export default function WfAuditScreen() {
const [sel, setSel] = useState("D-2026-001");
const [rjN, setRjN] = useState(6);
const [scelle, setScelle] = useState<any>(null); // dernier export R62 {scelle, nb, verif}
const rj = wfRejoue(sel, rjN);
const exporterScelle = () => {
const exp = WF_ENGINE.exportSealed((typeof currentUser !== "undefined" && currentUser && currentUser.name) || "Auditeur");
const verif = OliveWfEngine.verifySealed(exp);
setScelle({ scelle: exp.scelle, nb: exp.evenements.length, verif });
try {
const blob = new Blob([JSON.stringify(exp, null, 2)], { type: "application/json" });
const a = document.createElement("a");
a.href = URL.createObjectURL(blob);
a.download = "olive-audit-scelle-" + exp.aSeq + ".json";
a.click();
setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
catch (_) { }
};
return React.createElement("div", { style: { maxWidth: 1020 } },
React.createElement("div", { style: wfCarte },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" } },
React.createElement("div", { style: { flex: 1, minWidth: 260 } },
React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: T.olive900 } }, "Export d'audit scellé (R62)"),
React.createElement("div", { style: { fontSize: 12, color: T.inkSoft } }, "Le journal complet, scellé par hash SHA-256 chaîné — vérifiable hors ligne, toute altération casse le scellé. L'export est lui-même journalisé.")),
React.createElement("button", { onClick: exporterScelle, style: wfBouton(T.olive600) }, "⬇ Exporter le journal scellé")),
scelle && React.createElement("div", { style: { marginTop: 10, padding: "9px 12px", borderRadius: 9, background: T.greenSoft, border: `1px solid ${T.green}40`, fontSize: 12, color: T.ink, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" } },
React.createElement("span", { style: { fontWeight: 800, color: T.green } }, scelle.verif ? "✓ Scellé vérifié" : "⛔ Scellé invalide"),
React.createElement("span", null,
scelle.nb,
" événements"),
React.createElement("span", { style: { fontFamily: "monospace", fontSize: 10.5, color: T.inkMid } },
"SHA-256 · ",
scelle.scelle.slice(0, 16),
"…",
scelle.scelle.slice(-8)))),
React.createElement("div", { style: wfCarte },
React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: T.olive900, marginBottom: 4 } }, "Rejeu à date (X-02)"),
React.createElement("div", { style: { fontSize: 12, color: T.inkSoft, marginBottom: 10 } }, "L'état du dossier « tel qu'il était » — reconstruit depuis le journal append-only (R48/R49)."),
React.createElement("div", { style: { display: "flex", gap: 12, alignItems: "center", marginBottom: 8 } },
React.createElement("select", { value: sel, onChange: (e: any) => { setSel(e.target.value); setRjN(3); }, style: { border: `1px solid ${T.sage}`, borderRadius: 6, padding: "6px 9px" } }, WF_IDS.map((id: any) => React.createElement("option", { key: id, value: id },
id,
" — ",
WF_TITULAIRES[id]))),
React.createElement("input", { type: "range", min: 1, max: rj.total, value: Math.min(rjN, rj.total), onChange: (e: any) => setRjN(+e.target.value), style: { flex: 1 } }),
React.createElement("b", { style: { color: T.olive700, fontSize: 13, minWidth: 150 } },
"événement ",
Math.min(rjN, rj.total),
" / ",
rj.total,
" · ",
rj.evts.length ? "" + rj.evts[rj.evts.length - 1].at : "")),
rj.d && React.createElement(WfBranche, { d: rj.d }),
React.createElement("div", { style: { maxHeight: 230, overflow: "auto", marginTop: 6 } }, rj.evts.map((ev: any) => React.createElement("div", { key: ev.seq, style: { padding: "5px 10px", borderLeft: `3px solid ${T.leaf}`,
background: T.surface, marginBottom: 4, fontSize: 12, borderRadius: "0 6px 6px 0", border: `1px solid ${T.lineSoft}` } },
React.createElement("span", { style: { color: T.inkSoft, fontSize: 11 } },
"#",
ev.seq,
" · ",
"" + ev.at,
" · ",
ev.actor || "system"),
" — ",
React.createElement("b", null, ev.type),
ev.sectionId ? " · " + ev.sectionId : "",
ev.motivation ? " · " + ev.motivation : "")))),
React.createElement("div", { style: wfCarte },
React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: T.olive900, marginBottom: 4 } }, "Preuve du 4-yeux (X-05)"),
React.createElement("div", { style: { fontSize: 12, color: T.inkSoft, marginBottom: 10 } }, "Préparateurs contre signataire, pour chaque visa accordé — extraction directe du journal."),
React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 13 } },
React.createElement("thead", null,
React.createElement("tr", null, ["Dossier", "Section", "Préparateurs", "Signataire", "Verdict"].map(h => React.createElement("th", { key: h, style: { textAlign: "left", fontSize: 11, color: T.inkSoft, textTransform: "uppercase",
padding: "5px 8px", borderBottom: `2px solid ${T.line}` } }, h)))),
React.createElement("tbody", null, wfPreuve4Yeux().map((v: any, i: number) => React.createElement("tr", { key: i },
React.createElement("td", { style: { padding: "6px 8px", borderBottom: `1px solid ${T.lineSoft}` } }, v.dossier),
React.createElement("td", { style: { padding: "6px 8px", borderBottom: `1px solid ${T.lineSoft}` } }, v.section),
React.createElement("td", { style: { padding: "6px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontSize: 12 } }, Array.from(v.preparateurs).join(", ")),
React.createElement("td", { style: { padding: "6px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontSize: 12 } }, v.validateur),
React.createElement("td", { style: { padding: "6px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontWeight: 700,
color: v.preparateurs.has(v.validateur) ? T.red : T.olive700 } }, v.preparateurs.has(v.validateur) ? "✖ VIOLATION" : "✔ conforme R13")))))));
}
