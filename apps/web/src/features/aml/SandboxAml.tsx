import React, { useState } from "react";
import { isDemoMode } from "../../lib/api";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";

// Écran « Bac à sable AML — voir avant d'écrire » (Vague 9, R94 / scénario B-02). On rejoue le
// moteur PUR ratifié (R189→R206) sur des contextes réels avec les seuils ACTUELS puis SIMULÉS,
// et l'on montre l'impact NOMINATIF : alertes avant/après, nouvelles/disparues, chaque nouvelle
// NOMMÉE (client, fait, règle franchie). AUCUNE écriture (ni signal, ni tâche, ni case — R70) :
// la simulation ne matérialise rien. Appliquer reste un acte gouverné au registre (onglet Paramétrage).

type Alerte = { clientId: string; regle: string; type: string; niveau: 1 | 2; note: string; motif: string; bloquant: boolean };
type Resultat = {
  override: { cle: string; valeurActuelle: unknown; valeurSimulee: unknown };
  ecriture: boolean;
  totaux: { avant: number; apres: number; nouvelles: number; disparues: number };
  nouvelles: Alerte[]; disparues: Alerte[];
};

// Contexte de démonstration : 5 virements sous 200k vers le même UBO en 38h (structuring latent).
const CONTEXTE_DEMO = {
  clientId: "demo-client",
  virements: [
    { sens: "SORTIE", montantChf: 149000, at: "2026-06-01T08:00:00Z", uboContrepartie: "ACME-UBO", pays: "CH" },
    { sens: "SORTIE", montantChf: 149000, at: "2026-06-01T18:00:00Z", uboContrepartie: "ACME-UBO", pays: "CH" },
    { sens: "SORTIE", montantChf: 149000, at: "2026-06-02T04:00:00Z", uboContrepartie: "ACME-UBO", pays: "CH" },
    { sens: "SORTIE", montantChf: 149000, at: "2026-06-02T14:00:00Z", uboContrepartie: "ACME-UBO", pays: "CH" },
    { sens: "SORTIE", montantChf: 149000, at: "2026-06-02T22:00:00Z", uboContrepartie: "ACME-UBO", pays: "CH" },
  ],
};

export function SandboxAml() {
  const [cle, setCle] = useState("amlStructuringSeuilChf");
  const [valeur, setValeur] = useState("200000");
  const [res, setRes] = useState<Resultat | null>(null);
  const [msg, setMsg] = useState("");

  async function simuler() {
    setMsg(""); setRes(null);
    const base = (window as any).OLIVE_API_URL;
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/aml/sandbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` },
      body: JSON.stringify({ override: { cle, valeur: Number(valeur) }, contextes: [CONTEXTE_DEMO] }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(body.message ?? "Erreur"); return; }
    setRes(body);
  }

  const inp = { padding: 6, borderRadius: 6, border: "1px solid #ccc", fontSize: 13 };
  const carte = (titre: string, n: number, couleur: string) =>
    <div style={{ flex: 1, padding: 12, borderRadius: 8, background: "#f7f5ef", borderLeft: `4px solid ${couleur}` }}>
      <div style={{ fontSize: 11, color: "#777" }}>{titre}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: couleur }}>{n}</div>
    </div>;
  const liste = (titre: string, arr: Alerte[], couleur: string) => arr.length > 0 &&
    <div style={{ marginTop: 12 }}>
      <h4 style={{ margin: "6px 0", color: couleur }}>{titre}</h4>
      {arr.map((a, i) => <div key={i} style={{ padding: 8, marginBottom: 6, borderRadius: 6, background: "#fff", border: "1px solid #eee" }}>
        <span style={{ fontWeight: 700 }}>{a.regle}</span> · <span style={{ fontFamily: "monospace", fontSize: 11 }}>{a.type}</span>
        {a.bloquant && <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 8, background: "#c33", color: "#fff", fontSize: 10 }}>BLOQUANT</span>}
        <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>Client <strong>{a.clientId}</strong> — {a.note}</div>
        <div style={{ fontSize: 11, color: "#999" }}>{a.motif}</div>
      </div>)}
    </div>;

  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Bac à sable AML — voir avant d'écrire (R94)</h3>
    <p style={{ fontSize: 12, color: "#777" }}>Simule un seuil sur données réelles et montre l'impact NOMINATIF
      (alertes avant/après, nouvelles/disparues nommées). <strong>La simulation n'écrit rien</strong> — ni signal,
      ni tâche, ni case (R70). Appliquer reste un acte gouverné au registre (onglet Paramétrage, R126).</p>
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <label style={{ fontSize: 12, color: "#666" }}>Seuil (clé registre)</label>
      <input style={{ ...inp, width: 220 }} value={cle} onChange={(e) => setCle(e.target.value)}/>
      <label style={{ fontSize: 12, color: "#666" }}>Valeur simulée</label>
      <input style={{ ...inp, width: 120 }} value={valeur} onChange={(e) => setValeur(e.target.value)}/>
      <button style={{ ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" }} onClick={simuler}>Simuler (dry-run)</button>
    </div>
    {msg && <div style={{ margin: "10px 0", padding: 8, borderRadius: 6, background: "#f3f0e8" }}>{msg}</div>}
    {res && <div style={{ marginTop: 14 }}>
      <div style={{ padding: 8, borderRadius: 6, background: "#eef4e6", fontSize: 12, marginBottom: 10 }}>
        <strong>{res.override.cle}</strong> : {String(res.override.valeurActuelle)} → {String(res.override.valeurSimulee)}
        {res.ecriture === false && <span style={{ marginLeft: 10, color: "#4A6B28", fontWeight: 700 }}>✔ aucune écriture (dry-run, R70)</span>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {carte("Alertes avant", res.totaux.avant, "#888")}
        {carte("Alertes après", res.totaux.apres, "#4A6B28")}
        {carte("Nouvelles", res.totaux.nouvelles, "#c93")}
        {carte("Disparues", res.totaux.disparues, "#39c")}
      </div>
      {liste("Nouvelles alertes (nommées)", res.nouvelles, "#c93")}
      {liste("Alertes disparues", res.disparues, "#39c")}
    </div>}
    <p style={{ fontSize: 11, color: "#888", marginTop: 12 }}>Proposer n'est pas appliquer (R96) : le bac à sable propose,
      l'owner arbitre. L'application écrit avec sa date de mise en vigueur (R29) et se journalise — au registre, jamais en dur.</p>
  </div>;
}
