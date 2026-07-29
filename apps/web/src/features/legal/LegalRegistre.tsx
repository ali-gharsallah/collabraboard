import React, { useState } from "react";
import { apiGetSourced, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

/**
 * `legalreg` — R312-R313 (dégel V5, ratifié 2026-07-28). Le registre LEGAL vit sur la
 * GED : sans pièce, pas d'objet (le refus R312 s'affiche tel quel). Les échéances sont
 * des FAITS calculés (préavis ouvert, en retard) — notifiées, jamais bloquantes. Le mémo
 * cité par le country manual (R293) se retrouve ici par sa référence — la boucle
 * cross-border est fermée. O-Live structure, il ne rend jamais l'avis.
 */

type Echeance = { reference: string; type: string; dateFin?: string | null;
  preavisJours?: number | null; tacite?: boolean; statut: string };

export function LegalRegistre() {
  const [echeances, setEcheances] = useState<Echeance[] | null>(null);
  const [ref, setRef] = useState("");
  const [objet, setObjet] = useState<any | null>(null);
  const [msg, setMsg] = useState("");

  const charger = async () => {
    const r = await apiGetSourced<Echeance[] | null>("/v1/legal/echeances", null);
    setEcheances(r.isDemo ? null : r.data);
  };
  const td = { fontSize: 12, borderTop: `1px solid ${tokens.color.border}`, padding: "3px 8px" };
  const couleur = (s: string) => s === "EN_RETARD" ? "#b91c1c" : s === "PREAVIS_OUVERT" ? "#b45309" : tokens.color.muted;
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Legal — contrats & mémos sur la GED (le document est la preuve ; l&apos;avis reste à l&apos;avocat)</h3>
    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
      <button onClick={charger} disabled={isDemoMode()} style={{ fontSize: 12 }}>Charger</button>
      <button style={{ fontSize: 12 }} disabled={isDemoMode()} onClick={async () => {
        setMsg("");
        try { const r = await apiPost<{ taches: number; escalades: number }>("/v1/legal/tick", {});
          setMsg(`Tick : ${r.taches} préavis notifié(s), ${r.escalades} escalade(s) — rien n'est bloqué (R39).`); await charger(); }
        catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
      }}>Tick échéances</button>
      <input placeholder="référence (ex. mémo Legal 2024-003)" value={ref} onChange={(e) => setRef(e.target.value)}
        style={{ fontSize: 12, width: 220 }}/>
      <button style={{ fontSize: 12 }} disabled={isDemoMode()} onClick={async () => {
        setMsg(""); setObjet(null);
        const r = await apiGetSourced<any | null>(`/v1/legal/par-reference?ref=${encodeURIComponent(ref)}`, null);
        if (r.isDemo || !r.data) setMsg("Référence inconnue du registre"); else setObjet(r.data);
      }}>Ouvrir par référence (boucle R293)</button>
    </div>
    {msg && <p style={{ fontSize: 12, color: tokens.color.olive700 }}>{msg}</p>}
    {objet && <p data-testid="objet-legal" style={{ fontSize: 12 }}>
      <strong>{objet.reference}</strong> ({objet.type}) — pièce GED {objet.documentId?.slice(0, 8)}…
      {objet.versionEnVigueur && <> · version en vigueur v{objet.versionEnVigueur.numero} (résolue à date, R48)</>}
      {objet.rattachements?.juridiction && <> · juridiction {objet.rattachements.juridiction} (country manual R293)</>}
      {objet.fournisseur && <> · {objet.fournisseur}</>}</p>}
    {echeances && <table style={{ borderCollapse: "collapse" }}><tbody>
      {echeances.map((e) => <tr key={e.reference}>
        <td style={td}><strong>{e.reference}</strong></td>
        <td style={td}>{e.type}</td>
        <td style={td}>{e.dateFin ?? "—"}{e.tacite ? " (tacite reconduction)" : ""}</td>
        <td style={{ ...td, color: couleur(e.statut) }}>{e.statut}</td>
      </tr>)}
    </tbody></table>}
  </div>;
}
