import React, { useState } from "react";
import { T } from "./tokens";
import { wfCarte } from "./wf-styles";
import { pushParamAudit } from "./param-audit-support";
import { NAV, OLIVE_ROLES, NAV_VIS_OVERRIDE, navVisible } from "./paramnav-support";

// Source : docs/reference/olive-demo.html 25194-25244 — ParamNavScreen (Paramétrage → Menus par
// rôle : qui voit quoi dans la navigation). Porté verbatim.

export default function ParamNavScreen() {
  const [, force] = useState(0);
  const re2 = () => force((x) => x + 1);
  const [fineGrp, setFineGrp] = useState("g_compliance");
  const roots = NAV.map((n: any) => ({ id: n.id, label: (n.label || n.id).replace(/ —.*$/, "") }));
  return React.createElement("div", { style: { maxWidth: 1060 } },
    React.createElement("div", { style: wfCarte },
      React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: T.olive900, marginBottom: 4 } }, "Menus par rôle"),
      React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, marginBottom: 12 } }, "Chaque rôle voit ce qu'il a à voir — défauts logiques métier, ajustables ici, journalisés. La visibilité des données (mes clients / tous) reste régie par le profil."),
      React.createElement("div", { style: { overflowX: "auto" } },
        React.createElement("table", { style: { borderCollapse: "collapse", fontSize: 11, minWidth: 900 } },
          React.createElement("thead", null,
            React.createElement("tr", null,
              React.createElement("th", { style: { textAlign: "left", padding: "6px 8px", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", borderBottom: `1px solid ${T.line}` } }, "Rôle"),
              roots.map((r: any) => React.createElement("th", { key: r.id, style: { textAlign: "center", padding: "6px 5px", fontSize: 9, color: T.inkSoft, borderBottom: `1px solid ${T.line}`, maxWidth: 74 } }, r.label)))),
          React.createElement("tbody", null, OLIVE_ROLES.map((role) => React.createElement("tr", { key: role },
            React.createElement("td", { style: { padding: "6px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontWeight: 700, color: T.ink } }, role),
            roots.map((r: any) => React.createElement("td", { key: r.id, style: { textAlign: "center", padding: "5px", borderBottom: `1px solid ${T.lineSoft}` } },
              React.createElement("input", { type: "checkbox", checked: navVisible(role, r.id), style: { accentColor: T.olive600, cursor: "pointer" }, onChange: (e: any) => {
                NAV_VIS_OVERRIDE[role] = NAV_VIS_OVERRIDE[role] || {};
                NAV_VIS_OVERRIDE[role][r.id] = e.target.checked;
                pushParamAudit("Admin", "Menu « " + r.label + " » " + (e.target.checked ? "activé" : "masqué") + " pour le rôle " + role);
                re2();
              } })))))))),
    React.createElement("div", { style: { marginTop: 22, paddingTop: 16, borderTop: `1px solid ${T.line}` } },
      React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.olive900, marginBottom: 4 } }, "Réglage fin — par élément de menu"),
      React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, marginBottom: 10 } }, "La matrice ci-dessus règle les groupes ; ici, chaque élément d'un groupe peut être masqué rôle par rôle (ex. le CO voit le Screening mais pas le Registre LBA)."),
      React.createElement("select", { value: fineGrp, onChange: (e: any) => setFineGrp(e.target.value), style: { padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12, background: "#fff", marginBottom: 12 } }, NAV.filter((n: any) => n.children && n.children.length).map((n: any) => React.createElement("option", { key: n.id, value: n.id }, (n.label || n.id)))),
      (() => {
        const grpRaw = NAV.find((n: any) => n.id === fineGrp);
        if (!grpRaw || !grpRaw.children)
          return null;
        const grp = { ...grpRaw, children: grpRaw.children.filter((c: any) => c.id) };
        return React.createElement("div", { style: { overflowX: "auto" } },
          React.createElement("table", { style: { borderCollapse: "collapse", fontSize: 11, minWidth: 900 } },
            React.createElement("thead", null,
              React.createElement("tr", null,
                React.createElement("th", { style: { textAlign: "left", padding: "6px 8px", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", borderBottom: `1px solid ${T.line}` } }, "Rôle"),
                grp.children.map((c: any) => React.createElement("th", { key: c.id, style: { textAlign: "center", padding: "6px 5px", fontSize: 9, color: T.inkSoft, borderBottom: `1px solid ${T.line}`, maxWidth: 80 } }, c.label)))),
            React.createElement("tbody", null, OLIVE_ROLES.filter((role) => navVisible(role, grp.id)).map((role) => React.createElement("tr", { key: role },
              React.createElement("td", { style: { padding: "6px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontWeight: 700, color: T.ink } }, role),
              grp.children.map((c: any) => React.createElement("td", { key: c.id, style: { textAlign: "center", padding: "5px", borderBottom: `1px solid ${T.lineSoft}` } },
                React.createElement("input", { type: "checkbox", checked: navVisible(role, c.id), style: { accentColor: T.olive600, cursor: "pointer" }, onChange: (e: any) => {
                  NAV_VIS_OVERRIDE[role] = NAV_VIS_OVERRIDE[role] || {};
                  NAV_VIS_OVERRIDE[role][c.id] = e.target.checked;
                  pushParamAudit("Admin", "Élément « " + c.label + " » " + (e.target.checked ? "activé" : "masqué") + " pour le rôle " + role);
                  re2();
                } }))))))));
      })())));
}
