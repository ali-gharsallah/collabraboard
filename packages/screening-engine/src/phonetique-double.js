"use strict";
/**
 * R416 — DOUBLE METAPHONE (méthode phonétique « double »).
 *
 * Portage déterministe de l'algorithme Double Metaphone (L. Philips) : à un mot, il associe DEUX codes
 * sonores — un PRIMAIRE et un SECONDAIRE — le secondaire capturant une prononciation alternative
 * (translittérations slaves/germaniques/romanes : « Wladimir/Vladimir », « Katherine/Catherine »,
 * « Gonzalez/Gonzales »). Deux jetons « riment » si leurs ensembles de codes se croisent — recall
 * supérieur à la clé mono-méthode (metaphone simplifié) sur les noms translittérés des listes de
 * sanctions. Codes sur l'alphabet metaphone {A,P,S,K,J,T,F,H,L,M,N,R,W,X,0} (« 0 » = son « th »).
 *
 * Portée assumée : latin. Comme toute méthode phonétique du moteur, elle est OFF par défaut (R413) —
 * activée seulement via config { phonetique:true, phonetiqueMethode:"double" }.
 */

const VOYELLES = "AEIOUY";
const estVoyelle = (c) => c !== undefined && VOYELLES.indexOf(c) !== -1;

// Renvoie [primaire, secondaire] — deux codes (identiques si aucune divergence de prononciation).
function doubleMetaphone(value) {
  let primary = "";
  let secondary = "";
  // Normalise : lettres latines, majuscules ; padding pour lire sans borne.
  const s = String(value == null ? "" : value)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z]/g, "");
  if (!s) return ["", ""];
  const chars = s + "      ";
  const len = s.length;
  const at = (i) => (i >= 0 && i < chars.length ? chars[i] : "");
  const sub = (i, n) => chars.slice(i, i + n);
  const isAny = (i, n, list) => list.indexOf(sub(i, n)) !== -1;
  const add = (p, sec) => { primary += p; secondary += sec === undefined ? p : sec; };

  const slavoGermanique = /W|K|CZ|WITZ/.test(s);
  let i = 0;
  // Voyelles muettes de tête (KN/GN/PN/WR/PS) : on saute la 1re lettre.
  if (isAny(0, 2, ["GN", "KN", "PN", "WR", "PS"])) i = 1;
  // « X » initial se prononce « S » (Xavier).
  if (at(0) === "X") { add("S"); i = 1; }

  while (i < len && (primary.length < 8 || secondary.length < 8)) {
    const c = at(i);
    switch (c) {
      case "A": case "E": case "I": case "O": case "U": case "Y":
        if (i === 0) add("A");                       // seule une voyelle de tête compte
        i += 1; break;
      case "B":
        add("P"); i += at(i + 1) === "B" ? 2 : 1; break;      // « MB » muet géré via B->P puis skip
      case "C":
        if (i > 1 && !estVoyelle(at(i - 2)) && sub(i - 1, 3) === "ACH" && at(i + 2) !== "I"
            && (at(i + 2) !== "E" || isAny(i - 2, 6, ["BACHER", "MACHER"]))) { add("K"); i += 2; break; }
        if (i === 0 && sub(0, 6) === "CAESAR") { add("S"); i += 2; break; }
        if (sub(i, 4) === "CHIA") { add("K"); i += 2; break; }
        if (sub(i, 2) === "CH") {
          if (i > 0 && sub(i, 4) === "CHAE") { add("K", "X"); i += 2; break; }
          if (i === 0 && (isAny(i + 1, 5, ["HARAC", "HARIS"]) || isAny(i + 1, 3, ["HOR", "HYM", "HIA", "HEM"]))
              && sub(0, 5) !== "CHORE") { add("K"); i += 2; break; }
          if (/^(VAN |VON |SCH)/.test(sub(0, 4)) || isAny(i - 2, 6, ["ORCHES", "ARCHIT", "ORCHID"])
              || isAny(i + 2, 1, ["T", "S"])
              || ((isAny(i - 1, 1, ["A", "O", "U", "E"]) || i === 0)
                  && (isAny(i + 2, 1, ["L", "R", "N", "M", "B", "H", "F", "V", "W", " "]) || i + 1 === len - 1))) {
            add("K"); i += 2; break;
          }
          if (i > 0) { add(sub(0, 2) === "MC" ? "K" : "X", "K"); } else { add("X"); }
          i += 2; break;
        }
        if (sub(i, 2) === "CZ" && sub(i - 2, 4) !== "WICZ") { add("S", "X"); i += 2; break; }
        if (sub(i + 1, 3) === "CIA") { add("X"); i += 3; break; }
        if (sub(i, 2) === "CC" && !(i === 1 && at(0) === "M")) {
          if (isAny(i + 2, 1, ["I", "E", "H"]) && sub(i + 2, 2) !== "HU") {
            if ((i === 1 && at(i - 1) === "A") || isAny(i - 1, 5, ["UCCEE", "UCCES"])) add("KS");
            else add("X");
            i += 3; break;
          }
          add("K"); i += 2; break;
        }
        if (isAny(i, 2, ["CK", "CG", "CQ"])) { add("K"); i += 2; break; }
        if (isAny(i, 2, ["CI", "CE", "CY"])) {
          add(isAny(i, 3, ["CIO", "CIE", "CIA"]) ? "S" : "S"); i += 2; break;
        }
        add("K");
        i += isAny(i + 1, 2, [" C", " Q", " G"]) ? 3 : (isAny(i + 1, 1, ["C", "K", "Q"]) && !isAny(i + 1, 2, ["CE", "CI"]) ? 2 : 1);
        break;
      case "D":
        if (sub(i, 2) === "DG") {
          if (isAny(i + 2, 1, ["I", "E", "Y"])) { add("J"); i += 3; break; }
          add("TK"); i += 2; break;
        }
        add("T"); i += isAny(i, 2, ["DT", "DD"]) ? 2 : 1; break;
      case "F": add("F"); i += at(i + 1) === "F" ? 2 : 1; break;
      case "G":
        if (at(i + 1) === "H") {
          if (i > 0 && !estVoyelle(at(i - 1))) { add("K"); i += 2; break; }
          if (i === 0) { add(at(i + 2) === "I" ? "J" : "K"); i += 2; break; }
          if ((i > 1 && isAny(i - 2, 1, ["B", "H", "D"]))
              || (i > 2 && isAny(i - 3, 1, ["B", "H", "D"]))
              || (i > 3 && isAny(i - 4, 1, ["B", "H"]))) { i += 2; break; }
          if (i > 2 && at(i - 1) === "U" && isAny(i - 3, 1, ["C", "G", "L", "R", "T"])) { add("F"); i += 2; break; }
          if (i > 0 && at(i - 1) !== "I") add("K");
          i += 2; break;
        }
        if (at(i + 1) === "N") {
          if (i === 1 && estVoyelle(at(0)) && !slavoGermanique) { add("KN", "N"); }
          else if (sub(i + 2, 2) !== "EY" && at(i + 1) !== "Y" && !slavoGermanique) { add("N", "KN"); }
          else add("KN");
          i += 2; break;
        }
        if (sub(i + 1, 2) === "LI" && !slavoGermanique) { add("KL", "L"); i += 2; break; }
        if (i === 0 && (at(i + 1) === "Y" || isAny(i + 1, 2, ["ES", "EP", "EB", "EL", "EY", "IB", "IL", "IN", "IE", "EI", "ER"]))) {
          add("K", "J"); i += 2; break;
        }
        if ((sub(i + 1, 2) === "ER" || at(i + 1) === "Y")
            && !isAny(0, 6, ["DANGER", "RANGER", "MANGER"])
            && !isAny(i - 1, 1, ["E", "I"]) && !isAny(i - 1, 3, ["RGY", "OGY"])) {
          add("K", "J"); i += 2; break;
        }
        if (isAny(i + 1, 1, ["E", "I", "Y"]) || isAny(i - 1, 4, ["AGGI", "OGGI"])) {
          if (/^(VAN |VON |SCH)/.test(sub(0, 4)) || sub(i + 1, 2) === "ET") add("K");
          else add("J", isAny(i + 1, 4, ["IER "]) ? "J" : "K");
          i += 2; break;
        }
        add("K"); i += at(i + 1) === "G" ? 2 : 1; break;
      case "H":
        if ((i === 0 || estVoyelle(at(i - 1))) && estVoyelle(at(i + 1))) { add("H"); i += 2; break; }
        i += 1; break;
      case "J":
        if (sub(i, 4) === "JOSE" || sub(0, 4) === "SAN ") {
          if ((i === 0 && at(i + 4) === " ") || sub(0, 4) === "SAN ") add("H");
          else add("J", "H");
          i += 1; break;
        }
        if (i === 0) add("J", "A");
        else if (estVoyelle(at(i - 1)) && !slavoGermanique && isAny(i + 1, 1, ["A", "O"])) add("J", "H");
        else if (i === len - 1) add("J", "");
        else if (!isAny(i + 1, 1, ["L", "T", "K", "S", "N", "M", "B", "Z"]) && !isAny(i - 1, 1, ["S", "K", "L"])) add("J");
        i += at(i + 1) === "J" ? 2 : 1; break;
      case "K": add("K"); i += at(i + 1) === "K" ? 2 : 1; break;
      case "L":
        if (at(i + 1) === "L") {
          if ((i === len - 3 && isAny(i - 1, 4, ["ILLO", "ILLA", "ALLE"]))
              || ((isAny(len - 2, 2, ["AS", "OS"]) || isAny(len - 1, 1, ["A", "O"])) && sub(i - 1, 4) === "ALLE")) {
            add("L", ""); i += 2; break;
          }
          i += 2; add("L"); break;
        }
        add("L"); i += 1; break;
      case "M":
        add("M");
        i += (sub(i - 1, 3) === "UMB" && (i + 1 === len - 1 || sub(i + 2, 2) === "ER")) || at(i + 1) === "M" ? 2 : 1;
        break;
      case "N": add("N"); i += at(i + 1) === "N" ? 2 : 1; break;
      case "P":
        if (at(i + 1) === "H") { add("F"); i += 2; break; }
        add("P"); i += isAny(i + 1, 1, ["P", "B"]) ? 2 : 1; break;
      case "Q": add("K"); i += at(i + 1) === "Q" ? 2 : 1; break;
      case "R":
        if (i === len - 1 && !slavoGermanique && sub(i - 2, 2) === "IE" && !isAny(i - 4, 2, ["ME", "MA"])) add("", "R");
        else add("R");
        i += at(i + 1) === "R" ? 2 : 1; break;
      case "S":
        if (isAny(i - 1, 3, ["ISL", "YSL"])) { i += 1; break; }
        if (i === 0 && sub(0, 5) === "SUGAR") { add("X", "S"); i += 1; break; }
        if (sub(i, 2) === "SH") {
          if (isAny(i + 1, 4, ["HEIM", "HOEK", "HOLM", "HOLZ"])) add("S");
          else add("X");
          i += 2; break;
        }
        if (isAny(i, 3, ["SIO", "SIA"]) || sub(i, 4) === "SIAN") { add(slavoGermanique ? "S" : "X", "S"); i += 3; break; }
        if ((i === 0 && isAny(i + 1, 1, ["M", "N", "L", "W"])) || at(i + 1) === "Z") { add("S", "X"); i += at(i + 1) === "Z" ? 2 : 1; break; }
        if (sub(i, 2) === "SC") {
          if (at(i + 2) === "H") {
            if (isAny(i + 3, 2, ["OO", "ER", "EN", "UY", "ED", "EM"])) {
              add(isAny(i + 3, 2, ["ER", "EN"]) ? "X" : "SK"); i += 3; break;
            }
            if (i === 0 && !estVoyelle(at(3)) && at(3) !== "W") add("X", "S");
            else add("X");
            i += 3; break;
          }
          if (isAny(i + 2, 1, ["I", "E", "Y"])) { add("S"); i += 3; break; }
          add("SK"); i += 3; break;
        }
        if (i === len - 1 && isAny(i - 2, 2, ["AI", "OI"])) add("", "S");
        else add("S");
        i += isAny(i + 1, 1, ["S", "Z"]) ? 2 : 1; break;
      case "T":
        if (sub(i, 4) === "TION") { add("X"); i += 3; break; }
        if (isAny(i, 3, ["TIA", "TCH"])) { add("X"); i += 3; break; }
        if (sub(i, 2) === "TH" || sub(i, 3) === "TTH") {
          if (isAny(i + 2, 2, ["OM", "AM"]) || /^(VAN |VON |SCH)/.test(sub(0, 4))) add("T");
          else add("0", "T");
          i += 2; break;
        }
        add("T"); i += isAny(i + 1, 1, ["T", "D"]) ? 2 : 1; break;
      case "V": add("F"); i += at(i + 1) === "V" ? 2 : 1; break;
      case "W":
        if (sub(i, 2) === "WR") { add("R"); i += 2; break; }
        if (i === 0 && (estVoyelle(at(i + 1)) || sub(i, 2) === "WH")) {
          if (estVoyelle(at(i + 1))) add("A", "F"); else add("A");
        }
        if ((i === len - 1 && estVoyelle(at(i - 1)))
            || isAny(i - 1, 5, ["EWSKI", "EWSKY", "OWSKI", "OWSKY"]) || sub(0, 3) === "SCH") { add("", "F"); i += 1; break; }
        if (isAny(i, 4, ["WICZ", "WITZ"])) { add("TS", "FX"); i += 4; break; }
        i += 1; break;
      case "X":
        if (!(i === len - 1 && (isAny(i - 3, 3, ["IAU", "EAU"]) || isAny(i - 2, 2, ["AU", "OU"])))) add("KS");
        i += isAny(i + 1, 1, ["C", "X"]) ? 2 : 1; break;
      case "Z":
        if (at(i + 1) === "H") { add("J"); i += 2; break; }
        if (isAny(i + 1, 2, ["ZO", "ZI", "ZA"]) || (slavoGermanique && i > 0 && at(i - 1) !== "T")) add("S", "TS");
        else add("S");
        i += at(i + 1) === "Z" ? 2 : 1; break;
      default: i += 1; break;
    }
  }
  return [primary.slice(0, 8), secondary.slice(0, 8)];
}

// Ensemble des clés phonétiques (déduit, non vides). Deux jetons riment si leurs ensembles se croisent.
function clesDouble(s) {
  const [p, sec] = doubleMetaphone(s);
  const out = [];
  if (p) out.push(p);
  if (sec && sec !== p) out.push(sec);
  return out;
}

module.exports = { doubleMetaphone, clesDouble };
