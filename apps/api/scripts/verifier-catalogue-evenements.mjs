#!/usr/bin/env node
/**
 * Garde d'inventaire du CATALOGUE D'ÉVÉNEMENTS (C6 · P-L5-2) — pendant du registre des
 * règles C5. Le catalogue (src/contracts/events-catalog.ts) refuse au write tout type
 * absent de (SCHEMAS_EVENEMENTS ∪ TYPES_EN_ATTENTE) : un littéral émis au code mais
 * oublié de l'inventaire est une BOMBE À REFUS qui n'explose qu'à l'exécution.
 * Cette garde la désamorce en CI.
 *
 *   node verifier-catalogue-evenements.mjs            → CHECK : littéral émis hors
 *     catalogue = rouge (sortie 1). Vert = « ### catalogue d'événements vert (C6) ### ».
 *   node verifier-catalogue-evenements.mjs --generer  → régénère TYPES_EN_ATTENTE :
 *     nouvelle liste = (ancienne ∪ scan) − schématisés, triée. MONOTONE : n'enlève
 *     jamais une entrée héritée du scan initial (la SUR-capture est assumée, cf.
 *     docs/notes/L5-events-todo.md) ; un type ne SORT de la liste qu'en recevant
 *     son schéma.
 *
 * Heuristique de scan (même doctrine que l'inventaire initial du 2026-08-06 — large,
 * car la SOUS-capture est le seul danger) : dans tout fichier ÉMETTEUR de src/
 * (contient emitEvent( / .emit( / domainEvent.create), chaque littéral « pointé »
 * minuscule (xxx.yyy[.zzz…]) est présumé type d'événement.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOGUE = join(RACINE, "src/contracts/events-catalog.ts");
const GENERER = process.argv.includes("--generer");

// ── 1. Lire le catalogue actuel (textuel — zod ne se résout pas en .mjs) ──
const src = readFileSync(CATALOGUE, "utf8");
const schematises = new Set([...src.matchAll(/^\s*"([^"]+)":\s*\{ version/gm)].map((m) => m[1]));
const blocAttente = src.match(/TYPES_EN_ATTENTE[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/);
if (!blocAttente) { console.error("✗ TYPES_EN_ATTENTE introuvable dans events-catalog.ts"); process.exit(1); }
const enAttente = new Set([...blocAttente[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));

// ── 2. Scanner les fichiers émetteurs ──
const fichiers = [];
(function marcher(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) { if (e !== "node_modules") marcher(p); }
    else if (p.endsWith(".ts") && !p.endsWith(".spec.ts") && !p.endsWith(".d.ts")) fichiers.push(p);
  }
})(join(RACINE, "src"));

const EMETTEUR = /\bemitEvent\(|\.emit\(|domainEvent\.create/;
const LITTERAL_POINTE = /["'`]([a-z][a-z0-9_]*(?:\.[a-z0-9_]+){1,5})["'`]/g;
// Types GABARITS (`PREFIXE_${expr}`) : invisibles du scan de littéraux — chaque variante doit
// être ÉNUMÉRÉE À LA MAIN dans TYPES_EN_ATTENTE (leçon CC-07 : `COC_${vers}` → COC_NON_RETENU
// refusé au write). On les LISTE ici pour qu'aucune émission dynamique ne reste invisible.
const TYPE_GABARIT = /(?:\.emit|emitEvent)\(\s*[^,;]+,\s*[^,;]+,\s*`([^`$]*)\$\{/g;
// Bruit évident retiré du scan large : noms de fichiers et accès membres cités en chaîne.
// (La doctrine reste la SUR-capture — on n'exclut que l'indiscutable.)
const BRUIT = /(?:\.(?:py|json|ts|js|mjs|cjs|txt|md|ya?ml|html|sql|env|csv|xml|xsd|pdf|png)$)|^this\./;
const emis = new Set();
const gabarits = [];   // { prefixe, ou } — émissions à type dynamique
for (const f of fichiers) {
  const t = readFileSync(f, "utf8");
  if (!EMETTEUR.test(t)) continue;
  for (const m of t.matchAll(LITTERAL_POINTE)) if (!BRUIT.test(m[1])) emis.add(m[1]);
  for (const m of t.matchAll(TYPE_GABARIT))
    gabarits.push({ prefixe: m[1], ou: f.slice(RACINE.length + 1) });
}

// ── 3. Vérifier / régénérer ──
const manquants = [...emis].filter((t) => !schematises.has(t) && !enAttente.has(t)).sort();
const doublons = [...enAttente].filter((t) => schematises.has(t)).sort();

if (GENERER) {
  const nouvelle = [...new Set([...enAttente, ...emis])].filter((t) => !schematises.has(t)).sort();
  const rendu = nouvelle.map((t) => `  "${t}",`).join("\n");
  const maj = src.replace(/(TYPES_EN_ATTENTE[^=]*=\s*new Set\(\[)[\s\S]*?(\]\))/, `$1\n${rendu}\n$2`);
  writeFileSync(CATALOGUE, maj);
  console.log(`inventaire (ré)généré : ${schematises.size} schématisés · ${nouvelle.length} en attente ` +
    `(+${manquants.length} du scan, −${doublons.length} désormais schématisés)`);
  process.exit(0);
}

console.log(`CATALOGUE D'ÉVÉNEMENTS — ${schematises.size} schématisés · ${enAttente.size} en attente · ` +
  `${emis.size} littéraux pointés scannés (${fichiers.length} fichiers src, émetteurs seulement)`);
let rouge = false;
for (const g of gabarits) {
  const variantes = [...enAttente, ...schematises].filter((t) => g.prefixe && t.startsWith(g.prefixe));
  console.log(`ℹ type GABARIT \`${g.prefixe}\${…}\` (${g.ou}) — ${variantes.length} variante(s) énumérée(s) : ` +
    `${variantes.join(", ") || "AUCUNE"}. Chaque nouvelle valeur DOIT être énumérée à la main (leçon CC-07).`);
  if (!variantes.length) {
    rouge = true;
    console.error(`✗ type gabarit \`${g.prefixe}\${…}\` sans AUCUNE variante au catalogue — refus au write garanti.`);
  }
}
if (manquants.length) {
  rouge = true;
  console.error(`\n✗ ${manquants.length} littéral(aux) émis ABSENTS du catalogue (bombe à refus au write) :`);
  for (const t of manquants) console.error(`   ✗ ${t}`);
  console.error("→ régénérez : node apps/api/scripts/verifier-catalogue-evenements.mjs --generer");
}
if (doublons.length) {
  rouge = true;
  console.error(`\n✗ ${doublons.length} type(s) à la fois SCHÉMATISÉS et EN ATTENTE (la liste d'attente ment) :`);
  for (const t of doublons) console.error(`   ✗ ${t}`);
  console.error("→ régénérez : node apps/api/scripts/verifier-catalogue-evenements.mjs --generer");
}
if (rouge) process.exit(1);
console.log("✓ chaque littéral émis est au catalogue, aucun type à double statut.");
console.log("### catalogue d'événements vert (C6) ###");
