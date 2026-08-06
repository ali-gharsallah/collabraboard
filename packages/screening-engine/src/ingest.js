/**
 * Ingestion des listes (sous R409 — chargement de la liste). Normalise une entrée BRUTE d'un format
 * de liste réel vers la forme EntreeMoteur que consomme le moteur (uid/nom_complet/alias/
 * date_naissance/type/nationalites). C'est l'adaptateur qui rendait jusqu'ici chaque banc et chaque
 * spec responsable du même mapping (dates_naissance[0]→date_naissance, alias objet→chaîne) : centralisé
 * ici, un SEUL endroit fait foi. Multi-format : accepte les noms de champs SECO/synthétique, OFAC et UN.
 *
 * Ce n'est PAS une nouvelle règle : c'est l'adaptateur d'entrée du pré-filtre R409. Aucun score n'en
 * dépend — il produit exactement la forme MAPPED sur laquelle les planchers du gate sont figés.
 */
"use strict";

const prem = (x) => (Array.isArray(x) ? x[0] : x);                     // 1re valeur d'un tableau, sinon la valeur
const arr = (x) => (x == null ? undefined : Array.isArray(x) ? x : [x]); // force en tableau (ou undefined)
const aliasNom = (a) => (typeof a === "string" ? a : (a && (a.nom ?? a.name ?? a.aliasName ?? a.wholeName)));

// Type : ramène les vocabulaires courants à { individu | entite }, sinon laisse la valeur telle quelle.
function normaliserType(t) {
  if (!t) return undefined;
  const s = String(t).toLowerCase();
  if (/(individu|individual|person|physical|particulier|natural)/.test(s)) return "individu";
  if (/(entite|entity|organi[sz]ation|company|entreprise|legal|vessel|aircraft)/.test(s)) return "entite";
  return t;
}

/** Normalise UNE entrée brute (multi-format) vers EntreeMoteur. */
function ingererEntree(e) {
  const alias = (e.alias ?? e.aka ?? e.aliases ?? e.akas ?? []).map(aliasNom).filter(Boolean);
  const dob = e.date_naissance ?? prem(e.dates_naissance) ?? prem(e.dob) ?? e.birthDate ?? e.dateOfBirth ?? null;
  const nat = e.nationalites ?? e.nationalities ?? e.nationality ?? e.citizenships;
  return {
    uid: e.uid ?? e.id ?? e.reference ?? e.ref ?? e.recordId,
    nom_complet: e.nom_complet ?? e.name ?? e.fullName ?? e.full_name ?? e.wholeName,
    alias,
    date_naissance: dob ?? null,
    type: normaliserType(e.type ?? e.entityType ?? e.schema ?? e.subjectType),
    nationalites: arr(nat),
  };
}

/** Normalise une LISTE brute vers EntreeMoteur[]. */
function ingererListe(entrees) {
  return (entrees || []).map(ingererEntree);
}

module.exports = { ingererEntree, ingererListe, normaliserType };
