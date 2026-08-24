import React, { useState } from "react";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { apiGetSourced, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { useConfirmGate } from "../../components/ConfirmValidation";  // contrat UX
import { tokens } from "../../theme/tokens";

// Écran `offboarding` (canon vague écrans pilote §5.3, R267→R271, OF-01..12). La fin de
// relation est un WORKFLOW tracé — jamais une suppression. Le détail rend la machine à
// états, la checklist d'obstacles R269 EN DIRECT (servie par le backend — le front ne
// déduit rien), les visas du type (R268) et les documents. Le panneau « motif sensible »
// (EXIT_COMPLIANCE, R270) n'existe dans le DOM QUE si le backend a servi la clé — servi
// conditionnellement par rôle (pattern SD-03), jamais masqué côté client.

type Ligne = { id: string; clientId: string; type: string; statut: string; createdAt: string;
  clotureEffectiveAt?: string | null; retentionJusqua?: string | null };
type Detail = Ligne & { motif: string; obstacles: string[]; initiateur: string;
  documents: { type: string; ref?: string }[]; visas: { role: string; statut: string; par?: string | null }[];
  attestationAvoirs?: { par: string; at: string; motif: string } | null;
  motifAnnulation?: string | null; motifSensible?: string; mrosRef?: string };

const TYPES = ["DEMANDE_CLIENT", "DECISION_BANQUE", "EXIT_COMPLIANCE", "DECES_SUCCESSION", "TRANSFERT_ETABLISSEMENT"];
const SEED: Ligne[] = [{ id: "OFF-DEMO", clientId: "c-demo", type: "DEMANDE_CLIENT",
  statut: "CLOTURE_DEMANDEE", createdAt: "2026-07-01" }];

export function Offboarding() {
  const { data: lignes, isDemo, reload } = useApiOrSeed<Ligne[]>("/v1/offboarding", SEED);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [msg, setMsg] = useState("");
  const [clientId, setClientId] = useState(""); const [type, setType] = useState(TYPES[0]);
  const [motif, setMotif] = useState(""); const [mrosRef, setMrosRef] = useState("");
  const { ask, modal } = useConfirmGate();               // contrat UX : confirmation + pré-vol

  const agir = async (fn: () => Promise<unknown>) => {
    setMsg("");
    try { await fn(); reload(); if (detail) ouvrir(detail.id); }
    catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }        // FE-04 : le message serveur, tel quel
  };
  const ouvrir = async (id: string) => {
    const r = await apiGetSourced<Detail>(`/v1/offboarding/${id}`, null as unknown as Detail);
    if (!r.isDemo) setDetail(r.data);
  };

  return <div>
    {modal}
    {isDemo && <DemoModeBanner/>}
    <h3>Offboarding — la fin de relation est un workflow, jamais une suppression (R267)</h3>
    {msg && <p style={{ color: tokens.color.danger, fontSize: 13 }}>{msg}</p>}

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
      <input placeholder="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)}
        style={{ padding: 6, borderRadius: 6, border: `1px solid ${tokens.color.border}`, fontSize: 12, width: 260 }}/>
      <select value={type} onChange={(e) => setType(e.target.value)}
        style={{ padding: 6, borderRadius: 6, border: `1px solid ${tokens.color.border}`, fontSize: 12 }}>
        {TYPES.map((t) => <option key={t}>{t}</option>)}</select>
      <input placeholder="motif (obligatoire, R7)" value={motif} onChange={(e) => setMotif(e.target.value)}
        style={{ padding: 6, borderRadius: 6, border: `1px solid ${tokens.color.border}`, fontSize: 12, width: 280 }}/>
      {type === "EXIT_COMPLIANCE" && <input placeholder="réf MROS (accès restreint, R270)" value={mrosRef}
        onChange={(e) => setMrosRef(e.target.value)}
        style={{ padding: 6, borderRadius: 6, border: `1px solid ${tokens.color.border}`, fontSize: 12, width: 240 }}/>}
      <button disabled={isDemoMode() || !clientId.trim() || !motif.trim()}
        onClick={() => agir(() => apiPost("/v1/offboarding", { clientId, type, motif, ...(mrosRef ? { mrosRef } : {}) }))}
        style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: tokens.color.olive700, color: "#fff", cursor: "pointer" }}>
        Demander la clôture</button>
    </div>

    <table cellPadding={6} style={{ fontSize: 13 }}><thead><tr>
      <th align="left">Type</th><th>Statut</th><th>Clôture effective</th><th>Rétention</th><th/></tr></thead>
      <tbody>{lignes.map((l) => <tr key={l.id}>
        <td>{l.type}</td><td align="center"><strong>{l.statut}</strong></td>
        <td align="center">{l.clotureEffectiveAt ? String(l.clotureEffectiveAt).slice(0, 10) : "—"}</td>
        <td align="center">{l.retentionJusqua ? String(l.retentionJusqua).slice(0, 10) : "—"}</td>
        <td><button onClick={() => ouvrir(l.id)} disabled={isDemoMode()} style={{ fontSize: 11 }}>Détail</button></td>
      </tr>)}</tbody></table>

    {detail && <div style={{ marginTop: 16, padding: 14, borderRadius: tokens.radius.lg,
      background: tokens.color.surface, border: `1px solid ${tokens.color.border}` }}>
      <h4>{detail.type} · <span>{detail.statut}</span></h4>
      <p style={{ fontSize: 13 }}>Motif : {detail.motif}</p>
      {/* R270 : ce panneau n'existe QUE si le backend a servi la clé (rôle habilité) */}
      {detail.motifSensible && <div data-testid="panneau-sensible" style={{ padding: 10, borderRadius: 8,
        background: "#FFF8E7", border: "1px solid #C9A227", fontSize: 13 }}>
        <strong>Motif compliance (accès restreint — LBA art. 10a)</strong>
        <div>{detail.motifSensible}</div>
        {detail.mrosRef && <div style={{ color: tokens.color.muted }}>Communication MROS : {detail.mrosRef}</div>}
      </div>}
      <div style={{ marginTop: 10 }}>
        <strong style={{ fontSize: 13 }}>Obstacles à la clôture (R269 — vérifiés par le backend, tous listés)</strong>
        {detail.obstacles.length === 0
          ? <div style={{ fontSize: 13, color: tokens.color.olive700 }}>Aucun obstacle</div>
          : detail.obstacles.map((o, i) => <div key={i} style={{ fontSize: 13, color: tokens.color.danger }}>⛔ {o}</div>)}
      </div>
      <div style={{ marginTop: 10, fontSize: 13 }}>
        <strong>Visas requis par le type (R268)</strong>
        {detail.visas.map((v, i) => <span key={i} style={{ marginLeft: 8 }}>
          {v.statut === "SIGNED" ? "✓" : "…"} {v.role}</span>)}
        <button onClick={() => agir(() => apiPost(`/v1/offboarding/${detail.id}/visa`, {}))}
          style={{ marginLeft: 12, fontSize: 11 }}>Viser (mon rôle)</button>
      </div>
      <div style={{ marginTop: 6, fontSize: 13 }}>
        <strong>Documents</strong> : {detail.documents.length ? detail.documents.map((d) => d.type).join(", ") : "aucun"}
      </div>
      {!detail.attestationAvoirs && <button style={{ marginTop: 8, fontSize: 12 }}
        onClick={() => agir(() => apiPost(`/v1/offboarding/${detail.id}/attestation-avoirs`,
          { motif: "Soldes vérifiés manuellement" }))}>Attester les avoirs (port core absent)</button>}
      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        {detail.statut === "CLOTURE_DEMANDEE" &&
          <button onClick={() => ask({ title: "Passer EN_CLOTURE",
            message: "La clôture ne peut avancer que si les obstacles R269 sont levés (vérifié serveur).",
            items: [{ label: detail.obstacles.length ? `${detail.obstacles.length} obstacle(s) à lever` : "Aucun obstacle", ok: detail.obstacles.length === 0 }],
            confirmLabel: "Passer EN_CLOTURE", onConfirm: () => agir(() => apiPost(`/v1/offboarding/${detail.id}/transition`, { vers: "EN_CLOTURE" })) })}>Passer EN_CLOTURE</button>}
        {detail.statut === "EN_CLOTURE" &&
          <button onClick={() => ask({ title: "Clôturer le dossier", danger: true,
            message: "La clôture est définitive : le dossier passe en lecture seule (rétention LBA).",
            items: [{ label: "Tous les visas requis signés", ok: detail.visas.every((v) => v.statut === "SIGNED") },
              { label: detail.obstacles.length ? `${detail.obstacles.length} obstacle(s) restant(s)` : "Aucun obstacle", ok: detail.obstacles.length === 0 }],
            blockIfIncomplete: true, confirmLabel: "Clôturer définitivement", onConfirm: () => agir(() => apiPost(`/v1/offboarding/${detail.id}/transition`, { vers: "CLOTUREE" })) })}>Clôturer</button>}
        {["CLOTURE_DEMANDEE", "EN_CLOTURE"].includes(detail.statut) &&
          <button onClick={() => ask({ title: "Annuler l'offboarding", danger: true,
            input: { label: "Motif d'annulation (obligatoire, R7)", required: true }, confirmLabel: "Annuler l'offboarding",
            onConfirm: (m) => agir(() => apiPost(`/v1/offboarding/${detail.id}/transition`, { vers: "CLOTURE_ANNULEE", motif: m })) })}>
            Annuler (motivé)</button>}
      </div>
      {detail.statut === "CLOTUREE" && <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8,
        background: "#FDF3F2", border: `1px solid ${tokens.color.danger}`, color: tokens.color.danger, fontSize: 13 }}>
        Dossier clôturé le {String(detail.clotureEffectiveAt).slice(0, 10)} — lecture seule —
        rétention jusqu&apos;au {String(detail.retentionJusqua).slice(0, 10)}</div>}
    </div>}
  </div>;
}
