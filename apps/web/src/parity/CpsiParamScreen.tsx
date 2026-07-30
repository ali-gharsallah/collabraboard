import React, { useState } from "react";
import { T } from "./tokens";
import {
  CPSI, cpsiSetUser, cpsiUserNom, cpsiStats, cpsiDecrireRegles,
  cpsiSimuler, cpsiAppliquer, cpsiPropositions, cpsiCandidatDeProposition, cpsiLog,
} from "./cpsi-engine-support";

// Source : docs/reference/olive-demo.html 25508–25630 — CpsiParamScreen (CPSI — Règles de calcul, paramétrage).
export function CpsiParamScreen({ user }: { user?: any }) {
  cpsiSetUser(user);
  const [, force] = useState(0);
  const re = () => force(x => x + 1);
  const [cand, setCand] = useState<any>(() => JSON.parse(JSON.stringify(CPSI.cfg)));
  const [rapport, setRapport] = useState<any>(null);
  const [simDe, setSimDe] = useState(""); // signature du cand simulé — Appliquer exige une simulation à jour (R70)
  const sig = JSON.stringify(cand);
  cpsiStats(CPSI.cfg); // parité : lecture des stats en vigueur (source)
  const num = (v: string, fn: (x: number) => void) => { const x = parseFloat(v); if (!isNaN(x)) fn(x); };
  const setSig = (k: string, v: number) => { const c = JSON.parse(JSON.stringify(cand)); c.poids_signaux[k] = v; setCand(c); };
  const setSta = (k: string, v: number) => { const c = JSON.parse(JSON.stringify(cand)); c.poids_statique[k] = v; setCand(c); };
  const setHl = (v: number) => { const c = JSON.parse(JSON.stringify(cand)); c.half_life_jours = v; setCand(c); };
  const setB = (i: number, v: number) => { const c = JSON.parse(JSON.stringify(cand)); c.bandes[i] = v; setCand(c); };
  return (
    <div style={{ maxWidth: 1120 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: T.olive700, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>O-Live CPSI</div>
        <div style={{ fontSize: 21, fontWeight: 800, color: T.ink }}>CPSI — Règles de calcul (paramétrage)</div>
        <div style={{ fontSize: 11.5, color: T.inkSoft }}>Les règles sont affichées en clair À CÔTÉ de leur paramétrage (R68), évolutives par l'humain ici et par l'IA en proposition (R69) — TOUT changement se simule d'abord au bac à sable (R70).</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.olive900, marginBottom: 8 }}>Règles de calcul — en clair (R68)</div>
          {cpsiDecrireRegles(CPSI.cfg).map((l: string, i: number) => (
            <div key={i} style={{ fontSize: 11.5, color: i < 2 ? T.ink : T.inkSoft, padding: "4px 0", borderBottom: `1px solid ${T.lineSoft}`, fontWeight: i < 2 ? 700 : 400 }}>{l}</div>
          ))}
          <div style={{ marginTop: 10, fontSize: 10.5, color: T.inkSoft }}>Évolutives par l'humain (ci-contre) et par l'IA en proposition (ci-dessous) — l'humain décide toujours (R69/R44). Chaque modification est journalisée et versionnée par date de mise en vigueur.</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.olive900, marginBottom: 2 }}>Paramétrage — bac à sable d'abord (R70)</div>
          <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 10 }}>« Appliquer » n'est possible qu'après avoir simulé l'impact des valeurs saisies.</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
            <tbody>
              {Object.keys(cand.poids_signaux).map((k: string) => (
                <tr key={k}>
                  <td style={{ padding: "4px 6px", color: T.inkMid }}>Signal · {k}</td>
                  <td style={{ padding: "4px 6px", width: 90 }}>
                    <input type="number" step="0.5" value={cand.poids_signaux[k]} onChange={e => num(e.target.value, v => setSig(k, v))} style={{ width: 80, padding: "4px 7px", borderRadius: 7, border: `1px solid ${T.line}`, fontSize: 11.5 }} />
                  </td>
                </tr>
              ))}
              {Object.keys(cand.poids_statique).map((k: string) => (
                <tr key={k}>
                  <td style={{ padding: "4px 6px", color: T.inkMid }}>Statique · {k}</td>
                  <td style={{ padding: "4px 6px" }}>
                    <input type="number" step="0.5" value={cand.poids_statique[k]} onChange={e => num(e.target.value, v => setSta(k, v))} style={{ width: 80, padding: "4px 7px", borderRadius: 7, border: `1px solid ${T.line}`, fontSize: 11.5 }} />
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: "4px 6px", color: T.inkMid }}>Half-life (jours)</td>
                <td style={{ padding: "4px 6px" }}>
                  <input type="number" value={cand.half_life_jours} onChange={e => num(e.target.value, setHl)} style={{ width: 80, padding: "4px 7px", borderRadius: 7, border: `1px solid ${T.line}`, fontSize: 11.5 }} />
                </td>
              </tr>
              <tr>
                <td style={{ padding: "4px 6px", color: T.inkMid }}>Bandes (LOW/MEDIUM · MEDIUM/HIGH)</td>
                <td style={{ padding: "4px 6px", display: "flex", gap: 6 }}>
                  <input type="number" value={cand.bandes[0]} onChange={e => num(e.target.value, v => setB(0, v))} style={{ width: 52, padding: "4px 7px", borderRadius: 7, border: `1px solid ${T.line}`, fontSize: 11.5 }} />
                  <input type="number" value={cand.bandes[1]} onChange={e => num(e.target.value, v => setB(1, v))} style={{ width: 52, padding: "4px 7px", borderRadius: 7, border: `1px solid ${T.line}`, fontSize: 11.5 }} />
                </td>
              </tr>
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => { setRapport(cpsiSimuler(cand, cpsiUserNom() || "—")); setSimDe(sig); }} style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: T.olive600, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Simuler l'impact</button>
            <button disabled={simDe !== sig} onClick={() => { cpsiAppliquer(cand, cpsiUserNom() || "Admin", "paramétrage manuel"); setRapport(null); setSimDe(""); re(); }} style={{ padding: "8px 16px", borderRadius: 9, border: `1px solid ${simDe === sig ? T.olive600 : T.line}`, background: simDe === sig ? T.oliveSoft : T.cream, color: simDe === sig ? T.olive700 : T.inkSoft, fontSize: 12, fontWeight: 700, cursor: simDe === sig ? "pointer" : "not-allowed" }}>Appliquer les paramètres</button>
          </div>
        </div>
      </div>
      {rapport && (
        <div style={{ marginTop: 14, background: T.surface, border: `1px solid ${T.olive600}40`, borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.olive900, marginBottom: 8 }}>Impact simulé — bac à sable (R70) · rien n'a été modifié</div>
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap", fontSize: 12, marginBottom: 10 }}>
            <span><b>{rapport.clients}</b> clients évalués</span>
            <span>Δ moyen <b style={{ color: rapport.deltaMoyen >= 0 ? T.red : T.green }}>{rapport.deltaMoyen >= 0 ? "+" : ""}{rapport.deltaMoyen}</b> pts</span>
            <span><b style={{ color: T.red }}>{rapport.nouveauxHigh}</b> nouveaux HIGH</span>
            <span>charge de revues induite : <b>{rapport.chargeRevues}</b> dossiers</span>
          </div>
          {rapport.franchissements.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
              <thead>
                <tr>{["Client", "Bande avant", "Bande après", "Score avant → après"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "5px 8px", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", borderBottom: `1px solid ${T.line}` }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {rapport.franchissements.slice(0, 8).map((f: any, i: number) => (
                  <tr key={i}>
                    <td style={{ padding: "5px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontWeight: 700 }}>{f.client}</td>
                    <td style={{ padding: "5px 8px", borderBottom: `1px solid ${T.lineSoft}` }}>{f.avant}</td>
                    <td style={{ padding: "5px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontWeight: 700, color: f.apres === "HIGH" ? T.red : T.olive700 }}>{f.apres}</td>
                    <td style={{ padding: "5px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontFamily: "monospace" }}>{f.s0} → {f.s1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {rapport.franchissements.length > 8 && (
            <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 6 }}>… et {rapport.franchissements.length - 8} autres franchissements.</div>
          )}
        </div>
      )}
      <div style={{ marginTop: 14, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.olive900, marginBottom: 2 }}>Propositions d'Olivia (R69)</div>
        <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 10 }}>L'IA propose avec justification et impact simulé — l'humain adopte ou rejette, tout est tracé (R44).</div>
        {cpsiPropositions().map((p: any) => (
          <div key={p.id} style={{ border: `1px solid ${T.lineSoft}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8, background: p.statut === "EN_ATTENTE" ? "#fff" : T.cream }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, fontWeight: 800, fontFamily: "monospace", color: T.violet || "#7A5AF8", background: "#7A5AF815", padding: "2px 8px", borderRadius: 6 }}>✦ {p.auteur}</span>
              <b style={{ fontSize: 12, color: T.ink }}>{p.chemin} → {p.valeur}</b>
              <span style={{ fontSize: 10, fontWeight: 700, color: p.statut === "EN_ATTENTE" ? T.amber : (p.statut === "ADOPTEE" ? T.green : T.red) }}>{p.statut}</span>
              {p.statut === "EN_ATTENTE" && (
                <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <button onClick={() => { setRapport(cpsiSimuler(cpsiCandidatDeProposition(p), "Olivia")); }} style={{ padding: "4px 10px", borderRadius: 7, border: `1px solid ${T.line}`, background: "#fff", fontSize: 11, cursor: "pointer" }}>Voir l'impact</button>
                  <button onClick={() => { cpsiAppliquer(cpsiCandidatDeProposition(p), cpsiUserNom() || "—", "adoption " + p.id + " (Olivia)"); p.statut = "ADOPTEE"; cpsiLog("proposition_adoptee", { proposition: p.id, decideur: cpsiUserNom() || "—" }); re(); }} style={{ padding: "4px 10px", borderRadius: 7, border: "none", background: T.olive600, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Adopter</button>
                  <button onClick={() => { const m = window.prompt("Motivation du rejet (obligatoire, R69) :"); if (m === null) return; if (!m.trim()) { window.alert("R69 : le rejet exige une motivation."); return; } p.statut = "REJETEE"; cpsiLog("proposition_rejetee", { proposition: p.id, decideur: cpsiUserNom() || "—", motivation: m.trim() }); re(); }} style={{ padding: "4px 10px", borderRadius: 7, border: `1px solid ${T.red}50`, background: "#fff", color: T.red, fontSize: 11, cursor: "pointer" }}>Rejeter</button>
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 5 }}>{p.justification}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.olive900, marginBottom: 8 }}>Journal CPSI (append-only, R49)</div>
        {CPSI.journal.slice(0, 8).map((e: any, i: number) => (
          <div key={i} style={{ fontSize: 11, color: T.inkSoft, padding: "4px 0", borderBottom: `1px solid ${T.lineSoft}` }}>
            <b style={{ color: T.olive700 }}>{e.type}</b>
            {e.acteur ? " · " + e.acteur : ""}
            {e.decideur ? " · décideur " + e.decideur : ""}
            {e.proposition ? " · " + e.proposition : ""}
            {e.franchissements != null ? " · " + e.franchissements + " franchissements" : ""}
            {e.motivation ? " · «" + e.motivation + "»" : ""}
            {e.note ? " · " + e.note : ""}
          </div>
        ))}
        {CPSI.journal.length === 0 && <div style={{ fontSize: 11, color: T.inkSoft }}>Aucun événement — simulez ou modifiez un paramètre.</div>}
      </div>
    </div>
  );
}
