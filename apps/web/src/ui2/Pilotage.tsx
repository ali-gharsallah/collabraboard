import React from "react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderListe, Ui2Bouton } from "./Header";
import { StatTile } from "./StatTile";
import { traduire, langue } from "../lib/i18n";

/**
 * UI v2 — étape 8 : écran 08 « Pilotage — direction ». Un tableau de bord qui montre OÙ LE
 * TRAVAIL EST BLOQUÉ plutôt qu'une collection d'indicateurs : le Bar Meter (temps d'attente
 * médian par étape) se conclut par une phrase ÉCRITE qui nomme le seul goulot interne — la
 * lecture est faite, pas déléguée au lecteur. Chaque chiffre est cliquable jusqu'aux dossiers
 * qui le composent (règle StatTile : un chiffre sans chemin n'existe pas).
 */

function BarMeter({ lignes, max }: {
  lignes: { label: string; valeur: number; affichage: string; mode: "ok" | "warn" | "alert" }[];
  max: number;
}) {
  return (
    <div>
      {lignes.map((l) => (
        <div key={l.label} style={{ padding: "7px 0", borderBottom: "1px solid var(--border-row)" }}>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ fontSize: 12, color: "var(--text-body)" }}>{l.label}</span>
            <span className="mono" style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600,
              color: l.mode === "ok" ? "var(--text)" : `var(--${l.mode}-text)` }}>{l.affichage}</span>
          </div>
          <div aria-hidden style={{ height: 5, borderRadius: 3, background: "var(--border-soft)",
            marginTop: 4 }}>
            <div style={{ height: 5, borderRadius: 3, width: `${(l.valeur / max) * 100}%`,
              background: `var(--${l.mode}-line)` }} />
          </div>
        </div>))}
    </div>);
}

const carte: React.CSSProperties = { background: "var(--bg-surface)", border: "1px solid var(--border)",
  borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: "14px 16px" };

