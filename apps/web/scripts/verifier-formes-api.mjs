#!/usr/bin/env node
/**
 * VÉRIFICATEUR DE FORME DES RÉPONSES — écran v2 ↔ API vivante (V2-M41).
 *
 * POURQUOI IL EXISTE. La garde de contrat `actes-contrat.test.ts` (V2-M39/M40) se termine par
 * un aveu : « CE QUE CES GARDES NE VÉRIFIENT PAS […] la FORME des réponses. Un seed peut avoir
 * les bonnes clés et le moteur en renvoyer d'autres — seule une API vivante le dirait. »
 * Ce script EST cette API vivante. Il ne remplace pas la garde statique : il couvre le contrat
 * de RETOUR, là où la garde couvre le contrat d'APPEL.
 *
 * CE QU'IL FAIT, sans rien simuler :
 *   1. il lit les VRAIS seeds des écrans — le module `src/ui2/*.tsx` est empaqueté par esbuild
 *      avec un export injecté des constantes de seed, puis importé ; aucune recopie à la main ;
 *   2. il appelle le VRAI moteur avec un VRAI jeton, route par route ;
 *   3. il compare les deux FORMES (clés et types, en profondeur) et signale ce qui manque
 *      côté moteur — c'est-à-dire ce que l'écran lira `undefined` le jour du branchement.
 *
 * CE QU'IL NE FAIT PAS, et qu'il ne faut pas croire fait : il ne juge pas les VALEURS (une
 * date plausible, un montant juste), il ne vérifie pas les écritures, et une réponse `[]`
 * du moteur ne prouve rien sur la forme des éléments — le rapport le dit alors explicitement
 * plutôt que de compter un succès.
 *
 * IL N'EST PAS UN TEST DE CI : il exige une API démarrée et une base semée. Le mettre en CI
 * ferait rougir la CI pour une raison qui n'est pas une régression de code. Usage :
 *
 *   OLIVE_API=http://127.0.0.1:3010 OLIVE_TOKEN=$(cat /tmp/tok-carla) \
 *     node scripts/verifier-formes-api.mjs
 *
 * Sortie : rapport lisible sur stdout, code de sortie 1 s'il manque une clé au moteur.
 */
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

// esbuild n'est pas une dépendance DIRECTE de apps/web : il arrive par vite. Plutôt que
// d'ajouter une dépendance au manifeste pour un outil hors CI, on le résout là où pnpm l'a
// posé — et on le dit si on ne le trouve pas, au lieu d'échouer sur une trace obscure.
const requis = createRequire(import.meta.url);
const esbuild = await (async () => {
  for (const p of ["esbuild", "vite/node_modules/esbuild"]) {
    try { return await import(pathToFileURL(requis.resolve(p)).href); } catch { /* candidat suivant */ }
  }
  try {
    const viteDir = dirname(requis.resolve("vite/package.json"));
    return await import(pathToFileURL(createRequire(join(viteDir, "index.js")).resolve("esbuild")).href);
  } catch { /* dernier recours ci-dessous */ }
  console.error("esbuild introuvable — `pnpm install` dans apps/web, puis relancer.");
  process.exit(2);
})();

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI2 = join(RACINE, "src", "ui2");
const API = process.env.OLIVE_API ?? "http://127.0.0.1:3010";
const TOKEN = process.env.OLIVE_TOKEN ?? "";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Lire les LECTURES déclarées par les écrans : useApiOrSeed<T>(route, seed)
// ─────────────────────────────────────────────────────────────────────────────

function fichiersUi2() {
  const out = [];
  const visiter = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { visiter(p); continue; }
      if (!/\.tsx?$/.test(e.name) || /\.test\./.test(e.name)) continue;
      out.push({ chemin: p, nom: e.name, src: readFileSync(p, "utf8") });
    }
  };
  visiter(UI2);
  return out;
}

