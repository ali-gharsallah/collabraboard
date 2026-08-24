import React, { useState } from "react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderListe, Ui2Bouton } from "./Header";
import { StatusChip } from "./StatusChip";
import { EntityList } from "./Listes";
import { BarreActes, ActeMoteur } from "./acte-moteur";
import { useApiOrSeed } from "../lib/useApiOrSeed";
import { exporterCsv, jourFichier } from "./actions";
import { traduire, langue } from "../lib/i18n";

/**
 * V2-M55 — PROFILAGE CPSI, écran vertical du SOCLE (licence `null` — les deux capacités
 * `cpsiSeg` et `cpsiCases` ne sont pas vendues à part : cet écran n'entre PAS dans le
 * compartiment des modules †, il compte dans le budget du cœur, et c'est voulu).
 *
 * CE LOT CORRIGE AUSSI UNE AFFIRMATION FAUSSE DE MA PART : au lot V2-M54 j'ai écrit « les deux
 * CPSI sur routes vides ». La mesure dit le contraire — la segmentation sert un client réel
 * (M-INTENSE), le score sert ses DRIVERS décomposés, le référentiel sert les règles R-Q. Le
 * registre ne prétend jamais mieux que l'état du code ; il ne doit pas non plus prétendre pire.
 *
 * CE QUE L'ÉCRAN TIENT, parce que c'est la doctrine du moteur (PC-01..06, R250) :
 *   · l'état CPSI est un REJEU du journal — chaque réponse porte son `meta.evenements_rejoues`
 *     et son chemin (replay_complet / incrémental) : l'écran AFFICHE cette provenance ;
 *   · le score se DÉCOMPOSE (statique + comportemental, drivers datés, décroissance
 *     exponentielle) — jamais un chiffre nu ;
 *   · un cas proposé PAR LE MOTEUR reste une PROPOSITION (R44) : l'adoption est humaine, et
 *     elle vit dans la file des risk cases — pas ici.
 */

type Segment = { client?: string; segment?: string };
type Proposition = { id?: string; clientId?: string; motif?: string; statut?: string };
type Sla = { seuils?: { hitEscaladeJours?: number; escaladeMrosJours?: number }; chaine?: unknown[] };
type Meta = { evenements_rejoues?: number; chemin?: string };

// Seeds au format EXACT du moteur — relevés sur l'API vivante reconstruite (tenant GWB re-semé).
const SEED_SEG: { asOf?: string | null; meta?: Meta; segments: Segment[] } = {
  asOf: null, segments: [{ client: "619f3674-d01b-4a2b-a3e5-88d5745385db", segment: "M-INTENSE" }],
};
const SEED_PROPS: Proposition[] = [];
const SEED_SLA: Sla = { seuils: { hitEscaladeJours: 30, escaladeMrosJours: 5 }, chaine: [] };

const ACTES: ActeMoteur[] = [
  { cle: "cpsi.score", libelle: "Lire un score décomposé, à date", route: "GET /v1/cpsi/clients/:id/score",
    methode: "GET",
    champs: [{ cle: ":id", libelle: "Client" },
      { cle: "asOf", libelle: "Date du rejeu (vide = maintenant)" }],
    garde: "PC-01/R48 — le score est un REJEU du journal, jamais une colonne : la réponse porte ses DRIVERS (statique + comportemental, chacun daté et pondéré par décroissance exponentielle) et le nombre d'événements rejoués. Un chiffre sans sa décomposition ne se discute pas — celui-ci arrive décomposé." },
  { cle: "cpsi.proposer", libelle: "Proposer un cas depuis un signal", route: "POST /v1/cpsi/case-proposals",
    methode: "POST",
    champs: [{ cle: "clientId", libelle: "Client" },
      { cle: "motif", libelle: "Motif (R7 — obligatoire)" }],
    garde: "R44 — le moteur (ou un CO) PROPOSE un cas ; il ne l'ouvre pas. L'adoption est un acte humain distinct, tracé dans la file des risk cases (R133-R136). Une proposition rejetée reste au journal avec son motif." },
  { cle: "cpsi.sla.tick", libelle: "Mesurer les SLA (tick)", route: "POST /v1/cpsi/reporting/sla/tick",
    methode: "POST", champs: [],
    garde: "R281/PC-16 — le tick MESURE la chaîne signal → hit → escalade contre les seuils gouvernés (hitEscaladeJours, escaladeMrosJours) et NOTIFIE une fois par état. Rien n'est bloqué : un SLA dépassé est un fait porté, jamais un verrou." },
];

