import React, { useEffect, useState } from "react";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { useConfirmGate } from "../../components/ConfirmValidation";  // contrat UX
import { tokens } from "../../theme/tokens";

// Matrice documentaire versionnée (R26/R27/R29). Le CONTENU (documents par type d'entité) est
// ARBITRÉ BANQUE (voie ⚙ R-Q, cf. GOUVERNANCE-LOTC.md) — l'écran ne fabrique aucun seuil : il
// affiche la version en vigueur et publie une nouvelle version (append-only) sur saisie explicite.
// GET /v1/doc-matrix/en-vigueur · POST /v1/doc-matrix { contenu, enVigueurLe }.

export function MatriceDoc() {
  const [courante, setCourante] = useState<any>(null);
  const [contenu, setContenu] = useState("");
  const [enVigueurLe, setEnVigueurLe] = useState("");
  const [msg, setMsg] = useState("");
  const { ask, modal } = useConfirmGate();
  const base = (window as any).OLIVE_API_URL;
  const H = { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` };

  const load = () => fetch(`${base}/v1/doc-matrix/en-vigueur`, { headers: H })
    .then((r) => r.ok ? r.json() : null).then(setCourante).catch(() => setCourante(null));
  useEffect(() => { if (base) load(); }, []);
  if (!base) return <DemoModeBanner/>;

  // Pré-vol : le contenu doit être un JSON valide { exigences: { <type>: {…} } } avant publication.
  let parsed: any = null, jsonOk = false, aExigences = false;
  try { parsed = JSON.parse(contenu || "{}"); jsonOk = true; aExigences = !!parsed?.exigences && typeof parsed.exigences === "object"; } catch { jsonOk = false; }
  const nbTypes = aExigences ? Object.keys(parsed.exigences).length : 0;

  async function publier() {
    setMsg("");
    const r = await fetch(`${base}/v1/doc-matrix`, { method: "POST", headers: H,
      body: JSON.stringify({ contenu: parsed, enVigueurLe: enVigueurLe || undefined }) });
    if (!r.ok) { setMsg((await r.json().catch(() => ({} as any)))?.message ?? "Erreur de publication"); return; }
    const v = await r.json(); setMsg(`Version v${v.version} publiée.`); setContenu(""); load();
  }

  const exig = courante?.contenu?.exigences ?? {};
  return <div>
    {modal}
    <h3>Matrice documentaire (R26/R27)</h3>
    <p style={{ fontSize: tokens.font.sm, color: tokens.color.muted }}>
      Référentiel versionné : documents requis × type d'entité × juridiction. Le contenu est
      <strong> arbitré banque</strong> (gouverné) ; chaque publication crée une version immuable (grandfathering R29).</p>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#eef4e6", fontSize: 12 }}>{msg}</div>}

    <section style={{ margin: "10px 0 18px" }}>
      <h4 style={{ margin: "0 0 6px" }}>Version en vigueur {courante ? `— v${courante.version}` : ""}</h4>
      {!courante && <p style={{ fontSize: 12, color: tokens.color.muted }}>Aucune matrice publiée (défaut neutre : aucune exigence).</p>}
      {courante && <table cellPadding={4} style={{ fontSize: 12, borderCollapse: "collapse" }}>
        <thead><tr style={{ textAlign: "left", color: tokens.color.muted }}><th>Type d'entité</th><th>Entité</th><th>Personne liée</th><th>Compte</th></tr></thead>
        <tbody>{Object.keys(exig).map((k) => <tr key={k} style={{ borderTop: `1px solid ${tokens.color.border}` }}>
          <td style={{ fontWeight: 600 }}>{k}</td>
          <td>{(exig[k].entite ?? []).length}</td><td>{(exig[k].personne_liee ?? []).length}</td><td>{(exig[k].compte ?? []).length}</td>
        </tr>)}</tbody>
      </table>}
    </section>

    <section>
      <h4 style={{ margin: "0 0 6px" }}>Publier une nouvelle version</h4>
      <label style={{ display: "block", fontSize: 12, color: tokens.color.muted, marginBottom: 4 }}>Date de mise en vigueur (optionnel)</label>
      <input type="date" value={enVigueurLe} onChange={(e) => setEnVigueurLe(e.target.value)}
        style={{ padding: 6, borderRadius: 6, border: `1px solid ${tokens.color.border}`, fontSize: 12, marginBottom: 8 }}/>
      <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} rows={10}
        placeholder={'{ "exigences": { "PP": { "entite": [ { "groupe": "id", "parJuridiction": { "CH": "PASSEPORT_CH", "*": "PASSEPORT" } } ], "personne_liee": [], "compte": [] } } }'}
        style={{ width: "100%", fontFamily: "monospace", fontSize: 12, padding: 8, borderRadius: 6, border: `1px solid ${tokens.color.border}` }}/>
      <div style={{ marginTop: 8 }}>
        <button onClick={() => ask({ title: "Publier la matrice documentaire (R29)",
            message: "Publication append-only : la version devient la référence en vigueur (les dossiers estampillés gardent la leur).",
            items: [{ label: jsonOk ? "JSON valide" : "JSON invalide", ok: jsonOk },
              { label: aExigences ? `Bloc « exigences » présent (${nbTypes} type(s) d'entité)` : "Bloc « exigences » manquant", ok: aExigences }],
            blockIfIncomplete: true, confirmLabel: "Publier la version", onConfirm: publier })}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: tokens.color.olive700, color: "#fff", cursor: "pointer", fontSize: 13 }}>
          Publier…</button>
      </div>
    </section>
  </div>;
}
