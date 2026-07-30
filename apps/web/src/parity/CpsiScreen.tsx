import React, { useState } from "react";
import { T } from "./tokens";
import { CPSI_GROUPES } from "./cpsi-data-support";
import {
  CPSI, cpsiSetUser, cpsiUserNom, cpsiStats, cpsiDecrireRegles, cpsiPopulation, cpsiScore,
  cpsiPropositionsAiguillage, cpsiAdopterAiguillage, cpsiRejeterAiguillage,
  cpsiPeutInsider, cpsiInsiders, cpsiTaggerInsider, cpsiLeverInsider, cpsiMembres,
} from "./cpsi-engine-support";

// Source : docs/reference/olive-demo.html 25489–25508 — Aiguillage workflow (propositions CPSI).
function CpsiAiguillageCard() {
  const [, force] = useState(0);
  const re = () => force(x => x + 1);
  const props = cpsiPropositionsAiguillage();
  return (
    <div style={{ marginTop: 14, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: T.olive900, marginBottom: 2 }}>Aiguillage workflow — propositions du CPSI (R66)</div>
      <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 10 }}>Le score propose le régime de diligence, l'humain décide (R44) — chaque décision est tracée dans le dossier ET au journal. <b>{props.length}</b> propositions en attente.</div>
      {props.slice(0, 8).map(function (p: any) {
        return (
          <div key={p.cl.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "8px 10px", borderRadius: 10, border: `1px solid ${T.lineSoft}`, marginBottom: 6, background: "#fff" }}>
            <b style={{ minWidth: 170, fontSize: 12, color: T.ink }}>{p.cl.name}</b>
            <span style={{ fontSize: 11, fontWeight: 800, color: p.sens === "durcissement" ? T.red : T.green }}>{p.de} → {p.vers}</span>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: T.inkMid }}>score {p.score}</span>
            <span style={{ fontSize: 10, color: T.inkSoft, flex: 1, minWidth: 180 }}>{p.drivers.map((d: any) => d[0] + " +" + d[1]).join(" · ")}</span>
            <button onClick={() => { cpsiAdopterAiguillage(p, cpsiUserNom()); re(); }} style={{ padding: "4px 12px", borderRadius: 7, border: "none", background: T.olive600, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Adopter</button>
            <button onClick={() => { const m = window.prompt("Motivation du rejet (obligatoire) :"); if (m === null) return; if (!m.trim()) { window.alert("Le rejet d'une proposition exige une motivation."); return; } cpsiRejeterAiguillage(p, cpsiUserNom(), m.trim()); re(); }} style={{ padding: "4px 12px", borderRadius: 7, border: `1px solid ${T.red}50`, background: "#fff", color: T.red, fontSize: 11, cursor: "pointer" }}>Rejeter</button>
          </div>
        );
      })}
      {props.length > 8 && <div style={{ fontSize: 10.5, color: T.inkSoft }}>… et {props.length - 8} autres propositions.</div>}
      {props.length === 0 && <div style={{ fontSize: 11, color: T.inkSoft }}>Aucun écart entre le score CPSI et les régimes de diligence en vigueur.</div>}
    </div>
  );
}