export function Cpsi({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  const [vue, setVue] = useState<"segmentation" | "cases">("segmentation");
  const seg = useApiOrSeed<{ asOf?: string | null; meta?: Meta; segments: Segment[] }>(
    "/v1/cpsi/segmentation", SEED_SEG);
  const props = useApiOrSeed<Proposition[]>("/v1/cpsi/case-proposals", SEED_PROPS);
  const sla = useApiOrSeed<Sla>("/v1/cpsi/reporting/sla", SEED_SLA);
  const segments = Array.isArray(seg.data?.segments) ? seg.data.segments : [];
  const propositions = Array.isArray(props.data) ? props.data : [];

  const pilule = (id: "segmentation" | "cases", label: string) => (
    <button key={id} onClick={() => setVue(id)} aria-pressed={vue === id}
      style={{ padding: "6px 13px", borderRadius: 999, fontFamily: "inherit", fontSize: 12,
        fontWeight: 600, cursor: "pointer",
        border: vue === id ? "1px solid var(--brand)" : "1px solid var(--border-input)",
        background: vue === id ? "var(--brand-surface)" : "var(--bg-surface)",
        color: vue === id ? "var(--brand)" : "var(--text-secondary)" }}>{label}</button>);

  // La PROVENANCE du rejeu, affichée — c'est l'architecture du module, pas un détail technique.
  const provenance = seg.data?.meta
    ? `${seg.data.meta.evenements_rejoues ?? "?"} ${t("événements rejoués")} · ${seg.data.meta.chemin ?? "?"}`
    : null;

  return (
    <Ui2Shell nav={<Ui2Nav active={active} user="Sofia Berger" role="Compliance Officer"
      onNavigate={onNavigate} t={t}
      badges={{ journee: { n: 12 }, dossiers: { n: 48, sobre: true }, clients: { n: 214, sobre: true },
        surveillance: { n: 5, alert: true } }} />}
      header={<Ui2HeaderListe titre={t("Profilage CPSI")}
        sousTitre={seg.isDemo ? t("données maquette")
          : `${t("source : /v1/cpsi — état par REJEU du journal (PC-01)")}${provenance ? ` · ${provenance}` : ""}`}
        action={<Ui2Bouton onClick={() => exporterCsv(`olive-cpsi-${jourFichier()}`,
          [t("Client"), t("Segment")], segments.map((s) => [s.client ?? "", s.segment ?? ""]))}>
          {t("Exporter la segmentation")}</Ui2Bouton>} t={t} />}>
      <BarreActes actes={ACTES} t={t} />
      <div style={{ display: "flex", gap: 8, margin: "12px 0 14px", flexWrap: "wrap" }}>
        {pilule("segmentation", `${t("Segmentation")} · ${segments.length}`)}
        {pilule("cases", `${t("Risk cases proposés")} · ${propositions.length}`)}
      </div>

      {vue === "segmentation" && (!segments.length ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {t("Aucun client segmenté — la segmentation est un REJEU : sans signal au journal, elle est vide, et elle le prouve.")}</div>
      ) : (<>
        <EntityList grid="1.5fr 160px" onOpen={() => setVue("cases")}
          entetes={[t("Client"), t("Segment de surveillance")]}
          lignes={segments.map((s, i) => ({ id: s.client ?? String(i), cells: [
            <span key="c" className="mono" style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>
              {s.client ?? "—"}</span>,
            <StatusChip key="s" mode={s.segment === "M-INTENSE" ? "alert"
              : s.segment === "M-RENFORCE" ? "warn" : "neutral"}>{s.segment ?? "—"}</StatusChip>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Le segment DÉCOULE du score (statique + comportemental, décroissance exponentielle des signaux) — il n'est la saisie de personne. Le score d'un client se lit DÉCOMPOSÉ par l'acte ci-dessus : chaque driver porte sa source et sa contribution. Les barèmes se règlent au Paramétrage (clé gouvernée R125), jamais ici.")}</div>
      </>))}

      {vue === "cases" && (<>
        {!propositions.length ? (
          <div style={{ fontSize: 12, color: "var(--text-body)", background: "var(--bg-surface)",
            border: "1px solid var(--border)", borderRadius: "var(--r-card)", padding: "13px 15px" }}>
            {t("Aucun cas proposé. Le moteur propose quand la corrélation des signaux le justifie — et l'humain décide (R44) : l'adoption ouvre un risk case dans la file de Surveillance, jamais ici.")}</div>
        ) : (
          <EntityList grid="1.4fr 1fr 130px" onOpen={() => setVue("segmentation")}
            entetes={[t("Client"), t("Motif"), t("Statut")]}
            lignes={propositions.map((p, i) => ({ id: p.id ?? String(i), cells: [
              <span key="c" className="mono" style={{ fontSize: 11, fontWeight: 600 }}>{p.clientId ?? "—"}</span>,
              <span key="m" style={{ fontSize: 12 }}>{p.motif ?? "—"}</span>,
              <StatusChip key="s" mode="neutral">{p.statut ?? "—"}</StatusChip>] }))} />)}
        <div style={{ fontSize: 11.5, color: "var(--text-body)", marginTop: 12, background: "var(--bg-surface)",
          border: "1px solid var(--border)", borderRadius: "var(--r-card)", padding: "12px 14px", lineHeight: 1.6 }}>
          {`${t("SLA gouvernés de la chaîne signal → cas")} : ${t("escalade d'un hit")} ${sla.data?.seuils?.hitEscaladeJours ?? "—"} j · ${t("escalade MROS")} ${sla.data?.seuils?.escaladeMrosJours ?? "—"} j — ${t("mesurés par le tick, jamais bloquants (R281)")}`}</div>
      </>)}
    </Ui2Shell>);
}
