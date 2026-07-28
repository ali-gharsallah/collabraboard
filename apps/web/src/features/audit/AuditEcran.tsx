import React, { useState } from "react";
import { apiGetSourced, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

/**
 * Écran AUDIT & TRANSPORT — application PURE de R284 + R286 (canon SO + transport async,
 * ratifié 2026-07-28). Aucun canon nouveau : l'écran REND ce que le backend décide.
 * - Journal des accès (R284/SO-04) : « l'auditeur est audité » — qui a consulté quoi, quand.
 *   Servi en SO/DIR ; append-only (le backend refuse toute suppression).
 * - T9 étendu (R286/AS-04) : « N événements en souffrance, le plus ancien : X » + watermarks
 *   des consommateurs. Le REJEU d'une dead-letter est un acte MANUEL tracé (qui/quand côté
 *   serveur — toujours sûr : les consommateurs sont idempotents).
 * - Export d'audit (R284) : génération TRACÉE — le document est la réponse du serveur.
 */

type Acces = { at: string; par: string; role: string; chemin: string; methode: string };
type Sante = { enSouffrance: number; plusAncien: string | null;
  deadLetters: { id: number; consumer: string; seq: number; erreur: string; tentatives: number; depuis: string }[];
  consommateurs: { consumer: string; stream: string; lastSeq: number; enRetry: boolean; tentatives: number }[] };

export function AuditEcran() {
  const [acces, setAcces] = useState<Acces[] | null>(null);
  const [sante, setSante] = useState<Sante | null>(null);
  const [msg, setMsg] = useState("");

  const charger = async () => {
    setMsg("");
    const a = await apiGetSourced<Acces[] | null>("/v1/audit/acces", null);
    setAcces(a.isDemo ? null : a.data);                       // 403 (rôle non SO/DIR) ⇒ indisponible, jamais un faux vide
    const s = await apiGetSourced<Sante | null>("/v1/events/sante", null);
    setSante(s.isDemo ? null : s.data);
  };
  const rejouer = async (id: number) => {
    setMsg("");
    try {
      const r = await apiPost<{ rejoue: boolean; consumer: string; seq: number }>(`/v1/events/dead-letters/${id}/rejouer`, {});
      await charger();
      setMsg(`Dead-letter ${id} rejouée (${r.consumer}, seq ${r.seq}) — acte tracé côté serveur (qui/quand).`);
    } catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  };
  const exporter = async () => {
    setMsg("");
    try {
      const r = await apiPost<{ genereAt: string; n: number }>("/v1/audit/export", {});
      setMsg(`Export généré à ${r.genereAt} — ${r.n} événements (génération TRACÉE, R284).`);
    } catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  };

  const th = { fontSize: 11, textAlign: "left" as const, color: tokens.color.muted };
  const td = { fontSize: 11, borderTop: `1px solid ${tokens.color.border}` };
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Audit & transport — l&apos;auditeur est audité, l&apos;échec est visible</h3>
    <p style={{ fontSize: 12, color: tokens.color.muted }}>R284 : chaque consultation sensible du Security Officer est un événement append-only.
      R286 : aucun échec de transport n&apos;est silencieux — dead-letter visible, rejeu manuel tracé.</p>
    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
      <button onClick={charger} disabled={isDemoMode()} style={{ fontSize: 12 }}>Charger</button>
      <button onClick={exporter} disabled={isDemoMode()} style={{ fontSize: 12 }}>Exporter (audit tracé)</button>
    </div>
    {msg && <p data-testid="msg-audit" style={{ fontSize: 12, color: tokens.color.olive700 }}>{msg}</p>}

    {sante && <div style={{ marginBottom: 14 }}>
      <h4 style={{ margin: "6px 0" }}>Transport (T9 étendu — R286)</h4>
      <p style={{ fontSize: 12 }}><strong>{sante.enSouffrance} en souffrance</strong>
        {sante.plusAncien ? <> — le plus ancien : {new Date(sante.plusAncien).toLocaleString("fr-CH")}</> : " — rien en souffrance"}</p>
      {sante.deadLetters.length > 0 && <table cellPadding={4} style={{ borderCollapse: "collapse" }}><thead><tr>
        <th style={th}>Consommateur</th><th style={th}>Seq</th><th style={th}>Erreur</th><th style={th}>Tentatives</th><th style={th}>Depuis</th><th style={th}/></tr></thead>
        <tbody>{sante.deadLetters.map((d) => <tr key={d.id}>
          <td style={td}>{d.consumer}</td><td style={td}>{d.seq}</td><td style={{ ...td, maxWidth: 320 }}>{d.erreur}</td>
          <td style={td}>{d.tentatives}</td><td style={td}>{new Date(d.depuis).toLocaleString("fr-CH")}</td>
          <td style={td}><button onClick={() => rejouer(d.id)} style={{ fontSize: 11 }}>Rejouer (tracé)</button></td>
        </tr>)}</tbody></table>}
      <p style={{ fontSize: 11, color: tokens.color.muted, marginTop: 6 }}>Watermarks : {sante.consommateurs.map((c) =>
        `${c.consumer}@${c.lastSeq}${c.enRetry ? ` (retry ${c.tentatives})` : ""}`).join(" · ") || "aucun consommateur"}</p>
    </div>}

    {acces && <div>
      <h4 style={{ margin: "6px 0" }}>Journal des accès d&apos;audit (R284 — servi en SO/DIRECTION)</h4>
      {acces.length === 0 && <p style={{ fontSize: 12, color: tokens.color.muted }}>Aucune consultation sensible journalisée.</p>}
      {acces.length > 0 && <table cellPadding={4} style={{ borderCollapse: "collapse" }}><thead><tr>
        <th style={th}>Quand</th><th style={th}>Qui</th><th style={th}>Rôle</th><th style={th}>Quoi</th></tr></thead>
        <tbody>{acces.map((a, i) => <tr key={i}>
          <td style={td}>{new Date(a.at).toLocaleString("fr-CH")}</td><td style={td}>{a.par}</td>
          <td style={td}>{a.role}</td><td style={td}>{a.methode} {a.chemin}</td>
        </tr>)}</tbody></table>}
    </div>}
  </div>;
}
