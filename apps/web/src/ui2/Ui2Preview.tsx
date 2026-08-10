import React, { useState } from "react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav } from "./Nav";
import { Ui2HeaderListe, Ui2HeaderDossier, Ui2Bouton } from "./Header";
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

const Puce = ({ mode, children }: { mode: "ok" | "warn" | "alert" | "info" | "ai"; children: React.ReactNode }) => (
  <span style={{ fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: "var(--r-chip)",
    letterSpacing: 0.2, background: `var(--${mode}-chip)`, color: `var(--${mode}-text)` }}>{children}</span>);

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
          borderRadius: 11, padding: 12, fontSize: 12.5, lineHeight: 1.55, color: "var(--ai-text)" }}>
          <span className="mono" style={{ fontSize: 9.5, background: "var(--ai-chip)", padding: "2px 6px",
            borderRadius: 4, letterSpacing: 1 }}>IA</span>
          <p style={{ margin: "8px 0" }}>{t("Gabarit du conteneur de suggestion — l'IA propose, l'humain décide (R44).")}</p>
          <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>{t("Proposition — la décision reste vôtre et sera tracée.")}</p>
        </div>
      </div>}>
      <Carte titre={t("Étape 1 — tokens & shell (à valider avant l'étape 2)")}>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-body)" }}>
          {t("Grille réelle : nav 248px sombre à 3 blocs + bloc « Métiers » licencié (R320) · header liste 60px / dossier 92px (bouton en haut à droite) · contenu minmax(0,1fr) · colonne latérale. Le shell ne défile jamais — seuls les panneaux internes défilent. Icônes Unicode PROVISOIRES : jeu vectoriel à choisir (étape 2).")}
        </p>
      </Carte>
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
