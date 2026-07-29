// Moteur BAT (R333/FB) — fonctions PURES. Génère le cahier filtré par licence (FB-05), et
// décide la porte de promotion d'un tenant (FB-07) : PROMOTABLE seulement si toute case a un
// verdict, aucun écart bloquant, et le cahier est VISÉ (signature nommée, R15).
import { catalogueBat } from "./catalogue.mjs";

// FB-05 — cahier généré, filtré par les modules de la LICENCE du tenant (jamais à la main).
export function genererCahier(modulesLicence) {
  const licence = new Set(modulesLicence);
  const cases = catalogueBat.filter((c) => licence.has(c.module));
  return { modules: [...licence], cases };
}

// Rendu markdown du cahier (ce que le client exécute et signe).
export function rendreCahier(tenant, modulesLicence) {
  const { cases } = genererCahier(modulesLicence);
  const L = [`# Cahier de recette BAT — ${tenant} (généré, ne pas éditer à la main)`, ""];
  L.push(`Modules licenciés : ${modulesLicence.join(", ") || "—"}. ${cases.length} case(s) de recette.`, "");
  L.push("| Case | Module | Intitulé | Critère d'acceptation | Verdict | Visa |");
  L.push("|------|--------|----------|------------------------|---------|------|");
  for (const c of cases) L.push(`| ${c.id} | ${c.module} | ${c.intitule} | ${c.critere} |  |  |`);
  L.push("");
  L.push("Verdicts : PASS / ÉCHEC (écart classé BLOQUANT ou MINEUR). Promotion en prod : cahier");
  L.push("complet, aucun écart BLOQUANT, visa nommé apposé (R15). Voir tools/bat/bat.mjs::promotable.");
  return L.join("\n");
}

// FB-07 — porte de promotion. campagne = { cases:[{id, verdict:"PASS"|"ECHEC",
// ecart?:{gravite:"BLOQUANT"|"MINEUR"}}], visa?:{par, role, at} }. Rôles habilités au visa R15.
const ROLES_VISA = new Set(["CO_SR", "DIR", "ADMIN"]);
export function promotable(campagne, modulesLicence) {
  const attendus = genererCahier(modulesLicence).cases.map((c) => c.id);
  const rendus = new Map((campagne.cases ?? []).map((c) => [c.id, c]));
  const raisons = [];
  // Toute case du cahier doit avoir un verdict.
  for (const id of attendus) if (!rendus.has(id) || !rendus.get(id).verdict) raisons.push(`case sans verdict : ${id}`);
  // Aucun écart BLOQUANT.
  for (const c of campagne.cases ?? [])
    if (c.ecart?.gravite === "BLOQUANT") raisons.push(`écart bloquant : ${c.id}`);
  // Visa nommé par un rôle habilité (R15).
  const v = campagne.visa;
  if (!v || !v.par || !v.role) raisons.push("cahier non visé (signature R15 absente)");
  else if (!ROLES_VISA.has(v.role)) raisons.push(`rôle non habilité au visa : ${v.role}`);
  return { promotable: raisons.length === 0, raisons };
}

// Classement des écarts d'une campagne (pour l'écran BAT).
export function classerEcarts(campagne) {
  const ecarts = (campagne.cases ?? []).filter((c) => c.ecart).map((c) => ({ id: c.id, ...c.ecart }));
  return {
    bloquants: ecarts.filter((e) => e.gravite === "BLOQUANT"),
    mineurs: ecarts.filter((e) => e.gravite === "MINEUR"),
  };
}
