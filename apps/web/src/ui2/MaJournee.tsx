import React, { useState } from "react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderListe, Ui2Bouton } from "./Header";
import { StatTile } from "./StatTile";
import { WorkQueueHeader, WorkQueueRow, WorkQueueItem } from "./WorkQueueRow";
import { CommandPalette } from "./CommandPalette";
import { useApiOrSeed } from "../lib/useApiOrSeed";
import { traduire, langue } from "../lib/i18n";

/**
 * UI v2 — écran 01 « Ma journée » (handoff, maquette screenshots/01-ma-journee.png).
 * L'écran répond à UNE question : « qu'est-ce que je dois faire maintenant » — une file de
 * travail triée par échéance et par risque, 4 indicateurs cliquables, les suggestions d'Olivia
 * en colonne latérale (jamais dans le flux principal, R44 visible), l'activité récente, la
 * capacité d'équipe en pied. Données : la corbeille « À décider » R478 (/v1/decisions/corbeille)
 * quand l'API répond ; sinon le seed signalé (useApiOrSeed — la source ne se masque jamais).
 * Fusion arbitrée PO n°3 : cet écran absorbe Accueil / Command Center / Dashboard central.
 */

type CorbeilleApi = { tri: string; items: { type: string; ref: string; etape: string;
  slaAt: string | null; badge: "ROUGE" | "AMBRE" | "VERT" | null }[] };

// L'action ATTENDUE en toutes lettres, par type de décision (jamais un code à décoder).
const ACTION_PAR_TYPE: Record<string, string> = {
  KYC: "Viser l'étape du dossier", ACCOUNT_REVIEW: "Viser le delta de la revue",
  GROUP_ACCOUNT_REVIEW: "Poser la décision de groupe", BUSINESS_TRIP: "Approuver le voyage",
  OFFBOARDING: "Viser l'étape de sortie", TACHE_REPRISE: "Reprendre la section (renvoi R475)",
};
const badgeVers = (b: string | null): { echeance: string; mode: "ok" | "warn" | "alert"; chip: WorkQueueItem["risque"]; prio: WorkQueueItem["priorite"] } =>
  b === "ROUGE" ? { echeance: "échu", mode: "alert", chip: { label: "ÉCHU", mode: "alert" }, prio: "alert" }
  : b === "AMBRE" ? { echeance: "sous 7 j", mode: "warn", chip: { label: "J-7", mode: "warn" }, prio: "warn" }
  : { echeance: "dans les temps", mode: "ok", chip: { label: "OK", mode: "ok" }, prio: "ok" };

// Seed fidèle à la maquette 01 — servi UNIQUEMENT quand l'API est absente (mode signalé).
const SEED_QUEUE: WorkQueueItem[] = [
  { id: "s1", client: "Meridian Trust Ltd", sous: "Trust · Jersey · CDB 20 art. 39",
    action: "Qualifier un hit sanctions", etape: "Screening", echeance: "aujourd'hui",
    echeanceMode: "alert", risque: { label: "CRITIQUE", mode: "alert" }, priorite: "alert" },
  { id: "s2", client: "Nordwind Holding AG", sous: "Personne morale · Zoug · EDD",
    action: "Compléter l'origine des fonds", etape: "KYC", echeance: "dans 2 j",
    echeanceMode: "ok", risque: { label: "ÉLEVÉ", mode: "warn" }, priorite: "warn" },
  { id: "s3", client: "Famille Ferreira", sous: "Personne physique · Brésil · CDD",
    action: "Viser la section patrimoine", etape: "Revue périodique", echeance: "dans 3 j",
    echeanceMode: "ok", risque: { label: "ÉLEVÉ", mode: "warn" }, priorite: "warn" },
  { id: "s4", client: "Amara Okonkwo", sous: "Personne physique · Genève · SDD",
    action: "Confirmer le nouveau passeport", etape: "Change of Circumstances", echeance: "dans 6 j",
    echeanceMode: "ok", risque: { label: "FAIBLE", mode: "ok" }, priorite: "ok" },
  { id: "s5", client: "Sablier Investments SA", sous: "Personne morale · Luxembourg · CDD",
    action: "Valider l'entrée en relation", etape: "Onboarding", echeance: "dans 8 j",
    echeanceMode: "ok", risque: { label: "FAIBLE", mode: "ok" }, priorite: "ok" },
];
const SEED_CORBEILLE: CorbeilleApi = { tri: "SLA", items: [] };

