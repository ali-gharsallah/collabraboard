import React, { useState } from "react";
import { apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

// Écran « Bac à sable Onboarding — voir avant d'écrire » (`sbonb`, application R94 — patron sbaml/B-02).
// On rejoue la MÊME détermination SLA que le moteur (R120) sur les onboardings réels, avec le seuil
// ACTUEL puis SIMULÉ, et l'on montre l'impact NOMINATIF : dépassements avant/après, chaque nouveau
// NOMMÉ (prospect, étape, jours écoulés, seuil). AUCUNE écriture (R70/R94) : ni slaSignale, ni alerte,
// ni tâche. Appliquer reste un acte gouverné au registre R-Q (`onboardingSlaJours`, R125/R126).

type Nomme = { onboardingId: string; prospect: string; etape: string; jours: number; seuil: number };
type Resultat = {
  override: { etape: string; valeurActuelle: number; valeurSimulee: number };
  ecriture: boolean;
  totaux: { avant: number; apres: number; nouveaux: number; disparus: number };
  nouveaux: Nomme[]; disparus: Nomme[];
};

const ETAPES = ["COLLECTE", "KYC_EN_COURS", "DECISION"];                  // étapes SLA gouvernées (R120)

export function SandboxOnboarding() {
  const [etape, setEtape] = useState("COLLECTE");
  const [jours, setJours] = useState("15");
  const [res, setRes] = useState<Resultat | null>(null);
  const [msg, setMsg] = useState("");

  async function simuler() {
    setMsg(""); setRes(null);
    try { setRes(await apiPost<Resultat>("/v1/onboarding/sandbox", { override: { etape, jours: Number(jours) } })); }
    catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  }

  const ligne = (n: Nomme, couleur: string) =>
    <div key={n.onboardingId} style={{ padding: 8, marginTop: 6, borderRadius: tokens.radius.md, fontSize: 12,
      background: tokens.color.surface, border: `1px solid ${tokens.color.border}`, borderLeft: `3px solid ${couleur}` }}>
      <strong>{n.prospect}</strong> · étape {n.etape} · <strong>{n.jours} j</strong> écoulés vs seuil {n.seuil} j
    </div>;

  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Bac à sable Onboarding — dry-run d'un seuil SLA (R94 · R120)</h3>
    <p style={{ fontSize: tokens.font.sm, color: tokens.color.muted }}>Simulez un seuil SLA <strong>sans rien écrire</strong> :
      l'impact est <strong>nominatif</strong> (qui entre / sort du dépassement). Le SLA mesure et notifie, il ne coerce
      jamais (R39). Appliquer réellement = acte gouverné au registre R-Q (<code>onboardingSlaJours</code>, R126).</p>
    <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "10px 0", flexWrap: "wrap" }}>
      <select value={etape} onChange={(e) => setEtape(e.target.value)}
        style={{ padding: 7, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.color.border}`, fontSize: 12 }}>
        {ETAPES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <input value={jours} onChange={(e) => setJours(e.target.value)} placeholder="seuil simulé (jours)"
        style={{ padding: 7, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.color.border}`, fontSize: 12, width: 140 }}/>
      <button disabled={isDemoMode()} onClick={simuler} style={{ padding: "7px 16px", borderRadius: 6, border: "none",
        background: isDemoMode() ? "#ccc" : tokens.color.olive700, color: "#fff", cursor: "pointer", fontSize: 12 }}>Simuler (dry-run)</button>
    </div>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#fdeaea", fontSize: 12, color: tokens.color.danger }}>{msg}</div>}
    {res && <div>
      <div style={{ display: "flex", gap: 6, fontSize: 12, flexWrap: "wrap" }}>
        <span style={{ padding: "3px 10px", borderRadius: 999, background: tokens.color.surface, border: `1px solid ${tokens.color.border}` }}>
          {res.override.etape} : {res.override.valeurActuelle} j → <strong>{res.override.valeurSimulee} j</strong></span>
        <span style={{ padding: "3px 10px", borderRadius: 999, background: tokens.color.surface, border: `1px solid ${tokens.color.border}` }}>
          dépassements : {res.totaux.avant} → {res.totaux.apres}</span>
        <span style={{ padding: "3px 10px", borderRadius: 999, background: res.totaux.nouveaux ? tokens.color.gold : tokens.color.ok, color: "#fff" }}>
          nouveaux : {res.totaux.nouveaux}</span>
        <span style={{ padding: "3px 10px", borderRadius: 999, background: tokens.color.surface, border: `1px solid ${tokens.color.border}` }}>
          écriture : {String(res.ecriture)} (dry-run)</span>
      </div>
      {res.nouveaux.length > 0 && <><h4 style={{ margin: "10px 0 2px" }}>Entrent en dépassement (nominatif)</h4>
        {res.nouveaux.map((n) => ligne(n, tokens.color.gold))}</>}
      {res.disparus.length > 0 && <><h4 style={{ margin: "10px 0 2px" }}>Sortent du dépassement</h4>
        {res.disparus.map((n) => ligne(n, tokens.color.ok))}</>}
      {!res.nouveaux.length && !res.disparus.length && <div style={{ marginTop: 10, color: tokens.color.muted, fontSize: 13 }}>
        Aucun changement nominatif avec ce seuil.</div>}
    </div>}
  </div>;
}
