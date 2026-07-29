import React, { useState } from "react";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

// `paramfields` (canon vague pilote partie 4, SD-05) : le registre R-Q rendu comme ANNUAIRE.
// Chaque paramètre tenant : libellé, valeur en vigueur, règle source. « Modifier » RENVOIE vers
// l'écran de paramétrage du module concerné — paramfields n'édite RIEN (un seul lieu d'édition
// par paramètre, jamais deux ; SD-05 prouvé : aucune requête non-GET).

type Entree = { cle: string; libelle?: string; valeur?: unknown; regle?: string; module?: string };
const SEED = { registre: [{ cle: "riskCaseSlaJours", libelle: "SLA des risk cases", valeur: { NOUVELLE: 2 }, regle: "R135", module: "riskcases" }] };
const EDITEURS: Record<string, string> = { cpsi: "CPSI · Barèmes", coc: "écran CoC (registre)", reviews: "écran Review",
  offboarding: "écran Offboarding", olivia: "écran Olivia", kyc: "sdkyc" };

export function ParamFields() {
  const { data } = useApiOrSeed<typeof SEED | Entree[]>("/v1/parametres/registre", SEED);
  const [filtre, setFiltre] = useState("");
  const entrees: Entree[] = Array.isArray(data) ? data : (data.registre ?? []);
  const visibles = entrees.filter((e) => !filtre.trim()
    || JSON.stringify(e).toLowerCase().includes(filtre.trim().toLowerCase()));

  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Registre des paramètres (paramfields) — un ANNUAIRE, pas un éditeur (SD-05)</h3>
    <p style={{ fontSize: 12, color: tokens.color.muted }}>Chaque paramètre a UN lieu d&apos;édition — son écran de module.
      Ici : recherche, valeur en vigueur, règle source. Aucune écriture ne part de cet écran.</p>
    <input placeholder="recherche (clé, module, règle)" value={filtre} onChange={(e) => setFiltre(e.target.value)}
      style={{ padding: 6, fontSize: 12, width: 300, border: `1px solid ${tokens.color.border}`, borderRadius: 6, marginBottom: 10 }}/>
    <table cellPadding={5} style={{ fontSize: 12 }}><thead><tr>
      <th align="left">Clé</th><th align="left">Libellé</th><th>Valeur en vigueur</th><th>Règle</th><th>Édition</th></tr></thead>
      <tbody>{visibles.map((e, i) => <tr key={i}>
        <td><code style={{ fontSize: 11 }}>{e.cle}</code></td>
        <td>{e.libelle ?? "—"}</td>
        <td align="center"><code style={{ fontSize: 11 }}>{JSON.stringify(e.valeur)}</code></td>
        <td align="center">{e.regle ?? "—"}</td>
        <td align="center" style={{ color: tokens.color.olive700, fontSize: 11 }}>
          → {EDITEURS[e.module ?? ""] ?? "écran du module"}</td>
      </tr>)}</tbody></table>
  </div>;
}
