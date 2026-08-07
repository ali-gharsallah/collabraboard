import { parse } from "yaml";
import { z } from "zod";
import { CompletionProfile, KINDS_REQUIREMENT, SEVERITES } from "./types";
import { compilerExpression, ExpressionInvalide } from "./dsl";

/**
 * P-L7-1 — CHARGEUR YAML STRICT des CompletionProfiles. La config d'inférence est GOUVERNÉE :
 * un champ inconnu est REFUSÉ (jamais ignoré — un `severty` mal orthographié qui passerait en
 * silence désarmerait une exigence réglementaire), et chaque erreur porte le CHEMIN du champ
 * fautif (`profils[0].requirements[1].kind`). Aucun état module-global (leçon C8) : le chargeur
 * est une fonction pure texte → profils, appelée par requête/chargement.
 * `when` (activation_rules) est COMPILÉ ICI par le DSL sûr (P-L7-2, dsl.ts — AST restreint,
 * pas d'eval) : une expression invalide est rejetée AU CHARGEMENT, avec le chemin du champ.
 */

const SCHEMA_REQUIREMENT = z.object({
  id: z.string().min(1),
  kind: z.enum(KINDS_REQUIREMENT),
  basis: z.string().min(1),
  severity: z.enum(SEVERITES),
  params: z.record(z.unknown()).default({}),
  when: z.string().min(1).optional(),
}).strict();

const SCHEMA_PROFIL = z.object({
  profil: z.string().min(1),
  entityType: z.string().min(1),
  jurisdiction: z.string().min(1),               // ISO-2 ou "*" (repli)
  requirements: z.array(SCHEMA_REQUIREMENT).min(1),
}).strict();

const SCHEMA_DOCUMENT = z.object({ profils: z.array(SCHEMA_PROFIL).min(1) }).strict();

export class ConfigurationProfilInvalide extends Error {
  constructor(public erreurs: { chemin: string; message: string }[]) {
    super("P-L7-1 : configuration de profils INVALIDE — " +
      erreurs.map((e) => `${e.chemin || "(racine)"} : ${e.message}`).join(" · "));
  }
}

/** Texte YAML → profils validés. Erreur = ConfigurationProfilInvalide avec chemins précis. */
export function chargerProfils(yamlText: string): CompletionProfile[] {
  let brut: unknown;
  try { brut = parse(yamlText); }
  catch (e: any) {
    throw new ConfigurationProfilInvalide([{ chemin: "(document)", message: `YAML illisible : ${e?.message ?? e}` }]);
  }
  const verdict = SCHEMA_DOCUMENT.safeParse(brut);
  if (!verdict.success)
    throw new ConfigurationProfilInvalide(verdict.error.issues.map((i) => ({
      chemin: i.path.join("."),
      message: i.code === "unrecognized_keys"
        ? `champ(s) inconnu(s) refusé(s) : ${(i as any).keys.join(", ")}` : i.message })));

  const profils = verdict.data.profils;
  const erreurs: { chemin: string; message: string }[] = [];
  // Unicité des ids de requirement DANS un profil, et unicité (entityType, jurisdiction) entre profils.
  profils.forEach((p, pi) => {
    const vus = new Set<string>();
    p.requirements.forEach((r, ri) => {
      if (vus.has(r.id)) erreurs.push({ chemin: `profils.${pi}.requirements.${ri}.id`,
        message: `id dupliqué « ${r.id} » dans le profil ${p.profil}` });
      vus.add(r.id);
    });
  });
  const cles = new Map<string, number>();
  profils.forEach((p, pi) => {
    const cle = `${p.entityType}|${p.jurisdiction}`;
    if (cles.has(cle)) erreurs.push({ chemin: `profils.${pi}`,
      message: `profil dupliqué pour (${p.entityType}, ${p.jurisdiction}) — déjà défini par profils.${cles.get(cle)}` });
    else cles.set(cle, pi);
  });
  // P-L7-2 : les activation_rules se COMPILENT au chargement — expression invalide = config refusée.
  profils.forEach((p, pi) => p.requirements.forEach((r, ri) => {
    if (r.when === undefined) return;
    try { compilerExpression(r.when); }
    catch (e) {
      erreurs.push({ chemin: `profils.${pi}.requirements.${ri}.when`,
        message: e instanceof ExpressionInvalide ? e.message : String(e) });
    }
  }));
  if (erreurs.length) throw new ConfigurationProfilInvalide(erreurs);
  return profils as CompletionProfile[];
}
