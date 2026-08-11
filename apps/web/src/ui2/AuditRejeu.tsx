import React, { useState } from "react";
import { Check } from "lucide-react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderDossier, Ui2Bouton } from "./Header";
import { StatusChip } from "./StatusChip";
import { EventTimeline } from "./EventTimeline";
import { exporterCsv, jourFichier } from "./actions";
import { traduire, langue } from "../lib/i18n";

/**
 * UI v2 — étape 8 : écran 09 « Audit — rejeu et preuves ». L'écran que l'auditeur utilise
 * LUI-MÊME : on choisit une date, le dossier se réaffiche tel qu'il était (R48), avec le
 * paramétrage ALORS EN VIGUEUR (R29 — version à date d'effet, jamais « courante »), et
 * l'intégrité documentaire ancrée chez un tiers (RFC 3161 / ZertES). Les événements
 * postérieurs à la date n'apparaissent PAS dans l'état — c'est l'état réel connu de la
 * banque ce jour-là. Chaque consultation est elle-même tracée (l'auditeur est un utilisateur
 * comme un autre).
 */

// La frise : chaque événement porte l'état du dossier TEL QU'IL EN RESSORT (rejeu R48).
const FRISE = [
  { date: "17.05.2019", titre: "Entrée en relation", meta: "17.05.2019 11:08 · C. Morel", mode: "neutral",
    etat: { statut: "En cours d'ouverture", diligence: "CDD", risque: "Moyen", visa: "—" },
    matrice: "v2.0 — en vigueur du 01.03.2019", seuils: "v6 — inchangés depuis 2018" },
  { date: "01.03.2025", titre: "Screening périodique — aucun hit", meta: "01.03.2025 03:00 · système", mode: "neutral",
    etat: { statut: "Validé", diligence: "CDD", risque: "Moyen", visa: "M. Bregy" },
    matrice: "v4.2 — en vigueur du 01.01.2025", seuils: "v11 — inchangés depuis 09.2024" },
  { date: "08.03.2025", titre: "Revue périodique validée", meta: "08.03.2025 16:41 · M. Bregy", mode: "ok",
    etat: { statut: "Validé", diligence: "CDD", risque: "Moyen", visa: "M. Bregy" },
    matrice: "v4.2 — en vigueur du 01.01.2025", seuils: "v11 — inchangés depuis 09.2024" },
  { date: "12.03.2025", titre: "", meta: "", mode: "neutral",
    etat: { statut: "Validé", diligence: "CDD", risque: "Moyen", visa: "M. Bregy" },
    matrice: "v4.2 — en vigueur du 01.01.2025", seuils: "v11 — inchangés depuis 09.2024" },
  { date: "18.06.2026", titre: "Passage CDD → EDD", meta: "18.06.2026 09:04 · moteur de règles v5.1", mode: "warn",
    etat: { statut: "Validé", diligence: "EDD", risque: "Élevé", visa: "M. Bregy" },
    matrice: "v4.5 — en vigueur du 01.04.2026", seuils: "v11 — inchangés depuis 09.2024" },
  { date: "10.08.2026", titre: "Blocage sanctions — UBO listé", meta: "10.08.2026 14:22 · screening", mode: "alert",
    etat: { statut: "Bloqué — sanctions", diligence: "EDD", risque: "Critique", visa: "M. Bregy" },
    matrice: "v4.5 — en vigueur du 01.04.2026", seuils: "v11 — inchangés depuis 09.2024" },
] as const;

const carte: React.CSSProperties = { background: "var(--bg-surface)", border: "1px solid var(--border)",
  borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: "14px 16px", marginBottom: 14 };

