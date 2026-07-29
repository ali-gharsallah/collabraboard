// Détecteurs déterministes d'Olivia — versant HARNAIS D'ÉVALUATION (A.1 golden set + A.5
// suite d'attaque). Node natif, ZÉRO appel modèle (R167 : la mesure tourne sur gabarits +
// logique déterministe, jamais un appel fournisseur en CI).
//
// SOURCE DE VÉRITÉ DU CONTRAT = le lexique LIVRÉ olivia-gabarits.default.json (R68), lu ICI
// tel quel — le même fichier que le service importe via olivia-detecteurs.ts. Les quatre
// filtres ci-dessous sont l'exacte transcription des quatre filtres du service (substring sur
// le lexique). Le test de PARITÉ (test.mjs, AI-EV-PARITÉ) échoue si les deux implémentations
// divergent sur le vecteur partagé — l'unicité du contrat est donc vérifiée, pas seulement
// affirmée.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
export const GABARITS = JSON.parse(
  readFileSync(join(ici, "..", "..", "apps", "api", "src", "modules", "olivia", "olivia-gabarits.default.json"), "utf8"),
);

export function detecterLangue(texte) {
  const t = ` ${texte.toLowerCase()} `;
  const marque = (mots) => mots.reduce((n, m) => n + (t.includes(` ${m} `) ? 1 : 0), 0);
  const scores = [
    ["DE", marque(["der", "die", "das", "und", "ist", "nicht", "welche", "bitte", "für", "wie"])],
    ["EN", marque(["the", "is", "what", "which", "please", "and", "not", "for", "does"])],
    ["IT", marque(["che", "di", "il", "per", "sono", "quale", "non", "come", "della"])],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0][1] > 0 ? scores[0][0] : "FR";
}

export const estHorsPerimetre = (texte) =>
  GABARITS.horsPerimetre.some((m) => texte.toLowerCase().includes(m));

export const detecterInjection = (contenu) =>
  GABARITS.injectionMarqueurs.find((m) => contenu.toLowerCase().includes(m)) ?? null;

export const detecterRecoProse = (texte) =>
  GABARITS.recoProse.prescriptifs.some((m) => texte.toLowerCase().includes(m));