const ACTIVITE = [
  { mode: "ok", texte: "Visa Compliance accordé — Delacroix & Fils", meta: "à 12 min · M. Bregy" },
  { mode: "warn", texte: "Changement d'adresse propagé sur 3 dossiers", meta: "il y a 40 min · système" },
  { mode: "alert", texte: "Nouvelle alerte transaction — corridor Genève / Beyrouth", meta: "il y a 2 h · monitoring" },
  { mode: "info", texte: "Dossier Sablier Investments transmis pour décision", meta: "hier · vous" },
] as const;

export function MaJournee({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  const [onglet, setOnglet] = useState<"tout" | "bloques" | "delegues">("tout");
  const [tout, setTout] = useState(false);
  const [palette, setPalette] = useState(false);               // ⌘K — le pivot des 10 entrées
  const corbeille = useApiOrSeed<CorbeilleApi>("/v1/decisions/corbeille", SEED_CORBEILLE);

  // API vivante → la corbeille R478 EST la file ; sinon le seed maquette (source signalée).
  const apiItems: WorkQueueItem[] = corbeille.data.items.map((it) => {
    const b = badgeVers(it.badge);
    return { id: it.ref, client: it.ref, sous: it.type, action: t(ACTION_PAR_TYPE[it.type] ?? "Décider"),
      etape: it.etape, echeance: it.slaAt ? it.slaAt.slice(0, 10) : t(b.echeance),
      echeanceMode: b.mode, risque: b.chip, priorite: b.prio };
  });
  const items = corbeille.isDemo ? SEED_QUEUE : apiItems;
  const filtres: Record<typeof onglet, (i: WorkQueueItem) => boolean> = {
    tout: () => true, bloques: (i) => i.priorite === "alert", delegues: () => false };
  const visibles = items.filter(filtres[onglet]);
  const affiches = tout ? visibles : visibles.slice(0, 5);
  const critiques = items.filter((i) => i.priorite === "alert").length;

  const pill = (id: typeof onglet, label: string, n: number) => (
    <button key={id} onClick={() => setOnglet(id)} style={{ padding: "5px 12px",
      borderRadius: "var(--r-pill)", cursor: "pointer", fontFamily: "inherit", fontSize: 11.5,
      fontWeight: onglet === id ? 600 : 400,
      border: onglet === id ? "1px solid var(--brand-border)" : "1px solid transparent",
      background: onglet === id ? "var(--brand-surface)" : "transparent",
      color: onglet === id ? "var(--brand)" : "var(--text-muted)", whiteSpace: "nowrap" }}>
      {label} · <span className="mono">{n}</span></button>);

  return (<>
    <CommandPalette ouvert={palette} onOuvrir={() => setPalette(true)}
      onFermer={() => setPalette(false)} onNavigate={onNavigate} />
    <Ui2Shell
      nav={<Ui2Nav active={active} user="Camille Morel" role="Relationship Manager" onNavigate={onNavigate} t={t}
        onSearch={() => setPalette(true)}
        badges={{ journee: { n: items.length || 12 }, dossiers: { n: 48, sobre: true },
          clients: { n: 214, sobre: true }, kyc: { n: 3, sobre: true },
          surveillance: { n: critiques || 5, alert: true } }}
        modulesLicencies={[{ id: "pms", label: "PMS", icon: "▦" }, { id: "fx", label: "Multi-devise & FX", icon: "💱" }]} />}
      header={<Ui2HeaderListe titre="Ma journée" sousTitre={new Intl.DateTimeFormat("fr-CH",
          { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date())}
        filtres={<><Ui2Bouton>{t("Tous mes portefeuilles")} ▾</Ui2Bouton><Ui2Bouton>{t("Priorité")} ▾</Ui2Bouton></>}
        action={<Ui2Bouton primaire>{t("＋ Nouveau")}</Ui2Bouton>} t={t} />}
      sideWidth={340}
      side={<div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
        <div className="microlabel" style={{ marginBottom: 8 }}>{t("Suggestions d'Olivia")} <span style={{ background: "var(--ai-chip)", padding: "1px 5px", borderRadius: 4 }}>IA</span></div>
        <div style={{ background: "var(--ai-card)", border: "1px solid var(--ai-card-border)",
          borderRadius: 11, padding: 12, fontSize: 12.5, lineHeight: 1.55, color: "var(--ai-text)", marginBottom: 10 }}>
          <p style={{ margin: "0 0 10px" }}>{t("Le hit sanctions de")} <strong>Meridian Trust</strong> {t("présente un écart de date de naissance de 4 ans avec la liste source.")}</p>
          <span style={{ display: "flex", gap: 8 }}>
            <button style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
              background: "var(--ai-line)", color: "#fff", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600 }}>{t("Ouvrir l'analyse")}</button>
            <button style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border-input)", cursor: "pointer",
              background: "var(--bg-surface)", color: "var(--text-secondary)", fontFamily: "inherit", fontSize: 11.5 }}>{t("Écarter")}</button>
          </span>
          <p style={{ margin: "10px 0 0", fontSize: 10.5, color: "var(--text-muted)" }}>{t("Proposition — la décision reste vôtre et sera tracée.")}</p>
        </div>
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: 11, padding: 12, fontSize: 12.5, lineHeight: 1.55, marginBottom: 16 }}>
          <p style={{ margin: 0 }}>{t("3 revues périodiques de votre portefeuille portent le même document manquant. Les traiter ensemble ?")}</p>
          <button style={{ marginTop: 8, padding: 0, border: "none", background: "transparent", cursor: "pointer",
            color: "var(--brand)", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600 }}>{t("Grouper les 3 revues →")}</button>
        </div>
        <div className="microlabel" style={{ marginBottom: 8 }}>{t("Activité récente")}</div>
        <div>
          {ACTIVITE.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 9, marginBottom: 12 }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                background: `var(--${a.mode}-line)` }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12, color: "var(--text-body)", lineHeight: 1.4 }}>{t(a.texte)}</span>
                <span className="mono" style={{ display: "block", fontSize: 10.5, color: "var(--text-muted)", marginTop: 1 }}>{a.meta}</span>
              </span>
            </div>))}
        </div>
        <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid var(--border-soft)",
          display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t("Capacité de l'équipe")}</span>
          <span aria-hidden style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--border-soft)", overflow: "hidden" }}>
            <span style={{ display: "block", width: "72%", height: "100%", background: "var(--brand-light)" }} />
          </span>
          <span className="mono" style={{ fontSize: 11.5, fontWeight: 600 }}>72 %</span>
        </div>
      </div>}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        <StatTile label={t("À traiter aujourd'hui")} valeur={items.length || 12} note={t("dossiers")} onOpen={() => setOnglet("tout")} />
        <StatTile label={t("En attente de mon visa")} valeur={4} note={t("sections")} onOpen={() => setOnglet("tout")} />
        <StatTile label={t("SLA sous 48 h")} valeur={7} note={t("échéances")} accent="warn" onOpen={() => setOnglet("tout")} />
        <StatTile label={t("Alertes ouvertes")} valeur={critiques || 3} note={t("à qualifier")} accent="alert" onOpen={() => setOnglet("bloques")} />
      </div>
      <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px",
          borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 13.5, fontWeight: 600, margin: 0, whiteSpace: "nowrap" }}>{t("File de travail")}</h2>
          <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            {corbeille.isDemo ? t("triée par échéance et par risque") : t("corbeille « À décider » (R478) — tri SLA")}</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
            {pill("tout", t("Tout"), items.length)}
            {pill("bloques", t("Bloqués"), critiques)}
            {pill("delegues", t("Délégués"), 0)}
          </span>
        </div>
        <WorkQueueHeader t={t} />
        {affiches.map((it) => <WorkQueueRow key={it.id} item={it} onOpen={() => onNavigate("kyc")} />)}
        {affiches.length === 0 && <div style={{ padding: "18px 20px", fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>{t("Rien à décider — à jour.")}</div>}
        {!tout && visibles.length > 5 && (
          <button onClick={() => setTout(true)} style={{ display: "block", padding: "12px 20px", border: "none",
            background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12,
            fontWeight: 600, color: "var(--brand)" }}>
            {t("Voir les")} {visibles.length - 5} {t("dossiers restants →")}</button>)}
      </section>
    </Ui2Shell>
  </>);
}
