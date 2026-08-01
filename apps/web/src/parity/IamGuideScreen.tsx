import React, { useState } from "react";
import { T } from "./tokens";
import { IAM_BRIQUES, IAM_DEMO_STEPS, IAM_OBJECTIONS } from "./iam-guide-support";

// Source : docs/reference/olive-demo.html 40355-40396 — IamGuideScreen (IAM — Sécurité & accès, guide/fil de démo). Porté verbatim.

export default function IamGuideScreen() {
const [ong, setOng] = useState("briques");
const ONG = [["briques", "🧩 Ce que couvre l'IAM"], ["demo", "🎬 Scénario de démo (7 min)"], ["objections", "💬 Objections fréquentes"]];
return (React.createElement("div", null,
React.createElement("div", { style: { marginBottom: 14 } },
React.createElement("div", { style: { fontSize: 21, fontWeight: 800, color: T.ink } }, "IAM — Sécurité & accès"),
React.createElement("div", { style: { fontSize: 12, color: T.inkSoft, marginTop: 4, maxWidth: 900, lineHeight: 1.6 } }, "Qui est l'utilisateur, ce qu'il a le droit de faire, et comment on le prouve. C'est le socle de MOD-30 : sans identité fiable, ni le four-eyes ni la piste d'audit n'ont de valeur probante devant FINMA. Cet écran explique la feature et sert de fil conducteur en démo client.")),
React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" } }, ONG.map(function (o) {
return (React.createElement("button", { key: o[0], onClick: function () { setOng(o[0]); }, style: { padding: "7px 14px", borderRadius: 8,
border: `1px solid ${ong === o[0] ? T.olive600 : T.line}`, background: ong === o[0] ? T.oliveSoft : "transparent",
color: ong === o[0] ? T.olive900 : T.inkMid, fontSize: 11.5, fontWeight: 700, cursor: "pointer" } }, o[1]));
})),
ong === "briques" && (React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } }, IAM_BRIQUES.map(function (b: any) {
return (React.createElement("div", { key: b.titre, style: { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 16 } },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 9, marginBottom: 8 } },
React.createElement("span", { style: { fontSize: 18 } }, b.icon),
React.createElement("span", { style: { fontSize: 13.5, fontWeight: 800, color: T.ink } }, b.titre)),
React.createElement("div", { style: { fontSize: 11.5, color: T.inkMid, lineHeight: 1.65, marginBottom: 10 } }, b.quoi),
React.createElement("div", { style: { fontSize: 11, color: T.olive700, background: T.oliveSoft, borderRadius: 7, padding: "7px 10px", marginBottom: 6 } },
React.createElement("b", null, "En démo :"),
" ",
b.demo),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft } },
"Preuve : ",
b.preuve)));
}))),
ong === "demo" && (React.createElement("div", { style: { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 18 } },
React.createElement("div", { style: { fontSize: 12, color: T.inkMid, marginBottom: 14, lineHeight: 1.6 } }, "Déroulé conseillé face à un Compliance Officer ou un CISO de banque privée. Chaque étape se joue dans la démo."),
IAM_DEMO_STEPS.map(function (st: any, i: number) {
return (React.createElement("div", { key: i, style: { display: "flex", gap: 12, padding: "11px 0", borderBottom: i < IAM_DEMO_STEPS.length - 1 ? `1px solid ${T.lineSoft}` : "none" } },
React.createElement("div", { style: { minWidth: 190, fontSize: 12, fontWeight: 800, color: T.olive900 } }, st.t),
React.createElement("div", { style: { fontSize: 11.5, color: T.inkMid, lineHeight: 1.65 } }, st.d)));
}),
React.createElement("div", { style: { marginTop: 14, padding: "10px 12px", background: T.oliveSoft, borderRadius: 8, fontSize: 11.5, color: T.olive900, lineHeight: 1.6 } },
React.createElement("b", null, "Phrase de clôture :"),
" « L'IA propose, l'humain décide, la machine trace. L'IAM est la première moitié de cette phrase : sans identité prouvée, la décision humaine n'est pas attribuable. »"))),
ong === "objections" && (React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, IAM_OBJECTIONS.map(function (o: any, i: number) {
return (React.createElement("div", { key: i, style: { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 14 } },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 6 } }, o[0]),
React.createElement("div", { style: { fontSize: 11.5, color: T.inkMid, lineHeight: 1.65 } }, o[1])));
})))));
}
