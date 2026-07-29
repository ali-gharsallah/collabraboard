import React, { useState, useEffect, useRef } from "react";
import { apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

// LES BACS À SABLE (canon vague pilote partie 3, BS-01..06 — patron SandboxAml, application de
// R70). Trois zones : (1) LEVIERS, (2) PROJECTION calculée par le BACKEND en dry-run (BS-02 :
// endpoint coupé ⇒ « indisponible », AUCUN calcul de repli ici), (3) rappel « aucune donnée
// n'est modifiée » + pont « Ouvrir dans le paramétrage » qui PRÉ-REMPLIT l'écran réel où le
// verrou R70 s'applique (BS-06) — AUCUN bouton « Appliquer » dans un bac.

function Bac({ titre, sousTitre, leviers, action, pont, focus }: {
  titre: string; sousTitre: string;
  leviers: (set: (v: Record<string, string>) => void, v: Record<string, string>) => React.ReactNode;
  action: (v: Record<string, string>) => Promise<unknown>;
  pont?: string; focus?: boolean;
}) {
  const [v, setV] = useState<Record<string, string>>({});
  const [projection, setProjection] = useState<unknown | null>(null);
  const [indisponible, setIndisponible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  // Deep-link (les 4 onglets sbkyc/sbbrm/sbcf/sbwf ouvrent le hub FOCALISÉ sur leur bac) :
  // le bac ciblé se met en surbrillance et remonte à l'écran. Le hub reste UN écran (BS-01..06).
  useEffect(() => { if (focus && typeof ref.current?.scrollIntoView === "function") ref.current.scrollIntoView({ block: "center" }); }, [focus]);

  const simuler = async () => {
    setIndisponible(false); setProjection(null);
    try { setProjection(await action(v)); }
    catch (e) {
      const err = e as OliveError;
      if (err.status && err.status >= 500) setIndisponible(true);            // BS-02 : la source est en panne
      else if (err.status === 0) setIndisponible(true);
      else setProjection({ refus: err.message });                            // refus typé (default-deny) affiché tel quel
    }
  };
  return <div ref={ref} id={`bac-${titre}`} style={{ padding: 12, marginBottom: 14, borderRadius: tokens.radius.lg,
    background: tokens.color.surface, border: `${focus ? 2 : 1}px solid ${focus ? tokens.color.olive700 : tokens.color.border}` }}>
    <h4 style={{ margin: "0 0 2px" }}>{titre}</h4>
    <p style={{ margin: "0 0 8px", fontSize: 12, color: tokens.color.muted }}>{sousTitre}</p>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {leviers((nv) => setV((old) => ({ ...old, ...nv })), v)}
      <button onClick={simuler} disabled={isDemoMode()} style={{ fontSize: 12 }}>Simuler (dry-run)</button>
    </div>
    {indisponible && <p data-testid={`indispo-${titre}`} style={{ fontSize: 12, color: tokens.color.danger }}>
      indisponible — la projection vient du backend, aucun calcul de repli (BS-02)</p>}
    {projection != null && <pre data-testid={`projection-${titre}`} style={{ marginTop: 8, padding: 8, borderRadius: 6,
      background: "#fff", border: `1px solid ${tokens.color.border}`, fontSize: 11, whiteSpace: "pre-wrap" }}>
      {JSON.stringify(projection, null, 1)}</pre>}
    <p style={{ marginTop: 8, fontSize: 11, color: tokens.color.muted }}>
      Aucune donnée n&apos;est modifiée (BS-01). {pont && <>→ <strong>Ouvrir dans le paramétrage</strong> : {pont} —
      les valeurs arrivent « à simuler », le verrou R70 s&apos;applique là-bas (BS-06).</>}</p>
  </div>;
}

const inp = { padding: 5, fontSize: 12, border: `1px solid ${tokens.color.border}`, borderRadius: 6 };

export function Sandboxes({ focus }: { focus?: string } = {}) {
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Bacs à sable — simuler sans jamais muter (R70, BS-01..06)</h3>
    <Bac titre="sbkyc" focus={focus === "sbkyc"} sousTitre="Levier : un droit REQUIRED ajouté (rôle × section) → dossiers devenant incomplets + charge par rôle (BS-03)"
      pont="sdkyc (matrice sections × rôles)"
      leviers={(set, v) => <>
        <input placeholder="rôle (ex. CO)" value={v.role ?? ""} onChange={(e) => set({ role: e.target.value })} style={inp}/>
        <input placeholder="section (ex. AML)" value={v.section ?? ""} onChange={(e) => set({ section: e.target.value })} style={inp}/></>}
      action={(v) => apiPost("/v1/sandbox/kyc-droits", { role: v.role, sectionCode: v.section })}/>
    <Bac titre="sbbrm" focus={focus === "sbbrm"} sousTitre="Levier : seuils de la grille SDD/CDD/EDD → reclassements NOMINATIFS + Δ charge EDD (BS-04)"
      pont="registre R-Q (grille de risque)"
      leviers={(set, v) => <>
        <input placeholder="seuil EDD (ex. 40)" value={v.edd ?? ""} onChange={(e) => set({ edd: e.target.value })} style={inp}/>
        <input placeholder="seuil CDD (ex. 20)" value={v.cdd ?? ""} onChange={(e) => set({ cdd: e.target.value })} style={inp}/></>}
      action={(v) => apiPost("/v1/sandbox/brm-seuils", { seuilEdd: Number(v.edd), seuilCdd: Number(v.cdd) })}/>
    <Bac titre="sbonb" sousTitre="Levier : règles d'aiguillage structure → workflow ; l'inconnu part en QUARANTAINE, jamais deviné (BS-05)"
      pont="écran Onboarding (paramétrage d'aiguillage)"
      leviers={(set, v) => <input placeholder='table JSON (ex. {"PP":"SDD","SA":"CDD"})' value={v.table ?? ""}
        onChange={(e) => set({ table: e.target.value })} style={{ ...inp, width: 280 }}/>}
      action={(v) => apiPost("/v1/sandbox/onb-aiguillage", { table: JSON.parse(v.table || "{}") })}/>
    <Bac titre="sbcf" focus={focus === "sbcf"} sousTitre="Levier : exigences documentaires par structure → non-conformités et manquants PAR DOSSIER"
      pont="GED (exigences documentaires)"
      leviers={(set, v) => <input placeholder='exigences JSON (ex. {"PP":["PASSEPORT"]})' value={v.exigences ?? ""}
        onChange={(e) => set({ exigences: e.target.value })} style={{ ...inp, width: 280 }}/>}
      action={(v) => apiPost("/v1/sandbox/cf-exigences", { exigences: JSON.parse(v.exigences || "{}") })}/>
    <Bac titre="sbwf" focus={focus === "sbwf"} sousTitre="Levier : délais cibles par section → goulots projetés + charge par rôle"
      pont="Workflow (délais cibles)"
      leviers={(set, v) => <input placeholder='délais JSON (ex. {"IDENTITY":5})' value={v.delais ?? ""}
        onChange={(e) => set({ delais: e.target.value })} style={{ ...inp, width: 280 }}/>}
      action={(v) => apiPost("/v1/sandbox/wf-delais", { delaisJours: JSON.parse(v.delais || "{}") })}/>
  </div>;
}
