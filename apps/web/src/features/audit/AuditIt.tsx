import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

/**
 * `auditit` — extension R284 (canon triage final, ratifié 2026-07-28), SO-07/SO-08.
 * Audit IT : (1) la VÉRIFICATION D'INTÉGRITÉ des journaux à la demande — chaîne HMAC
 * kyc_question_history recomputée, liaison record_hash des runs, seq monotones, unicité des
 * versions R282 ; premier maillon rompu LOCALISÉ ; la vérification est ELLE-MÊME tracée
 * (AUDIT_ACCESS). (2) le JOURNAL DES PARAMÉTRAGES transversal (événements R68 de tous les
 * modules, une seule source). Accès SO + DIRECTION — lecture seule stricte.
 */

type Journal = { journal: string; controles: number; statut: string; rompu?: { ref: string; detail: string } };
type Param = { at: string; type: string; cle: string; payload: any };

export function AuditIt() {
  const [journaux, setJournaux] = useState<Journal[] | null>(null);
  const [verifieAt, setVerifieAt] = useState("");
  const [params, setParams] = useState<Param[] | null>(null);

  const verifier = async () => {
    const r = await apiGetSourced<{ verifieAt: string; journaux: Journal[] } | null>("/v1/audit/integrite", null);
    if (!r.isDemo && r.data) { setJournaux(r.data.journaux); setVerifieAt(r.data.verifieAt); }
  };
  const chargerParams = async () => {
    const r = await apiGetSourced<Param[] | null>("/v1/audit/parametrages", null);
    setParams(r.isDemo ? null : r.data);
  };

  const td = { fontSize: 11, borderTop: `1px solid ${tokens.color.border}`, padding: "3px 6px" };
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Audit IT — intégrité des journaux & journal des paramétrages</h3>
    <p style={{ fontSize: 12, color: tokens.color.muted }}>La vérification est un acte TRACÉ (AUDIT_ACCESS). Un maillon rompu est localisé, jamais résumé.</p>
    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
      <button onClick={verifier} disabled={isDemoMode()} style={{ fontSize: 12 }}>Vérifier l&apos;intégrité (tracé)</button>
      <button onClick={chargerParams} disabled={isDemoMode()} style={{ fontSize: 12 }}>Journal des paramétrages</button>
    </div>
    {journaux && <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 11, color: tokens.color.muted }}>vérifié le {verifieAt}</p>
      <table style={{ borderCollapse: "collapse" }}><tbody>
        {journaux.map((j) => <tr key={j.journal}>
          <td style={td}><code>{j.journal}</code></td>
          <td style={td}>{j.controles} contrôles</td>
          <td style={{ ...td, fontWeight: 700, color: j.statut === "OK" ? tokens.color.olive700 : tokens.color.danger }}>{j.statut}</td>
          <td style={{ ...td, maxWidth: 420 }}>{j.rompu?.detail ?? ""}</td>
        </tr>)}
      </tbody></table>
    </div>}
    {params && <table style={{ borderCollapse: "collapse" }}><tbody>
      {params.map((p, i) => <tr key={i}>
        <td style={td}>{new Date(p.at).toLocaleString("fr-CH")}</td>
        <td style={td}><code>{p.type}</code></td>
        <td style={td}>{p.cle}</td>
        <td style={{ ...td, maxWidth: 380, color: tokens.color.muted }}>{JSON.stringify(p.payload).slice(0, 140)}</td>
      </tr>)}
    </tbody></table>}
  </div>;
}
