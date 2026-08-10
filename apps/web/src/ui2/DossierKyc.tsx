import React, { useState } from "react";
import { LayoutGrid, ArrowLeftRight } from "lucide-react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderDossier, Ui2Bouton } from "./Header";
import { StatusChip } from "./StatusChip";
import { FieldCard } from "./FieldCard";
import { SectionChecklist, SectionEtat } from "./SectionChecklist";
import { EventTimeline } from "./EventTimeline";
import { traduire, langue } from "../lib/i18n";

/**
 * UI v2 — écran 02 « Dossier KYC » (handoff, maquette screenshots/02-dossier-kyc.png).
 * Le dossier S'OUVRE SUR LA PREMIÈRE SECTION INCOMPLÈTE et sur ses champs manquants — jamais
 * sur le premier onglet (bandeau ambre qui l'explique). Colonne des sections 262px, champs au
 * centre (FieldCard : provenance OBLIGATOIRE quand renseigné, bordure ambre permanente quand
 * manquant, Olivia PROPOSE — reprendre est un acte), colonne latérale 320px : « Qui doit agir »,
 * « Ce qui bloque la transmission », journal du dossier. Le bouton « Transmettre pour visa »
 * RESTE ACTIF : au clic il énonce précisément ce qui manque — jamais grisé sans explication.
 */

const SECTIONS: SectionEtat[] = [
  { code: "ident", label: "Identification", etat: "visee" },
  { code: "structure", label: "Structure & ayants droit", etat: "visee" },
  { code: "activite", label: "Activité économique", etat: "visee" },
  { code: "fonds", label: "Origine des fonds", etat: "encours", manquants: 2 },
  { code: "patrimoine", label: "Origine du patrimoine", etat: "encours", manquants: 1 },
  { code: "fiscalite", label: "Fiscalité", etat: "vide" },
  { code: "crossborder", label: "Cross-border", etat: "vide" },
  { code: "risque", label: "Profil de risque", etat: "vide" },
];
const MANQUES = [
  "2 champs obligatoires en origine des fonds",
  "1 champ en origine du patrimoine",
];

