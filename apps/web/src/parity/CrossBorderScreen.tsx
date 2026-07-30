import React, { useState } from "react";
import { T } from "./tokens";
import CLIENTS from "../fixtures/CLIENTS.json";
import { clientById } from "./components-data";
import { CB_ACTIVITIES, CB_RULES, cbCountry, cbCheckTrip, CB_V_META } from "./cross-border-support";

// Source : docs/reference/olive-demo.html 29631–29755 — porté verbatim.
export function CrossBorderScreen({ user }: { user?: any }) {
  const [tab, setTab] = useState("matrix");
  const [tripCC, setTripCC] = useState("");
  const [tripActs, setTripActs] = useState<string[]>(["MEET", "ADVICE"]);
  const [tripRes, setTripRes] = useState<any>(null);
  const [selCid, setSelCid] = useState("");
  const card: React.CSSProperties = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
  const toggleAct = function (a: string) { setTripActs(tripActs.indexOf(a) >= 0 ? tripActs.filter(function (x) { return x !== a; }) : tripActs.concat([a])); setTripRes(null); };
  const client = selCid ? clientById[selCid] : null;
  const cliRules = client ? cbCountry(client.countryCode) : null;
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: T.ink }}>🌐 Cross-Border — restrictions par juridiction</div>
        <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3 }}>Le country manual de la banque : {CB_RULES.length} juridictions × {CB_ACTIVITIES.length} activités. Base : positions FINMA sur les risques juridiques transfrontières — chaque déplacement RM et chaque service offert à un client domicilié à l'étranger passe par cette matrice.</div>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: T.surface, padding: 5, borderRadius: 12, border: "1px solid " + T.line, width: "fit-content" }}>
        {[["matrix", "▤ Matrice pays"], ["trip", "🧳 Check pré-voyage"], ["client", "👤 Par client"]].map(function (x) {
          return <button key={x[0]} onClick={function () { setTab(x[0]); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === x[0] ? T.olive600 : "transparent", color: tab === x[0] ? "#fff" : T.inkMid, fontSize: 12.5, fontWeight: tab === x[0] ? 700 : 500 }}>{x[1]}</button>;
        })}
      </div>
      {tab === "matrix" && (
        <div style={card}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ textAlign: "left", color: T.inkSoft, textTransform: "uppercase", fontSize: 9 }}>
                  <th style={{ padding: "7px 10px", borderBottom: "1px solid " + T.line }}>Juridiction</th>
                  {CB_ACTIVITIES.map(function (a) { return <th key={a.code} style={{ padding: "7px 8px", borderBottom: "1px solid " + T.line }}>{a.label}</th>; })}
                </tr>
              </thead>
              <tbody>
                {CB_RULES.map(function (c) {
                  return (
                    <tr key={c.cc}>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 700, color: T.ink }}>{c.flag} {c.country}</span>
                        <div style={{ fontSize: 9, color: T.inkSoft }}>{c.regime}</div>
                      </td>
                      {CB_ACTIVITIES.map(function (a) {
                        const r = c.rules[a.code];
                        const m = CB_V_META[r[0]];
                        return <td key={a.code} style={{ padding: "8px 8px" }} title={r[1] || m[0]}><span style={{ fontSize: 9, fontWeight: 800, color: m[1], background: T[m[2]], padding: "3px 8px", borderRadius: 9, whiteSpace: "nowrap" }}>{m[0]}</span></td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10, color: T.inkSoft, marginTop: 10 }}>Survoler une cellule pour la règle détaillée (licence requise, reverse solicitation, exemption…).</div>
        </div>
      )}
      {tab === "trip" && (
        <div>
          <div style={Object.assign({}, card, { marginBottom: 14 })}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>🧳 Check pré-voyage — avant tout Business Trip</div>
            <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 12 }}>Sélectionnez la destination et les activités prévues : le moteur rend le verdict juridiction par activité. Chaque check est consigné dans la piste d'audit — c'est la preuve que le RM a vérifié AVANT de partir.</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <select value={tripCC} onChange={function (e) { setTripCC(e.target.value); setTripRes(null); }} style={{ padding: "8px 11px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 11.5 }}>
                <option value="">— Destination —</option>
                {CB_RULES.filter(function (x) { return x.cc !== "CH"; }).map(function (c) { return <option key={c.cc} value={c.cc}>{c.flag} {c.country}</option>; })}
              </select>
              {CB_ACTIVITIES.map(function (a) {
                const on = tripActs.indexOf(a.code) >= 0;
                return <button key={a.code} onClick={function () { toggleAct(a.code); }} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid " + (on ? T.olive600 : T.line), background: on ? T.oliveSoft : T.surface, color: on ? T.olive700 : T.inkMid, fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>{on ? "✓ " : ""}{a.label}</button>;
              })}
              <button onClick={function () { if (tripCC && tripActs.length) setTripRes(cbCheckTrip(tripCC, tripActs, user)); }} disabled={!tripCC || !tripActs.length} style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: (tripCC && tripActs.length) ? T.olive600 : T.line, color: "#fff", fontSize: 12, fontWeight: 800, cursor: (tripCC && tripActs.length) ? "pointer" : "not-allowed" }}>▶ Vérifier</button>
            </div>
          </div>
          {tripRes && tripRes.c && (
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: tripRes.blocked ? T.red : tripRes.cond ? T.amber : T.green, background: tripRes.blocked ? T.redSoft : tripRes.cond ? T.amberSoft : T.greenSoft, padding: "6px 16px", borderRadius: 12 }}>{tripRes.verdict}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: T.ink }}>{tripRes.c.flag} {tripRes.c.country}</span>
                <span style={{ fontSize: 10.5, color: T.inkSoft }}>· {tripRes.c.regime} · consigné dans la piste d'audit</span>
              </div>
              {tripRes.lines.map(function (l: any, i: number) {
                const m = CB_V_META[l.v];
                return (
                  <div key={i} style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid " + T.lineSoft }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: m[1], background: T[m[2]], padding: "3px 8px", borderRadius: 9, width: 66, textAlign: "center", flexShrink: 0 }}>{m[0]}</span>
                    <span style={{ fontSize: 11.5, color: T.ink, width: 200, flexShrink: 0, fontWeight: 600 }}>{l.act}</span>
                    <span style={{ fontSize: 10.5, color: T.inkSoft }}>{l.note || "—"}</span>
                  </div>
                );
              })}
              {tripRes.blocked > 0 && <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: 9, background: T.redSoft, fontSize: 10.5, color: T.inkMid }}>⛔ {tripRes.blocked} activité(s) interdite(s) sans licence locale — les retirer du programme de voyage ou obtenir la clearance Compliance.</div>}
            </div>
          )}
        </div>
      )}
      {tab === "client" && (
        <div style={card}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>👤 Restrictions par client — selon le pays de domicile</div>
          <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 12 }}>Quels services la banque peut offrir à ce client depuis la Suisse : la matrice s'applique au domicile du client, pas seulement aux voyages.</div>
          <select value={selCid} onChange={function (e) { setSelCid(e.target.value); }} style={{ width: "100%", maxWidth: 420, padding: "9px 12px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 12, marginBottom: 14 }}>
            <option value="">— Choisir un client —</option>
            {(CLIENTS as any[]).slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (c) { return <option key={c.id} value={c.id}>{c.countryFlag} {c.name} — {c.country}</option>; })}
          </select>
          {client && !cliRules && <div style={{ padding: "10px 14px", borderRadius: 9, background: T.amberSoft, fontSize: 11.5, color: T.inkMid }}>⚠ {client.countryFlag} {client.country} n'est pas encore dans le country manual — analyse Legal au cas par cas avant toute activité.</div>}
          {client && cliRules && (
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: T.ink, marginBottom: 8 }}>{cliRules.flag} {cliRules.country} — <span style={{ fontWeight: 500, color: T.inkSoft }}>{cliRules.regime}</span></div>
              {CB_ACTIVITIES.map(function (a) {
                const r = cliRules.rules[a.code];
                const m = CB_V_META[r[0]];
                return (
                  <div key={a.code} style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid " + T.lineSoft }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: m[1], background: T[m[2]], padding: "3px 8px", borderRadius: 9, width: 66, textAlign: "center", flexShrink: 0 }}>{m[0]}</span>
                    <span style={{ fontSize: 11.5, color: T.ink, width: 200, flexShrink: 0, fontWeight: 600 }}>{a.label}</span>
                    <span style={{ fontSize: 10.5, color: T.inkSoft }}>{r[1] || "—"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
