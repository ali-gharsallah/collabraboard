import React, { useState } from "react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderListe, Ui2Bouton } from "./Header";
import { StatusChip } from "./StatusChip";
import { EntityList } from "./Listes";
import { BarreActes, ActeMoteur } from "./acte-moteur";
import { useApiOrSeed } from "../lib/useApiOrSeed";
import { jour } from "./moteur-formes";
import { exporterCsv, jourFichier } from "./actions";
import { traduire, langue } from "../lib/i18n";

/**
 * V2-M52 — OCTOPULSE OPRISK (†OPRISK), deuxième vertical du compartiment paresseux.
 *
 * Choisi contre Legal par la même règle que Custody au lot précédent : le moteur d'OpRisk sert
 * AUJOURD'HUI un incident réel et une heatmap à sept catégories ; /v1/legal/* répond `[]`.
 * Les trois refus du moteur ont été observés en vrai avant d'écrire l'écran — ils sont cités
 * MOT POUR MOT dans les gardes des actes ci-dessous.
 *
 * CE QUE L'ÉCRAN TIENT, parce que c'est la doctrine du moteur (R321-R323) :
 *   · la classification est OBLIGATOIRE dans la taxonomie Bâle du tenant (clé R-Q
 *     `oprisk_taxonomie`, default-deny) — l'écran ne propose pas de catégorie « Autre » ;
 *   · le chemin de l'incident est une liste FERMÉE (DECLARE → EN_ANALYSE → CLOS), la clôture
 *     se motive (R7) ;
 *   · la heatmap est CALCULÉE (fréquence × sévérité), JAMAIS peinte : aucune route ni aucun
 *     événement de cellule n'existe au moteur (OP-03 structurel) — et donc aucun clic de
 *     cellule n'écrit quoi que ce soit ici ;
 *   · le RETARD d'une action est un FAIT calculé (R274), jamais un blocage : une action en
 *     retard se complète normalement, et l'écran la montre en retard sans l'empêcher.
 */

type Incident = { id: string; titre?: string; categorie?: string; severite?: number;
  pertes?: number | null; statut?: string; reference?: unknown; par?: string };
type Cellule = { categorie?: string; frequence?: number; severiteMax?: number; score?: number };
type Action = { id: string; incidentId?: string; titre?: string; owner?: string;
  echeance?: string; statut?: string; enRetard?: boolean };

// Seeds au format EXACT du moteur — relevés sur l'API vivante (incident + heatmap réels du
// tenant GWB). L'action en retard est ajoutée pour que la garde du retard vérifie quelque
// chose (leçon U2-73 : un seed qui ne montre jamais l'état limite laisse la garde tourner à vide).
const SEED_INCIDENTS: { incidents: Incident[] } = { incidents: [
  { id: "3a08e3b4-0dc0-40be-8d21-48dd568dc151", titre: "Double exécution d'un virement",
    pertes: 12500, severite: 3, categorie: "EXECUTION_PROCESSUS", statut: "DECLARE" },
] };
const SEED_HEATMAP: { at?: string; cellules: Cellule[] } = { at: "maintenant", cellules: [
  { categorie: "FRAUDE_INTERNE", frequence: 0, severiteMax: 0, score: 0 },
  { categorie: "FRAUDE_EXTERNE", frequence: 0, severiteMax: 0, score: 0 },
  { categorie: "PRATIQUES_EMPLOI", frequence: 0, severiteMax: 0, score: 0 },
  { categorie: "CLIENTS_PRODUITS_PRATIQUES", frequence: 0, severiteMax: 0, score: 0 },
  { categorie: "DOMMAGES_ACTIFS", frequence: 0, severiteMax: 0, score: 0 },
  { categorie: "INTERRUPTION_SYSTEMES", frequence: 0, severiteMax: 0, score: 0 },
  { categorie: "EXECUTION_PROCESSUS", frequence: 1, severiteMax: 3, score: 3 },
] };
const SEED_ACTIONS: { actions: Action[] } = { actions: [
  { id: "act-demo-1", incidentId: "3a08e3b4-0dc0-40be-8d21-48dd568dc151",
    titre: "Revoir le contrôle 4 yeux sur les virements > 10k", owner: "carla@gwb-demo.ch",
    echeance: "2026-08-01", statut: "EN_COURS", enRetard: true },
] };

