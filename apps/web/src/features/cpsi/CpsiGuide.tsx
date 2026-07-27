import React from "react";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

// Écran « CPSI — Guide » (`cpsiguide`). PAS une page statique : le guide est ANCRÉ sur le réel —
// les règles de calcul en vigueur (GET /cpsi/rules, R68) et le catalogue de conformité (GET
// /cpsi/compliance-catalogue, R79 : source de vérité unique de l'explicabilité). S'y ajoutent le
// vocabulaire RATIFIÉ du pipeline (R80/R81) et les invariants de la porte (amendement R248-R252).
// Lecture seule intégrale.

type EntreeCatalogue = { id: string; label: string; domaine: string; champ_label: string; champ_formule: string; operateur: string; seuils: Record<string, number>; groupes: string[] };

const SEED_RULES = { asOf: null as string | null, regles: [
  "Score client = Statique + Comportemental, plafonné à 100.",
  "Half-life : 180 jours — un signal vieux d'une demi-vie pèse moitié (R64).",
  "Chaque score publie ses drivers ; leur somme reconstitue le score (R67)."] };
const SEED_CAT = { asOf: null as string | null, catalogue: [
  { id: "SC_DEMO", label: "Structuration (démo)", domaine: "Activité transactionnelle", champ_label: "Score de structuration",
    champ_formule: "Indice de fractionnement d'opérations sous le seuil de déclaration.", operateur: "≥", seuils: { PEP: 60 }, groupes: ["PEP"] }] as EntreeCatalogue[] };

const VOCABULAIRE: { terme: string; def: string }[] = [
  { terme: "Franchissement", def: "hit brut de détection d'un scénario — pas encore un signal." },
  { terme: "Signal scoré", def: "UN par (client, scénario), dédupliqué (R81) ; score = w_impact·impact + w_freq·fréquence (R80)." },
  { terme: "Alerte scorée", def: "signal dont le score ≥ seuil X paramétrable (R80)." },
  { terme: "Near-miss / analyse", def: "sous X : near-miss dans [X−marge, X), analyse en deçà — jamais des alertes." },
  { terme: "Corrélation", def: "un même client touché par ≥2 scénarios (R81) → émission d'un case_proposal (R252)." },
];

const INVARIANTS: string[] = [
  "La porte NE calcule RIEN : toute valeur provient du moteur ratifié, rejoué depuis le journal append-only (R248/R249).",
  "Rejeu à date natif : ?asOf= reconstruit l'état d'alors, config comprise (R48/R68).",
  "Default-deny : type de signal, opérateur ou paramètre inconnu ⇒ refus typé, rien n'est écrit.",
  "Tout changement de barème se SIMULE avant proposition (R70) ; l'IA propose, l'humain décide, rejet motivé (R69).",
  "Le CPSI PROPOSE (case_proposal) ; l'instruction des risk cases relève de riskcases R133-R136 (R252).",
  "La jauge de rejeu se mesure et se notifie — jamais de blocage (R250/R39).",
];

export function CpsiGuide() {
  const { data: rules, isDemo } = useApiOrSeed<typeof SEED_RULES>("/v1/cpsi/rules", SEED_RULES);
  const { data: cat } = useApiOrSeed<typeof SEED_CAT>("/v1/cpsi/compliance-catalogue", SEED_CAT);

  const carte = (titre: string, corps: React.ReactNode) =>
    <div style={{ padding: 12, marginTop: 10, borderRadius: tokens.radius.lg, background: tokens.color.surface, border: `1px solid ${tokens.color.border}` }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: tokens.color.olive700 }}>{titre}</div>{corps}
    </div>;

  return <div>
    {isDemo && <DemoModeBanner/>}
    <h3>CPSI — Guide (règles en vigueur, vocabulaire, explicabilité)</h3>
    <p style={{ fontSize: tokens.font.sm, color: tokens.color.muted }}>Ce guide n'est pas une page figée : les règles et le
      catalogue ci-dessous sont <strong>ceux du tenant, en vigueur maintenant</strong> (R68/R79) — la même source que le calcul.</p>

    {carte("Règles de calcul en vigueur (R68)",
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>{rules.regles.map((r, i) => <li key={i} style={{ padding: "1px 0" }}>{r}</li>)}</ul>)}

    {carte("Vocabulaire ratifié du pipeline (R80/R81)",
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><tbody>
        {VOCABULAIRE.map((v) => <tr key={v.terme} style={{ borderTop: `1px solid ${tokens.color.border}` }}>
          <td style={{ padding: "4px 8px 4px 0", fontWeight: 600, whiteSpace: "nowrap", verticalAlign: "top" }}>{v.terme}</td>
          <td style={{ padding: "4px 0", color: tokens.color.ink }}>{v.def}</td></tr>)}
      </tbody></table>)}

    {carte("Catalogue de conformité — comment chaque scénario surveille (R79, lecture seule)",
      cat.catalogue.length
        ? <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ textAlign: "left", color: tokens.color.muted }}><th style={{ padding: "2px 6px 2px 0" }}>Scénario</th><th>Domaine</th><th>Attribut surveillé (formule)</th><th>Seuils par groupe</th></tr></thead>
            <tbody>{cat.catalogue.map((c) => <tr key={c.id} style={{ borderTop: `1px solid ${tokens.color.border}`, verticalAlign: "top" }}>
              <td style={{ padding: "4px 6px 4px 0", fontWeight: 600 }}>{c.label}</td>
              <td style={{ padding: "4px 6px 4px 0" }}>{c.domaine}</td>
              <td style={{ padding: "4px 6px 4px 0" }}>{c.champ_label} — <span style={{ color: tokens.color.muted }}>{c.champ_formule}</span></td>
              <td style={{ padding: "4px 0", whiteSpace: "nowrap" }}>{Object.entries(c.seuils).map(([g, s]) => `${g} ${c.operateur} ${s}`).join(" · ")}</td>
            </tr>)}</tbody>
          </table>
        : <div style={{ fontSize: 12, color: tokens.color.muted }}>Aucun scénario défini — le catalogue se remplit dès qu'un scénario ciblé (R73) existe.</div>)}

    {carte("Invariants de la porte CPSI (amendement R248-R252)",
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>{INVARIANTS.map((s, i) => <li key={i} style={{ padding: "1px 0" }}>{s}</li>)}</ul>)}
  </div>;
}
