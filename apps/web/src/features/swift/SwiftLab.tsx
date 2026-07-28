import React, { useState } from "react";
import { apiGetSourced, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

/**
 * `swiftlab` — R300 (dégel V1, ratifié 2026-07-28) : un LABORATOIRE d'analyse — parsing
 * ENTRANT seulement, l'émission n'existe pas (structurellement, TF-11). L'extraction est
 * SERVIE ; les champs sensibles (donneur d'ordre, bénéficiaire) sont surlignés — ils
 * nourrissent les attributs R79 côté moteur. Message hors bibliothèque = quarantaine
 * motivée, rendue telle quelle.
 */

type Msg = { type: string; reference: string; devise?: string | null; montant?: number | null;
  donneurOrdre?: string | null; beneficiaire?: string | null; transactionId?: string | null; at: string };
type Quar = { motif: string; apercu: string; at: string };

export function SwiftLab() {
  const [texte, setTexte] = useState("");
  const [resultat, setResultat] = useState<any | null>(null);
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [quar, setQuar] = useState<Quar[] | null>(null);
  const [msg, setMsg] = useState("");

  const charger = async () => {
    const m = await apiGetSourced<Msg[] | null>("/v1/swift/messages", null);
    setMessages(m.isDemo ? null : m.data);
    const q = await apiGetSourced<Quar[] | null>("/v1/swift/quarantaine", null);
    setQuar(q.isDemo ? null : q.data);
  };
  const td = { fontSize: 12, borderTop: `1px solid ${tokens.color.border}`, padding: "3px 8px" };
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Analyseur SWIFT/SEPA — laboratoire d&apos;analyse (parsing entrant ; l&apos;émission n&apos;existe pas)</h3>
    <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={6}
      placeholder="Coller un message MT/MX (MT103, MT202, pacs.008)…"
      style={{ width: "100%", fontSize: 11, fontFamily: "monospace" }}/>
    <div style={{ display: "flex", gap: 8, margin: "6px 0" }}>
      <button style={{ fontSize: 12 }} disabled={isDemoMode()} onClick={async () => {
        setMsg("");
        try { setResultat(await apiPost("/v1/swift/analyser", { texte })); await charger(); }
        catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
      }}>Analyser</button>
      <button style={{ fontSize: 12 }} onClick={charger} disabled={isDemoMode()}>Charger l&apos;historique</button>
    </div>
    {msg && <p style={{ fontSize: 12, color: tokens.color.olive700 }}>{msg}</p>}
    {resultat && (resultat.quarantaine
      ? <p data-testid="swift-quarantaine" style={{ fontSize: 12, color: "#b45309" }}>QUARANTAINE — {resultat.motif}</p>
      : <div data-testid="swift-extraction" style={{ fontSize: 12 }}>
          <p><strong>{resultat.extraction.type}</strong> · réf {resultat.extraction.reference}
            {resultat.extraction.montant != null && <> · {resultat.extraction.montant.toLocaleString("fr-CH")} {resultat.extraction.devise}</>}
            {resultat.transactionId ? " · rattaché au journal" : " · sans transaction rattachée"}</p>
          <p>Donneur d&apos;ordre : <mark>{resultat.extraction.donneurOrdre ?? "—"}</mark> ·
            {" "}Bénéficiaire : <mark>{resultat.extraction.beneficiaire ?? "—"}</mark> (champs sensibles → attributs R79)</p>
        </div>)}
    {messages && messages.length > 0 && <table style={{ borderCollapse: "collapse", marginTop: 8 }}><tbody>
      {messages.map((m, i) => <tr key={i}>
        <td style={td}><strong>{m.type}</strong></td><td style={td}>{m.reference}</td>
        <td style={td}>{m.montant != null ? `${m.montant.toLocaleString("fr-CH")} ${m.devise}` : "—"}</td>
        <td style={{ ...td, color: tokens.color.muted }}>{m.transactionId ? "rattaché" : "non rattaché"}</td>
      </tr>)}
    </tbody></table>}
    {quar && quar.length > 0 && <div style={{ marginTop: 8 }}>
      <h4 style={{ fontSize: 13, margin: "4px 0" }}>Quarantaine (jamais deviné — motifs visibles)</h4>
      {quar.map((q, i) => <p key={i} style={{ fontSize: 12, color: "#b45309" }}>{q.motif}</p>)}
    </div>}
  </div>;
}
