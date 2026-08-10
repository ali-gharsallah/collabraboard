import React, { useState } from "react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav } from "./Nav";
import { Ui2HeaderListe, Ui2HeaderDossier, Ui2Bouton } from "./Header";
import { StatusChip } from "./StatusChip";
import { StatTile } from "./StatTile";
import { WorkQueueHeader, WorkQueueRow, WorkQueueItem } from "./WorkQueueRow";
import { EventTimeline } from "./EventTimeline";
import { traduire, langue } from "../lib/i18n";

/**
 * UI v2 — APERÇU de l'étape 1 (tokens + shell), à VALIDER par le PO avant l'étape 2
 * (composants transverses). Rien ici ne touche les écrans existants : le shell v2 est une
 * couche opt-in (classe .ui2). Contenu de l'aperçu : la grille réelle (nav 248 · header ·
 * contenu · colonne latérale), les nuanciers de tokens et le spécimen typographique —
 * exactement ce que le handoff demande de montrer avant de continuer.
 */

const Carte = ({ titre, children }: { titre: string; children: React.ReactNode }) => (
  <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
    borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: 18, marginBottom: 14 }}>
    <h2 style={{ fontSize: 13.5, fontWeight: 600, margin: "0 0 10px", color: "var(--text)" }}>{titre}</h2>
    {children}
  </section>);

const Nuance = ({ v, nom }: { v: string; nom: string }) => (
  <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11 }}>
    <span aria-hidden style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0,
      background: `var(${v})`, border: "1px solid var(--border)" }} />
    <span className="mono" style={{ color: "var(--text-muted)" }}>{v}</span>
    <span style={{ color: "var(--text-body)" }}>{nom}</span>
  </span>);

const Puce = StatusChip;                         // étape 2 : la puce de l'aperçu EST le composant

// File de travail d'exemple (écran 01 « Ma journée ») — l'action attendue en toutes lettres.
const FILE_EXEMPLE: WorkQueueItem[] = [
  { id: "w1", client: "Al-Maktoum Holdings SA", action: "Qualifier un hit sanctions", etape: "Screening",
    echeance: "AUJOURD'HUI", risque: { label: "CRITIQUE", mode: "alert" }, priorite: "alert" },
  { id: "w2", client: "Zhang Wei Family Office", action: "Compléter la section SOF/SOW", etape: "Collecte",
    echeance: "11.08.2026", risque: { label: "ÉLEVÉ", mode: "warn" }, priorite: "warn" },
  { id: "w3", client: "Nordic Wealth AB", action: "Viser le delta de la revue périodique", etape: "Revue",
    echeance: "14.08.2026", risque: { label: "MOYEN", mode: "neutral" }, priorite: "ok" },
  { id: "w4", client: "Mancini GmbH", action: "Approuver l'ordre de transfert (4 yeux)", etape: "Settlement",
    echeance: "15.08.2026", risque: { label: "FAIBLE", mode: "ok" }, priorite: "ok" },
];

