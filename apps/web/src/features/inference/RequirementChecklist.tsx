import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";

// P-L7-5 — <RequirementChecklist caseId/> branchée sur l'API RÉELLE du ledger
// (GET /v1/inference/:kycId/ledger, /explain/:rid). AUCUNE valeur fabriquée côté front
// (leçon L6-3) : l'écran AFFICHE les statuts/gap/explications servis par le module A.
// Palette Encre & Olive : INK #232A1E · OLIVE #5C6B3C · PAPER #EEF0EA.

const INK = "#232A1E", OLIVE = "#5C6B3C", PAPER = "#EEF0EA";
type Statut = { id: string; satisfied: boolean; satisfiedBy?: string; derivedBy?: string };
type Gap = Statut & { severity: string; basis: string };
type Ledger = { profil: string; statuts: Statut[]; gap: Gap[] };

export const GROUPES: [string, string][] = [["data", "Données"], ["document", "Documents"],
  ["check", "Contrôles"], ["approval", "Visas"]];
/** Groupe par kind (déduit de l'id de gap sinon de l'explain), BLOQUANTS D'ABORD dans chaque groupe. */
export function grouperStatuts(statuts: Statut[], gap: Gap[]) {
  const sev = new Map(gap.map((g) => [g.id, g.severity]));
  const basis = new Map(gap.map((g) => [g.id, g.basis]));
  const kindDe = (id: string) => id.includes("DOC") || id.includes("EDD") ? "document"
    : id.includes("CHECK") ? "check" : id.includes("VISA") ? "approval" : "data";
  return GROUPES.map(([kind, titre]) => ({ kind, titre,
    lignes: statuts.filter((s) => kindDe(s.id) === kind)
      .map((s) => ({ ...s, severity: sev.get(s.id) ?? "", basis: basis.get(s.id) ?? "" }))
      .sort((a, b) => Number(b.severity === "bloquant") - Number(a.severity === "bloquant")) }))
    .filter((g) => g.lignes.length);
}

export function RequirementChecklist({ caseId }: { caseId: string }) {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [pourquoi, setPourquoi] = useState<any>(null);
  const charger = async () =>
    setLedger((await apiGetSourced<Ledger | null>(`/v1/inference/${caseId}/ledger`, null)).data);
  const expliquer = async (rid: string) =>
    setPourquoi((await apiGetSourced<any>(`/v1/inference/${caseId}/explain/${rid}`, null)).data);

  const card = { background: "#fff", border: `1px solid ${OLIVE}33`, borderRadius: 10, padding: 12, marginBottom: 10 };
  return <div style={{ background: PAPER, color: INK, padding: 14, borderRadius: 12 }}>
    {isDemoMode() && <DemoModeBanner/>}
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
      <h3 style={{ margin: 0, color: INK }}>Checklist d'exigences (module A — le ledger est une vue)</h3>
      <button onClick={charger} style={{ background: OLIVE, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>Charger</button>
      {ledger && <span style={{ fontSize: 12, color: OLIVE }}>profil : {ledger.profil} · {ledger.gap.length} manque(s)</span>}
    </div>
    {ledger && grouperStatuts(ledger.statuts, ledger.gap).map((g) => <div key={g.kind} style={card}>
      <b style={{ color: OLIVE }}>{g.titre}</b>
      {g.lignes.map((l) => <div key={l.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderTop: `1px solid ${PAPER}` }}>
        <span>{l.satisfied ? "✅" : l.severity === "bloquant" ? "⛔" : "▫️"}</span>
        <code style={{ fontSize: 12 }}>{l.id}</code>
        {l.basis && <span title={l.basis} style={{ fontSize: 11, background: `${OLIVE}22`, color: INK,
          borderRadius: 6, padding: "1px 6px", cursor: "help" }}>{l.basis.split("·")[0].trim()}</span>}
        <span style={{ fontSize: 12, color: "#555" }}>{l.satisfied ? `preuve : ${l.satisfiedBy}` : l.derivedBy}</span>
        <a style={{ fontSize: 12, color: OLIVE, cursor: "pointer", marginLeft: "auto" }}
          onClick={() => expliquer(l.id)}>pourquoi ?</a>
      </div>)}
    </div>)}
    {pourquoi && <pre style={{ ...card, fontSize: 11, overflowX: "auto" }}>{JSON.stringify(pourquoi, null, 2)}</pre>}
  </div>;
}

export function InferenceScreen() {
  const [caseId, setCaseId] = useState("");
  return <div>
    <input placeholder="kycFileId" value={caseId} onChange={(e) => setCaseId(e.target.value)}
      style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", marginBottom: 10 }}/>
    {caseId && <RequirementChecklist caseId={caseId}/>}
  </div>;
}