export function AuditRejeu({ active, onNavigate, onRetour }: {
  active: Ui2NavId; onNavigate: (id: Ui2NavId) => void; onRetour?: () => void;
}) {
  const t = traduire(langue());
  const [idx, setIdx] = useState(3);                       // 12.03.2025 — la reconstitution de la maquette
  const pos = FRISE[idx];
  const posterieurs = FRISE.slice(idx + 1).filter((e) => e.titre);
  const journal = [...FRISE.filter((e) => e.titre)].reverse().map((e) => ({
    id: e.date, titre: t(e.titre), meta: e.meta,
    mode: e.mode === "neutral" ? undefined : (e.mode as "ok" | "warn" | "alert") }));
  const iciPos = journal.findIndex((e) => FRISE.findIndex((f) => f.date === e.id) <= idx);
  const journalAvecIci = [
    ...journal.slice(0, iciPos < 0 ? journal.length : iciPos),
    { id: "ici", titre: `${t("Vous êtes ici")} — ${pos.date}`, meta: t("état reconstitué"), ici: true },
    ...journal.slice(iciPos < 0 ? journal.length : iciPos)];

  return (
    <Ui2Shell nav={<Ui2Nav active={active} user="Jean Perrin" role={t("Audit interne — lecture seule")}
      onNavigate={onNavigate} t={t} badges={{}} />} sideWidth={400}
      header={<Ui2HeaderDossier nom={t("Rejeu — Meridian Trust Ltd")} initiales="MT"
        identifiants={`CLI-02207 · ${t("état reconstitué au")} ${pos.date} · ${t("consultation tracée sous")} AUD-9931`}
        puces={<StatusChip mode="neutral">{t("LECTURE SEULE")}</StatusChip>}
        actions={<>{onRetour && <Ui2Bouton onClick={onRetour}>{t("← Pilotage")}</Ui2Bouton>}
          <Ui2Bouton onClick={() => exporterCsv(`olive-dossier-de-preuve-${jourFichier()}`,
            [t("Élément"), t("Valeur")],
            [[t("Écran"), t("Audit & rejeu")], [t("Exporté le"), new Date().toISOString()],
             [t("Portée"), t("le journal est append-only (R49) — l'export en est une LECTURE")]])}>
            {t("Exporter le dossier de preuve")}</Ui2Bouton></>} t={t} />}
      stepper={<div style={{ display: "flex", alignItems: "center", gap: 14, width: "100%" }}>
        <span className="microlabel" style={{ flexShrink: 0 }}>{t("Date de rejeu")}</span>
        <div style={{ position: "relative", flex: 1, height: 16 }}>
          <div aria-hidden style={{ position: "absolute", top: 6, left: 0, right: 0, height: 4,
            borderRadius: 2, background: "var(--border-soft)" }} />
          {FRISE.map((e, i) => e.titre && (
            <span key={e.date} aria-hidden style={{ position: "absolute", top: 4.5,
              left: `calc(${(i / (FRISE.length - 1)) * 100}% - 3.5px)`, width: 7, height: 7,
              borderRadius: "50%", background: `var(--${e.mode === "neutral" ? "text-muted" : `${e.mode}-line`})` }} />))}
          <input type="range" className="ui2-slider" min={0} max={FRISE.length - 1} step={1}
            value={idx} aria-label={t("Date de rejeu")} onChange={(e) => setIdx(Number(e.target.value))}
            style={{ position: "absolute", inset: 0 }} />
        </div>
        <span className="mono" style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600,
          border: "1px solid var(--border-input)", borderRadius: 8, padding: "6px 10px",
          background: "var(--bg-surface)" }}>{pos.date}</span>
        <span className="mono" style={{ flexShrink: 0, fontSize: 10.5, color: "var(--text-muted)" }}>
          {t("142 événements · ouverture 2019 → aujourd'hui")}</span>
      </div>}
      side={<div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>
          {t("Journal d'événements")}</div>
        <EventTimeline events={journalAvecIci} />
        <div style={{ background: "var(--info-chip)", border: "1px solid var(--info-line)",
          borderRadius: 10, padding: "10px 12px", marginTop: 14, fontSize: 11.5,
          color: "var(--info-text)", lineHeight: 1.55 }}>
          {t("Cette consultation est enregistrée : identité, dossier consulté, date de rejeu, horodatage. L'auditeur est tracé comme tout autre utilisateur.")}</div>
      </div>}>
      <section style={carte}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>
          {`${t("État du dossier au")} ${pos.date}`}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {[[t("Statut KYC"), pos.etat.statut], [t("Niveau de diligence"), pos.etat.diligence],
            [t("Risque"), pos.etat.risque], [t("Visa en vigueur"), pos.etat.visa]].map(([l, v]) => (
            <div key={l}>
              <div className="microlabel" style={{ marginBottom: 4 }}>{l}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600,
                color: v.startsWith("Bloqué") ? "var(--alert-text)" : "var(--text)" }}>{t(v)}</div>
            </div>))}
        </div>
        {posterieurs.length > 0 && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.5 }}>
            {`${posterieurs.map((e) => t(e.titre)).join(" · ")} — ${t("postérieurs à cette date : ils n'apparaissent pas ici. C'est l'état réel connu de la banque ce jour-là.")}`}</div>)}
      </section>
      <section style={carte}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>
          {t("Paramétrage en vigueur ce jour-là")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[[t("Matrice de risque pays"), pos.matrice], [t("Seuils AML"), pos.seuils],
            [t("Questionnaire KYC"), t("v7 — 9 sections obligatoires")],
            [t("Workflow de visa"), t("WF-KYC-03 — quatre yeux")]].map(([l, v]) => (
            <div key={l} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px" }}>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 2 }}>{l}</div>
              <div className="mono" style={{ fontSize: 11.5, color: "var(--text-body)" }}>{v}</div>
            </div>))}
        </div>
      </section>
      <section style={{ ...carte, marginBottom: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
          {t("Intégrité documentaire")}</div>
        {[[t("Acte de trust — v2"), t("empreinte ancrée le 14.11.2023")],
          [t("Passeport UBO — v1"), t("empreinte ancrée le 02.02.2024")],
          [t("Attestation d'origine des fonds — v1"), t("empreinte ancrée le 02.02.2024")]].map(([doc, anc]) => (
          <div key={doc} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0",
            borderBottom: "1px solid var(--border-row)" }}>
            <Check size={14} strokeWidth={2} color="var(--ok-line)" aria-hidden />
            <span style={{ fontSize: 12, color: "var(--text-body)" }}>{doc}</span>
            <span className="mono" style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--text-muted)" }}>{anc}</span>
          </div>))}
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Horodatage par tiers qualifié (RFC 3161 / ZertES). L'antériorité de chaque version est opposable sans dépendre du journal interne.")}</div>
      </section>
    </Ui2Shell>);
}