export function Ui2Preview() {
  const t = traduire(langue());
  const [active, setActive] = useState("journee");
  const [variante, setVariante] = useState<"liste" | "dossier">("liste");
  const header = variante === "liste"
    ? <Ui2HeaderListe titre="Ma journée" sousTitre="dimanche 10 août 2026 · 12 éléments"
        filtres={<Ui2Bouton>{t("Filtres")}</Ui2Bouton>}
        action={<Ui2Bouton primaire onClick={() => setVariante("dossier")}>{t("Voir le header dossier →")}</Ui2Bouton>} t={t} />
    : <Ui2HeaderDossier nom="Al-Maktoum Holdings SA" initiales="AM"
        identifiants="CLI-00001 · KYC-2026-CH-3693-R1 · EDD · CH"
        puces={<><Puce mode="warn">{t("EN REVUE")}</Puce><Puce mode="alert">{t("RISQUE ÉLEVÉ")}</Puce></>}
        actions={<><Ui2Bouton onClick={() => setVariante("liste")}>{t("← Header liste")}</Ui2Bouton>
          <Ui2Bouton primaire>{t("Transmettre pour visa")}</Ui2Bouton></>} t={t} />;
  return (
    <Ui2Shell
      nav={<Ui2Nav active={active} user="Camille Morel" role="Relationship Manager"
        onNavigate={setActive} t={t}
        badges={{ journee: { n: 12 }, surveillance: { n: 3, alert: true } }}
        modulesLicencies={[{ id: "pms", label: "PMS", icon: "▦" }, { id: "fx", label: "Multi-devise & FX", icon: "💱" }]} />}
      header={header}
      side={<div>
        <div className="microlabel" style={{ marginBottom: 8 }}>{t("Colonne latérale — 340px")}</div>
        <div style={{ background: "var(--ai-card)", border: "1px solid var(--ai-card-border)",
          borderRadius: 11, padding: 12, fontSize: 12.5, lineHeight: 1.55, color: "var(--ai-text)",
          marginBottom: 16 }}>
          <span className="mono" style={{ fontSize: 9.5, background: "var(--ai-chip)", padding: "2px 6px",
            borderRadius: 4, letterSpacing: 1 }}>IA</span>
          <p style={{ margin: "8px 0" }}>{t("Gabarit du conteneur de suggestion — l'IA propose, l'humain décide (R44).")}</p>
          <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>{t("Proposition — la décision reste vôtre et sera tracée.")}</p>
        </div>
        <div className="microlabel" style={{ marginBottom: 8 }}>{t("Journal du dossier — EventTimeline")}</div>
        <EventTimeline events={[
          { id: "e1", titre: t("Visa Compliance apposé (R15)"), meta: "10.08.2026 · Isabelle Vernet", mode: "ok" },
          { id: "e2", titre: t("Renvoi ciblé vers Collecte (R475)"), meta: "09.08.2026 · Marc Dubois", mode: "warn", ici: true },
          { id: "e3", titre: t("Hit screening qualifié — faux positif"), meta: "08.08.2026 · Sarah Zimmermann", mode: "ok" },
          { id: "e4", titre: t("Dossier ouvert — EDD"), meta: "01.08.2026 · Camille Morel", mode: "info" },
        ]} />
      </div>}>
      <Carte titre={t("Étapes 1+2 — tokens, shell & composants transverses (à valider avant l'étape 3)")}>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-body)" }}>
          {t("Grille réelle : nav 248px à 3 blocs + « Métiers » licencié (R320) · headers 60/92px · contenu minmax(0,1fr) · colonne latérale. Ci-dessous, les 4 composants transverses RÉELS : StatTile (toute tuile est cliquable), WorkQueueRow (action en toutes lettres, en-tête sur la MÊME grille), StatusChip, EventTimeline (« vous êtes ici » en colonne latérale). Icônes Unicode provisoires — jeu vectoriel proposé : Lucide.")}
        </p>
      </Carte>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        <StatTile label={t("À traiter aujourd'hui")} valeur={12} note={t("dossiers, triés par échéance")} onOpen={() => setActive("journee")} />
        <StatTile label={t("En attente de mon visa")} valeur={4} note={t("décisions — corbeille R478")} onOpen={() => setActive("journee")} />
        <StatTile label={t("SLA sous 48 h")} valeur={7} note={t("préavis — jamais un blocage")} accent="warn" onOpen={() => setActive("journee")} />
        <StatTile label={t("Alertes ouvertes")} valeur={3} note={t("dont 1 critique")} accent="alert" onOpen={() => setActive("surveillance")} />
      </div>
      <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", overflow: "hidden", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px",
          borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>{t("File de travail — l'action attendue est écrite en toutes lettres")}</h2>
          <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>4 / 12</span>
        </div>
        <WorkQueueHeader t={t} />
        {FILE_EXEMPLE.map((it) => <WorkQueueRow key={it.id} item={it} onOpen={() => setActive("journee")} />)}
      </section>
      <Carte titre={t("Sémantique réglementaire — jamais décorative")}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Puce mode="ok">{t("VALIDÉ")}</Puce><Puce mode="warn">{t("À CONFIRMER")}</Puce>
          <Puce mode="alert">{t("CRITIQUE")}</Puce><Puce mode="info">{t("LECTURE SEULE")}</Puce>
          <Puce mode="ai">{t("SUGGESTION IA")}</Puce>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
          {t("Chaque puce reste lisible sans sa couleur : le libellé porte l'information (AA ≥ 4,5:1).")}</p>
      </Carte>
      <Carte titre={t("Structure & marque")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Nuance v="--bg-app" nom={t("fond de contenu")} /><Nuance v="--brand" nom={t("actions & identité")} />
          <Nuance v="--bg-surface" nom={t("cartes & tableaux")} /><Nuance v="--brand-light" nom={t("jauges & timeline")} />
          <Nuance v="--bg-subtle" nom={t("colonnes secondaires")} /><Nuance v="--brand-surface" nom={t("option sélectionnée")} />
          <Nuance v="--text" nom={t("texte principal")} /><Nuance v="--gold" nom={t("l'olive du logo, uniquement")} />
          <Nuance v="--text-muted" nom={t("métadonnées (AA)")} /><Nuance v="--nav-bg" nom={t("navigation sombre")} />
        </div>
      </Carte>
      <Carte titre={t("Spécimen typographique")}>
        <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.2 }}>{t("Titre d'écran — 16px/600")}</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, margin: "8px 0 4px" }}>{t("Titre de carte — 13,5px/600")}</div>
        <p style={{ margin: "0 0 8px", fontSize: 13, lineHeight: 1.6, color: "var(--text-body)", maxWidth: 560 }}>
          {t("Corps 13px/1,6 — l'écran répond à une question, pas à dix. L'action attendue est écrite en toutes lettres, jamais encodée dans un statut à décoder.")}</p>
        <div className="mono" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1 }}>1 284<span style={{ fontSize: 12, color: "var(--text-muted)" }}> CHF M</span></div>
        <div className="microlabel" style={{ marginTop: 6 }}>{t("Micro-libellé capitales — Mono 9,5px")}</div>
        <div className="mono" style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
          KYC-2026-CH-3693-R1 · 10.08.2026 · 61/100 — {t("tout nombre, identifiant ou date est en Mono")}</div>
      </Carte>
    </Ui2Shell>);
}
