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
 * V2-M56 — PMS (mandats & adéquation), écran vertical du SOCLE (licence « PMS », sans † : pas
 * vendu à part — import statique, budget du cœur, même décision qu'au lot CPSI).
 *
 * « Intégrer, pas refaire » (doctrine du module, R105-R108) : ce n'est PAS un moteur de
 * portefeuille, c'est la couche COMPLIANCE sur les positions. L'écran tient exactement cela :
 *   · le drift est CONSTATÉ, jamais rééquilibré (R105/R44) — aucune action de rééquilibrage
 *     n'existe ici, ni au moteur, ni à l'écran ;
 *   · le pre-trade rend un VERDICT motivé (R106) — « exclusion mandat : ARMEMENT » observé en
 *     vrai — et un blocage n'écrit rien : c'est un refus, pas un événement ;
 *   · l'adéquation LSFin borne le mandat par le profil CLIENT (R107) — le moteur a refusé en
 *     vrai « inadéquation LSFin : profil client MEDIUM < profil requis HIGH » ;
 *   · le registre de breaches est append-only et l'échéance ESCALADE SANS LIQUIDER (R108/R39).
 *
 * Les POSITIONS sont des données d'import core (R167) : sans port, la valorisation rend
 * {totalChf: 0, drifts: []} et le registre de breaches reste vide — l'écran le DIT au lieu de
 * peindre un portefeuille, même famille d'honnêteté que Settlement (V2-M48).
 */

type Mandat = { id: string; clientId?: string; nom?: string; profilRequis?: string;
  strategie?: { exclusions?: string[]; plafondConcentrationPct?: number };
  statut?: string; createdAt?: string };
type Breach = { id: string; mandateId?: string; type?: string; statut?: string;
  echeance?: string; motif?: string };

// Seeds au format EXACT du moteur — mandat relevé sur l'API vivante (semis 8j).
const SEED_MANDATS: Mandat[] = [
  { id: "ac99edfb-28a6-42cf-99be-f5ad8e1f2cdc", clientId: "9bf1bcbf-6137-4bc1-b1be-f82ad5b9099a",
    nom: "Mandat équilibré Nordwind", profilRequis: "MEDIUM",
    strategie: { exclusions: ["ARMEMENT"], plafondConcentrationPct: 20 },
    statut: "ACTIF", createdAt: "2026-08-21T20:51:51.104Z" },
];
const SEED_BREACHES: Breach[] = [];

const ACTES: ActeMoteur[] = [
  { cle: "pms.attacher", libelle: "Attacher un mandat", route: "POST /v1/pms/mandats",
    methode: "POST",
    champs: [{ cle: "clientId", libelle: "Client" },
      { cle: "nom", libelle: "Nom du mandat" },
      { cle: "profilRequis", libelle: "Profil requis", exemple: "LOW | MEDIUM | HIGH" }],
    garde: "R107 — l'adéquation LSFin borne le mandat par le profil CLIENT : un profil requis au-dessus du profil du client est REFUSÉ (« inadéquation LSFin : profil client MEDIUM < profil requis HIGH », observé en vrai). Le mandat porte sa stratégie — exclusions et plafond de concentration — qui deviendra la règle du pre-trade." },
  { cle: "pms.pretrade", libelle: "Contrôler un ordre (pre-trade)", route: "POST /v1/pms/mandats/:id/pre-trade",
    methode: "POST",
    champs: [{ cle: ":id", libelle: "Mandat" },
      { cle: "instrument", libelle: "Instrument" },
      { cle: "secteur", libelle: "Secteur", exemple: "ARMEMENT" },
      { cle: "classe", libelle: "Classe d'actifs" },
      { cle: "montantChf", libelle: "Montant (CHF)" }],
    garde: "R106 — le pre-trade rend un VERDICT motivé : exclusion du mandat ou concentration au-delà du plafond ⇒ BLOQUE, avec le motif en toutes lettres. Un blocage n'écrit rien — c'est un refus qui protège, pas un événement. L'écran affiche le verdict du moteur tel quel." },
  { cle: "pms.valoriser", libelle: "Valoriser un mandat (drift constaté)", route: "GET /v1/pms/mandats/:id/valoriser",
    methode: "GET",
    champs: [{ cle: ":id", libelle: "Mandat" }],
    garde: "R105/R44 — le drift est CONSTATÉ, jamais rééquilibré : aucune action de rééquilibrage n'existe, ni ici ni au moteur. Les positions sont des données d'import core (R167) : sans port configuré, la valorisation rend zéro position — et le dit, plutôt que de peindre un portefeuille." },
  { cle: "pms.clore", libelle: "Clore un breach", route: "POST /v1/pms/breaches/:id/clore",
    methode: "POST",
    champs: [{ cle: ":id", libelle: "Breach" },
      { cle: "motif", libelle: "Motif (R7 — obligatoire)" }],
    garde: "R7/R108 — le registre de breaches est append-only : clore se motive, et l'échéance d'un breach ouvert ESCALADE sans jamais liquider une position (R39). Un breach clos reste au registre avec son motif." },
];

export function Pms({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  const [vue, setVue] = useState<"mandats" | "breaches">("mandats");
  const man = useApiOrSeed<Mandat[]>("/v1/pms/mandats", SEED_MANDATS);
  const bre = useApiOrSeed<Breach[]>("/v1/pms/breaches", SEED_BREACHES);
  const mandats = Array.isArray(man.data) ? man.data : [];
  const breaches = Array.isArray(bre.data) ? bre.data : [];

  const pilule = (id: "mandats" | "breaches", label: string) => (
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
      header={<Ui2HeaderListe titre={t("PMS — mandats & adéquation")}
        sousTitre={man.isDemo ? t("données maquette")
          : t("source : /v1/pms — couche COMPLIANCE sur les positions (R105-R108), jamais un moteur de portefeuille")}
        action={<Ui2Bouton onClick={() => exporterCsv(`olive-pms-${jourFichier()}`,
          [t("Mandat"), t("Profil requis"), t("Exclusions"), t("Plafond %"), t("Statut")],
          mandats.map((m) => [m.nom ?? "", m.profilRequis ?? "",
            (m.strategie?.exclusions ?? []).join(" · "),
            String(m.strategie?.plafondConcentrationPct ?? ""), m.statut ?? ""]))}>
          {t("Exporter les mandats")}</Ui2Bouton>} t={t} />}>
      <BarreActes actes={ACTES} t={t} />
      <div style={{ display: "flex", gap: 8, margin: "12px 0 14px", flexWrap: "wrap" }}>
        {pilule("mandats", `${t("Mandats")} · ${mandats.length}`)}
        {pilule("breaches", `${t("Breaches")} · ${breaches.length}`)}
      </div>

      {vue === "mandats" && (!mandats.length ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("Aucun mandat attaché.")}</div>
      ) : (<>
        <EntityList grid="1.4fr 120px 1fr 110px 110px" onOpen={() => setVue("breaches")}
          entetes={[t("Mandat"), t("Profil requis"), t("Exclusions"), t("Plafond conc."), t("Statut")]}
          lignes={mandats.map((m) => ({ id: m.id, cells: [
            <span key="n" style={{ fontWeight: 600, color: "var(--text)" }}>{m.nom ?? "—"}</span>,
            <span key="p" className="mono">{m.profilRequis ?? "—"}</span>,
            <span key="x" className="mono" style={{ fontSize: 10.5 }}>
              {(m.strategie?.exclusions ?? []).join(" · ") || "—"}</span>,
            <span key="c" className="mono">{m.strategie?.plafondConcentrationPct != null
              ? `${m.strategie.plafondConcentrationPct} %` : "—"}</span>,
            <StatusChip key="s" mode={m.statut === "ACTIF" ? "ok" : "neutral"}>{m.statut ?? "—"}</StatusChip>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Le mandat porte la RÈGLE, pas les positions : exclusions et plafond de concentration deviennent le verdict du pre-trade (R106). L'attacher est borné par l'adéquation LSFin (R107) — le profil requis ne dépasse jamais le profil du client, et le moteur refuse en nommant les deux.")}</div>
      </>))}

      {vue === "breaches" && (!breaches.length ? (
        <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-card)", padding: "13px 16px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", marginBottom: 5 }}>
            {t("Registre vide — et voici pourquoi")}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-body)", lineHeight: 1.6 }}>
            {t("Un breach naît du DRIFT constaté à la valorisation (R105→R108), et les positions sont des données d'import core (R167) : sans port core banking configuré, il n'y a rien à valoriser, donc rien à constater. Ce registre vide est l'état RÉEL — pas un écran en panne. Un pre-trade BLOQUÉ n'y figure pas non plus : c'est un refus qui protège, pas un breach.")}</div>
        </section>
      ) : (
        <EntityList grid="140px 1fr 120px 120px 120px" onOpen={() => setVue("mandats")}
          entetes={[t("Breach"), t("Motif"), t("Échéance"), t("Statut"), t("Mandat")]}
          lignes={breaches.map((b, i) => ({ id: b.id ?? String(i), cells: [
            <span key="i" className="mono" style={{ fontSize: 10.5, fontWeight: 600 }}>{(b.id ?? "—").slice(0, 8)}</span>,
            <span key="m" style={{ fontSize: 12 }}>{b.motif ?? b.type ?? "—"}</span>,
            <span key="e" className="mono">{jour(b.echeance) ?? "—"}</span>,
            <StatusChip key="s" mode={b.statut === "CLOS" ? "ok" : "warn"}>{b.statut ?? "—"}</StatusChip>,
            <span key="d" className="mono" style={{ fontSize: 10.5 }}>{(b.mandateId ?? "—").slice(0, 8)}</span>] }))} />))}
      {vue === "breaches" && (
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Le registre est append-only (R108) : un breach clos reste inscrit avec son motif (R7). L'échéance d'un breach ouvert ESCALADE — elle ne liquide jamais une position (R39) : constater n'est pas agir sur le marché, et aucune route du moteur ne le permet.")}</div>)}
    </Ui2Shell>);
}
