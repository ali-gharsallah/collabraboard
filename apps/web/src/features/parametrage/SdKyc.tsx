import React, { useState } from "react";
import { apiGetSourced, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

// `sdkyc` (canon vague pilote partie 4 PARTIELLE — arbitrage : « rendu sur le modèle ACTUEL,
// SD-04 suspendu, écart versionnage kyc_access_rules consigné »). La grille RENDE la matrice
// dérivée des KycAccessRule par question ; l'édition d'une cellule passe les GARDE-FOUS backend
// (SD-02 : refus typé AFFICHÉ tel quel, jamais pré-calculé ici). « Voir comme » est SERVI par
// le backend avec le rôle simulé (SD-03) — jamais un masquage front.

type Matrice = { code: string; sections: { code: string; label: string; visas: string[];
  questions: { code: string; label: string; droits: Record<string, string> }[] }[] };
const ROLES = ["RM", "ARM", "CO", "CO_SR", "MLRO", "CF", "BRM", "DIR"];
const DROITS = ["HIDDEN", "VIEW", "EDIT", "REQUIRED"];
const COULEUR: Record<string, string> = { HIDDEN: "#eee", VIEW: "#EAF2FA", EDIT: "#E8F0DC", REQUIRED: "#F8ECD7" };

export function SdKyc() {
  const [code, setCode] = useState("");
  const [matrice, setMatrice] = useState<Matrice | null>(null);
  const [voirComme, setVoirComme] = useState<{ role: string; questions: number } | null>(null);
  const [msg, setMsg] = useState("");

  const charger = async (c: string) => {
    setMsg(""); setVoirComme(null);
    const r = await apiGetSourced<Matrice>(`/v1/kyc/${c}/access-matrix`, null as unknown as Matrice);
    if (r.isDemo || !r.data) setMsg("Matrice indisponible (dossier inconnu ou API absente)");
    else setMatrice(r.data);
  };
  const changer = async (q: string, role: string, right: string) => {
    setMsg("");
    try {
      await fetchPatch(`/v1/kyc/${code.trim()}/questions/${q}/access`, { role, right });
      await charger(code.trim());
      setMsg(`Modifié : ${q} × ${role} → ${right} (événement au change tracker).`);
    } catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }          // SD-02 : le refus TYPÉ, tel quel
  };
  const simuler = async (role: string) => {
    setMsg("");
    const r = await apiGetSourced<{ sections: { questions: unknown[] }[] }>(`/v1/kyc/${code.trim()}/voir-comme/${role}`, null as never);
    if (!r.isDemo && r.data) setVoirComme({ role, questions: r.data.sections.flatMap((s) => s.questions).length });
    else setMsg("« Voir comme » indisponible");
  };

  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Sections & droits KYC (sdkyc) — la matrice, servie et gardée par le backend</h3>
    <p style={{ fontSize: 12, color: tokens.color.muted }}>Modèle ACTUEL par question (écart SD-04 consigné : pas de versionnage à date).
      Les garde-fous (section sans éditeur, visa d&apos;un rôle aveugle) sont REFUSÉS par le backend — l&apos;écran affiche le refus, il ne le pré-calcule pas.</p>
    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
      <input placeholder="code du dossier (ex. KYC-2026-CH-0001-R1)" value={code} onChange={(e) => setCode(e.target.value)}
        style={{ padding: 6, fontSize: 12, width: 280, border: `1px solid ${tokens.color.border}`, borderRadius: 6 }}/>
      <button onClick={() => charger(code.trim())} disabled={!code.trim() || isDemoMode()} style={{ fontSize: 12 }}>Charger la matrice</button>
    </div>
    {msg && <p style={{ fontSize: 12, color: tokens.color.danger }}>{msg}</p>}
    {matrice && <>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12 }}>Voir comme :</span>
        {ROLES.slice(0, 4).map((r) => <button key={r} onClick={() => simuler(r)} style={{ fontSize: 11 }}>{r}</button>)}
        {voirComme && <span data-testid="voir-comme" style={{ fontSize: 12, color: tokens.color.olive700 }}>
          vue {voirComme.role} (servie backend) : <strong>{voirComme.questions}</strong> questions visibles</span>}
      </div>
      {matrice.sections.map((s) => <div key={s.code} style={{ marginBottom: 12 }}>
        <h4 style={{ margin: "6px 0 2px" }}>{s.label} {s.visas.map((v) => <span key={v} style={{ marginLeft: 6, fontSize: 10,
          padding: "1px 8px", borderRadius: 999, background: tokens.color.gold, color: "#fff" }}>visa {v}</span>)}</h4>
        <table cellPadding={3} style={{ fontSize: 11, borderCollapse: "collapse" }}><thead><tr>
          <th align="left" style={{ minWidth: 220 }}>Question</th>{ROLES.map((r) => <th key={r}>{r}</th>)}</tr></thead>
          <tbody>{s.questions.map((q) => <tr key={q.code}>
            <td>{q.label}</td>
            {ROLES.map((r) => <td key={r} style={{ background: COULEUR[q.droits[r]] ?? "#eee", textAlign: "center" }}>
              <select value={q.droits[r]} onChange={(e) => changer(q.code, r, e.target.value)}
                disabled={isDemoMode()} style={{ fontSize: 10, border: "none", background: "transparent" }}>
                {DROITS.map((d) => <option key={d}>{d}</option>)}</select></td>)}
          </tr>)}</tbody></table>
      </div>)}
    </>}
  </div>;
}

async function fetchPatch(path: string, body: unknown) {
  const base = (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;
  if (!base) throw { code: "DEMO_MODE", status: 0, message: "Mode démonstration" } as OliveError;
  const r = await fetch(`${base}${path}`, { method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` },
    body: JSON.stringify(body) });
  if (!r.ok) { const b = await r.json().catch(() => ({})); throw { code: "ERR", status: r.status, message: b.message ?? "Erreur" } as OliveError; }
  return r.json();
}
