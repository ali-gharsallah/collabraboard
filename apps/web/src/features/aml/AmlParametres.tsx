import React, { useEffect, useState } from "react";
import { apiGetSourced } from "../../lib/api";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";
import { useConfirmGate } from "../../components/ConfirmValidation";  // contrat UX

// Onglet « Paramétrages AML » (Bloc 48, R189→R206). Ce n'est PAS un module à part : les
// seuils AML vivent dans le registre R-Q (préfixe `aml`), sous la même gouvernance que tout
// paramètre — changer un seuil est un acte motivé, daté, jamais rétroactif (R7/R125/R126).
// L'onglet n'est qu'une VUE filtrée de /v1/parametres, la porte d'écriture reste le service.

type Entree = { cle: string; type: string; defaut: unknown; regle: string; requis: boolean; description: string };

const SEED: Entree[] = [
  { cle: "amlStructuringAlertCount", type: "int", defaut: 5, regle: "R189", requis: false,
    description: "Nombre de virements sous le seuil qui déclenche un signal de structuring" },
  { cle: "amlHriPays", type: "json", defaut: ["Iran", "Syrie", "Corée du Nord", "Cuba"], regle: "R197", requis: false,
    description: "Juridictions à haut risque (blocage en attente d'approbation CO)" },
  { cle: "amlConcentrationSeuilPct", type: "int", defaut: 80, regle: "R206", requis: false,
    description: "Part (%) du patrimoine sur ≤2 comptes courants qui signale une concentration" },
];

export function AmlParametres() {
  const [entrees, setEntrees] = useState<Entree[]>([]);
  const [edit, setEdit] = useState<Record<string, { valeur: string; motif: string }>>({});
  const [msg, setMsg] = useState("");
  const [demo, setDemo] = useState(false);
  const { ask, modal } = useConfirmGate();               // contrat UX : confirmation + pré-vol

  useEffect(() => {
    apiGetSourced<Entree[]>("/v1/parametres/registre", SEED)
      .then((r) => { setEntrees((r.data ?? []).filter((e) => e.cle.startsWith("aml"))); setDemo(r.isDemo); });
  }, []);

  async function enregistrer(e: Entree) {
    setMsg("");
    const base = (window as any).OLIVE_API_URL;
    const brouillon = edit[e.cle];
    if (!brouillon || !brouillon.motif.trim()) { setMsg(`« ${e.cle} » : motif obligatoire (R7)`); return; }
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    let valeur: unknown = brouillon.valeur;
    if (e.type === "int") valeur = Number(brouillon.valeur);
    else if (e.type === "json") { try { valeur = JSON.parse(brouillon.valeur); } catch { setMsg("JSON invalide"); return; } }
    const r = await fetch(`${base}/v1/parametres/valeur/${e.cle}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` },
      body: JSON.stringify({ valeur, motif: brouillon.motif }),
    });
    const body = await r.json().catch(() => ({}));
    setMsg(r.ok ? `« ${e.cle} » enregistré` : (body.message ?? "Erreur"));
  }

  const inp = { padding: 6, borderRadius: 6, border: "1px solid #ccc", fontSize: 13 };
  return <div>
    {modal}
    {demo && <DemoModeBanner/>}
    <h3>Paramétrages AML — chaque seuil est une règle (R7/R125)</h3>
    <p style={{ color: "#666", fontSize: 13 }}>
      Le régler passe par le registre : motivé, daté, jamais rétroactif. Détection R189→R206.</p>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#f3f0e8" }}>{msg}</div>}
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #4A6B28" }}>
        <th style={{ padding: 6 }}>Règle</th><th>Clé</th><th>Défaut</th><th>Nouvelle valeur</th><th>Motif (R7)</th><th/></tr></thead>
      <tbody>
        {entrees.map((e) => <tr key={e.cle} style={{ borderBottom: "1px solid #eee" }}>
          <td style={{ padding: 6, fontWeight: 600 }}>{e.regle}</td>
          <td title={e.description}>{e.cle}</td>
          <td style={{ color: "#666" }}>{JSON.stringify(e.defaut)}</td>
          <td><input style={inp} value={edit[e.cle]?.valeur ?? ""} placeholder={e.type}
            onChange={(ev) => setEdit({ ...edit, [e.cle]: { valeur: ev.target.value, motif: edit[e.cle]?.motif ?? "" } })}/></td>
          <td><input style={inp} value={edit[e.cle]?.motif ?? ""} placeholder="obligatoire"
            onChange={(ev) => setEdit({ ...edit, [e.cle]: { valeur: edit[e.cle]?.valeur ?? "", motif: ev.target.value } })}/></td>
          <td><button style={{ ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" }}
            onClick={() => ask({ title: `Enregistrer « ${e.cle} » (${e.regle})`,
              message: "Le réglage passe par le registre : motivé, daté, jamais rétroactif.",
              items: [{ label: (edit[e.cle]?.valeur ?? "") !== "" ? `Nouvelle valeur : ${edit[e.cle]?.valeur}` : "Nouvelle valeur manquante", ok: (edit[e.cle]?.valeur ?? "") !== "" },
                { label: (edit[e.cle]?.motif ?? "").trim() ? "Motif fourni (R7)" : "Motif manquant (R7)", ok: !!(edit[e.cle]?.motif ?? "").trim() }],
              blockIfIncomplete: true, confirmLabel: "Enregistrer", onConfirm: () => enregistrer(e) })}>Enregistrer</button></td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}
