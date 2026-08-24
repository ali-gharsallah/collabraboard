import React, { useState } from "react";
import { T } from "./tokens";
import { wfCarte } from "./wf-styles";
import { WF_ENGINE, wfPreuve4Yeux } from "./olive-wf-engine";
import { PARAM_AUDIT } from "./param-audit-support";

// Source : docs/reference/olive-demo.html 24420-24471 — AuditITScreen (Audit IT — intégrité & paramétrage).
// Contrôles d'intégrité calculés en direct sur le journal WF_ENGINE + journal des paramétrages (PARAM_AUDIT).
// Porté verbatim.

export default function AuditITScreen() {
const [filtre, setFiltre] = useState("");
const evts = WF_ENGINE.audit();
const seqOK = evts.every((e: any, i: number) => i === 0 || e.seq > evts[i - 1].seq);
const uniqOK = new Set(evts.map((e: any) => e.seq)).size === evts.length;
const rt = WF_ENGINE.tenantRules;
const rtOK = evts.filter((e: any) => e.type === "REGLE_TENANT_ACTIVEE" || e.type === "REGLE_TENANT_DESACTIVEE")
.every((e: any) => evts.some((a: any) => a.type === "REGLE_TENANT_AJOUTEE" && a.regle === e.regle));
const p4 = wfPreuve4Yeux();
const r13OK = p4.every((v: any) => !v.preparateurs.has(v.validateur));
const parType: any = {};
evts.forEach((e: any) => { parType[e.type] = (parType[e.type] || 0) + 1; });
const ctrl: any[] = [["Journal monotone (seq strictement croissants)", seqOK],
["Unicité des séquences", uniqOK],
["Règles tenant : activations rattachées à un ajout tracé", rtOK],
["R13 sur tous les visas accordés (0 auto-validation)", r13OK],
["Règles tenant actives : " + rt.filter((r: any) => r.actif).length + " / " + rt.length, true]];
const audit = PARAM_AUDIT.filter((a: any) => !filtre || ((a.what || "") + (a.by || "")).toLowerCase().includes(filtre.toLowerCase()));
return React.createElement("div", { style: { maxWidth: 1020 } },
React.createElement("div", { style: wfCarte },
React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: T.olive900, marginBottom: 8 } },
"Contrôles d'intégrité — calculés en direct sur le journal (",
evts.length,
" événements)"),
ctrl.map(([l, ok]: any, i: number) => React.createElement("div", { key: i, style: { display: "flex", gap: 10, alignItems: "center", padding: "7px 4px",
borderBottom: `1px solid ${T.lineSoft}`, fontSize: 13 } },
React.createElement("span", { style: { fontWeight: 800, color: ok ? T.green : T.red, minWidth: 20 } }, ok ? "✔" : "✖"),
React.createElement("span", { style: { color: T.ink } }, l))),
React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 } }, Object.entries(parType).map(([t, n]: any) => React.createElement("span", { key: t, style: { fontSize: 10.5, padding: "3px 9px",
borderRadius: 9, background: T.lineSoft, color: T.inkMid } },
t,
" × ",
n)))),
React.createElement("div", { style: wfCarte },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 10 } },
React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: T.olive900 } },
"Journal des paramétrages (",
PARAM_AUDIT.length,
")"),
React.createElement("input", { value: filtre, onChange: (e: any) => setFiltre(e.target.value), placeholder: "Filtrer…", style: { marginLeft: "auto", border: `1px solid ${T.sage}`, borderRadius: 6, padding: "6px 10px", fontSize: 12, width: 220 } })),
React.createElement("div", { style: { maxHeight: 380, overflow: "auto" } },
audit.length === 0 && React.createElement("div", { style: { fontSize: 13, color: T.inkSoft } }, "Aucune entrée."),
audit.slice(0, 200).map((a: any, i: number) => React.createElement("div", { key: i, style: { padding: "6px 10px", borderLeft: `3px solid ${T.blue}`,
background: T.surface, marginBottom: 4, fontSize: 12, borderRadius: "0 6px 6px 0", border: `1px solid ${T.lineSoft}` } },
React.createElement("span", { style: { color: T.inkSoft, fontSize: 11 } },
a.at,
" · ",
a.by),
" — ",
a.what)))));
}