export function DossierKyc({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  // Ouverture : PREMIÈRE section incomplète (celle qui porte des manquants) — le principe n°1.
  const premiereIncomplete = SECTIONS.find((s) => s.etat !== "visee")?.code ?? SECTIONS[0].code;
  const [section, setSection] = useState(premiereIncomplete);
  const [manques, setManques] = useState(false);               // panneau « ce qui manque » au clic
  const [montant, setMontant] = useState("");
  const champStyle: React.CSSProperties = { padding: "8px 11px", borderRadius: "var(--r-input)",
    border: "1px solid var(--border-input)", fontFamily: "inherit", fontSize: 12.5,
    color: "var(--text)", background: "var(--bg-surface)" };
  return (
    <Ui2Shell
      nav={<Ui2Nav active={active} user="Camille Morel" role="Relationship Manager" onNavigate={onNavigate} t={t}
        badges={{ journee: { n: 12 }, dossiers: { n: 48, sobre: true }, clients: { n: 214, sobre: true },
          kyc: { n: 3, sobre: true }, surveillance: { n: 5, alert: true } }}
        modulesLicencies={[{ id: "pms", label: "PMS", icon: <LayoutGrid size={16} strokeWidth={1.75} /> },
          { id: "fx", label: "Multi-devise & FX", icon: <ArrowLeftRight size={16} strokeWidth={1.75} /> }]} />}
      header={<Ui2HeaderDossier nom="Nordwind Holding AG" initiales="NH"
        identifiants="CLI-04812 · Personne morale · Zoug · relation depuis 2019"
        puces={<><StatusChip mode="alert">{t("RISQUE ÉLEVÉ")}</StatusChip><StatusChip mode="neutral">EDD</StatusChip></>}
        actions={<><Ui2Bouton>{t("Chronologie")}</Ui2Bouton><Ui2Bouton>{t("Documents")}</Ui2Bouton>
          <Ui2Bouton primaire onClick={() => setManques(true)}>{t("Transmettre pour visa")}</Ui2Bouton></>} t={t} />}
      sideWidth={320}
      side={<div>
        <div className="microlabel" style={{ marginBottom: 10 }}>{t("Qui doit agir")}</div>
        <EventTimeline events={[
          { id: "q1", titre: t("Saisie gestionnaire") + " — C. Morel", meta: t("en cours"), mode: "ok" },
          { id: "q2", titre: t("Visa Compliance"), meta: t("en attente") + " · SLA 3 j", ici: true },
          { id: "q3", titre: t("Décision MLRO"), meta: t("requis en EDD"), mode: "info" },
        ]} />
        <div style={{ background: "var(--warn-card)", border: "1px solid var(--warn-card-border)",
          borderRadius: 11, padding: 12, margin: "6px 0 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--warn-text)", marginBottom: 6 }}>
            {t("Ce qui bloque la transmission")}</div>
          {MANQUES.map((m, i) => (
            <div key={i} style={{ fontSize: 11.5, color: "var(--warn-text)", padding: "2px 0" }}>◐ {t(m)}</div>))}
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 7 }}>
            {t("Le bouton reste actif : il indiquera précisément ce qui manque plutôt que d'être grisé sans explication.")}</div>
        </div>
        <div className="microlabel" style={{ marginBottom: 8 }}>{t("Journal du dossier")}</div>
        <EventTimeline events={[
          { id: "j1", titre: t("Section « activité économique » visée"), meta: "08.08 · M. Bregy", mode: "ok" },
          { id: "j2", titre: t("Screening relancé — aucun hit"), meta: "07.08 · système", mode: "ok" },
          { id: "j3", titre: t("Passage CDD → EDD (pays de l'ayant droit)"), meta: "02.08 · moteur de règles", mode: "warn" },
        ]} />
      </div>}>
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <SectionChecklist sections={SECTIONS} courante={section} onOuvrir={setSection} t={t}
          pied={<div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{t("Prochaine échéance")}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", marginTop: 2 }}>
              {t("Revue périodique")} — <span className="mono">14.09.2026</span></div>
          </div>} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{t("Origine des fonds")}</h2>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
              {t("exigence CDB 20 · art. 27 — corroboration requise en EDD")}</span>
          </div>
          <div style={{ background: "var(--warn-card)", border: "1px solid var(--warn-card-border)",
            borderRadius: 9, padding: "8px 12px", fontSize: 11.5, color: "var(--warn-text)", marginBottom: 12 }}>
            ◐ {t("Ouvert directement sur les 2 champs manquants. Les sections déjà visées ne sont pas rouvertes.")}</div>
          {manques && (
            <div role="alert" style={{ background: "var(--alert-card)", border: "1px solid var(--alert-line)",
              borderRadius: 9, padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--alert-text)", marginBottom: 5 }}>
                {t("Transmission impossible — il manque :")}</div>
              {MANQUES.map((m, i) => (
                <div key={i} style={{ fontSize: 11.5, color: "var(--alert-text)", padding: "1px 0" }}>→ {t(m)}</div>))}
              <button onClick={() => setManques(false)} style={{ marginTop: 7, padding: "4px 10px",
                borderRadius: 7, border: "1px solid var(--border-input)", background: "var(--bg-surface)",
                fontFamily: "inherit", fontSize: 11, cursor: "pointer", color: "var(--text-secondary)" }}>{t("Compris")}</button>
            </div>)}
          <FieldCard label={t("Source principale des apports")} etat="RENSEIGNE" t={t}
            valeur={<>Cession de participation — Nordwind Energie GmbH, 2019</>}
            provenance={t("Source : acte notarié du 12.03.2019 · empreinte vérifiée · saisi par M. Bregy")} />
          <FieldCard label={t("Montant et devise de l'apport initial")} etat="MANQUANT" t={t}
            saisie={<span style={{ display: "flex", gap: 8 }}>
              <input value={montant} onChange={(e) => setMontant(e.target.value)}
                placeholder={t("Montant")} aria-label={t("Montant")} style={{ ...champStyle, flex: 1 }} />
              <select aria-label={t("Devise")} style={champStyle}>
                <option>CHF</option><option>EUR</option><option>USD</option></select>
            </span>}
            olivia={{ texte: t("Olivia lit 14 200 000 CHF dans l'acte notarié — reprendre ?"),
              onReprendre: () => setMontant("14 200 000") }} />
          <FieldCard label={t("Flux récurrents attendus")} etat="MANQUANT" t={t}
            saisie={<input placeholder={t("Nature, fréquence et ordre de grandeur des flux")}
              aria-label={t("Flux récurrents attendus")} style={{ ...champStyle, width: "100%", boxSizing: "border-box" }} />}
            note={t("Sert de référence au monitoring transactionnel : un écart déclenchera une alerte.")} />
          <section style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)",
            borderRadius: 11, padding: "13px 15px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>
                {t("Corroboration documentaire")}</span>
              <span style={{ marginLeft: "auto" }}><StatusChip mode="neutral">3 {t("PIÈCES")}</StatusChip></span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
              {t("Acte notarié · états financiers 2018-2019 · attestation fiduciaire")}</div>
          </section>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Ui2Bouton primaire>{t("Enregistrer et continuer")}</Ui2Bouton>
            <Ui2Bouton>{t("Demander au client")}</Ui2Bouton>
            <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
              {t("Brouillon enregistré")} · 14:02</span>
          </div>
        </div>
      </div>
    </Ui2Shell>);
}
