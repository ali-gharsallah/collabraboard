import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";
import { traduire, langue } from "../../lib/i18n";

/**
 * Écran « Rapports conformité » — câblage des routes /v1/rapports/* jusqu'ici sans
 * consommateur front : KPI période (P-L8-2), rapport trimestriel exportable (CSV servi
 * par l'API — jamais recalculé côté écran), et les registres R50 (dérogations, hits,
 * PEP, retards de recertification). AUCUNE valeur fabriquée (leçon L6-3) : l'écran
 * affiche les chiffres ET LES DÉFINITIONS servies (un KPI sans définition est un
 * chiffre mort — doctrine P-L8-2).
 */

type Comptes = Record<string, number>;
type Kpi = {
  periode: { du: string; au: string };
  definitions: Record<string, string>;
  screening: { volumes: Comptes; parListe: Comptes; ageMoyenJours: number;
    ageP90Jours: number; verdicts: Comptes };
  riskCases: { volumes: Comptes };
  mros: { volumes: Comptes; conversionAlerteDeclaration: number };
  chargeParAnalyste: Comptes;
  csv?: string; trimestre?: string;
};

const c = tokens.color;
const carte: React.CSSProperties = { background: "#fff", border: `1px solid ${c.border}`,
  borderRadius: tokens.radius.lg, padding: 14 };
const chiffre: React.CSSProperties = { fontSize: 26, fontWeight: 700, color: c.olive900,
  fontVariantNumeric: "tabular-nums" };
const etiquette: React.CSSProperties = { fontSize: 11, textTransform: "uppercase",
  letterSpacing: 0.4, color: c.muted };

function Tuile({ titre, valeur, detail }: { titre: string; valeur: React.ReactNode; detail?: string }) {
  return <div style={{ ...carte, minWidth: 150, flex: 1 }}>
    <div style={etiquette}>{titre}</div>
    <div style={chiffre}>{valeur}</div>
    {detail && <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }} title={detail}>{detail}</div>}
  </div>;
}
function Repartition({ titre, valeurs }: { titre: string; valeurs: Record<string, number> }) {
  const total = Object.values(valeurs ?? {}).reduce((a, b) => a + b, 0) || 1;
  return <div style={{ ...carte, flex: 1, minWidth: 220 }}>
    <div style={{ ...etiquette, marginBottom: 8 }}>{titre}</div>
    {Object.entries(valeurs ?? {}).map(([k, v]) => <div key={k} style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span>{k}</span><span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{v}</span></div>
      <div style={{ height: 5, borderRadius: 3, background: c.surface }}>
        <div style={{ height: 5, borderRadius: 3, width: `${(v / total) * 100}%`, background: c.olive600 }}/></div>
    </div>)}
  </div>;
}
/** Tableau générique : colonnes = clés servies (données backend affichées telles quelles, FE-04). */
function TableServie({ lignes }: { lignes: any[] }) {
  const t = traduire(langue());
  if (!lignes?.length) return <p style={{ fontSize: 12, color: c.muted }}>{t("Aucune ligne sur la période.")}</p>;
  const cols = Object.keys(lignes[0]);
  return <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
    <thead><tr style={{ textAlign: "left", borderBottom: `2px solid ${c.olive700}` }}>
      {cols.map((k) => <th key={k} style={{ padding: 6 }}>{k}</th>)}</tr></thead>
    <tbody>{lignes.map((l, i) => <tr key={i} style={{ borderBottom: `1px solid ${c.border}` }}>
      {cols.map((k) => <td key={k} style={{ padding: 6 }}>
        {typeof l[k] === "object" && l[k] !== null ? JSON.stringify(l[k]) : String(l[k] ?? "—")}</td>)}</tr>)}</tbody>
  </table></div>;
}