const ACTES: ActeMoteur[] = [
  { cle: "oprisk.declarer", libelle: "Déclarer un incident", route: "POST /v1/oprisk/incidents",
    methode: "POST",
    champs: [{ cle: "titre", libelle: "Titre de l'incident" },
      { cle: "categorie", libelle: "Catégorie Bâle (taxonomie du tenant)", exemple: "EXECUTION_PROCESSUS" },
      { cle: "severite", libelle: "Sévérité (entier 1..5)" },
      { cle: "pertes", libelle: "Pertes estimées (optionnel)" }],
    garde: "R321 — TOUT collaborateur déclare, mais la classification est OBLIGATOIRE dans la taxonomie Bâle du tenant (default-deny) : une catégorie hors taxonomie est refusée en NOMMANT les catégories admises. Il n'existe pas de catégorie « Autre » — un incident inclassable est un problème de taxonomie, qui se règle au Paramétrage." },
  { cle: "oprisk.transition", libelle: "Faire avancer un incident",
    route: "POST /v1/oprisk/incidents/:id/transition", methode: "POST",
    champs: [{ cle: ":id", libelle: "Incident" },
      { cle: "vers", libelle: "Vers", exemple: "EN_ANALYSE | CLOS" },
      { cle: "motif", libelle: "Motif (obligatoire pour CLOS — R7)" }],
    garde: "R321 — le chemin est une liste FERMÉE : DECLARE → EN_ANALYSE → CLOS. Le moteur refuse toute autre transition en citant ce qui est admis, et clore se MOTIVE (R7) : un incident opérationnel qui se ferme sans un mot n'apprend rien à personne." },
  { cle: "oprisk.action", libelle: "Créer une action corrective", route: "POST /v1/oprisk/actions",
    methode: "POST",
    champs: [{ cle: "incidentId", libelle: "Incident" },
      { cle: "titre", libelle: "Action" },
      { cle: "owner", libelle: "Owner" },
      { cle: "echeance", libelle: "Échéance", exemple: "2026-09-30" }],
    garde: "R323 — une action porte un OWNER et une ÉCHÉANCE dès sa création. Le retard qui en découle est un FAIT calculé (R274) : notifié à l'owner une fois, escaladé DIR au-delà du seuil gouverné — jamais bloquant, une action en retard se complète normalement." },
  { cle: "oprisk.heatmap.rejeu", libelle: "Rejouer la heatmap à une date",
    route: "GET /v1/oprisk/heatmap", methode: "GET",
    champs: [{ cle: "asOf", libelle: "Date du rejeu", exemple: "2026-08-01T00:00:00Z" }],
    garde: "R322 — la heatmap est CALCULÉE (fréquence × sévérité par catégorie), jamais peinte : aucune route d'écriture de cellule n'existe au moteur, structurellement (OP-03). La rejouer à une date borne le calcul sur le journal — c'est le même invariant que le registre TA (R48)." },
];

// Encre de la cellule selon le score — un CALCUL d'affichage sur la donnée du moteur, pas un
// état : la heatmap n'a aucun état propre, c'est exactement le point de R322.
const MODE_SCORE = (score: number): "ok" | "warn" | "alert" | "neutral" =>
  score === 0 ? "neutral" : score < 4 ? "ok" : score < 8 ? "warn" : "alert";

