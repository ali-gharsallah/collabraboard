/**
 * Moteur de rapprochement — LIGNE DE BASE, volontairement simple.
 * Son rôle n'est pas d'être bon : c'est de donner un point de comparaison chiffré.
 * Tout moteur ultérieur (pg_trgm, phonétique, commercial) se juge contre ces chiffres.
 */
const PARTICULES = /\b(al|el|bin|ibn|van|der|de|la|du|von|ben)\b/g;
const SUFFIXES = /\b(sa|ag|ltd|llc|gmbh|inc|plc|sarl|holding|holdings)\b/g;

export function normaliser(s) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // diacritiques
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")                        // ponctuation, tirets
    .replace(SUFFIXES, " ")                              // formes juridiques
    .replace(/\s+/g, " ").trim();
}
/** Tri des jetons : « Volkov Dmitri » et « Dmitri Volkov » deviennent identiques. */
export function jetonsTries(s) { return normaliser(s).split(" ").filter(Boolean).sort().join(" "); }

/** Jaro-Winkler — classique du rapprochement de noms. */
export function jaroWinkler(a, b) {
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

/**
 * Pondération IDF : un jeton présent partout ne discrimine rien.
 * « Invest », « Trading », « Partners » apparaissent dans des centaines d'entrées : les compter comme
 * un nom de famille produit « Keller Invest » → « Petrov Invest » à 88. C'est le défaut le plus
 * classique du rapprochement de noms — et le banc l'a rendu visible en une ligne.
 */
let _idf = null;
export function construireIdf(entries) {
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
  // symétrie : un jeton du candidat non couvert par la requête pénalise aussi
  let num2 = 0, den2 = 0;
  for (const c of cTok) {
    let best = 0;
    for (const q of qTok) best = Math.max(best, jaroWinkler(c, q));
    const w = poids(c);
    num2 += best * w; den2 += w;
  }
  return ((num / (den || 1)) + (num2 / (den2 || 1))) / 2;
}

/** Score 0-100 d'une requête contre une entrée (nom principal + alias). */
export function scorer(requete, entree) {
  const qTok = normaliser(requete.nom).split(" ").filter(Boolean);
  const candidats = [entree.nom_complet, ...(entree.alias || []).map((a) => (typeof a === "string" ? a : a.nom))];
  let best = 0;
  for (const c of candidats) {
    const cTok = normaliser(c).split(" ").filter(Boolean);
    best = Math.max(best, simPonderee(qTok, cTok));
  }
  let score = best * 100;

  // Discriminant de TYPE — dans les DEUX sens.
  // Une requête avec date de naissance vise une personne ; une requête sans date, pour un client
  // qui est une société, ne doit pas se rapprocher d'une personne physique.
  if (requete.dob && entree.type === "entite") score -= 40;
  if (requete.est_entite && entree.type === "individu") score -= 40;

  // Discriminant date de naissance : c'est lui qui écarte les homonymes.
  if (requete.dob && entree.date_naissance) {
    if (requete.dob === entree.date_naissance) score = Math.min(100, score + 6);
    else {
      const anQ = +requete.dob.slice(0, 4), anE = +entree.date_naissance.slice(0, 4);
      const ecart = Math.abs(anQ - anE);
      if (ecart === 0) score += 2;              // même année, jour différent : tolérance
      else if (ecart <= 2) score -= 12;         // proche : doute
      else score -= 45;                          // incompatible : ce n'est pas la même personne
    }
  }
  return Math.max(0, Math.min(100, score));
}

/** Meilleur candidat au-dessus du seuil, ou null. */
export function rapprocher(requete, entries, seuil) {
  let best = null, bestScore = 0;
  for (const e of entries) {
    const s = scorer(requete, e);
    if (s > bestScore) { bestScore = s; best = e; }
  }
  return bestScore >= seuil ? { uid: best.uid, score: Math.round(bestScore), entree: best } : null;
}
