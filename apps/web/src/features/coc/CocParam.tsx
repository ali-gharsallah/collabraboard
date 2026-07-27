import React, { useState } from "react";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

// `cocparam` (canon vague pilote partie 4 — séquencé APRÈS la PR CoC, comme ratifié : R276
// étendu a CRÉÉ le store COC_CONFIG). Rend le registre versionné à date (types, matérialité,
// action, rôle, sévérité CPSI, source livrée/tenant) ; l'éditeur passe par le BACKEND — la
// contrainte « matérialité HAUTE force la révision KYC » est un refus typé SERVI (SD-06),
// jamais pré-calculé ici.

type TypeCoc = { typeCode: string; libelle: string; materialite: string; actionRequise: string;
  roleTraitant: string; severiteCpsi?: number | null; effetAt?: string; source?: string };
const SEED = { types: [{ typeCode: "UBO_CHANGE", libelle: "Changement d'UBO", materialite: "HAUTE",
  actionRequise: "REVISION_KYC", roleTraitant: "CO", severiteCpsi: 3, source: "livree" } as TypeCoc] };

export function CocParam() {
  const { data, isDemo, reload } = useApiOrSeed<typeof SEED>("/v1/coc/config", SEED);
  const [f, setF] = useState({ typeCode: "", libelle: "", materialite: "MOYENNE", actionRequise: "MAJ_CIBLEE", roleTraitant: "CO", severiteCpsi: "1" });
  const [msg, setMsg] = useState("");

  const definir = async () => {
    setMsg("");
    try {
      await apiPost("/v1/coc/config", { ...f, severiteCpsi: Number(f.severiteCpsi) });
      setMsg(`Type ${f.typeCode} versionné à date (R68/R276).`); reload();
    } catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }          // SD-06 : le refus typé, tel quel
  };
  const inp = { padding: 6, fontSize: 12, border: `1px solid ${tokens.color.border}`, borderRadius: 6 };

  return <div>
    {isDemo && <DemoModeBanner/>}
    <h3>Types de CoC & sensibilité (cocparam) — le store COC_CONFIG, versionné à date (R276)</h3>
    <p style={{ fontSize: 12, color: tokens.color.muted }}>Reconfigurer un type ne requalifie JAMAIS un CoC ouvert
      (grandfathering R29/CC-02). La matérialité HAUTE force « Révision KYC » — contrainte BACKEND, affichée (SD-06).</p>
    {msg && <p data-testid="msg-cocparam" style={{ fontSize: 12, color: tokens.color.danger }}>{msg}</p>}
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
      <input placeholder="typeCode" value={f.typeCode} onChange={(e) => setF({ ...f, typeCode: e.target.value })} style={inp}/>
      <input placeholder="libellé" value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} style={{ ...inp, width: 220 }}/>
      <select value={f.materialite} onChange={(e) => setF({ ...f, materialite: e.target.value })} style={inp}>
        {["HAUTE", "MOYENNE", "BASSE"].map((m) => <option key={m}>{m}</option>)}</select>
      <select value={f.actionRequise} onChange={(e) => setF({ ...f, actionRequise: e.target.value })} style={inp}>
        {["REVISION_KYC", "MAJ_CIBLEE", "PRISE_CONNAISSANCE"].map((a) => <option key={a}>{a}</option>)}</select>
      <select value={f.roleTraitant} onChange={(e) => setF({ ...f, roleTraitant: e.target.value })} style={inp}>
        {["RM", "CO", "CO_SR", "MLRO"].map((r) => <option key={r}>{r}</option>)}</select>
      <input placeholder="sévérité CPSI" value={f.severiteCpsi} onChange={(e) => setF({ ...f, severiteCpsi: e.target.value })} style={{ ...inp, width: 100 }}/>
      <button onClick={definir} disabled={isDemoMode() || !f.typeCode.trim() || !f.libelle.trim()} style={{ fontSize: 12 }}>Définir (versionné)</button>
    </div>
    <table cellPadding={5} style={{ fontSize: 12 }}><thead><tr>
      <th align="left">Type</th><th align="left">Libellé</th><th>Matérialité</th><th>Action requise</th><th>Rôle</th><th>Sévérité CPSI</th><th>Source</th></tr></thead>
      <tbody>{data.types.map((t) => <tr key={t.typeCode}>
        <td><code style={{ fontSize: 11 }}>{t.typeCode}</code></td><td>{t.libelle}</td>
        <td align="center" style={{ color: t.materialite === "HAUTE" ? tokens.color.danger : undefined,
          fontWeight: t.materialite === "HAUTE" ? 700 : 400 }}>{t.materialite}</td>
        <td align="center">{t.actionRequise}</td><td align="center">{t.roleTraitant}</td>
        <td align="center">{t.severiteCpsi ?? "—"}</td>
        <td align="center" style={{ fontSize: 11, color: tokens.color.muted }}>{t.source ?? "—"}</td>
      </tr>)}</tbody></table>
  </div>;
}
