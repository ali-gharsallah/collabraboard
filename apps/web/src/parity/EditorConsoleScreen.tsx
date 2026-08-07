import React, { useState } from "react";
import { T } from "./tokens";
import { Badge } from "./components";
import { pushParamAudit } from "./param-audit-support";
import { ACTIVE_LICENSE, DEMO_LICENSES, ENVIRONMENTS, LICENSED_MODULES_CATALOG, ETL_ENTITY_SCHEMA, SOURCE_FORMATS, MIGRATION_PACKAGES, licenseDaysRemaining, demoDaysRemaining, toggleLicenseModule, addMigrationRun, setMigrationStrategy } from "./editorconsole-support";

// Source : docs/reference/olive-demo.html 27902-28078 — EditorConsoleScreen (Administration Éditeur :
// Vendor Console on-premise — licence signée, environnements, activation modules, POC/démo, ETL &
// migration). Réservé au rôle EDITOR (défaut EDITOR ici pour l'affichage parité). Porté verbatim.

export default function EditorConsoleScreen({ user = { role: "EDITOR" } }: { user?: any } = {}) {
  const [, bump] = useState(0);
  const re = function () { bump(function (x) { return x + 1; }); };
  const [tab, setTab] = useState("license");
  const [selPkg, setSelPkg] = useState(MIGRATION_PACKAGES[0].id);
  const card: any = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 18, marginBottom: 14 };
  if (!user || user.role !== "EDITOR") {
    return React.createElement("div", { style: { background: T.redSoft, border: "1px solid " + T.red + "44", borderRadius: 14, padding: 24, color: T.red, fontSize: 13 } }, "🔒 Accès réservé à l'éditeur du logiciel (Olive) — Product Owner, support éditeur ou administrateur technique certifié. Non accessible aux utilisateurs de la banque.");
  }
  licenseDaysRemaining();
  const TABS = [["license", "🔑 Licence"], ["env", "🖥 Environnements"], ["modules", "▦ Modules"], ["poc", "⏱ Démo / POC"], ["etl", "⇌ ETL & Migration"]];
  return (React.createElement("div", null,
    React.createElement("div", { style: { marginBottom: 16 } },
      React.createElement("div", { style: { fontSize: 11, color: T.violet, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 } }, "Vendor Console — On-Premise Licensing"),
      React.createElement("div", { style: { fontSize: 22, fontWeight: 700, color: T.ink } }, "Administration Éditeur"),
      React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft, marginTop: 2, maxWidth: 680 } }, "Modèle on-premise : aucun accès distant aux données clients, licence vérifiée localement via fichier signé, activation des modules pilotée par la licence. Ce menu n'est jamais visible pour les utilisateurs de la banque.")),
    React.createElement("div", { style: { display: "flex", gap: 4, marginBottom: 16, background: T.surface, padding: 5, borderRadius: 12, border: "1px solid " + T.line, width: "fit-content", flexWrap: "wrap" } }, TABS.map(function (tb) {
      return (React.createElement("button", { key: tb[0], onClick: function () { setTab(tb[0]); }, style: { padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === tb[0] ? T.violet : "transparent", color: tab === tb[0] ? "#fff" : T.inkMid, fontSize: 12.5, fontWeight: tab === tb[0] ? 700 : 500 } }, tb[1]));
    })),
    tab === "license" && (React.createElement("div", { style: card },
      React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 4 } }, "Fichier de licence — olive_license.lic"),
      React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 12 } }, "Déchiffré et vérifié localement au démarrage de l'application. Aucun appel externe requis pour la validation."),
      React.createElement("div", { style: { background: T.ink, color: "#B8E6C8", borderRadius: 10, padding: 16, fontFamily: "monospace", fontSize: 11.5, lineHeight: 1.7, overflowX: "auto" } },
        "{", React.createElement("br", null),
        "  \"customer\": \"", ACTIVE_LICENSE.customer, "\",", React.createElement("br", null),
        "  \"tier\": \"", ACTIVE_LICENSE.tier, "\",", React.createElement("br", null),
        "  \"modules\": [", ACTIVE_LICENSE.modules.map(function (m: string) { return '"' + m + '"'; }).join(", "), "],", React.createElement("br", null),
        "  \"users\": ", ACTIVE_LICENSE.users, ",", React.createElement("br", null),
        "  \"valid_from\": \"", ACTIVE_LICENSE.valid_from, "\",", React.createElement("br", null),
        "  \"valid_until\": \"", ACTIVE_LICENSE.valid_until, "\",", React.createElement("br", null),
        "  \"environment\": \"", ACTIVE_LICENSE.environment, "\"", React.createElement("br", null),
        "}"),
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 12, padding: "10px 12px", borderRadius: 9, background: ACTIVE_LICENSE.verified ? T.greenSoft : T.redSoft } },
        React.createElement("span", { style: { fontSize: 15 } }, ACTIVE_LICENSE.verified ? "✓" : "✕"),
        React.createElement("div", { style: { flex: 1 } },
          React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: ACTIVE_LICENSE.verified ? T.green : T.red } }, ACTIVE_LICENSE.verified ? "Signature valide" : "Signature invalide"),
          React.createElement("div", { style: { fontSize: 10, color: T.inkSoft, fontFamily: "monospace" } }, "SHA-256 : ", ACTIVE_LICENSE.signature))),
      React.createElement("button", { onClick: function () { pushParamAudit("Éditeur Olive", "Fichier de licence re-vérifié manuellement"); re(); }, style: { marginTop: 12, padding: "8px 16px", borderRadius: 9, border: "1px solid " + T.violet, background: T.surface, color: T.violet, fontSize: 11.5, fontWeight: 700, cursor: "pointer" } }, "↻ Re-vérifier la signature"))),
    tab === "env" && (React.createElement("div", { style: card },
      React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 4 } }, "Environnements & instances"),
      React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 10 } }, "Déploiement on-premise : PROD/TEST/DEV séparés pour le client sous licence, plus les environnements DEMO des prospects en cours de POC."),
      React.createElement("div", { style: { overflowX: "auto" } },
        React.createElement("table", { style: { borderCollapse: "collapse", fontSize: 11.5, minWidth: 600 } },
          React.createElement("thead", null,
            React.createElement("tr", null, ["Instance ID", "Client", "Environnement", "Version", "Dernier accès", "Statut"].map(function (h) { return React.createElement("th", { key: h, style: { textAlign: "left", padding: "6px 12px 6px 0", fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase" } }, h); }))),
          React.createElement("tbody", null, ENVIRONMENTS.map(function (e: any) {
            const col = e.status === "ACTIVE" ? T.green : e.status === "SUSPENDUE" ? T.amber : T.red;
            return (React.createElement("tr", { key: e.id, style: { borderTop: "1px solid " + T.lineSoft } },
              React.createElement("td", { style: { padding: "8px 12px 8px 0", fontFamily: "monospace", fontWeight: 700, color: T.violet } }, e.id),
              React.createElement("td", { style: { padding: "8px 12px 8px 0" } }, e.customer),
              React.createElement("td", { style: { padding: "8px 12px 8px 0" } }, React.createElement(Badge, { text: e.env, color: T.blue, bg: T.blueSoft })),
              React.createElement("td", { style: { padding: "8px 12px 8px 0", fontFamily: "monospace", fontSize: 10.5, color: T.inkSoft } }, e.version),
              React.createElement("td", { style: { padding: "8px 12px 8px 0", color: T.inkSoft, fontSize: 10.5 } }, e.lastAccess),
              React.createElement("td", { style: { padding: "8px 12px 8px 0", color: col, fontWeight: 700 } }, e.status)));
          })))))),
    tab === "modules" && (React.createElement("div", { style: card },
      React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 4 } }, "Activation des modules — ", ACTIVE_LICENSE.customer),
      React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 12 } }, "Le contrôle est appliqué dynamiquement au démarrage : un module désactivé disparaît de la navigation pour tous les rôles bancaires, immédiatement."),
      React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 } }, LICENSED_MODULES_CATALOG.map(function (m: any) {
        const on = ACTIVE_LICENSE.modules.indexOf(m.id) >= 0;
        return (React.createElement("label", { key: m.id, style: { display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", border: "1px solid " + (on ? T.green : T.line), borderRadius: 9, background: on ? T.greenSoft : T.surface, cursor: "pointer" } },
          React.createElement("input", { type: "checkbox", checked: on, onChange: function () { toggleLicenseModule(m.id); re(); }, style: { accentColor: T.olive600 } }),
          React.createElement("span", { style: { fontSize: 12, fontWeight: on ? 700 : 500, color: on ? T.ink : T.inkMid } }, m.label)));
      })))),
    tab === "poc" && (React.createElement("div", { style: card },
      React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 4 } }, "Licences Démo / POC — temporaires"),
      React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 12 } }, "À expiration : blocage de création, passage en lecture seule, message « Votre environnement Proof Of Concept a expiré. Veuillez contacter Olive. »"),
      React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, DEMO_LICENSES.map(function (d: any) {
        const left = demoDaysRemaining(d);
        const expired = left <= 0;
        return (React.createElement("div", { key: d.id, style: { border: "1px solid " + (expired ? T.red : T.line), borderRadius: 10, padding: "12px 14px", background: expired ? T.redSoft : T.surface } },
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
            React.createElement("span", { style: { fontSize: 12.5, fontWeight: 700, color: T.ink } }, d.customer),
            React.createElement(Badge, { text: d.environment, color: T.gold, bg: T.amberSoft }),
            React.createElement("span", { style: { marginLeft: "auto", fontSize: 11.5, fontWeight: 800, color: expired ? T.red : (left < 7 ? T.amber : T.green) } }, expired ? "EXPIRÉ" : left + " jour(s) restant(s)")),
          React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginTop: 4 } }, d.start, " → ", d.end, " · modules : ", d.modules.join(", ")),
          expired && React.createElement("div", { style: { marginTop: 8, padding: "8px 10px", borderRadius: 7, background: T.surface, border: "1px solid " + T.red + "44", fontSize: 11, color: T.red } }, "« Votre environnement Proof Of Concept a expiré. Veuillez contacter Olive. » — création bloquée, lecture seule active.")));
      })))),
    tab === "etl" && (() => {
      const pkg = MIGRATION_PACKAGES.find(function (p: any) { return p.id === selPkg; });
      return (React.createElement("div", null,
        React.createElement("div", { style: card },
          React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 8 } }, "Structure de données attendue (ETL Designer)"),
          ETL_ENTITY_SCHEMA.map(function (ent: any) {
            return (React.createElement("div", { key: ent.entity, style: { marginBottom: 14 } },
              React.createElement("div", { style: { fontSize: 11, fontWeight: 800, color: T.olive700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 } }, ent.entity),
              React.createElement("table", { style: { borderCollapse: "collapse", fontSize: 11, width: "100%" } },
                React.createElement("thead", null,
                  React.createElement("tr", null, ["Champ", "Type", "Obligatoire", "Exemple"].map(function (h) { return React.createElement("th", { key: h, style: { textAlign: "left", padding: "3px 10px 3px 0", fontSize: 9, color: T.inkSoft, textTransform: "uppercase" } }, h); }))),
                React.createElement("tbody", null, ent.fields.map(function (f: any) {
                  return (React.createElement("tr", { key: f.name, style: { borderTop: "1px solid " + T.lineSoft } },
                    React.createElement("td", { style: { padding: "4px 10px 4px 0", fontFamily: "monospace", color: T.ink } }, f.name),
                    React.createElement("td", { style: { padding: "4px 10px 4px 0", color: T.inkMid } }, f.type),
                    React.createElement("td", { style: { padding: "4px 10px 4px 0", color: f.required ? T.red : T.inkSoft, fontWeight: f.required ? 700 : 400 } }, f.required ? "Oui" : "Non"),
                    React.createElement("td", { style: { padding: "4px 10px 4px 0", color: T.inkSoft, fontFamily: "monospace", fontSize: 10 } }, f.example)));
                })))));
          }),
          React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft } }, "Formats source supportés : ", SOURCE_FORMATS.join(" · "), ".")),
        React.createElement("div", { style: card },
          React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 8 } }, "Packages de migration par banque"),
          React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" } }, MIGRATION_PACKAGES.map(function (p: any) {
            return (React.createElement("button", { key: p.id, onClick: function () { setSelPkg(p.id); }, style: { padding: "7px 14px", borderRadius: 8, border: "1px solid " + (selPkg === p.id ? T.violet : T.line), background: selPkg === p.id ? T.violet + "18" : T.surface, color: selPkg === p.id ? T.violet : T.inkMid, fontSize: 11.5, fontWeight: selPkg === p.id ? 700 : 500, cursor: "pointer" } }, p.tenant));
          })),
          pkg && (React.createElement(React.Fragment, null,
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" } },
              React.createElement("span", { style: { fontSize: 11, color: T.inkMid } }, "Format source : ", React.createElement("strong", null, pkg.format)),
              React.createElement("span", { style: { fontSize: 11, color: T.inkMid } }, "Stratégie :"),
              React.createElement("select", { value: pkg.strategy, onChange: function (e: any) { setMigrationStrategy(pkg, e.target.value, pkg.frequency); re(); }, style: { padding: "4px 8px", borderRadius: 6, border: "1px solid " + T.line, fontSize: 11 } },
                React.createElement("option", { value: "ONE_SHOT" }, "Migration unique (one-shot)"),
                React.createElement("option", { value: "RECURRING" }, "Migration récurrente")),
              pkg.strategy === "RECURRING" && (React.createElement("select", { value: pkg.frequency || "Quotidienne", onChange: function (e: any) { setMigrationStrategy(pkg, "RECURRING", e.target.value); re(); }, style: { padding: "4px 8px", borderRadius: 6, border: "1px solid " + T.line, fontSize: 11 } },
                React.createElement("option", { value: "Quotidienne" }, "Quotidienne"),
                React.createElement("option", { value: "Hebdomadaire" }, "Hebdomadaire"),
                React.createElement("option", { value: "Mensuelle" }, "Mensuelle")))),
            React.createElement("div", { style: { fontSize: 10.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginBottom: 6 } }, "Fichiers du package"),
            React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 } }, pkg.files.map(function (f: any) {
              const ok = f.status === "OK";
              const wait = f.status === "EN ATTENTE";
              const col = ok ? T.green : wait ? T.amber : T.red;
              return (React.createElement("span", { key: f.name, style: { fontSize: 10.5, padding: "4px 10px", borderRadius: 20, background: col + "18", color: col, fontWeight: 700 } }, ok ? "✓" : wait ? "⏳" : "✕", " ", f.name));
            })),
            React.createElement("div", { style: { fontSize: 10.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginBottom: 6 } }, "Suivi des migrations"),
            React.createElement("table", { style: { borderCollapse: "collapse", fontSize: 11, width: "100%", marginBottom: 10 } },
              React.createElement("thead", null,
                React.createElement("tr", null, ["Run", "Date", "Statut", "Lignes", "Erreurs"].map(function (h) { return React.createElement("th", { key: h, style: { textAlign: "left", padding: "4px 10px 4px 0", fontSize: 9, color: T.inkSoft, textTransform: "uppercase" } }, h); }))),
              React.createElement("tbody", null, pkg.runs.map(function (r: any) {
                const col = r.status === "TERMINÉE" ? T.green : r.status === "ÉCHEC" ? T.red : T.amber;
                return (React.createElement("tr", { key: r.id, style: { borderTop: "1px solid " + T.lineSoft } },
                  React.createElement("td", { style: { padding: "5px 10px 5px 0", fontFamily: "monospace", color: T.violet, fontWeight: 700 } }, r.id),
                  React.createElement("td", { style: { padding: "5px 10px 5px 0", color: T.inkSoft } }, r.date),
                  React.createElement("td", { style: { padding: "5px 10px 5px 0", color: col, fontWeight: 700 } }, r.status),
                  React.createElement("td", { style: { padding: "5px 10px 5px 0", fontFamily: "monospace" } }, r.rows.toLocaleString("fr-CH")),
                  React.createElement("td", { style: { padding: "5px 10px 5px 0", color: r.errors > 0 ? T.red : T.inkSoft } }, r.errors)));
              }))),
            React.createElement("button", { onClick: function () { addMigrationRun(pkg, "TERMINÉE", Math.floor(15000 + Math.random() * 5000), Math.floor(Math.random() * 4)); re(); }, style: { padding: "8px 16px", borderRadius: 9, border: "none", background: T.violet, color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer" } }, "▶ Lancer une migration (simulation)"))))));
    })()));
}
