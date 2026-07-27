import React, { useState } from "react";
import { isDemoMode, apiPost, OliveError } from "../../lib/api";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";

// Écran « Change of Circumstances » (Vague 3). Enregistre un changement sur une personne
// (POST /v1/personnes/:id/coc — R30). La donnée vit sur la personne ; les dossiers reçoivent des
// ÉVÉNEMENTS TRACÉS (propagation), AUCUNE bascule d'état par effet de bord. Un changement sur un
// champ d'IDENTITÉ (nom, naissance, nationalité) DÉCLENCHE un re-screening (R42) — proposé, jamais
// exécuté. L'écran affiche la matérialité (champ identité ⇒ circuit re-screening).

const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;
const auth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` });
const IDENTITE = new Set(["nom", "naissance", "nationalite"]);

// R276-R278 (canon débloquants partie 2) : le CoC est désormais un DOSSIER à cycle de vie —
// l'écran consomme coc_files (plus seulement des événements). Matérialité/action FIGÉES servies.
type DossierCoc = { id: string; clientId: string; typeCode: string; materialite: string;
  actionRequise: string; statut: string; roleTraitant: string };
const SEED_COC = { total: 1, parMaterialite: { HAUTE: 1 }, dossiers: [{ id: "coc-demo", clientId: "c-demo",
  typeCode: "UBO_CHANGE", materialite: "HAUTE", actionRequise: "REVISION_KYC", statut: "OUVERT", roleTraitant: "CO" }] };

export function ChangementCirconstances() {
  const { data: dossiers, isDemo: demoDossiers, reload } = useApiOrSeed<typeof SEED_COC>("/v1/coc", SEED_COC);
  const [clientId, setClientId] = useState("");
  const [typeCode, setTypeCode] = useState("UBO_CHANGE");
  const [description, setDescription] = useState("");
  const [msgDossier, setMsgDossier] = useState("");
  const [personId, setPersonId] = useState("");
  const [champ, setChamp] = useState("nom");
  const [valeur, setValeur] = useState("");
  const [document, setDocument] = useState("");
  const [msg, setMsg] = useState("");

  async function enregistrer() {
    setMsg("");
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/personnes/${personId}/coc`, { method: "POST", headers: auth(),
      body: JSON.stringify({ champ, valeur, document: document || undefined }) });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(b.message ?? "Erreur"); return; }
    setMsg(IDENTITE.has(champ)
      ? `Changement enregistré sur « ${champ} » (IDENTITÉ) → re-screening DÉCLENCHÉ (R42) + propagation aux dossiers, sans bascule d'état.`
      : `Changement enregistré sur « ${champ} » → propagation aux dossiers (événement tracé), sans re-screening automatique.`);
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  const materiel = IDENTITE.has(champ);
  const ouvrirDossier = async () => {
    setMsgDossier("");
    try { await apiPost("/v1/coc", { clientId, typeCode, description }); setDescription(""); reload(); }
    catch (e) { setMsgDossier((e as OliveError).message ?? "Erreur"); }
  };

  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Change of Circumstances — matérialité & circuit (R30/R42)</h3>
    <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap", alignItems: "center" }}>
      <input style={inp} placeholder="personId" value={personId} onChange={(e) => setPersonId(e.target.value)}/>
      <select style={inp} value={champ} onChange={(e) => setChamp(e.target.value)}>
        {["nom", "naissance", "nationalite", "adresse", "profession", "telephone"].map((c) => <option key={c}>{c}</option>)}
      </select>
      <input style={inp} placeholder="nouvelle valeur" value={valeur} onChange={(e) => setValeur(e.target.value)}/>
      <input style={inp} placeholder="document (optionnel)" value={document} onChange={(e) => setDocument(e.target.value)}/>
      <button style={btn} onClick={enregistrer} disabled={!personId || !valeur}>Enregistrer le changement</button>
    </div>
    <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, fontSize: 13,
      background: materiel ? "#fbeaea" : "#eef3e8", border: `1px solid ${materiel ? "#c33" : "#4A6B28"}` }}>
      {materiel ? "⚠ Champ d'IDENTITÉ — changement MATÉRIEL : déclenche un re-screening (R42)." : "Champ non-identité — propagation tracée aux dossiers, sans re-screening automatique."}
    </div>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#f3f0e8", fontSize: 13 }}>{msg}</div>}
  
    <h4 style={{ marginTop: 18 }}>Dossiers CoC — cycle de vie prouvé (R276-R278){demoDossiers ? " · seed" : ""}</h4>
    {msgDossier && <p style={{ color: "#B5483C", fontSize: 13 }}>{msgDossier}</p>}
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
      <input placeholder="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} style={{ padding: 6, fontSize: 12, width: 240 }}/>
      <input placeholder="type (ex. UBO_CHANGE)" value={typeCode} onChange={(e) => setTypeCode(e.target.value)} style={{ padding: 6, fontSize: 12, width: 180 }}/>
      <input placeholder="description (obligatoire)" value={description} onChange={(e) => setDescription(e.target.value)} style={{ padding: 6, fontSize: 12, width: 260 }}/>
      <button onClick={ouvrirDossier} disabled={isDemoMode() || !clientId.trim() || !description.trim()} style={{ fontSize: 12 }}>Déclarer (dossier)</button>
    </div>
    <table cellPadding={5} style={{ fontSize: 12 }}><thead><tr>
      <th align="left">Type</th><th>Matérialité</th><th>Action requise (figée)</th><th>Statut</th><th>Rôle</th></tr></thead>
      <tbody>{dossiers.dossiers.map((d: DossierCoc) => <tr key={d.id}>
        <td>{d.typeCode}</td>
        <td align="center" style={{ color: d.materialite === "HAUTE" ? "#B5483C" : undefined, fontWeight: d.materialite === "HAUTE" ? 700 : 400 }}>{d.materialite}</td>
        <td align="center">{d.actionRequise}</td><td align="center"><strong>{d.statut}</strong></td><td align="center">{d.roleTraitant}</td>
      </tr>)}</tbody></table>
  </div>;
}