/** Découpe les arguments d'un appel en tenant compte des imbrications et des chaînes. */
function arguments_(src, iOuvrante) {
  let prof = 0, args = [], courant = "", chaine = "";
  for (let i = iOuvrante; i < src.length; i++) {
    const c = src[i];
    if (chaine) {                                   // dans une chaîne : rien n'est structurel
      courant += c;
      if (c === "\\") { courant += src[++i] ?? ""; continue; }
      if (c === chaine) chaine = "";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { chaine = c; courant += c; continue; }
    if ("([{".includes(c)) { prof++; if (prof === 1) continue; }
    if (")]}".includes(c)) { prof--; if (prof === 0) { args.push(courant); return args; } }
    if (c === "," && prof === 1) { args.push(courant); courant = ""; continue; }
    courant += c;
  }
  return args;
}

function lecturesDeclarees() {
  const out = [];
  for (const { nom, chemin, src } of fichiersUi2()) {
    for (const m of src.matchAll(/useApiOrSeed\s*(<[\s\S]*?>)?\s*\(/g)) {
      const args = arguments_(src, m.index + m[0].length - 1);
      if (args.length < 2) continue;
      out.push({ fichier: nom, chemin, routeExpr: args[0].trim(), seedExpr: args[1].trim() });
    }
  }
  return out;
}

/**
 * Une expression de route donne une ou plusieurs routes concrètes. Les gabarits `${x}` sont
 * résolus plus tard sur des données vivantes ; les routes sentinelles `__hors-api__` sont des
 * branches volontairement mortes (l'écran ne veut pas appeler) et sont écartées.
 */
function routesDe(expr) {
  const routes = [];
  for (const m of expr.matchAll(/["'`]([^"'`]+)["'`]/g)) routes.push(m[1]);
  return routes.filter((r) => r.startsWith("/v1/") && !r.includes("__hors-api__"));
}

/** Un seed exploitable est une CONSTANTE du module (on peut l'exporter et l'évaluer). */
function identifiantSeed(expr) {
  const m = expr.match(/^([A-Za-z_$][\w$]*)\s*(as\s+[\s\S]+)?$/);
  // `null as never` ressemble à un identifiant et n'en est pas : l'exporter casse le paquetage.
  if (!m || ["null", "undefined", "true", "false"].includes(m[1])) return null;
  return m[1];
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Évaluer les VRAIS seeds — esbuild + export injecté (jamais une recopie)
// ─────────────────────────────────────────────────────────────────────────────

async function evaluerSeeds(lectures) {
  const parFichier = new Map();
  for (const l of lectures) {
    const id = identifiantSeed(l.seedExpr);
    if (!id) continue;
    if (!parFichier.has(l.chemin)) parFichier.set(l.chemin, new Set());
    parFichier.get(l.chemin).add(id);
  }
  const entrees = [...parFichier.keys()];
  const entree = entrees.map((p, i) => `import * as M${i} from ${JSON.stringify(p)};`).join("\n")
    + `\nexport const DUMP = {${entrees.map((p, i) => `${JSON.stringify(p)}: M${i}`).join(",")}};`;

  const injection = {
    name: "exporter-les-seeds",
    setup(build) {
      build.onLoad({ filter: /\.tsx?$/ }, (a) => {
        const ids = parFichier.get(a.path);
        if (!ids) return null;
        const src = readFileSync(a.path, "utf8")
          + `\nexport { ${[...ids].join(", ")} };\n`;
        return { contents: src, loader: a.path.endsWith(".tsx") ? "tsx" : "ts" };
      });
    },
  };

  const dossier = mkdtempSync(join(tmpdir(), "formes-"));
  const sortie = join(dossier, "seeds.mjs");
  await esbuild.build({
    stdin: { contents: entree, resolveDir: RACINE, loader: "ts" },
    bundle: true, format: "esm", platform: "node", outfile: sortie,
    jsx: "automatic", plugins: [injection], logLevel: "silent",
    loader: { ".css": "empty", ".svg": "empty", ".png": "empty" },
  });
  const mod = await import(pathToFileURL(sortie).href);
  return mod.DUMP;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Comparer les formes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chemins feuilles d'une valeur : `parJuridiction[].clients` → "number".
 * Un conteneur VIDE (`[]` ou `{}`) est marqué « vide » et NON développé : c'est le seul aveu
 * honnête possible. Compter ses clés absentes comme un écart accuserait le moteur de ne pas
 * renvoyer ce qu'aucune donnée ne lui permet de renvoyer — un faux positif, pas un défaut.
 */
function chemins(v, prefixe = "", acc = new Map()) {
  if (Array.isArray(v)) {
    if (!v.length) { acc.set(prefixe + "[]", "vide"); return acc; }
    chemins(v[0], prefixe + "[]", acc);
    return acc;
  }
  if (v && typeof v === "object") {
    const e = Object.entries(v);
    if (!e.length) { acc.set(prefixe + "{}", "vide"); return acc; }
    for (const [k, x] of e) chemins(x, prefixe ? `${prefixe}.${k}` : k, acc);
    return acc;
  }
  acc.set(prefixe, v === null ? "null" : typeof v);
  return acc;
}

/** Préfixes que le moteur a rendus VIDES : tout chemin qui en descend est invérifiable. */
function prefixesVides(c) {
  return [...c.entries()].filter(([, t]) => t === "vide")
    .map(([k]) => k.replace(/(\[\]|\{\})$/, ""));
}

/**
 * Résout les gabarits `${x}` avec des identifiants VIVANTS. Sans cela, la route part telle
 * quelle et le moteur répond 404 sur la chaîne « ${ouvert} » — un faux échec qui masque la
 * seule question qui compte : la forme de la réponse quand l'identifiant est bon.
 */
async function resolveurs() {
  const j = async (r) => { try { return (await lire(r)).corps; } catch { return null; } };
  const clients = await j("/v1/clients");
  const listeClients = Array.isArray(clients) ? clients : clients?.data ?? [];
  const kyc = await j("/v1/kyc");
  const listeKyc = Array.isArray(kyc) ? kyc : kyc?.data ?? [];
  return [
    [/\/v1\/cpsi\/clients\/\$\{[^}]*\}/, `/v1/cpsi/clients/${listeClients[0]?.id ?? ""}`],
    [/clientId=\$\{[^}]*\}/, `clientId=${listeClients[0]?.id ?? ""}`],
    [/\/v1\/kyc\/\$\{[^}]*\}/, `/v1/kyc/${listeKyc[0]?.code ?? ""}`],
    [/\/v1\/revues\/kyc\/\$\{[^}]*\}/, `/v1/revues/kyc/${listeKyc[0]?.code ?? ""}`],
  ];
}

async function lire(route) {
  const r = await fetch(API + route, { headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {} });
  const texte = await r.text();
  let corps = null;
  try { corps = JSON.parse(texte); } catch { /* réponse non JSON : signalée telle quelle */ }
  return { statut: r.status, corps, texte };
}

const gras = (s) => `[1m${s}[0m`;

/**
 * Écrête les tableaux à 3 éléments. La FORME est intégralement conservée (c'est elle qu'on
 * fige) ; seul le VOLUME tombe. Une fixture doit rester relisible par un humain qui vérifie la
 * correspondance — 200 ko de journal ne se relisent pas, donc ne se vérifient pas.
 */
function ecreter(v) {
  if (Array.isArray(v)) return v.slice(0, 3).map(ecreter);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ecreter(x)]));
  return v;
}

async function principal() {
  if (!TOKEN) console.error("⚠ aucun OLIVE_TOKEN — les routes protégées répondront 401\n");
  const lectures = lecturesDeclarees();
  const seeds = await evaluerSeeds(lectures);

  const rapport = { ok: [], manques: [], adaptes: [], vides: [], erreurs: [], nonCompares: [] };
  const subs = await resolveurs();
  // Les routes dont l'écart est ASSUMÉ par un adaptateur (`src/ui2/moteur-formes.ts`). La liste
  // est lue là où elle vit — jamais recopiée ici, sinon les deux dérivent en silence.
  const adaptees = new Map([...readFileSync(join(UI2, "moteur-formes.ts"), "utf8")
    .matchAll(/"(\/v1\/[^"]+)":\s*"(\w+)"/g)].map((m) => [m[1], m[2]]));
  // `--capturer <fichier>` fige les réponses NON VIDES en fixtures. Les adaptateurs de forme
  // (`src/ui2/moteur-formes.ts`) sont testés contre CES payloads : une fixture recopiée à la
  // main dériverait du moteur sans que personne ne le voie ; celle-ci vient du moteur.
  const iCapture = process.argv.indexOf("--capturer");
  const capture = iCapture > 0 ? {} : null;
  const cible = iCapture > 0 ? process.argv[iCapture + 1] : null;

  for (const l of lectures) {
    const id = identifiantSeed(l.seedExpr);
    const routes = routesDe(l.routeExpr).map((r) => {
      let s = r;
      for (const [motif, remplacement] of subs) s = s.replace(motif, remplacement);
      return s;
    });
    if (!routes.length) continue;
    for (const route of routes) {
      if (route.includes("${")) { rapport.nonCompares.push(`${l.fichier} — ${route} : gabarit non résolu`); continue; }
      const etiquette = `${l.fichier} — ${route}`;
      const { statut, corps, texte } = await lire(route);
      if (statut !== 200) { rapport.erreurs.push(`${etiquette} → HTTP ${statut} ${texte.slice(0, 160)}`); continue; }
      if (capture && corps != null && JSON.stringify(corps) !== "[]" && JSON.stringify(corps) !== "{}")
        capture[route.replace(/\?.*$/, "")] = ecreter(corps);
      if (!id) { rapport.nonCompares.push(`${etiquette} — seed en ligne (non nommé) : forme non comparable`); continue; }
      const seed = seeds[l.chemin]?.[id];
      if (seed === undefined || seed === null) { rapport.nonCompares.push(`${etiquette} — seed « ${id} » nul : rien à comparer`); continue; }

      const cSeed = chemins(seed), cVif = chemins(corps);
      const vides = prefixesVides(cVif);
      if (vides.includes("")) {
        rapport.vides.push(`${etiquette} — conteneur racine vide : la forme des ÉLÉMENTS reste invérifiée`);
        continue;
      }
      const manquants = [...cSeed.keys()].filter((k) =>
        !cVif.has(k) && cSeed.get(k) !== "vide"
        && !vides.some((p) => p && k.startsWith(p)));   // sous un conteneur vide : rien à conclure
      const enPlus = [...cVif.keys()].filter((k) => !cSeed.has(k));
      if (manquants.length && adaptees.has(route))
        rapport.adaptes.push(`${etiquette} — écart assumé par ${adaptees.get(route)}() : ${manquants.length} clés traduites`);
      else if (manquants.length) rapport.manques.push({ etiquette, manquants, enPlus });
      else if (vides.length) rapport.vides.push(`${etiquette} — vide sous ${vides.join(", ")} : forme partiellement invérifiée`);
      else rapport.ok.push(`${etiquette}${enPlus.length ? ` (+${enPlus.length} clés au moteur, l'écran les ignore)` : ""}`);
    }
  }

  if (capture && cible) {
    writeFileSync(cible, JSON.stringify(capture, null, 1) + "\n");
    console.log(`${Object.keys(capture).length} réponses capturées → ${cible}`);
  }

  console.log(gras("\n═ FORMES CONFORMES ═"));
  for (const o of rapport.ok) console.log("  ✓ " + o);
  console.log(gras("\n═ CLÉS QUE L'ÉCRAN LIRA `undefined` ═"));
  if (!rapport.manques.length) console.log("  (aucune)");
  for (const m of rapport.manques) {
    console.log("  ✗ " + m.etiquette);
    console.log("      manquantes au moteur : " + m.manquants.join(", "));
    if (m.enPlus.length) console.log("      le moteur propose  : " + m.enPlus.slice(0, 12).join(", "));
  }
  console.log(gras("\n═ ÉCARTS ASSUMÉS PAR UN ADAPTATEUR (moteur-formes.ts) ═"));
  for (const a of rapport.adaptes) console.log("  → " + a);
  console.log(gras("\n═ RÉPONSES VIDES — forme des éléments INVÉRIFIÉE ═"));
  for (const v of rapport.vides) console.log("  ~ " + v);
  console.log(gras("\n═ ROUTES EN ERREUR ═"));
  for (const e of rapport.erreurs) console.log("  ! " + e);
  console.log(gras("\n═ NON COMPARÉES (dit, pas caché) ═"));
  for (const n of rapport.nonCompares) console.log("  · " + n);

  const total = rapport.ok.length + rapport.manques.length + rapport.adaptes.length
    + rapport.vides.length + rapport.erreurs.length + rapport.nonCompares.length;
  console.log(`\n${total} lectures examinées · ${rapport.ok.length} conformes · ${rapport.adaptes.length} adaptées · `
    + `${rapport.manques.length} en écart NON traité · ${rapport.vides.length} vides · `
    + `${rapport.erreurs.length} en erreur · ${rapport.nonCompares.length} non comparées`);
  process.exit(rapport.manques.length ? 1 : 0);
}

principal().catch((e) => { console.error(e); process.exit(2); });
