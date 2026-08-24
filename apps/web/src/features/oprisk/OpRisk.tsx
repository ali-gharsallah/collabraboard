import React, { useState } from "react";
import { apiPost, apiGet, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { useConfirmGate } from "../../components/ConfirmValidation";  // contrat UX
import { tokens } from "../../theme/tokens";
import { traduire, langue } from "../../lib/i18n";

/**
 * `oprisk` — R321-R323 (dégel V9, ratifié 2026-07-28). L'incident opérationnel est un
 * DOSSIER (taxonomie Bâle du tenant, classification obligatoire) ; la heatmap est
 * CALCULÉE au serveur (fréquence × sévérité) — l'écran la REND, il ne peint jamais une
 * cellule ; le retard d'action est un fait calculé, notifié — jamais bloquant. Les refus
 * backend s'affichent tels quels (FE-04). Converti au cliquet i18n (tour 3) : l'UI passe
 * par t(), les DONNÉES (titres d'incidents, motifs, catégories servies) restent verbatim.
 */

type Incident = { id: string; titre: string; categorie: string; severite: number; statut: string };
type Cellule = { categorie: string; frequence: number; severiteMax: number; score: number };
type Action = { id: string; titre: string; owner: string; echeance: string; statut: string; enRetard: boolean };

export function OpRisk() {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [cellules, setCellules] = useState<Cellule[] | null>(null);
  const [actions, setActions] = useState<Action[] | null>(null);
  const [titre, setTitre] = useState(""); const [categorie, setCategorie] = useState("EXECUTION_PROCESSUS");
  const [msg, setMsg] = useState("");
  const { ask, modal } = useConfirmGate();               // contrat UX : confirmation + pré-vol

  const erreur = (e: unknown) => setMsg((e as OliveError).message ?? "Erreur");   // le refus, TEL QUEL
  const petit = { fontSize: 12 } as const;
  const td = { fontSize: 12, borderTop: `1px solid ${tokens.color.border}`, padding: "3px 8px" };
  const t = traduire(langue());
  const charger = async () => {
    setMsg("");
    try {
      setIncidents((await apiGet<{ incidents: Incident[] }>("/v1/oprisk/incidents", { incidents: [] })).incidents);
      setCellules((await apiGet<{ cellules: Cellule[] }>("/v1/oprisk/heatmap", { cellules: [] })).cellules);
      setActions((await apiGet<{ actions: Action[] }>("/v1/oprisk/actions", { actions: [] })).actions);
    } catch (e) { erreur(e); }
  };
  return <div>
    {modal}
    {isDemoMode() && <DemoModeBanner/>}
    <h3>{t("Octopulse OpRisk — incidents opérationnels (dossiers tracés, taxonomie Bâle du tenant)")}</h3>
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
      <button style={petit} onClick={charger} disabled={isDemoMode()}>{t("Charger")}</button>
      <input placeholder={t("titre de l'incident")} value={titre} onChange={(e) => setTitre(e.target.value)} style={petit}/>
      <input placeholder={t("catégorie Bâle")} value={categorie} onChange={(e) => setCategorie(e.target.value)} style={petit}/>
      <button style={petit} disabled={isDemoMode() || !titre} onClick={() => ask({
        title: t("Déclarer un incident opérationnel (R321)"),
        message: t("La classification dans la taxonomie Bâle du tenant est obligatoire ; le serveur refuse une catégorie hors taxonomie."),
        items: [{ label: `${t("titre")} : ${titre || "—"}`, ok: !!titre },
          { label: `${t("catégorie")} : ${categorie || "—"}`, ok: !!categorie }],
        confirmLabel: t("Déclarer l'incident"),
        onConfirm: async () => {
          setMsg("");
          try { await apiPost("/v1/oprisk/incidents", { titre, categorie, severite: 3 }); setTitre(""); await charger(); }
          catch (e) { erreur(e); }                                            // classification obligatoire — refus R321 tel quel
        } })}>{t("Déclarer")}</button>
    </div>
    {msg && <p style={{ ...petit, color: tokens.color.olive700 }}>{msg}</p>}
    {cellules && <div>
      <h4 style={{ fontSize: 13 }}>{t("Heatmap (CALCULÉE serveur — fréquence × sévérité, rejouable à date ; aucune cellule ne se saisit)")}</h4>
      <table style={{ borderCollapse: "collapse" }}><tbody>
        <tr>{["catégorie", "fréquence", "sévérité max", "score"].map((h) => <td key={h} style={{ ...td, color: tokens.color.muted }}>{t(h)}</td>)}</tr>
        {cellules.map((c) => <tr key={c.categorie}>
          <td style={td}>{c.categorie}</td><td style={td}>{c.frequence}</td>
          <td style={{ ...td, color: c.severiteMax >= 4 ? tokens.color.danger : undefined }}>{c.severiteMax}</td>
          <td style={td}><strong>{c.score}</strong></td>
        </tr>)}
      </tbody></table>
    </div>}
    {incidents && <div>
      <h4 style={{ fontSize: 13 }}>{t("Incidents")} ({incidents.length})</h4>
      <ul style={{ paddingLeft: 16 }}>{incidents.map((i) => <li key={i.id} style={petit}>
        <strong>{i.titre}</strong> — {i.categorie} · {t("sévérité")} {i.severite} · {i.statut}
        {i.statut !== "CLOS" && <button style={{ ...petit, marginLeft: 8 }} disabled={isDemoMode()} onClick={() => ask({
          title: i.statut === "DECLARE" ? t("Passer l'incident en analyse") : t("Clore l'incident (motivé)"),
          message: i.statut === "DECLARE" ? t("L'incident passe en analyse.") : t("La clôture est motivée ; le serveur porte l'invariant."),
          confirmLabel: i.statut === "DECLARE" ? t("Passer en analyse") : t("Clore l'incident"),
          onConfirm: async () => {
            setMsg("");
            try {
              await apiPost(`/v1/oprisk/incidents/${i.id}/transition`,
                i.statut === "DECLARE" ? { vers: "EN_ANALYSE" } : { vers: "CLOS", motif: "Analyse terminée, mesures en plan d'action" });
              await charger();
            } catch (e) { erreur(e); }
          } })}>{i.statut === "DECLARE" ? t("Analyser") : t("Clore (motivé)")}</button>}
      </li>)}</ul>
    </div>}
    {actions && actions.length > 0 && <div>
      <h4 style={{ fontSize: 13 }}>{t("Plan d'action (le retard est un fait calculé — notifié, jamais bloquant)")}</h4>
      <ul style={{ paddingLeft: 16 }}>{actions.map((a) => <li key={a.id} style={petit}>
        {a.titre} — {a.statut}{a.enRetard && <strong style={{ color: tokens.color.danger }}> · {t("EN RETARD")}</strong>}
      </li>)}</ul>
    </div>}
  </div>;
}
