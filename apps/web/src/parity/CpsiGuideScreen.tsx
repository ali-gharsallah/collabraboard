import React, { useState } from "react";
import { T } from "./tokens";
import { CPSI_ETAPES, CPSI_PIEGES, CPSI_DEMO } from "./cpsi-guide-support";

// Source : docs/reference/olive-demo.html 18805–18867 — CpsiGuideScreen (CPSI — Profilage continu, guide).
export function CpsiGuideScreen() {
  const [ong, setOng] = useState("process");
  const ONG: [string, string][] = [["process", "🔄 Le process en 7 étapes"], ["scenario7min", "🎬 Scénario de démo (7 min)"], ["pieges", "⚠ Pièges & réponses"]];
  const card: React.CSSProperties = { background: T.surface, border: "1px solid " + T.line, borderRadius: 12, padding: 16 };
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 21, fontWeight: 800, color: T.ink }}>CPSI — Profilage continu</div>
        <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4, maxWidth: 940, lineHeight: 1.6 }}>
          <b>Client Profiling Server Intelligence</b> : le moteur qui maintient en permanence le profil de risque de chaque client, au lieu d'attendre la revue périodique. Il transforme des faits en franchissements, les franchissements en signaux, les signaux en score, et le score en <b>propositions</b> — jamais en décisions automatiques. Cet écran explique le mécanisme et sert de fil conducteur en démo.
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {ONG.map(o => (
          <button key={o[0]} onClick={() => setOng(o[0])} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid " + (ong === o[0] ? T.olive600 : T.line), background: ong === o[0] ? T.oliveSoft : "transparent", color: ong === o[0] ? T.olive900 : T.inkMid, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{o[1]}</button>
        ))}
      </div>
      {ong === "process" && (
        <div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 14, padding: "10px 14px", background: T.oliveSoft, borderRadius: 10 }}>
            {["Population", "Groupes", "Scénarios & seuils", "Franchissements", "Signaux (dédup)", "Score & bandes", "Propositions"].map((x, i) => (
              <span key={x} style={{ fontSize: 11, fontWeight: 700, color: T.olive900 }}>
                {x}
                {i < 6 ? <span style={{ color: T.olive600, margin: "0 6px" }}>→</span> : null}
              </span>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {CPSI_ETAPES.map((e: any) => (
              <div key={e.n} style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: T.olive600, color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{e.n}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: T.ink }}>{e.t}</span>
                </div>
                <div style={{ fontSize: 11.5, color: T.inkMid, lineHeight: 1.65, marginBottom: 9 }}>{e.d}</div>
                <div style={{ fontSize: 11, color: T.olive700, background: T.oliveSoft, borderRadius: 7, padding: "7px 10px" }}>
                  <b>Où le voir :</b> {e.ou}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {ong === "scenario7min" && (
        <div style={card}>
          <div style={{ fontSize: 12, color: T.inkMid, marginBottom: 14, lineHeight: 1.6 }}>Déroulé face à un Compliance Officer ou un CRO. Chaque étape se joue dans la démo.</div>
          {CPSI_DEMO.map((st: any, i: number) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: i < CPSI_DEMO.length - 1 ? "1px solid " + T.lineSoft : "none" }}>
              <div style={{ minWidth: 200, fontSize: 12, fontWeight: 800, color: T.olive900 }}>{st.t}</div>
              <div style={{ fontSize: 11.5, color: T.inkMid, lineHeight: 1.65 }}>{st.d}</div>
            </div>
          ))}
          <div style={{ marginTop: 14, padding: "10px 12px", background: T.oliveSoft, borderRadius: 8, fontSize: 11.5, color: T.olive900, lineHeight: 1.6 }}>
            <b>Phrase de clôture :</b> « Le CPSI ne décide rien. Il regarde en continu, il propose, il trace — et il vous montre l'impact d'un réglage avant que vous ne l'appliquiez. »
          </div>
        </div>
      )}
      {ong === "pieges" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {CPSI_PIEGES.map((o: any, i: number) => (
            <div key={i} style={card}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 6 }}>{o[0]}</div>
              <div style={{ fontSize: 11.5, color: T.inkMid, lineHeight: 1.65 }}>{o[1]}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
