import React, { useState } from "react";
import { apiGetSourced, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

/**
 * `builder` — R304-R308 (dégel V3, GO Ali 2026-07-28). L'ÉDITEUR de configurations des
 * moteurs ratifiés — zéro runtime ici. Brouillon → simuler (rapport d'impact SERVI) →
 * publier (four-eyes : un SECOND habilité). Les refus de cohérence R306 arrivent du
 * backend EN LISTE COMPLÈTE et s'affichent tels quels (FE-04) — rien n'est précalculé.
 */

type Liste = { brouillons: { id: string; type: string; code: string; auteur: string }[];
  versions: { type: string; code: string; version: number; depuisLe: string; auteur: string; publiePar: string }[] };

const EXEMPLES: Record<string, object> = {
  SECTION: { label: "Ma section", workflows: ["CDD"], questions: [{ code: "Q1", label: "…", requise: false, rights: { RM: "EDIT", ADMIN: "EDIT" } }] },
  WORKFLOW: { etapes: [{ code: "A", owner: "RM", transitions: ["FIN"] }, { code: "FIN", owner: "CO", transitions: [] }], terminaux: ["FIN"] },
  QUESTIONNAIRE: { type: "AR", niveau: "CDD", sectionsActives: ["SOF"], questionsRequises: [], sectionsReconfirmation: ["IDENTITY"] },
};

export function Builder() {
  const [liste, setListe] = useState<Liste | null>(null);
  const [type, setType] = useState("SECTION");
  const [code, setCode] = useState("");
  const [contenu, setContenu] = useState(JSON.stringify(EXEMPLES.SECTION, null, 1));
  const [id, setId] = useState("");
  const [motif, setMotif] = useState("");
  const [msg, setMsg] = useState("");
  const [refus, setRefus] = useState<string[]>([]);
  const [rapport, setRapport] = useState<any | null>(null);

  const charger = async () => {
    const r = await apiGetSourced<Liste | null>("/v1/builder/artefacts", null);
    setListe(r.isDemo ? null : r.data);
  };
  const agir = async (fn: () => Promise<void>) => {
    setMsg(""); setRefus([]);
    try { await fn(); await charger(); }
    catch (e) { const err = e as OliveError;
      setMsg(err.message ?? "Erreur");
      setRefus(err.refus ?? []); }                                            // R306 : LA LISTE, telle quelle
  };
  const td = { fontSize: 12, borderTop: `1px solid ${tokens.color.border}`, padding: "3px 8px" };
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Workflow Builder — l&apos;éditeur des moteurs ratifiés (le moteur exécute, le Builder configure)</h3>
    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
      <select value={type} onChange={(e) => { setType(e.target.value); setContenu(JSON.stringify(EXEMPLES[e.target.value], null, 1)); }} style={{ fontSize: 12 }}>
        <option>SECTION</option><option>QUESTIONNAIRE</option><option>WORKFLOW</option></select>
      <input placeholder="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} style={{ fontSize: 12, width: 130 }}/>
      <button style={{ fontSize: 12 }} disabled={isDemoMode()} onClick={() => agir(async () => {
        const r = await apiPost<{ id: string }>("/v1/builder/artefacts", { type, code, contenu: JSON.parse(contenu) });
        setId(r.id); setMsg(`Brouillon ${code} enregistré — simulez avant de publier (R305).`);
      })}>Enregistrer le brouillon</button>
      <button onClick={charger} disabled={isDemoMode()} style={{ fontSize: 12 }}>Charger</button>
    </div>
    <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} rows={7}
      style={{ width: "100%", fontSize: 11, fontFamily: "monospace" }}/>
    <div style={{ display: "flex", gap: 6, margin: "6px 0" }}>
      <button style={{ fontSize: 12 }} disabled={isDemoMode() || !id} onClick={() => agir(async () => {
        const r = await apiPost<{ rapport: any }>(`/v1/builder/artefacts/${id}/simuler`, {});
        setRapport(r.rapport); setMsg("Simulé — le rapport d'impact est SERVI ; toute modification invalide la simulation.");
      })}>Simuler (bac à sable, R305)</button>
      <input placeholder="motif de publication (R7)" value={motif} onChange={(e) => setMotif(e.target.value)} style={{ fontSize: 12, width: 220 }}/>
      <button style={{ fontSize: 12 }} disabled={isDemoMode() || !id} onClick={() => agir(async () => {
        const r = await apiPost<{ version: number }>(`/v1/builder/artefacts/${id}/publier`, { motif });
        setMsg(`Version ${r.version} publiée — matérialisée chez les moteurs (R308).`);
      })}>Publier (un SECOND habilité — R13)</button>
    </div>
    {msg && <p data-testid="msg-builder" style={{ fontSize: 12, color: tokens.color.olive700 }}>{msg}</p>}
    {refus.length > 0 && <ul data-testid="refus-builder" style={{ fontSize: 12, color: "#b91c1c", margin: "4px 0 4px 18px" }}>
      {refus.map((r, i) => <li key={i}>{r}</li>)}</ul>}
    {rapport && <p style={{ fontSize: 12 }}>Impact : {rapport.dossiersEnCoursConcernes ?? 0} dossier(s) en cours concerné(s)
      {rapport.chargeParRole && <> · charge {Object.entries(rapport.chargeParRole).map(([r, n]) => `${r}:${n}`).join(", ")}</>}
      {rapport.questionsRequisesAjoutees?.length > 0 && <> · requises + {rapport.questionsRequisesAjoutees.join(", ")}</>}
      {" — "}{rapport.note}</p>}
    {liste && <div style={{ display: "flex", gap: 24 }}>
      <div><h4 style={{ fontSize: 13, margin: "4px 0" }}>Brouillons</h4>
        <table style={{ borderCollapse: "collapse" }}><tbody>
          {liste.brouillons.map((b) => <tr key={b.id} onClick={() => setId(b.id)} style={{ cursor: "pointer" }}>
            <td style={td}>{b.type}</td><td style={td}><strong>{b.code}</strong></td>
            <td style={{ ...td, color: tokens.color.muted }}>auteur {b.auteur.slice(0, 8)}…</td></tr>)}
        </tbody></table></div>
      <div><h4 style={{ fontSize: 13, margin: "4px 0" }}>Versions publiées (gravées)</h4>
        <table style={{ borderCollapse: "collapse" }}><tbody>
          {liste.versions.map((v, i) => <tr key={i}>
            <td style={td}>{v.type}</td><td style={td}><strong>{v.code}</strong> v{v.version}</td>
            <td style={{ ...td, color: tokens.color.muted }}>depuis {v.depuisLe.slice(0, 10)} · auteur ≠ publicateur ✓</td></tr>)}
        </tbody></table></div>
    </div>}
  </div>;
}
