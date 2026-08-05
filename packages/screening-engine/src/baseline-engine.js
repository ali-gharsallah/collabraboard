/**
 * Moteur de rapprochement — LIGNE DE BASE (extrait de services/screening/baseline-engine.mjs, R263).
 * ALGORITHMES INCHANGÉS : Jaro-Winkler + pondération IDF + discriminants type/DOB. Format CommonJS
 * pour être importable par apps/api (Nest/CJS) ET par les bancs ESM (import de nommés CJS).
 *
 * `scorer(requete, entree)` renvoie exactement le même nombre qu'avant. `scorerDetail(...)` expose
 * LA MÊME décomposition (nom/alias, contribution DOB, pénalité type) sans recalcul divergent — c'est
 * la matière de l'explicabilité (R266), pas un nouvel algorithme.
 */
"use strict";

const PARTICULES = /\b(al|el|bin|ibn|van|der|de|la|du|von|ben)\b/g;   // NB : déclarée, non appliquée (parité avec l'origine)
const SUFFIXES = /\b(sa|ag|ltd|llc|gmbh|inc|plc|sarl|holding|holdings)\b/g;

function normaliser(s) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // diacritiques
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")                        // ponctuation, tirets
    .replace(SUFFIXES, " ")                              // formes juridiques
    .replace(/\s+/g, " ").trim();
}
/** Tri des jetons : « Volkov Dmitri » et « Dmitri Volkov » deviennent identiques. */
function jetonsTries(s) { return normaliser(s).split(" ").filter(Boolean).sort().join(" "); }

/** Jaro-Winkler — classique du rapprochement de noms. */
function jaroWinkler(a, b) {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const d = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  const ma = new Array(a.length).fill(false), mb = new Array(b.length).fill(false);
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - d); j < Math.min(b.length, i + d + 1); j++) {
      if (mb[j] || a[i] !== b[j]) continue;
      ma[i] = mb[j] = true; m++; break;
    }
  }
  if (!m) return 0;
  let k = 0, t = 0;
  for (let i = 0; i < a.length; i++) {
    if (!ma[i]) continue;
    while (!mb[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  t /= 2;
  const jaro = (m / a.length + m / b.length + (m - t) / m) / 3;
  let p = 0;
  while (p < 4 && a[p] === b[p]) p++;
  return jaro + p * 0.1 * (1 - jaro);
}

let _idf = null;
function construireIdf(entries) {
  const df = new Map(); const n = entries.length;
  for (const e of entries) {
    const vus = new Set();
    for (const nom of [e.nom_complet, ...(e.alias || []).map((a) => (typeof a === "string" ? a : a.nom))]) {
      for (const t of normaliser(nom).split(" ").filter(Boolean)) vus.add(t);
    }
    for (const t of vus) df.set(t, (df.get(t) || 0) + 1);
  }
  _idf = { df, n };
  return _idf;
}
const poids = (t) => {
  if (!_idf) return 1;                                   // sans IDF construit : tous les jetons égaux
  const d = _idf.df.get(t) || 0.5;
  return Math.log(_idf.n / d) / Math.log(_idf.n);        // 0 (partout) → 1 (unique)
};

/** Similarité pondérée : chaque jeton de la requête cherche son meilleur jeton dans le candidat. */
function simPonderee(qTok, cTok) {
  if (!qTok.length || !cTok.length) return 0;
  let num = 0, den = 0;
  for (const q of qTok) {
    let best = 0;
    for (const c of cTok) best = Math.max(best, jaroWinkler(q, c));
    const w = poids(q);
    num += best * w; den += w;
  }
  let num2 = 0, den2 = 0;
  for (const c of cTok) {
    let best = 0;
    for (const q of qTok) best = Math.max(best, jaroWinkler(c, q));
    const w = poids(c);
    num2 += best * w; den2 += w;
  }
  return ((num / (den || 1)) + (num2 / (den2 || 1))) / 2;
}

const aliasNom = (a) => (typeof a === "string" ? a : a.nom);

/**
 * DÉCOMPOSITION du score 0-100 (R266) — reproduit EXACTEMENT la logique de l'origine, en exposant
 * les intermédiaires : meilleur nom/alias apparié, pénalité de type, contribution DOB.
 */
function scorerDetail(requete, entree) {
  const qTok = normaliser(requete.nom).split(" ").filter(Boolean);
  const candidats = [entree.nom_complet, ...(entree.alias || []).map(aliasNom)];
  let best = 0, via = entree.nom_complet;
  for (const c of candidats) {
    const cTok = normaliser(c).split(" ").filter(Boolean);
    const s = simPonderee(qTok, cTok);
    if (s > best) { best = s; via = c; }
  }
  const nameScore = best * 100;
  let score = nameScore;

  // Discriminant de TYPE — dans les DEUX sens.
  let typePenalty = 0;
  if (requete.dob && entree.type === "entite") typePenalty -= 40;
  if (requete.est_entite && entree.type === "individu") typePenalty -= 40;
  score += typePenalty;

  // Discriminant date de naissance : c'est lui qui écarte les homonymes.
  let dobContribution = 0;
  if (requete.dob && entree.date_naissance) {
    if (requete.dob === entree.date_naissance) { dobContribution = 6; score = Math.min(100, score + 6); }
    else {
      const anQ = +requete.dob.slice(0, 4), anE = +entree.date_naissance.slice(0, 4);
      const ecart = Math.abs(anQ - anE);
      if (ecart === 0) { dobContribution = 2; score += 2; }
      else if (ecart <= 2) { dobContribution = -12; score -= 12; }
      else { dobContribution = -45; score -= 45; }
    }
  }
  score = Math.max(0, Math.min(100, score));
  return { score, via, nameScore, typePenalty, dobContribution };
}

/** Score 0-100 d'une requête contre une entrée — IDENTIQUE à l'origine (délègue à scorerDetail). */
function scorer(requete, entree) { return scorerDetail(requete, entree).score; }

/** Meilleur candidat au-dessus du seuil, ou null. */
function rapprocher(requete, entries, seuil) {
  let best = null, bestScore = 0;
  for (const e of entries) {
    const s = scorer(requete, e);
    if (s > bestScore) { bestScore = s; best = e; }
  }
  return bestScore >= seuil ? { uid: best.uid, score: Math.round(bestScore), entree: best } : null;
}

/** Comme rapprocher, mais renvoie aussi la décomposition du meilleur candidat (R266). */
function rapprocherDetail(requete, entries, seuil) {
  let best = null, bestDetail = null;
  for (const e of entries) {
    const d = scorerDetail(requete, e);
    if (!bestDetail || d.score > bestDetail.score) { bestDetail = d; best = e; }
  }
  if (!best || bestDetail.score < seuil) return null;
  return { uid: best.uid, score: Math.round(bestDetail.score), entree: best, detail: bestDetail };
}

module.exports = {
  PARTICULES, SUFFIXES, normaliser, jetonsTries, jaroWinkler,
  construireIdf, scorer, scorerDetail, rapprocher, rapprocherDetail,
};
