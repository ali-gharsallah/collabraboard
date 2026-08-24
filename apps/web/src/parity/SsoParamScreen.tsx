import React, { useState } from "react";
import { T } from "./tokens";
import { pushParamAudit } from "./param-audit-support";

// Source : docs/reference/olive-demo.html 40398-40525 — SsoParamScreen (SSO — Fédération
// d'identité, paramètre tenant / questionnaire R-Q). Porté verbatim.

const SSO_ROLES = ["RM", "ARM", "CO", "CO_SR", "MLRO", "CF", "BRM", "DIR", "ADMIN"];

export default function SsoParamScreen() {
  const [on, setOn] = useState(false);
  const [proto, setProto] = useState("OIDC");
  const [issuer, setIssuer] = useState("https://login.gharsallah-wealth.ch/realms/olive");
  const [audience, setAudience] = useState("olive-web");
  const [defRole, setDefRole] = useState("—");
  const [mfaPol, setMfaPol] = useState("IDP");
  const [map, setMap] = useState<Array<{ g: string; r: string }>>([
    { g: "gwb-compliance-senior", r: "CO_SR" },
    { g: "gwb-mlro", r: "MLRO" },
    { g: "gwb-rm", r: "RM" },
    { g: "gwb-admin", r: "ADMIN" },
  ]);
  const [ng, setNg] = useState("");
  const [nr, setNr] = useState("RM");
  const [msg, setMsg] = useState<{ k: string; t: string } | null>(null);
  function ajouter() {
    if (!ng.trim()) {
      setMsg({ k: "err", t: "Nom du groupe IdP requis." });
      return;
    }
    if (map.some(function (m) { return m.g === ng.trim(); })) {
      setMsg({ k: "err", t: "Ce groupe est déjà mappé." });
      return;
    }
    setMap(map.concat([{ g: ng.trim(), r: nr }]));
    pushParamAudit("K. Weber (ADMIN)", "SSO — mapping ajouté : groupe « " + ng.trim() + " » → rôle " + nr);
    setNg("");
    setMsg({ k: "ok", t: "Mapping ajouté." });
  }
  function retirer(g: string) {
    setMap(map.filter(function (m) { return m.g !== g; }));
    pushParamAudit("K. Weber (ADMIN)", "SSO — mapping retiré : groupe « " + g + " »");
  }
  function changerRole(g: string, r: string) {
    setMap(map.map(function (m) { return m.g === g ? { g: m.g, r: r } : m; }));
    pushParamAudit("K. Weber (ADMIN)", "SSO — groupe « " + g + " » → rôle " + r);
  }
  function enregistrer() {
    if (on && (!issuer.trim() || !audience.trim())) {
      setMsg({ k: "err", t: "Issuer et Audience sont requis pour activer le SSO." });
      return;
    }
    pushParamAudit("K. Weber (ADMIN)", "SSO " + (on ? "activé" : "désactivé") + " — " + proto + " · issuer " + issuer + " · audience " + audience + " · " + map.length + " mappings · MFA " + (mfaPol === "IDP" ? "déléguée à l'IdP" : "exigée par O-Live"));
    setMsg({ k: "ok", t: "Configuration enregistrée et journalisée (Audit → Audit paramètres)." });
  }
  function tester() {
    if (!issuer.trim() || !audience.trim()) {
      setMsg({ k: "err", t: "Renseignez issuer et audience avant de tester." });
      return;
    }
    setMsg({ k: "ok", t: "Test simulé (mode démo) : découverte " + issuer + "/.well-known/openid-configuration — jeton d'exemple accepté, " + map.length + " groupes traduits en rôles. En production, la signature est vérifiée via le JWKS de l'IdP." });
  }
  const lbl: any = { fontSize: 10.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 };
  const inp: any = { width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12, color: T.ink, background: "#fff" };
  return (React.createElement("div", null,
    React.createElement("div", { style: { marginBottom: 14 } },
      React.createElement("div", { style: { fontSize: 21, fontWeight: 800, color: T.ink } }, "SSO — Fédération d'identité"),
      React.createElement("div", { style: { fontSize: 12, color: T.inkSoft, marginTop: 4, maxWidth: 900, lineHeight: 1.6 } },
        "La banque conserve son annuaire (Entra ID, Keycloak, Ping…). O-Live valide le jeton émis par l'IdP, traduit les groupes en rôles O-Live et provisionne le compte à la première connexion. L'IdP reste la source de vérité du rôle. ",
        React.createElement("b", null, "Paramètre tenant"),
        " — répertorié au questionnaire R-Q.")),
    msg && React.createElement("div", { style: { marginBottom: 12, padding: "9px 12px", borderRadius: 8, fontSize: 11.5, lineHeight: 1.6,
      background: msg.k === "ok" ? T.greenSoft : T.redSoft, color: msg.k === "ok" ? T.green : T.red,
      border: `1px solid ${msg.k === "ok" ? T.green : T.red}30` } }, msg.t),
    React.createElement("div", { style: { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 18, marginBottom: 14 } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 } },
        React.createElement("div", null,
          React.createElement("div", { style: { fontSize: 13.5, fontWeight: 800, color: T.ink } }, "Activer l'authentification fédérée"),
          React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, marginTop: 3 } }, "Si désactivé, les comptes s'authentifient localement (mot de passe + MFA O-Live).")),
        React.createElement("button", { onClick: function () { setOn(!on); }, style: { padding: "7px 16px", borderRadius: 9, cursor: "pointer", fontSize: 11.5, fontWeight: 800,
          border: `1px solid ${on ? T.green : T.line}`, background: on ? T.greenSoft : "transparent", color: on ? T.green : T.inkSoft } }, on ? "✓ SSO activé" : "SSO désactivé")),
      React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, opacity: on ? 1 : 0.55 } },
        React.createElement("div", null,
          React.createElement("div", { style: lbl }, "Protocole"),
          React.createElement("select", { value: proto, onChange: function (e: any) { setProto(e.target.value); }, style: inp, disabled: !on },
            React.createElement("option", { value: "OIDC" }, "OIDC (OpenID Connect)"),
            React.createElement("option", { value: "SAML" }, "SAML 2.0"))),
        React.createElement("div", null,
          React.createElement("div", { style: lbl }, "Audience / Client ID"),
          React.createElement("input", { value: audience, onChange: function (e: any) { setAudience(e.target.value); }, style: inp, disabled: !on })),
        React.createElement("div", { style: { gridColumn: "1 / span 2" } },
          React.createElement("div", { style: lbl }, "Issuer (émetteur du jeton)"),
          React.createElement("input", { value: issuer, onChange: function (e: any) { setIssuer(e.target.value); }, style: inp, disabled: !on }),
          React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginTop: 4 } }, "Tout jeton dont l'émetteur diffère est rejeté. La signature est vérifiée via le JWKS publié par l'IdP.")),
        React.createElement("div", null,
          React.createElement("div", { style: lbl }, "Rôle par défaut (aucun groupe mappé)"),
          React.createElement("select", { value: defRole, onChange: function (e: any) { setDefRole(e.target.value); }, style: inp, disabled: !on },
            React.createElement("option", { value: "—" }, "Aucun — accès refusé (recommandé)"),
            SSO_ROLES.map(function (r) { return React.createElement("option", { key: r, value: r }, r); }))),
        React.createElement("div", null,
          React.createElement("div", { style: lbl }, "Politique MFA"),
          React.createElement("select", { value: mfaPol, onChange: function (e: any) { setMfaPol(e.target.value); }, style: inp, disabled: !on },
            React.createElement("option", { value: "IDP" }, "Déléguée à l'IdP (la banque impose son MFA)"),
            React.createElement("option", { value: "OLIVE" }, "Exigée par O-Live en plus (TOTP)"))))),
    React.createElement("div", { style: { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 18, marginBottom: 14 } },
      React.createElement("div", { style: { fontSize: 13.5, fontWeight: 800, color: T.ink, marginBottom: 4 } }, "Mapping groupes IdP → rôles O-Live"),
      React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, marginBottom: 12 } },
        "Le rôle est recalculé à chaque connexion : retirer un collaborateur d'un groupe suffit à lui retirer le rôle. ",
        map.length,
        " mapping",
        map.length > 1 ? "s" : "",
        "."),
      React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", marginBottom: 12 } },
        React.createElement("thead", null,
          React.createElement("tr", { style: { background: T.lineSoft } }, ["Groupe IdP", "", "Rôle O-Live", ""].map(function (h, i) {
            return (React.createElement("th", { key: i, style: { padding: "9px 12px", textAlign: "left", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 } }, h));
          }))),
        React.createElement("tbody", null, map.map(function (m) {
          return (React.createElement("tr", { key: m.g, style: { borderBottom: `1px solid ${T.lineSoft}` } },
            React.createElement("td", { style: { padding: "9px 12px", fontSize: 12, color: T.ink, fontFamily: "monospace" } }, m.g),
            React.createElement("td", { style: { padding: "9px 12px", fontSize: 13, color: T.olive600 } }, "→"),
            React.createElement("td", { style: { padding: "9px 12px" } },
              React.createElement("select", { value: m.r, onChange: function (e: any) { changerRole(m.g, e.target.value); }, style: { padding: "5px 8px", borderRadius: 7, border: `1px solid ${T.line}`, fontSize: 11.5 } }, SSO_ROLES.map(function (r) { return React.createElement("option", { key: r, value: r }, r); }))),
            React.createElement("td", { style: { padding: "9px 12px", textAlign: "right" } },
              React.createElement("button", { onClick: function () { retirer(m.g); }, style: { padding: "4px 9px", borderRadius: 6, border: `1px solid ${T.line}`, background: "transparent", color: T.red, fontSize: 10, fontWeight: 700, cursor: "pointer" } }, "Retirer"))));
        }))),
      React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
        React.createElement("input", { value: ng, onChange: function (e: any) { setNg(e.target.value); }, placeholder: "Nom du groupe dans l'annuaire (ex. gwb-central-file)", style: { flex: "1 1 320px", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12 } }),
        React.createElement("select", { value: nr, onChange: function (e: any) { setNr(e.target.value); }, style: { padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12 } }, SSO_ROLES.map(function (r) { return React.createElement("option", { key: r, value: r }, r); })),
        React.createElement("button", { onClick: ajouter, style: { padding: "8px 16px", borderRadius: 8, border: "none", background: T.olive600, color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: "pointer" } }, "Ajouter"))),
    React.createElement("div", { style: { display: "flex", gap: 8 } },
      React.createElement("button", { onClick: enregistrer, style: { padding: "9px 20px", borderRadius: 9, border: "none", background: T.olive700, color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" } }, "Enregistrer"),
      React.createElement("button", { onClick: tester, style: { padding: "9px 20px", borderRadius: 9, border: `1px solid ${T.olive600}`, background: "transparent", color: T.olive700, fontSize: 12, fontWeight: 800, cursor: "pointer" } }, "Tester la connexion"))));
}