export function RapportsConformite() {
  const t = traduire(langue());
  const [onglet, setOnglet] = useState<"kpi" | "registres">("kpi");
  const [du, setDu] = useState(""); const [au, setAu] = useState("");
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [tri, setTri] = useState("1");
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [msg, setMsg] = useState("");
  const [registre, setRegistre] = useState("hits");
  const [donnees, setDonnees] = useState<any>(null);

  const chargerKpi = async () => {
    setMsg("");
    const r = await apiGetSourced<Kpi | null>(`/v1/rapports/kpi?du=${du}&au=${au}`, null);
    setKpi(r.data); if (!r.data) setMsg(t("Période du/au requise (ISO), API connectée requise."));
  };
  const chargerTrimestre = async () => {
    setMsg("");
    const r = await apiGetSourced<Kpi | null>(`/v1/rapports/kpi/trimestre?annee=${annee}&t=${tri}`, null);
    setKpi(r.data); if (!r.data) setMsg(t("Trimestre 1..4 requis, API connectée requise."));
  };
  const telechargerCsv = () => {
    if (!kpi?.csv) return;
    const url = URL.createObjectURL(new Blob([kpi.csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `kpi-${kpi.trimestre ?? "periode"}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  const REGISTRES: [string, string][] = [["hits", t("Hits screening")], ["pep", t("Registre PEP")],
    ["derogations", t("Dérogations")], ["retards-recertification", t("Retards de recertification")]];
  const chargerRegistre = async (nom: string) => {
    setRegistre(nom);
    setDonnees((await apiGetSourced<any>(`/v1/rapports/${nom}`, null)).data);
  };

  const inp: React.CSSProperties = { padding: 7, borderRadius: tokens.radius.md, border: `1px solid ${c.border}`, fontSize: 12 };
  const btn: React.CSSProperties = { ...inp, cursor: "pointer", background: c.olive700, color: "#fff", border: "none" };
  const onglets: [typeof onglet, string][] = [["kpi", t("KPI conformité")], ["registres", t("Registres R50")]];
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3 style={{ color: c.ink }}>{t("Rapports conformité — chiffres ET définitions servis (R50, P-L8-2)")}</h3>
    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
      {onglets.map(([id, label]) => <button key={id} onClick={() => setOnglet(id)}
        style={{ ...btn, background: onglet === id ? c.olive700 : "#fff",
          color: onglet === id ? "#fff" : c.ink, border: `1px solid ${c.border}` }}>{label}</button>)}
    </div>

    {onglet === "kpi" && <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <input style={inp} placeholder={t("du (ISO)")} value={du} onChange={(e) => setDu(e.target.value)}/>
        <input style={inp} placeholder={t("au (ISO)")} value={au} onChange={(e) => setAu(e.target.value)}/>
        <button style={btn} onClick={chargerKpi}>{t("Charger la période")}</button>
        <span style={{ color: c.muted, fontSize: 12 }}>{t("ou")}</span>
        <input style={{ ...inp, width: 70 }} value={annee} onChange={(e) => setAnnee(e.target.value)}/>
        <select style={inp} value={tri} onChange={(e) => setTri(e.target.value)}>
          {["1", "2", "3", "4"].map((x) => <option key={x} value={x}>{`T${x}`}</option>)}</select>
        <button style={btn} onClick={chargerTrimestre}>{t("Charger le trimestre")}</button>
        {kpi?.csv && <button style={{ ...btn, background: c.gold }} onClick={telechargerCsv}>{t("Télécharger le CSV")}</button>}
      </div>
      {msg && <p style={{ fontSize: 12, color: c.danger }}>{msg}</p>}
      {kpi && <div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <Tuile titre={t("Hits (période)")} valeur={kpi.screening.volumes.total ?? 0} detail={kpi.definitions.age}/>
          <Tuile titre={t("Âge moyen (jours)")} valeur={kpi.screening.ageMoyenJours}/>
          <Tuile titre={t("Âge P90 (jours)")} valeur={kpi.screening.ageP90Jours}/>
          <Tuile titre={t("Conversion alerte→déclaration")} valeur={kpi.mros.conversionAlerteDeclaration}
            detail={kpi.definitions.conversion}/>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Repartition titre={t("Hits par statut")} valeurs={kpi.screening.volumes}/>
          <Repartition titre={t("Verdicts")} valeurs={kpi.screening.verdicts}/>
          <Repartition titre={t("Risk cases")} valeurs={kpi.riskCases.volumes}/>
          <Repartition titre={t("MROS")} valeurs={kpi.mros.volumes}/>
          <Repartition titre={t("Charge par analyste (R101)")} valeurs={kpi.chargeParAnalyste}/>
        </div>
      </div>}
    </div>}

    {onglet === "registres" && <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {REGISTRES.map(([nom, label]) => <button key={nom} onClick={() => chargerRegistre(nom)}
          style={{ ...btn, background: registre === nom && donnees ? c.olive700 : "#fff",
            color: registre === nom && donnees ? "#fff" : c.ink, border: `1px solid ${c.border}` }}>{label}</button>)}
      </div>
      {donnees && <div style={carte}>
        {Array.isArray(donnees) ? <TableServie lignes={donnees}/>
          : Object.entries(donnees).map(([k, v]) => <div key={k} style={{ marginBottom: 10 }}>
            <div style={etiquette}>{k}</div>
            {Array.isArray(v) ? <TableServie lignes={v as any[]}/>
              : <div style={{ fontSize: 12 }}>{typeof v === "object" && v !== null
                ? <TableServie lignes={Object.entries(v as object).map(([kk, vv]) => ({ [t("clé")]: kk, [t("valeur")]: JSON.stringify(vv) }))}/>
                : String(v)}</div>}
          </div>)}
      </div>}
    </div>}
  </div>;
}