export function Oprisk({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  const [vue, setVue] = useState<"incidents" | "heatmap" | "actions">("incidents");
  const inc = useApiOrSeed<{ incidents: Incident[] }>("/v1/oprisk/incidents", SEED_INCIDENTS);
  const hm = useApiOrSeed<{ at?: string; cellules: Cellule[] }>("/v1/oprisk/heatmap", SEED_HEATMAP);
  const act = useApiOrSeed<{ actions: Action[] }>("/v1/oprisk/actions", SEED_ACTIONS);
  const incidents = Array.isArray(inc.data?.incidents) ? inc.data.incidents : [];
  const cellules = Array.isArray(hm.data?.cellules) ? hm.data.cellules : [];
  const actions = Array.isArray(act.data?.actions) ? act.data.actions : [];

  const pilule = (id: "incidents" | "heatmap" | "actions", label: string) => (
    <button key={id} onClick={() => setVue(id)} aria-pressed={vue === id}
      style={{ padding: "6px 13px", borderRadius: 999, fontFamily: "inherit", fontSize: 12,
        fontWeight: 600, cursor: "pointer",
        border: vue === id ? "1px solid var(--brand)" : "1px solid var(--border-input)",
        background: vue === id ? "var(--brand-surface)" : "var(--bg-surface)",
        color: vue === id ? "var(--brand)" : "var(--text-secondary)" }}>{label}</button>);

  return (
    <Ui2Shell nav={<Ui2Nav active={active} user="Sofia Berger" role="Compliance Officer"
      onNavigate={onNavigate} t={t}
      badges={{ journee: { n: 12 }, dossiers: { n: 48, sobre: true }, clients: { n: 214, sobre: true },
        surveillance: { n: 5, alert: true } }} />}
      header={<Ui2HeaderListe titre={t("Octopulse OpRisk")}
        sousTitre={inc.isDemo ? t("données maquette")
          : t("source : /v1/oprisk — incidents, heatmap calculée (R322), plan d'action (R323)")}
        action={<Ui2Bouton onClick={() => exporterCsv(`olive-oprisk-${jourFichier()}`,
          [t("Titre"), t("Catégorie"), t("Sévérité"), t("Pertes"), t("Statut")],
          incidents.map((i) => [i.titre ?? "", i.categorie ?? "", String(i.severite ?? ""),
            String(i.pertes ?? ""), i.statut ?? ""]))}>
          {t("Exporter les incidents")}</Ui2Bouton>} t={t} />}>
      <BarreActes actes={ACTES} t={t} />
      <div style={{ display: "flex", gap: 8, margin: "12px 0 14px", flexWrap: "wrap" }}>
        {pilule("incidents", `${t("Incidents")} · ${incidents.length}`)}
        {pilule("heatmap", t("Heatmap"))}
        {pilule("actions", `${t("Plan d'action")} · ${actions.length}`)}
      </div>

      {vue === "incidents" && (!incidents.length ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("Aucun incident déclaré.")}</div>
      ) : (<>
        <EntityList grid="1.5fr 210px 90px 120px 120px" onOpen={() => setVue("actions")}
          entetes={[t("Incident"), t("Catégorie Bâle"), t("Sévérité"), t("Pertes"), t("Statut")]}
          lignes={incidents.map((i) => ({ id: i.id, cells: [
            <span key="t" style={{ fontWeight: 600, color: "var(--text)" }}>{i.titre ?? "—"}</span>,
            <span key="c" className="mono" style={{ fontSize: 10.5 }}>{i.categorie ?? "—"}</span>,
            <span key="s" className="mono" style={{ fontWeight: 600,
              color: (i.severite ?? 0) >= 4 ? "var(--alert-text)" : "var(--text)" }}>{`S${i.severite ?? "—"}`}</span>,
            <span key="p" className="mono">{i.pertes != null ? i.pertes.toLocaleString("fr-CH") : "—"}</span>,
            <StatusChip key="e" mode={i.statut === "CLOS" ? "ok" : i.statut === "EN_ANALYSE" ? "warn" : "neutral"}>
              {t(i.statut ?? "—")}</StatusChip>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Un incident est un DOSSIER tracé (R321) : déclaré par tout collaborateur, classé dans la taxonomie Bâle du tenant, jamais dans une catégorie inventée. Son chemin est fermé — DECLARE → EN_ANALYSE → CLOS — et la clôture se motive (R7). O-Live structure, il ne rend jamais l'avis.")}</div>
      </>))}

      {vue === "heatmap" && (<>
        <EntityList grid="1.5fr 120px 120px 120px" onOpen={() => setVue("incidents")}
          entetes={[t("Catégorie Bâle"), t("Fréquence"), t("Sévérité max"), t("Score")]}
          lignes={cellules.map((c, i) => ({ id: c.categorie ?? String(i), cells: [
            <span key="c" className="mono" style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>
              {c.categorie ?? "—"}</span>,
            <span key="f" className="mono">{c.frequence ?? 0}</span>,
            <span key="s" className="mono">{c.severiteMax ?? 0}</span>,
            <StatusChip key="x" mode={MODE_SCORE(c.score ?? 0)}>{String(c.score ?? 0)}</StatusChip>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("La heatmap est CALCULÉE — fréquence × sévérité par catégorie — jamais peinte : aucune route d'écriture de cellule n'existe au moteur (R322/OP-03, structurel). Une cellule à zéro reste affichée : l'absence d'incident dans une catégorie est une information, pas un vide. Rejouable à date par l'acte ci-dessus, comme le registre TA (R48).")}</div>
      </>)}

      {vue === "actions" && (!actions.length ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {t("Aucune action corrective — un incident analysé sans plan d'action est un constat sans suite.")}</div>
      ) : (<>
        <EntityList grid="1.5fr 200px 120px 110px 120px" onOpen={() => setVue("incidents")}
          entetes={[t("Action"), t("Owner"), t("Échéance"), t("Statut"), t("Retard")]}
          lignes={actions.map((a) => ({ id: a.id, cells: [
            <span key="t" style={{ fontWeight: 600, color: "var(--text)" }}>{a.titre ?? "—"}</span>,
            <span key="o" className="mono" style={{ fontSize: 11 }}>{a.owner ?? "—"}</span>,
            <span key="e" className="mono">{jour(a.echeance) ?? "—"}</span>,
            <StatusChip key="s" mode={a.statut === "FAIT" ? "ok" : "neutral"}>{t(a.statut ?? "—")}</StatusChip>,
            a.enRetard
              ? <StatusChip key="r" mode="alert">{t("EN RETARD")}</StatusChip>
              : <span key="r" className="mono" style={{ color: "var(--text-muted)" }}>—</span>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Le retard est un FAIT calculé (R274) : notifié à l'owner UNE fois, escaladé DIR au-delà du seuil gouverné (oprisk_escalade_jours) — jamais bloquant. Une action en retard se complète normalement : l'écran la montre en retard, il ne l'empêche pas.")}</div>
      </>))}
    </Ui2Shell>);
}