export function Pilotage({ active, onNavigate, onOuvrirAudit }: {
  active: Ui2NavId; onNavigate: (id: Ui2NavId) => void; onOuvrirAudit?: () => void;
}) {
  const t = traduire(langue());
  return (
    <Ui2Shell nav={<Ui2Nav active={active} user="Marc Bregy" role={t("Directeur Compliance")}
      onNavigate={onNavigate} t={t}
      badges={{ journee: { n: 12 }, dossiers: { n: 48, sobre: true }, clients: { n: 214, sobre: true },
        surveillance: { n: 5, alert: true } }} />}
      header={<Ui2HeaderListe titre={t("Pilotage")}
        sousTitre={t("août 2026 · Banque Olive Suisse SA · Zurich et Genève")}
        action={<><Ui2Bouton>{t("30 derniers jours ⌄")}</Ui2Bouton><Ui2Bouton>{t("Exporter")}</Ui2Bouton>
          {onOuvrirAudit && <Ui2Bouton onClick={onOuvrirAudit}>{t("Rejeu d'audit →")}</Ui2Bouton>}</>} t={t} />}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
        <StatTile label={t("Dossiers en cours")} valeur={438} note={t("+12 sur 30 jours")}
          onOpen={() => onNavigate("dossiers")} />
        <StatTile label={t("Hors SLA")} valeur={37} note={t("8,4 % du stock")} accent="warn"
          onOpen={() => onNavigate("dossiers")} />
        <StatTile label={t("Délai médian d'ouverture")} valeur={<>11 <span style={{ fontSize: 16 }}>j</span></>}
          note={t("−3 j depuis janvier")} onOpen={() => onNavigate("entree")} />
        <StatTile label={t("Alertes AML ouvertes")} valeur={23} note={t("dont 4 en escalade MLRO")}
          accent="alert" onOpen={() => onNavigate("surveillance")} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 14, alignItems: "start" }}>
        <section style={carte}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t("Où le travail est bloqué")}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
            {t("temps d'attente médian par étape du parcours")}</div>
          <BarMeter max={7} lignes={[
            { label: t("Saisie gestionnaire"), valeur: 2.1, affichage: "2,1 j", mode: "ok" },
            { label: t("Attente de documents client"), valeur: 6.8, affichage: "6,8 j", mode: "warn" },
            { label: t("Visa Compliance"), valeur: 4.3, affichage: "4,3 j", mode: "alert" },
            { label: t("Décision MLRO"), valeur: 1.4, affichage: "1,4 j", mode: "ok" },
            { label: t("Ouverture technique"), valeur: 0.6, affichage: "0,6 j", mode: "ok" }]} />
          <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "10px 12px", marginTop: 12, fontSize: 11.5,
            color: "var(--text-body)", lineHeight: 1.55 }}>
            {t("Le visa Compliance est le seul goulot interne : 4,3 jours pour 3 contrôleurs, dont 61 % du temps sur des dossiers à risque faible. Le reste de l'attente vient du client.")}</div>
        </section>
        <div style={{ display: "grid", gap: 14 }}>
          <section style={carte}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
              {t("Charge par contrôleur")}</div>
            {[{ ini: "SB", nom: "Sofia Berger", pct: 94, mode: "alert" },
              { ini: "TR", nom: "Thomas Roth", pct: 71, mode: "warn" },
              { ini: "AL", nom: "Ana Lopes", pct: 44, mode: "ok" }].map((c) => (
              <div key={c.ini} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                <span aria-hidden style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                  background: "var(--bg-subtle)", border: "1px solid var(--border)", display: "inline-flex",
                  alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 600,
                  color: "var(--text-secondary)" }}>{c.ini}</span>
                <span style={{ fontSize: 12, color: "var(--text-body)", minWidth: 90 }}>{c.nom}</span>
                <span aria-hidden style={{ flex: 1, height: 5, borderRadius: 3, background: "var(--border-soft)" }}>
                  <span style={{ display: "block", height: 5, borderRadius: 3, width: `${c.pct}%`,
                    background: `var(--${c.mode}-line)` }} /></span>
                <span className="mono" style={{ fontSize: 11.5, color: `var(--${c.mode}-text)` }}>{c.pct} %</span>
              </div>))}
            <button onClick={() => onNavigate("dossiers")} style={{ border: "none", background: "transparent",
              padding: 0, marginTop: 8, fontFamily: "inherit", fontSize: 11.5, fontWeight: 600,
              color: "var(--brand)", cursor: "pointer" }}>{t("Rééquilibrer 9 dossiers vers Ana Lopes →")}</button>
          </section>
          <section style={carte}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
              {t("Exposition par risque pays")}</div>
            {[{ label: t("Critique"), couleur: "var(--alert-line)", detail: t("6 clients · 41 M") },
              { label: t("Élevé"), couleur: "var(--warn-line)", detail: t("73 clients · 620 M") },
              { label: t("Modéré"), couleur: "var(--text-muted)", detail: t("218 clients · 2,1 Md") },
              { label: t("Faible"), couleur: "var(--ok-line)", detail: t("141 clients · 1,4 Md") }].map((r) => (
              <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 0" }}>
                <span aria-hidden style={{ width: 9, height: 9, borderRadius: 2, background: r.couleur }} />
                <span style={{ fontSize: 12, color: "var(--text-body)" }}>{r.label}</span>
                <span className="mono" style={{ marginLeft: "auto", fontSize: 11.5,
                  color: "var(--text-muted)" }}>{r.detail}</span>
              </div>))}
            <button onClick={() => onNavigate("surveillance")} style={{ border: "none", background: "transparent",
              padding: 0, marginTop: 8, fontFamily: "inherit", fontSize: 11.5, fontWeight: 600,
              color: "var(--brand)", cursor: "pointer" }}>{t("Ouvrir la carte des flux →")}</button>
          </section>
        </div>
      </div>
    </Ui2Shell>);
}
