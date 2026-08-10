import React, { useState } from "react";
import { Check } from "lucide-react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderDossier, Ui2Bouton } from "./Header";
import { StatusChip } from "./StatusChip";
import { SandboxSlider } from "./SandboxSlider";
import { traduire, langue } from "../lib/i18n";

/**
 * UI v2 — étape 8 : écran 10 « Paramétrage — bac à sable ». Changer un seuil sans savoir ce
 * qu'il produit est le vrai risque opérationnel : l'effet est SIMULÉ sur l'historique réel
 * avant toute mise en production. Le gain n'a de sens qu'avec son coût — les alertes fondées
 * qui n'auraient pas été levées sont listées NOMINATIVEMENT, avec leur issue réelle. Olivia
 * propose un réglage mais rien ne s'applique sans validation humaine (R44) ; l'application
 * crée une version datée et signée, la précédente reste rejouable (R29/R48).
 */

// Modèle de la simulation maquette (calé sur ses chiffres : ×2,0 → 1 244 ; ×2,5 → 812/419/13).
function simuler(seuilX10: number) {
  const s = seuilX10 / 10;
  const generees = Math.max(120, Math.round(s >= 2 ? 1244 - 864 * (s - 2) : 1244 + 600 * (2 - s)));
  const evitees = Math.max(0, 1244 - generees);
  const perdues = Math.round(evitees * 0.03);
  return { generees, evitees, fauxPositifs: evitees - perdues, perdues,
    heures: Math.round((evitees - perdues) * 0.62) };
}

