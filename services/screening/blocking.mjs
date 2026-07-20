/**
 * Pré-filtre (blocking) — index inversé de trigrammes.
 *
 * Pourquoi : le score fin coûte ~14 ms par client contre 1 174 entrées. Contre un vrai feed
 * (≈2 M d'entrées), c'est des centaines d'heures — impraticable. Le pré-filtre réduit les
 * candidats de plusieurs ordres de grandeur AVANT le score fin.
 *
 * Le danger, et c'est le seul qui compte : un pré-filtre trop agressif écarte de VRAIS positifs
 * sans rien dire. On ne l'accepte donc que si le banc prouve que le rappel est PRÉSERVÉ.
 *
 * Choix : trigrammes plutôt que première lettre du nom.
 *   « Volkov » / « Wolkow » ne partagent pas leur initiale — un blocking par lettre les rate.
 *   Ils partagent « olk », « lko ». Les trigrammes survivent à la translittération.
 *
 * ⚠ LIMITE CONNUE DE LA MESURE ACTUELLE (à lire avant de se réjouir).
 *   Contre 1 174 entrées, le pré-filtre ne perd RIEN, même au réglage le plus agressif
 *   (minPartages = 5, ~10 candidats par requête). Cela en dit plus sur la taille de la liste
 *   que sur la qualité du pré-filtre : avec si peu d'entrées, les trigrammes rares désignent
 *   la cible presque à coup sûr.
 *   Le vrai test — celui qui peut le faire échouer — exige une liste de taille réelle
 *   (centaines de milliers d'entrées), où les trigrammes deviennent ambigus et où le plafond
 *   de candidats commence à trancher. Tant qu'il n'est pas fait, ce pré-filtre est « prometteur »,
 *   pas « validé ».
 */
import { normaliser } from "./baseline-engine.mjs";

const trigrammes = (s) => {
  const t = " " + normaliser(s).replace(/\s+/g, " ") + " ";
  const out = new Set();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
};

export function construireIndex(entries) {
  const index = new Map();               // trigramme → [positions]
  entries.forEach((e, i) => {
    const noms = [e.nom_complet, ...(e.alias || []).map((a) => (typeof a === "string" ? a : a.nom))];
    const vus = new Set();
    for (const n of noms) for (const g of trigrammes(n)) vus.add(g);
    for (const g of vus) {
      if (!index.has(g)) index.set(g, []);
      index.get(g).push(i);
    }
  });
  return { index, entries, n: entries.length };
}

/**
 * Candidats pour une requête.
 * @param maxTrigrammes  on n'interroge que les trigrammes les plus RARES de la requête :
 *                       « inv » (présent partout) ne sert à rien, « olk » discrimine.
 * @param minPartages    nombre minimal de trigrammes rares partagés pour être candidat.
 */
export function candidats(idx, nom, { maxTrigrammes = 12, minPartages = 2, plafond = 400 } = {}) {
  const gs = [...trigrammes(nom)]
    .map((g) => ({ g, df: (idx.index.get(g) || []).length }))
    .filter((x) => x.df > 0)
    .sort((a, b) => a.df - b.df)          // du plus rare au plus commun
    .slice(0, maxTrigrammes);

  const compte = new Map();
  for (const { g } of gs) for (const i of idx.index.get(g)) compte.set(i, (compte.get(i) || 0) + 1);

  const retenus = [];
  for (const [i, c] of compte) if (c >= minPartages) retenus.push({ i, c });
  retenus.sort((a, b) => b.c - a.c);
  return retenus.slice(0, plafond).map((x) => idx.entries[x.i]);
}
