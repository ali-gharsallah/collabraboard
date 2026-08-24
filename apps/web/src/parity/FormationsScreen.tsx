import React, { useState } from "react";
import { T } from "./tokens";
import { CERT_CATALOG, STAFF_DATA, staffProfile, renewCert, trainingCrossChecks } from "./formations-support";

// Source : docs/reference/olive-demo.html 29471–29630 — porté verbatim.
export function FormationsScreen({ user }: { user?: any }) {
  const [tab, setTab] = useState("staff");
  const [selName, setSelName] = useState<any>(null);
  const [, bump] = useState(0);
  const re = function () { bump(function (x) { return x + 1; }); };
  const card: React.CSSProperties = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
  const profiles = STAFF_DATA.map(staffProfile);
  const nSusp = profiles.filter(function (x) { return x.suspended; }).length;
  const nSoon = profiles.filter(function (x) { return !x.suspended && x.soon.length > 0; }).length;
  const canRenew = user && ["ADMIN", "CO_SR", "DIR", "HPB", "CEO"].indexOf(user.role) >= 0;
  const checks = trainingCrossChecks();
  const SC: any = { "À JOUR": [T.green, "✓"], "ÉCHÉANCE": [T.amber, "⏳"], "ÉCHU": [T.red, "✗"] };
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: T.ink }}>🎓 Formations & habilitations LBA</div>
        <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3 }}>
          {STAFF_DATA.length} collaborateurs exposés aux obligations LBA · {nSusp} habilitation(s) suspendue(s) pour certification échue · {nSoon} échéance(s) sous 90 jours · {checks.length} contrôle(s) de cohérence ouverts. Règle : certification requise échue → habilitations suspendues automatiquement.
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: T.surface, padding: 5, borderRadius: 12, border: "1px solid " + T.line, width: "fit-content" }}>
        {[["staff", "▤ Collaborateurs"], ["matrix", "🎓 Matrice certifications"], ["checks", "⚠ Contrôles de cohérence"]].map(function (x) {
          return (
            <button key={x[0]} onClick={function () { setTab(x[0]); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === x[0] ? T.olive600 : "transparent", color: tab === x[0] ? "#fff" : T.inkMid, fontSize: 12.5, fontWeight: tab === x[0] ? 700 : 500 }}>
              {x[1]}
              {x[0] === "checks" && checks.length > 0 && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, background: T.red, color: "#fff", padding: "1px 6px", borderRadius: 8 }}>{checks.length}</span>}
            </button>
          );
        })}
      </div>
      {tab === "staff" && (
        <div style={card}>
          {profiles.map(function (sp) {
            const open = selName === sp.p.name;
            return (
              <div key={sp.p.name} style={{ marginBottom: 8 }}>
                <div onClick={function () { setSelName(open ? null : sp.p.name); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", borderRadius: 9, border: "1.5px solid " + (open ? T.olive600 : T.lineSoft), background: sp.suspended ? T.redSoft : open ? T.oliveSoft : T.cream, cursor: "pointer" }}>
                  <span style={{ width: 30, height: 30, borderRadius: "50%", background: T.olive600, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{sp.p.name.split(" ").map(function (x: string) { return x[0]; }).join("").slice(0, 2)}</span>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: T.ink }}>{sp.p.name} <span style={{ fontWeight: 500, color: T.inkSoft }}>· {sp.p.role}</span></span>
                  {sp.suspended
                    ? <span style={{ fontSize: 9, fontWeight: 800, color: T.red, background: "#fff", padding: "3px 10px", borderRadius: 12 }}>⛔ HABILITATIONS SUSPENDUES</span>
                    : sp.soon.length > 0
                      ? <span style={{ fontSize: 9, fontWeight: 800, color: T.amber, background: T.amberSoft, padding: "3px 10px", borderRadius: 12 }}>⏳ Échéance &lt; 90 j</span>
                      : <span style={{ fontSize: 9, fontWeight: 800, color: T.green, background: T.greenSoft, padding: "3px 10px", borderRadius: 12 }}>✓ À jour</span>}
                </div>
                {open && (
                  <div style={{ background: T.cream, borderRadius: 10, padding: "12px 16px", marginTop: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginBottom: 6 }}>Certifications requises ({sp.p.role})</div>
                    {sp.certs.map(function (c: any) {
                      const sc = SC[c.status];
                      return (
                        <div key={c.code} style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 0", borderBottom: "1px solid " + T.lineSoft }}>
                          <span style={{ fontWeight: 800, color: sc[0] }}>{sc[1]}</span>
                          <span style={{ fontSize: 11, color: T.ink, flex: 1 }}>{c.label} <span style={{ fontFamily: "monospace", fontSize: 9.5, color: T.inkSoft }}>({c.code})</span></span>
                          <span style={{ fontSize: 10, color: T.inkSoft, fontFamily: "monospace" }}>{c.expiresAt === "—" ? "acquise" : ("validité " + c.expiresAt)}</span>
                          <span style={{ fontSize: 9, fontWeight: 800, color: sc[0] }}>{c.status}{c.renewed ? " (recyclé)" : ""}</span>
                          {c.status === "ÉCHU" && <button onClick={function (e) { e.stopPropagation(); if (canRenew) { renewCert(sp.p, c.code, user); re(); } }} disabled={!canRenew} title={canRenew ? "" : "Réservé : Admin / CO Senior / Direction"} style={{ padding: "4px 10px", borderRadius: 7, border: "none", background: canRenew ? T.olive600 : T.line, color: "#fff", fontSize: 9.5, fontWeight: 800, cursor: canRenew ? "pointer" : "not-allowed" }}>↻ Enregistrer le recyclage</button>}
                        </div>
                      );
                    })}
                    <div style={{ fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", margin: "10px 0 5px" }}>Habilitations {sp.suspended && <span style={{ color: T.red }}>— suspendues jusqu'au recyclage</span>}</div>
                    {sp.habs.map(function (h: string, i: number) { return <div key={i} style={{ fontSize: 11, color: sp.suspended ? T.inkSoft : T.inkMid, textDecoration: sp.suspended ? "line-through" : "none", padding: "2px 0" }}>• {h}</div>; })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {tab === "matrix" && (
        <div style={card}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ textAlign: "left", color: T.inkSoft, textTransform: "uppercase", fontSize: 9 }}>
                  <th style={{ padding: "7px 10px", borderBottom: "1px solid " + T.line }}>Collaborateur</th>
                  {CERT_CATALOG.map(function (c) { return <th key={c.code} style={{ padding: "7px 10px", borderBottom: "1px solid " + T.line }} title={c.label}>{c.code}</th>; })}
                </tr>
              </thead>
              <tbody>
                {profiles.map(function (sp) {
                  return (
                    <tr key={sp.p.name} style={{ background: sp.suspended ? T.redSoft : "transparent" }}>
                      <td style={{ padding: "7px 10px", fontWeight: 700, color: T.ink }}>{sp.p.name}<span style={{ fontWeight: 400, color: T.inkSoft }}> · {sp.p.role}</span></td>
                      {CERT_CATALOG.map(function (cat) {
                        const c = sp.certs.find(function (x: any) { return x.code === cat.code; });
                        if (!c) return <td key={cat.code} style={{ padding: "7px 10px", color: T.lineSoft }}>—</td>;
                        const sc = SC[c.status];
                        return (
                          <td key={cat.code} style={{ padding: "7px 10px" }} title={c.label + " — " + c.status + (c.expiresAt !== "—" ? (" (" + c.expiresAt + ")") : "")}>
                            <span style={{ fontWeight: 800, color: sc[0] }}>{sc[1]}</span> <span style={{ fontSize: 9, color: T.inkSoft, fontFamily: "monospace" }}>{c.expiresAt === "—" ? "" : c.expiresAt.slice(2)}</span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10, color: T.inkSoft, marginTop: 10 }}>✓ à jour · ⏳ échéance sous 90 jours · ✗ échu (habilitations suspendues) — survoler une cellule pour le détail.</div>
        </div>
      )}
      {tab === "checks" && (
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 4 }}>⚠ Contrôles de cohérence — certifications × activité réelle</div>
          <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 12 }}>Le module croise les échéances de certification avec l'activité effectivement tracée (piste d'audit, dossiers assignés, revues, déclarations MROS). C'est la question exacte de l'auditeur : « cette personne avait-elle le droit de faire cet acte ce jour-là ? »</div>
          {checks.length === 0 && <div style={{ padding: "14px 16px", borderRadius: 10, background: T.greenSoft, fontSize: 12, color: T.green, fontWeight: 700 }}>✓ Aucune incohérence — toutes les habilitations exercées sont couvertes par des certifications valides.</div>}
          {checks.map(function (c, i) {
            return (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "9px 12px", borderRadius: 9, background: c.sev === "HIGH" ? T.redSoft : T.amberSoft, marginBottom: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: c.sev === "HIGH" ? T.red : T.amber, flexShrink: 0 }}>{c.sev}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: T.ink, flexShrink: 0 }}>{c.who}</span>
                <span style={{ fontSize: 11, color: T.inkMid }}>{c.what}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
