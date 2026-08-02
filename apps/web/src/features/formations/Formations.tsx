import React, { useState } from "react";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { apiGetSourced, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { useConfirmGate } from "../../components/ConfirmValidation";  // contrat UX
import { tokens } from "../../theme/tokens";

// Écran « Formations & Certifications » (MOD-43, R231→R238 · FE-FORM). Câblé au backend :
// catalogue tenant (R231), assignations avec visibilité par profil (R236), complétion événementielle
// avec attestation GED (R232 — le fichier part vers le backend, jamais un service externe), validation
// par visa si mode VALIDATED (R235), rejeu certifiant à date (R238). Rappels informatifs (R233/R39).

type Formation = { code: string; libelle: string; validiteMois?: number; rolesCibles?: string[]; periodicite?: string };
type Assignment = { id: string; userId: string; formationCode: string; echeance: string; statut: string; visaStatut?: string | null };
type Certif = { code: string; obtenueLe: string; expireLe: string };
type CertifRep = { userId: string; asOf?: string; certifie?: boolean; historique: Certif[] };

export function Formations() {
  const { data: catalog, isDemo } = useApiOrSeed<Formation[]>("/v1/formations/catalog", []);
  const { data: assigns, isDemo: d2, reload } = useApiOrSeed<Assignment[]>("/v1/formations/assignments", []);
  const [msg, setMsg] = useState("");
  const [certUser, setCertUser] = useState(""); const [asOf, setAsOf] = useState("");
  const [cert, setCert] = useState<CertifRep | null>(null);
  const { ask, modal } = useConfirmGate();               // contrat UX : confirmation + pré-vol

  async function completer(id: string, docId: string) {
    setMsg("");
    try { await apiPost(`/v1/formations/assignments/${id}/complete`, { attestationDocId: docId }); setMsg("Attestation déposée."); reload(); }
    catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  }
  async function valider(id: string) {
    setMsg("");
    try { await apiPost(`/v1/formations/assignments/${id}/visa`, {}); setMsg("Complétion validée."); reload(); }
    catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  }
  async function chargerCert() {
    setCert(null); if (!certUser.trim()) { setMsg("Renseigner un identifiant collaborateur."); return; }
    const q = `/v1/formations/certifications?userId=${certUser.trim()}${asOf ? `&asOf=${asOf}` : ""}`;
    setCert((await apiGetSourced<CertifRep | null>(q, null)).data);
  }

  const statutColor = (s: string) => s === "COMPLETED" ? tokens.color.ok : s === "EXPIRED" ? tokens.color.danger : tokens.color.warn;
  const th = { padding: 6, textAlign: "left" as const };
  const btn = (bg: string) => ({ padding: "4px 10px", borderRadius: tokens.radius.sm, border: "none", color: "#fff", background: bg, cursor: "pointer", fontSize: 12 });
  return <div>
    {modal}
    {(isDemo || d2) && <DemoModeBanner/>}
    <h3>Formations & Certifications</h3>
    <p style={{ fontSize: tokens.font.sm, color: tokens.color.muted }}>Référentiel 100% tenant (R231). La complétion dépose une
      attestation dans la GED (jamais un service externe, R232). Selon le tenant, une validation par visa peut être requise (R235).</p>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: tokens.radius.sm, background: "#eef4e6", fontSize: 12 }}>{msg}</div>}

    <h4>Catalogue</h4>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
      {catalog.map((f) => <span key={f.code} title={`validité ${f.validiteMois ?? "?"} mois`} style={{ padding: "4px 10px", borderRadius: 16, background: "#eef4e6", fontSize: 11 }}>{f.libelle} <span style={{ color: tokens.color.muted }}>({f.code})</span></span>)}
      {!catalog.length && <span style={{ fontSize: 12, color: tokens.color.muted }}>Aucune formation au référentiel.</span>}
    </div>

    <h4>Dossiers de formation (selon votre profil)</h4>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: tokens.font.sm }}>
      <thead><tr style={{ borderBottom: `2px solid ${tokens.color.olive700}` }}>
        <th style={th}>Formation</th><th style={th}>Collaborateur</th><th style={th}>Échéance</th><th style={th}>Statut</th><th style={th}>Action</th></tr></thead>
      <tbody>
        {assigns.map((a) => <tr key={a.id} style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
          <td style={{ padding: 6 }}>{a.formationCode}</td>
          <td style={{ fontSize: 11 }}>{a.userId}</td><td>{a.echeance}</td>
          <td><span style={{ color: statutColor(a.statut), fontWeight: 700 }}>{a.statut}</span>{a.visaStatut === "PENDING" && <span style={{ marginLeft: 6, color: tokens.color.warn }}>· visa en attente</span>}</td>
          <td>
            {a.statut !== "COMPLETED" && a.visaStatut !== "PENDING" && <button disabled={isDemoMode()} style={btn(tokens.color.olive700)}
              onClick={() => ask({ title: "Déposer l'attestation (R232)",
                message: "La complétion est un événement tracé ; l'attestation part vers la GED (jamais un service externe).",
                input: { label: "Identifiant de l'attestation (pièce GED)", required: true }, confirmLabel: "Déposer",
                onConfirm: (docId) => completer(a.id, docId ?? "") })}>Déposer l'attestation</button>}
            {a.visaStatut === "PENDING" && <button disabled={isDemoMode()} style={btn(tokens.color.gold)}
              onClick={() => ask({ title: "Valider la complétion (visa, R235)",
                message: "Validation par visa de la formation complétée.", confirmLabel: "Valider (visa)",
                onConfirm: () => valider(a.id) })}>Valider (visa)</button>}
          </td>
        </tr>)}
        {!assigns.length && <tr><td colSpan={5} style={{ padding: 6, color: tokens.color.muted }}>Aucune assignation visible.</td></tr>}
      </tbody>
    </table>

    <h4 style={{ marginTop: 16 }}>Certifications — rejeu à date (R238)</h4>
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input style={{ padding: 6, borderRadius: 6, border: "1px solid #ccc", fontSize: 13, width: 260 }} placeholder="Identifiant collaborateur" value={certUser} onChange={(e) => setCertUser(e.target.value)}/>
      <label style={{ fontSize: 12, color: tokens.color.muted }}>au (asOf)</label>
      <input type="date" style={{ padding: 6, borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }} value={asOf} onChange={(e) => setAsOf(e.target.value)}/>
      <button style={{ ...btn(tokens.color.olive700) }} onClick={chargerCert}>Voir</button>
    </div>
    {cert && <div style={{ marginTop: 10, fontSize: 13 }}>
      {cert.asOf && <div>Au {cert.asOf} : <strong style={{ color: cert.certifie ? tokens.color.ok : tokens.color.danger }}>{cert.certifie ? "certifié" : "non certifié"}</strong></div>}
      <ul style={{ fontSize: 12 }}>{cert.historique.map((c, i) => <li key={i}>{c.code} — obtenue {c.obtenueLe}, expire {c.expireLe}</li>)}</ul>
    </div>}
  </div>;
}
