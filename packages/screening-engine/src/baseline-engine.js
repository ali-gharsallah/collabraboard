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

/**
 * R268 — les CONSTANTES du score, jusqu'ici en dur, deviennent des paramètres. Les VALEURS par
 * défaut sont EXACTEMENT les littéraux de l'origine : sans `config`, le score est identique au bit
 * près (prouvé par config-equivalence.test.mjs, 127/127). Phase 2 : un appelant (ou un scénario
 * versionné) pourra durcir/assouplir un discriminant sans toucher au code — le moteur ne décide
 * toujours pas (R44), il applique le réglage qu'on lui passe.
 */
const DEFAUTS_MOTEUR = Object.freeze({
  echelle: 100,                    // amplitude du score (nameScore = sim × échelle ; borne du plafond)
  penaliteTypeIncompatible: 40,    // PP interrogée vs entité listée (et l'inverse)
  bonusDobExact: 6,                // date de naissance identique au jour
  bonusDobMemeAnnee: 2,            // même année, jour différent
  ecartAnneesProche: 2,            // seuil (années) sous lequel un écart de DOB est « proche »
  penaliteDobProche: 12,           // écart d'années ≤ seuil : doute, on pénalise
  penaliteDobIncompatible: 45,     // écart d'années > seuil : incompatible (écarte l'homonyme)
  // R271 — MÉTHODE phonétique, OFF par défaut (defaut = mono-méthode Jaro-Winkler, comportement d'origine).
  // Activée, deux jetons dont la CLÉ phonétique est identique reçoivent au moins `phonetiquePoids`,
  // ce qui rattrape des sonorités que Jaro rate (Knight/Nite, Phaisal/Faisal). Pluggable : d'autres
  // méthodes (double-metaphone, n-grammes) s'ajouteront sous le même schéma de config.
  phonetique: false,
  phonetiquePoids: 0.9,            // similarité créditée quand les clés phonétiques coïncident
  // R272 — discriminant NATIONALITÉ, OFF par défaut. Une nationalité commune entre le client et
  // l'entrée conforte la correspondance (bonus). Discriminant POSITIF seulement : l'absence de
  // recoupement ne pénalise pas (les données de nationalité sont souvent partielles).
  nationalite: false,
  nationaliteBonus: 8,
});

/**
 * R271 — CLÉ phonétique (style metaphone simplifié, déterministe). Réduit un jeton à son squelette
 * sonore : lettres muettes de tête (KN/GN/PN/WR/PS), PH→F, GH muet, CK→K, SCH→SK, Q→K, X→KS, Z/V→S/F,
 * H muet hors tête, voyelles muettes hors tête, doublons écrasés. Deux graphies d'un même son → même clé.
 * Portée assumée (latin) : c'est une PREMIÈRE méthode phonétique ; double-metaphone reste un ajout futur.
 */
function clePhonetique(s) {
  let t = String(s || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!t) return "";
  t = t.replace(/^(KN|GN|PN|WR|PS)/, (m) => m[1]);        // 1re lettre muette → on garde la 2e
  t = t.replace(/PH/g, "F").replace(/SCH/g, "SK").replace(/CK/g, "K")
       .replace(/GH/g, "").replace(/Q/g, "K").replace(/X/g, "KS").replace(/Z/g, "S").replace(/V/g, "F");
  const first = t[0];
  let rest = t.slice(1).replace(/H/g, "").replace(/[AEIOUY]/g, "");   // H et voyelles muets hors tête
  return (first + rest).replace(/(.)\1+/g, "$1");        // doublons consécutifs → simple
}

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

/**
 * Similarité entre deux jetons : Jaro-Winkler, éventuellement relevée par la méthode phonétique
 * (R271). Sans config phonétique active → jaroWinkler pur (comportement d'origine).
 */
function simJeton(a, b, cfg) {
  const jw = jaroWinkler(a, b);
  if (!cfg || !cfg.phonetique) return jw;
  const ka = clePhonetique(a);
  return (ka && ka === clePhonetique(b)) ? Math.max(jw, cfg.phonetiquePoids) : jw;
}

