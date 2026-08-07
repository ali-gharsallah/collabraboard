"use strict";
/**
 * R410 — TRANSLITTÉRATION cyrillique + arabe → latin, EN AMONT du pipeline (P-L6-2).
 * Sans elle, `normaliser` détruisait tout nom non-latin (strip [^a-z0-9] → chaîne vide) : une entrée
 * de liste en écriture d'origine était INVISIBLE au moteur. Tables DÉTERMINISTES (pas d'ICU hors
 * ligne) alignées sur les romanisations usuelles des listes (BGN/PCGN pour le cyrillique ; squelette
 * consonantique pour l'arabe — l'abjad ne note pas les voyelles brèves : c'est la couche PHONÉTIQUE
 * (R416, clés sans voyelles) qui rapproche « mhmd » de « muhammad », pas une invention de voyelles).
 * Variantes de romanisation assumées (table, pas exhaustive) : х→kh, ж→zh, ш→sh, щ→shch, я→ya, ю→yu,
 * ц→ts · خ→kh, ش→sh, غ→gh, ث→th, ذ→dh, ق→q, ء/ع→(muet), ة→a, ال→al. Le chemin LATIN est intact
 * bit à bit : la translittération ne s'applique QUE si la chaîne contient du cyrillique/arabe.
 */

const CYRILLIQUE = {
  "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh", "з": "z",
  "и": "i", "й": "i", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r",
  "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
  "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
  "і": "i", "ї": "yi", "є": "ye", "ґ": "g",                       // ukrainien
};

const ARABE = {
  "ا": "a", "أ": "a", "إ": "i", "آ": "a", "ء": "", "ؤ": "u", "ئ": "i",
  "ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "h", "خ": "kh",
  "د": "d", "ذ": "dh", "ر": "r", "ز": "z", "س": "s", "ش": "sh",
  "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "", "غ": "gh",
  "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n",
  "ه": "h", "ة": "a", "و": "w", "ي": "y", "ى": "a",
};

const A_CYRILLIQUE = /[Ѐ-ӿ]/;
const A_ARABE = /[؀-ۿ]/;
const TASHKEEL = /[ً-ْٰ]/g;                        // diacritiques arabes (voyelles brèves…)

function estNonLatin(s) { return A_CYRILLIQUE.test(s) || A_ARABE.test(s); }

/** Translittère cyrillique + arabe vers le latin ; les caractères latins passent inchangés. */
function translitterer(s) {
  let t = String(s ?? "").replace(TASHKEEL, "");
  t = t.replace(/لا/g, "la");                           // ligature لا
  let out = "";
  for (const ch of t) {
    const bas = ch.toLowerCase();
    if (CYRILLIQUE[bas] !== undefined) {
      const lat = CYRILLIQUE[bas];
      out += (ch !== bas && lat) ? lat[0].toUpperCase() + lat.slice(1) : lat;   // majuscule préservée
    } else if (ARABE[ch] !== undefined) {
      out += ARABE[ch];
    } else {
      out += ch;
    }
  }
  return out;
}

module.exports = { translitterer, estNonLatin };
