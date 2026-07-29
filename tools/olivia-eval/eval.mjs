// Évaluateur A.1/A.5 — calcule les métriques déterministes sur le corpus de fixtures.
// AUCUN appel modèle (R167). Deux familles de mesures :
//   • Golden (A.1) : justesse de détection de langue + taux de FAUX POSITIF des filtres sur du
//     trafic légitime (un filtre qui bloque une vraie question de conformité = dégradation).
//   • Attaques (A.5) : taux de RÉSISTANCE = fraction des attaques effectivement neutralisées par
//     le filtre déterministe visé. < 100 % = angles morts du lexique, publiés honnêtement.
import { detecterLangue, estHorsPerimetre, detecterInjection, detecterRecoProse } from "./detecteurs.mjs";
import { goldenSet, attaques } from "./corpus.mjs";

export function mesurer() {
  // ── Golden : par capacité, justesse de langue et faux positifs de filtre ──
  const parCapacite = {};
  for (const cas of goldenSet) {
    const c = (parCapacite[cas.capacite] ??= { total: 0, langueOk: 0, fauxPositifs: 0 });
    c.total++;
    if (detecterLangue(cas.texte) === cas.langue) c.langueOk++;
    // Sur du trafic légitime, AUCUN filtre défensif ne doit se déclencher.
    if (estHorsPerimetre(cas.texte) || detecterInjection(cas.texte) !== null) c.fauxPositifs++;
  }
  const goldenTotal = goldenSet.length;
  const langueOk = Object.values(parCapacite).reduce((n, c) => n + c.langueOk, 0);
  const fauxPositifs = Object.values(parCapacite).reduce((n, c) => n + c.fauxPositifs, 0);
  const langueAccuracy = Math.round((langueOk / goldenTotal) * 1000) / 10;   // %

  // ── Attaques : résistance par cible et globale ──
  const neutralise = (a) =>
    a.cible === "injection" ? detecterInjection(a.texte) !== null
    : a.cible === "horsPerimetre" ? estHorsPerimetre(a.texte)
    : a.cible === "recoProse" ? detecterRecoProse(a.texte)
    : false;
  const parCible = {};
  let resistees = 0;
  for (const a of attaques) {
    const p = (parCible[a.cible] ??= { total: 0, neutralisees: 0 });
    p.total++;
    if (neutralise(a)) { p.neutralisees++; resistees++; }
  }
  const resistance = Math.round((resistees / attaques.length) * 1000) / 10;   // %

  return {
    golden: { total: goldenTotal, parCapacite, langueAccuracy, fauxPositifs },
    attaques: { total: attaques.length, parCible, resistees, resistance },
  };
}

// CLI : imprime un rapport lisible (le workflow le porte ; SECURITE.md publie le taux).
if (import.meta.url === `file://${process.argv[1]}`) {
  const m = mesurer();
  console.log("## Olivia — évaluation déterministe (A.1 golden set · A.5 suite d'attaque)\n");
  console.log(`Golden set : ${m.golden.total} cas · justesse de langue ${m.golden.langueAccuracy}% · faux positifs de filtre ${m.golden.fauxPositifs}`);
  for (const [cap, c] of Object.entries(m.golden.parCapacite))
    console.log(`  ${cap} : ${c.total} cas · langue ${c.langueOk}/${c.total} · faux positifs ${c.fauxPositifs}`);
  console.log(`\nSuite d'attaque : ${m.attaques.total} cas · RÉSISTANCE ${m.attaques.resistance}% (${m.attaques.resistees}/${m.attaques.total} neutralisées)`);
  for (const [cible, p] of Object.entries(m.attaques.parCible))
    console.log(`  ${cible} : ${p.neutralisees}/${p.total} neutralisées`);
  console.log("\n(Résistance < 100 % = angles morts du lexique, publiés — le plancher anti-dégradation ne peut que monter.)");
}
