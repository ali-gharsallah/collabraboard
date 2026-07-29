// ═══ R258 — le comportement d'Olivia est un CONTRAT : détecteurs DÉTERMINISTES sur les
// lexiques LIVRÉS (olivia-gabarits.default.json, versionnés R68). SOURCE UNIQUE : ce module
// est importé par olivia.module.ts (service) ET par le harnais d'évaluation (golden set A.1 +
// suite d'attaque A.5). Aucune copie de logique — un seul endroit où le contrat vit, donc un
// seul endroit à corriger si le lexique laisse passer une variante (le golden set le révèle).
import * as GABARITS_LIVRES from "./olivia-gabarits.default.json";

const G: any = GABARITS_LIVRES;

// Détection de langue déterministe (compteur de mots-outils par langue ; FR par défaut).
export function detecterLangue(texte: string): string {
  const t = ` ${texte.toLowerCase()} `;
  const marque = (mots: string[]) => mots.reduce((n, m) => n + (t.includes(` ${m} `) ? 1 : 0), 0);
  const scores: [string, number][] = [
    ["DE", marque(["der", "die", "das", "und", "ist", "nicht", "welche", "bitte", "für", "wie"])],
    ["EN", marque(["the", "is", "what", "which", "please", "and", "not", "for", "does"])],
    ["IT", marque(["che", "di", "il", "per", "sono", "quale", "non", "come", "della"])],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0][1] > 0 ? scores[0][0] : "FR";
}

// Hors périmètre : la question sort du domaine bancaire/réglementaire (lexique livré).
export const estHorsPerimetre = (texte: string): boolean =>
  (G.horsPerimetre as string[]).some((m) => texte.toLowerCase().includes(m));

// Injection de prompt : marqueur d'instruction-override dans le CONTEXTE injecté (lexique livré).
export const detecterInjection = (contenu: string): string | null =>
  (G.injectionMarqueurs as string[]).find((m) => contenu.toLowerCase().includes(m)) ?? null;

// Recommandation en prose (interdite R258/A.2) : tournure prescriptive dans la SORTIE modèle.
export const detecterRecoProse = (texte: string): boolean =>
  (G.recoProse.prescriptifs as string[]).some((m) => texte.toLowerCase().includes(m));