// Source : docs/reference/olive-demo.html 27218–27265 — Liste d'initiés surveillés (MAR, R75).
function CpsiInsiderCard() {
  const [, force] = useState(0);
  const re = () => force(x => x + 1);
  const [sel, setSel] = useState("");
  const [motif, setMotif] = useState("");
  const [instr, setInstr] = useState("");
  const habilite = cpsiPeutInsider();
  const ins = cpsiInsiders();
  const pop = cpsiPopulation();
  const inities = Object.keys(ins).map(id => { const cl = pop.find((c: any) => c.id === id); return { id: id, name: cl ? cl.name : id, ...ins[id] }; });
  const grp = CPSI_GROUPES.find((g: any) => g.id === "G-INSIDER-DECL");
  return (
    <div style={{ marginTop: 14, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.olive900 }}>Liste d'initiés surveillés — MAR (R75)</div>
        <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 9px", borderRadius: 20, background: T.red + "15", color: T.red }}>● {inities.length} initié{inities.length > 1 ? "s" : ""}</span>
        <span style={{ fontSize: 10.5, color: T.inkSoft }}>groupe « Initiés déclarés » : {grp ? cpsiMembres(grp).length : 0} membres — ciblé par le scénario insider dealing (seuil serré à 1)</span>
      </div>
      <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 12 }}>Statut sensible porté par le client, tracé (qui/quand/motif/instrument), réversible avec motivation — réservé aux rôles habilités (compliance, market surveillance).</div>
      {habilite ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12, padding: "10px 12px", background: T.cream, borderRadius: 10 }}>
          <select value={sel} onChange={e => setSel(e.target.value)} style={{ padding: "6px 9px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 11.5, minWidth: 190, background: "#fff" }}>
            <option value="">— choisir un client —</option>
            {pop.filter((c: any) => !ins[c.id]).slice(0, 220).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={motif} onChange={e => setMotif(e.target.value)} placeholder="Motif (obligatoire)" style={{ padding: "6px 9px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 11.5, flex: 1, minWidth: 200 }} />
          <input value={instr} onChange={e => setInstr(e.target.value)} placeholder="Instrument / émetteur (opt.)" style={{ padding: "6px 9px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 11.5, width: 180 }} />
          <button disabled={!sel || !motif.trim()} onClick={() => { const cl = pop.find((c: any) => c.id === sel); cpsiTaggerInsider(sel, cl.name, motif.trim(), instr.trim()); setSel(""); setMotif(""); setInstr(""); re(); }} style={{ padding: "7px 15px", borderRadius: 9, border: "none", fontSize: 12, fontWeight: 700, cursor: (sel && motif.trim()) ? "pointer" : "not-allowed", background: (sel && motif.trim()) ? T.red : T.line, color: "#fff" }}>Taguer insider</button>
        </div>
      ) : <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 12, fontStyle: "italic" }}>Marquage réservé aux rôles habilités — vue en lecture seule.</div>}
      {inities.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
          <thead>
            <tr>{["Client", "Motif", "Instrument", "Marqué par", "Date", ""].map(h => <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", borderBottom: `1px solid ${T.line}` }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {inities.map((it: any) => (
              <tr key={it.id}>
                <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontWeight: 700, color: T.ink }}>{it.name}</td>
                <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}`, color: T.inkMid, fontSize: 11 }}>{it.motif}</td>
                <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontFamily: "monospace", fontSize: 10.5 }}>{it.instrument}</td>
                <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontSize: 10.5, color: T.inkSoft }}>{it.acteur}</td>
                <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontFamily: "monospace", fontSize: 10.5, color: T.inkSoft }}>{it.date}</td>
                <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}` }}>{habilite && <button onClick={() => { const m = window.prompt("Motivation de la levée du statut insider (obligatoire) :"); if (m === null) return; if (!m.trim()) { window.alert("R75 : la levée exige une motivation."); return; } cpsiLeverInsider(it.id, it.name, m.trim()); re(); }} style={{ padding: "3px 10px", borderRadius: 7, border: `1px solid ${T.line}`, background: "#fff", fontSize: 10.5, cursor: "pointer", color: T.inkMid }}>Lever le statut</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <div style={{ fontSize: 11, color: T.inkSoft }}>Aucun initié déclaré.</div>}
    </div>
  );
}

// Source : docs/reference/olive-demo.html 25445–25488 — porté verbatim.
export function CpsiScreen({ user }: { user?: any }) {
  cpsiSetUser(user);
  const stats = cpsiStats(CPSI.cfg);
  void stats;
  return (
    <div style={{ maxWidth: 1020 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: T.olive700, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>O-Live CPSI</div>
        <div style={{ fontSize: 21, fontWeight: 800, color: T.ink }}>Profilage & segmentation — scoring perpétuel (R63-R67)</div>
        <div style={{ fontSize: 11.5, color: T.inkSoft }}>Vue population. L'édition des règles de calcul vit dans <b>Paramétrage → CPSI — Règles de calcul</b> (bac à sable obligatoire, R70).</div>
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.olive900, marginBottom: 8 }}>Règles de calcul en vigueur — lecture (R68)</div>
        {cpsiDecrireRegles(CPSI.cfg).map((l: string, i: number) => <div key={i} style={{ fontSize: 11.5, color: i < 2 ? T.ink : T.inkSoft, padding: "4px 0", borderBottom: `1px solid ${T.lineSoft}`, fontWeight: i < 2 ? 700 : 400 }}>{l}</div>)}
      </div>
      <div style={{ marginTop: 14, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.olive900, marginBottom: 8 }}>Répartition HIGH — clients à revoir</div>
        {cpsiPopulation().map((cl: any) => ({ cl: cl, r: cpsiScore(cl, CPSI.cfg) })).filter((x: any) => x.r.bande === "HIGH").slice(0, 10).map((x: any) => (
          <div key={x.cl.id} style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 11.5, padding: "5px 0", borderBottom: `1px solid ${T.lineSoft}` }}>
            <b style={{ minWidth: 180, color: T.ink }}>{x.cl.name}</b>
            <span style={{ fontFamily: "monospace", color: T.red, fontWeight: 700 }}>{x.r.score}</span>
            <span style={{ color: T.inkSoft, fontSize: 10.5 }}>{x.r.drivers.slice(0, 3).map((d: any) => d[0] + " +" + d[1]).join(" · ")}</span>
          </div>
        ))}
      </div>
      <CpsiInsiderCard />
      <CpsiAiguillageCard />
    </div>
  );
}
