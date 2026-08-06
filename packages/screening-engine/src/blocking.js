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

/**
 * PERF (sous R409) — l'index trigramme est DÉTERMINISTE à partir des entrées (données de LISTE
 * partagées, jamais tenant). Le rescreening répété d'un portefeuille contre la MÊME version de liste
 * reconstruisait l'index à chaque run — coûteux à l'échelle réelle (100k+ entrées). On mémoïse par
 * `cle` (ex. `SECO@2026-07-15`), avec une empreinte légère qui invalide si la liste a changé.
 */
const _idxCache = new Map();
const _empreinte = (entries) => {
  const n = entries.length;
  return n + "|" + ((entries[0] && entries[0].uid) || "") + "|" + ((entries[n - 1] && entries[n - 1].uid) || "");
};
function construireIndexCache(cle, entries) {
  const emp = _empreinte(entries);
  const hit = _idxCache.get(cle);
  if (hit && hit.emp === emp) return hit.idx;       // même liste@version, entrées inchangées → réutilise
  const idx = construireIndex(entries);
  _idxCache.set(cle, { emp, idx });
  if (_idxCache.size > 16) _idxCache.delete(_idxCache.keys().next().value);   // éviction FIFO simple
  return idx;
}
function viderIndexCache() { _idxCache.clear(); }

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

module.exports = { construireIndex, construireIndexCache, viderIndexCache, candidats, DEFAUTS_BLOCKING };
