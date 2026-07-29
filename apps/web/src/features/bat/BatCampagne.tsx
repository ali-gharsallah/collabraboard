import React from "react";
import { tokens } from "../../theme/tokens";
import { traduire, langue } from "../../lib/i18n";

// ÉCRAN BAT LÉGER (R333/FB-06) — recette CLIENT. Lecture seule : il AFFICHE une campagne (cases
// du cahier généré filtré par licence, verdicts, écarts classés, visa) et le VERDICT de
// promotion. La logique fait autorité côté moteur (tools/bat/bat.mjs) puis serveur ; l'écran ne
// re-décide rien — il rend l'état. Le cahier n'est JAMAIS rédigé à la main (il est généré).

type Ecart = { gravite: "BLOQUANT" | "MINEUR"; note?: string };
type Cas = { id: string; module: string; intitule: string; verdict?: "PASS" | "ECHEC"; ecart?: Ecart };
export type Campagne = {
  tenant: string; modulesLicence: string[]; cases: Cas[];
  visa?: { par: string; role: string; at: string };
  promotion: { promotable: boolean; raisons: string[] };   // fait autorité : calculé serveur/moteur
};

// Campagne de DÉMONSTRATION (un écart bloquant ⇒ non promotable) — l'écran est illustratif ;
// en usage réel la campagne vient de l'API. Aucune donnée n'est mutée depuis cet écran.
const DEMO: Campagne = {
  tenant: "Genève Wealth Bank", modulesLicence: ["KYC", "AML", "IA"],
  cases: [
    { id: "BAT-KYC-01", module: "KYC", intitule: "Ouvrir une relation KYC jusqu'à décision.", verdict: "PASS" },
    { id: "BAT-KYC-02", module: "KYC", intitule: "Rejeu KYC à date.", verdict: "PASS" },
    { id: "BAT-AML-01", module: "AML", intitule: "Alerte AML qualifiée par le rôle habilité.", verdict: "ECHEC",
      ecart: { gravite: "BLOQUANT", note: "qualification bloquée sur un scénario" } },
    { id: "BAT-IA-01", module: "IA", intitule: "Olivia propose, l'humain décide.", verdict: "PASS" },
  ],
  visa: { par: "A. Gharsallah", role: "CO_SR", at: "2026-07-29" },
  promotion: { promotable: false, raisons: ["écart bloquant : BAT-AML-01"] },
};

export function BatCampagne({ campagne = DEMO }: { campagne?: Campagne }) {
  const t = traduire(langue());
  const bloquants = campagne.cases.filter((c) => c.ecart?.gravite === "BLOQUANT");
  const mineurs = campagne.cases.filter((c) => c.ecart?.gravite === "MINEUR");
  const badge = (ok: boolean) => ({
    padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
    background: ok ? "#E7F0DD" : tokens.accentComplianceBg, color: ok ? tokens.olive700 : tokens.accentCompliance,
  });

  return <div style={{ font: tokens.font }}>
    <h2 style={{ color: tokens.ink, marginBottom: 4 }}>{t("Recette client (BAT)")}</h2>
    <div style={{ color: tokens.muted, fontSize: 13, marginBottom: 12 }}>
      {t("Cahier généré du catalogue, filtré par la licence — jamais rédigé à la main.")}
    </div>

    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
      <strong style={{ color: tokens.ink }}>{campagne.tenant}</strong>
      <span style={{ color: tokens.muted, fontSize: 12 }}>
        {t("Modules licenciés")} : {campagne.modulesLicence.join(", ")}
      </span>
      <span style={badge(campagne.promotion.promotable)}>
        {campagne.promotion.promotable ? t("Promotion prod : APTE") : t("Promotion prod : BLOQUÉE")}
      </span>
    </div>

    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead><tr style={{ textAlign: "left", color: tokens.muted }}>
        <th style={{ padding: 6 }}>{t("Case")}</th><th style={{ padding: 6 }}>{t("Module")}</th>
        <th style={{ padding: 6 }}>{t("Intitulé")}</th><th style={{ padding: 6 }}>{t("Verdict")}</th>
        <th style={{ padding: 6 }}>{t("Écart")}</th>
      </tr></thead>
      <tbody>{campagne.cases.map((c) => <tr key={c.id} style={{ borderTop: `1px solid ${tokens.border}` }}>
        <td style={{ padding: 6, fontFamily: "monospace" }}>{c.id}</td>
        <td style={{ padding: 6 }}>{c.module}</td>
        <td style={{ padding: 6 }}>{c.intitule}</td>
        <td style={{ padding: 6, fontWeight: 700, color: c.verdict === "PASS" ? tokens.ok : c.verdict === "ECHEC" ? tokens.danger : tokens.muted }}>
          {c.verdict ?? "—"}
        </td>
        <td style={{ padding: 6, color: c.ecart?.gravite === "BLOQUANT" ? tokens.accentCompliance : tokens.muted }}>
          {c.ecart ? `${c.ecart.gravite}${c.ecart.note ? ` — ${c.ecart.note}` : ""}` : "—"}
        </td>
      </tr>)}</tbody>
    </table>

    <div style={{ marginTop: 12, fontSize: 13, color: tokens.ink }}>
      {t("Écarts")} : <strong style={{ color: tokens.accentCompliance }}>{bloquants.length}</strong> {t("bloquant(s)")},
      {" "}<strong>{mineurs.length}</strong> {t("mineur(s)")}.
      {campagne.visa && <> · {t("Visa")} : {campagne.visa.par} ({campagne.visa.role}), {campagne.visa.at}</>}
    </div>
    {!campagne.promotion.promotable && campagne.promotion.raisons.length > 0 &&
      <ul style={{ marginTop: 8, color: tokens.accentCompliance, fontSize: 12 }}>
        {campagne.promotion.raisons.map((r, i) => <li key={i}>{r}</li>)}
      </ul>}
  </div>;
}
