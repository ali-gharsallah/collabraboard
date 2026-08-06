/**
 * Pré-filtre (blocking) — index inversé de trigrammes. Extrait de services/screening/blocking.mjs
 * (R408), algorithme INCHANGÉ. On n'interroge que les trigrammes les plus RARES de la requête,
 * puis on garde les entrées partageant ≥ minPartages de ces trigrammes (plafond de candidats).
 */
"use strict";
const { normaliser } = require("./baseline-engine");

/**
 * R413 — les cutoffs du pré-filtre, jusqu'ici en dur dans la signature, sont exposés comme défauts
 * NOMMÉS (fin des nombres magiques). Sans `opts`, `candidats` se comporte à l'identique.
 */
const DEFAUTS_BLOCKING = Object.freeze({ maxTrigrammes: 12, minPartages: 2, plafond: 400 });

const trigrammes = (s) => {
  const t = " " + normaliser(s).replace(/\s+/g, " ") + " ";
  const out = new Set();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
};

function construireIndex(entries) {
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

function candidats(idx, nom, opts = {}) {
  const { maxTrigrammes, minPartages, plafond } = { ...DEFAUTS_BLOCKING, ...opts };
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

module.exports = { construireIndex, candidats, DEFAUTS_BLOCKING };