/** Similarité pondérée : chaque jeton de la requête cherche son meilleur jeton dans le candidat. */
function simPonderee(qTok, cTok, cfg) {
  if (!qTok.length || !cTok.length) return 0;
  let num = 0, den = 0;
  for (const q of qTok) {
    let best = 0;
    for (const c of cTok) best = Math.max(best, simJeton(q, c, cfg));
    const w = poids(q);
    num += best * w; den += w;
  }
  let num2 = 0, den2 = 0;
  for (const c of cTok) {
    let best = 0;
    for (const q of qTok) best = Math.max(best, simJeton(c, q, cfg));
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
function scorerDetail(requete, entree, config) {
  const c = config ? { ...DEFAUTS_MOTEUR, ...config } : DEFAUTS_MOTEUR;   // défauts = comportement d'origine
  const qTok = normaliser(requete.nom).split(" ").filter(Boolean);
  const candidats = [entree.nom_complet, ...(entree.alias || []).map(aliasNom)];
  let best = 0, via = entree.nom_complet;
  for (const cand of candidats) {
    const cTok = normaliser(cand).split(" ").filter(Boolean);
    const s = simPonderee(qTok, cTok, c);
    if (s > best) { best = s; via = cand; }
  }
  const nameScore = best * c.echelle;
  let score = nameScore;

  // Discriminant de TYPE — dans les DEUX sens.
  let typePenalty = 0;
  if (requete.dob && entree.type === "entite") typePenalty -= c.penaliteTypeIncompatible;
  if (requete.est_entite && entree.type === "individu") typePenalty -= c.penaliteTypeIncompatible;
  score += typePenalty;

  // Discriminant date de naissance : c'est lui qui écarte les homonymes.
  let dobContribution = 0;
  if (requete.dob && entree.date_naissance) {
    if (requete.dob === entree.date_naissance) { dobContribution = c.bonusDobExact; score = Math.min(c.echelle, score + c.bonusDobExact); }
    else {
      const anQ = +requete.dob.slice(0, 4), anE = +entree.date_naissance.slice(0, 4);
      const ecart = Math.abs(anQ - anE);
      if (ecart === 0) { dobContribution = c.bonusDobMemeAnnee; score += c.bonusDobMemeAnnee; }
      else if (ecart <= c.ecartAnneesProche) { dobContribution = -c.penaliteDobProche; score -= c.penaliteDobProche; }
      else { dobContribution = -c.penaliteDobIncompatible; score -= c.penaliteDobIncompatible; }
    }
  }
  // Discriminant NATIONALITÉ (R272) — positif seulement, actif sur demande (config).
  let natContribution = 0;
  if (c.nationalite && Array.isArray(requete.nationalites) && Array.isArray(entree.nationalites)) {
    if (requete.nationalites.some((n) => entree.nationalites.includes(n))) {
      natContribution = c.nationaliteBonus; score = Math.min(c.echelle, score + c.nationaliteBonus);
    }
  }
  score = Math.max(0, Math.min(c.echelle, score));
  return { score, via, nameScore, typePenalty, dobContribution, natContribution };
}

/** Score d'une requête contre une entrée — sans `config`, IDENTIQUE à l'origine (délègue à scorerDetail). */
function scorer(requete, entree, config) { return scorerDetail(requete, entree, config).score; }

/** Meilleur candidat au-dessus du seuil, ou null. `config` optionnel (R268). */
function rapprocher(requete, entries, seuil, config) {
  let best = null, bestScore = 0;
  for (const e of entries) {
    const s = scorer(requete, e, config);
    if (s > bestScore) { bestScore = s; best = e; }
  }
  return bestScore >= seuil ? { uid: best.uid, score: Math.round(bestScore), entree: best } : null;
}

/** Comme rapprocher, mais renvoie aussi la décomposition du meilleur candidat (R266). `config` optionnel (R268). */
function rapprocherDetail(requete, entries, seuil, config) {
  let best = null, bestDetail = null;
  for (const e of entries) {
    const d = scorerDetail(requete, e, config);
    if (!bestDetail || d.score > bestDetail.score) { bestDetail = d; best = e; }
  }
  if (!best || bestDetail.score < seuil) return null;
  return { uid: best.uid, score: Math.round(bestDetail.score), entree: best, detail: bestDetail };
}

module.exports = {
  PARTICULES, SUFFIXES, DEFAUTS_MOTEUR, normaliser, jetonsTries, jaroWinkler, clePhonetique,
  construireIdf, scorer, scorerDetail, rapprocher, rapprocherDetail,
};