export function ParamSandbox({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  const [seuil, setSeuil] = useState(25);                  // ×2,5 — la proposition d'Olivia
  const [fenetre, setFenetre] = useState(30);
  const [pops, setPops] = useState({ eleve: true, multi: true, faible: false });
  const [soumis, setSoumis] = useState(false);
  const sim = simuler(seuil);
  const fmt = (n: number) => n.toLocaleString("fr-CH");

  const tuile = (label: string, valeur: string, note1: string, note2: string, mode: "ok" | "alert") => (
    <div style={{ flex: 1, background: "var(--bg-surface)", borderRadius: "var(--r-card)",
      border: `1px solid var(--${mode === "alert" ? "alert-line" : "border"})`,
      borderLeft: `3px solid var(--${mode}-line)`, boxShadow: "var(--shadow-card)", padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1,
        color: mode === "alert" ? "var(--alert-text)" : "var(--text)" }}>{valeur}
        <span style={{ fontSize: 12, fontWeight: 500, color: `var(--${mode}-text)`, marginLeft: 6 }}>{note1}</span></div>
      <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 3 }}>{note2}</div>
    </div>);

  return (
    <Ui2Shell nav={<Ui2Nav active={active} user="Sofia Berger" role="Compliance Officer"
      onNavigate={onNavigate} t={t}
      badges={{ journee: { n: 12 }, dossiers: { n: 48, sobre: true }, clients: { n: 214, sobre: true },
        surveillance: { n: 5, alert: true } }} />}
      sideGauche={<div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t("Paramètres")}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", margin: "3px 0 14px", lineHeight: 1.5 }}>
          {t("Les modifications ne touchent que la simulation tant qu'elles ne sont pas appliquées.")}</div>
        <SandboxSlider label={t("Seuil d'écart déclenchant")} affichage={`× ${(seuil / 10).toFixed(1).replace(".", ",")}`}
          min={15} max={50} value={seuil} onChange={setSeuil} ia
          production={{ valeur: 20, label: t("production : × 2,0") }} minLabel="× 1,5" maxLabel="× 5,0" />
        <SandboxSlider label={t("Fenêtre d'observation")} affichage={`${fenetre} j`}
          min={7} max={90} value={fenetre} onChange={setFenetre} minLabel="7 j" maxLabel="90 j" />
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", margin: "4px 0 7px" }}>
          {t("Populations concernées")}</div>
        {([["eleve", t("Risque élevé et critique")], ["multi", t("Structures multi-niveaux")],
          ["faible", t("Risque faible et modéré")]] as const).map(([cle, label]) => (
          <button key={cle} role="checkbox" aria-checked={pops[cle]}
            onClick={() => setPops((p) => ({ ...p, [cle]: !p[cle] }))}
            style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
              padding: "9px 11px", marginBottom: 6, cursor: "pointer", fontFamily: "inherit",
              borderRadius: 9, fontSize: 12, color: "var(--text-body)",
              border: pops[cle] ? "1px solid var(--brand)" : "1px solid var(--border-input)",
              background: pops[cle] ? "var(--brand-surface)" : "var(--bg-surface)" }}>
            <span aria-hidden style={{ width: 15, height: 15, borderRadius: 4, flexShrink: 0,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              border: pops[cle] ? "none" : "1.5px solid var(--border-input)",
              background: pops[cle] ? "var(--brand)" : "var(--bg-surface)" }}>
              {pops[cle] && <Check size={11} strokeWidth={3} color="#fff" />}</span>
            {label}</button>))}
        <div style={{ background: "var(--ai-card)", border: "1px solid var(--ai-card-border)",
          borderRadius: 11, padding: "10px 12px", marginTop: 12 }}>
          <span className="mono" style={{ fontSize: 9.5, fontWeight: 600, background: "var(--ai-chip)",
            borderRadius: 5, padding: "2px 6px", color: "var(--ai-text)" }}>IA</span>
          <div style={{ fontSize: 11.5, color: "var(--ai-text)", marginTop: 6, lineHeight: 1.55 }}>
            {t("Proposition d'Olivia : ce réglage vient de l'analyse des 1 244 alertes historiques. Il n'a pas été appliqué et ne le sera pas sans validation humaine.")}</div>
        </div>
      </div>} sideGaucheWidth={320}
      header={<Ui2HeaderDossier nom={t("AML-R17 — écart au profil de flux")} initiales="R17"
        identifiants={t("Version en production : v11 · dernière modification 12.09.2024 · 1 244 alertes générées depuis")}
        puces={<StatusChip mode="ai">{t("SIMULATION")}</StatusChip>}
        actions={<Ui2Bouton>{t("Historique des versions")}</Ui2Bouton>} t={t} />}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{t("Effet simulé sur l'historique")}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("rejoué sur 24 mois de transactions réelles")}</span>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        {tuile(t("Alertes générées"), fmt(sim.generees), sim.evitees > 0 ? `−${fmt(sim.evitees)}` : "",
          `${t("contre")} 1 244 ${t("en production")}`, "ok")}
        {tuile(t("Faux positifs évités"), fmt(sim.fauxPositifs), "",
          `≈ ${fmt(sim.heures)} h ${t("de contrôle")}`, "ok")}
        {tuile(t("Alertes fondées perdues"), fmt(sim.perdues), "",
          t("dont 2 communications MROS"), "alert")}
      </div>
      {sim.perdues === 0 ? (
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 14 }}>
          {t("Aucune alerte fondée perdue à ce réglage — le coût de la simulation est nul.")}</div>
      ) : (
      <section style={{ background: "var(--alert-card)", border: "1px solid var(--alert-line)",
        borderRadius: "var(--r-card)", padding: "13px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--alert-text)", marginBottom: 5 }}>
          {`${t("Les")} ${sim.perdues} ${t("alertes qui n'auraient pas été levées")}`}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-body)", lineHeight: 1.55, marginBottom: 9 }}>
          {t("Le gain n'a de sens qu'avec son coût. Ces cas sont listés nominativement, avec leur issue réelle, pour que la décision se prenne en connaissance de cause.")}</div>
        {[{ nom: "Cèdre Maritime SARL", note: t("alerte de mars 2025"), chip: t("MROS COMMUNIQUÉ"), mode: "alert" as const },
          { nom: "Atlas Commodities Ltd", note: t("alerte de juin 2025"), chip: t("MROS COMMUNIQUÉ"), mode: "alert" as const },
          { nom: `${Math.max(0, sim.perdues - 2)} ${t("autres")}`, note: t("toutes classées sans suite"),
            chip: t("SANS SUITE"), mode: "neutral" as const }].slice(0, sim.perdues >= 2 ? 3 : 1).map((l) => (
          <div key={l.nom} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px",
            marginBottom: 6, borderRadius: 9, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{l.nom}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· {l.note}</span>
            <span style={{ marginLeft: "auto" }}><StatusChip mode={l.mode}>{l.chip}</StatusChip></span>
          </div>))}
      </section>)}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5, maxWidth: 420 }}>
          {t("L'application crée une nouvelle version datée et signée. La version précédente reste rejouable pour l'audit.")}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {soumis ? (
            <span role="status" style={{ fontSize: 11.5, color: "var(--ok-text)" }}>
              ✓ {t("Soumis au comité — v12 proposée, datée et signée ; v11 reste en production et rejouable.")}</span>
          ) : (<>
            <Ui2Bouton>{t("Enregistrer")}</Ui2Bouton>
            <Ui2Bouton primaire onClick={() => setSoumis(true)}>{t("Soumettre au comité")}</Ui2Bouton>
          </>)}
        </span>
      </div>
    </Ui2Shell>);
}
