#!/usr/bin/env node
/**
 * VÉRIFICATEUR D'EXÉCUTION DES ACTES — écran v2 → API vivante (V2-M44).
 *
 * POURQUOI IL EXISTE. Les lots V2-M35 à M42 ont câblé vingt et un actes d'écriture et les ont
 * vérifiés STATIQUEMENT : la route existe au contrôleur, le verbe est bon, chaque champ déclaré
 * est lu par le moteur. Aucun n'a jamais été EXÉCUTÉ. L'audit le disait en toutes lettres —
 * « aucune ÉCRITURE n'a été posée contre le moteur vivant ». Le lot V2-M43 en a posé une (le
 * dépôt réglementaire) et a montré ce que ça vaut. Ce script pose les autres.
 *
 * CE QU'IL FAIT. Il lit les actes déclarés dans `src/ui2`, résout les paramètres de route
 * (`:id`, `:empreinte`) sur des données VIVANTES, envoie le corps construit à partir des
 * `exemple` déclarés, et CLASSE la réponse :
 *
 *   ✓ ACCEPTÉ      2xx — l'acte s'exécute de bout en bout ;
 *   ⊘ REFUS TYPÉ   4xx dont le message cite une règle (R7, R13, R101…) — ce n'est PAS un
 *                  échec : c'est la garde du moteur qui fonctionne, et souvent la preuve la
 *                  plus utile du lot (l'exemple envoyé est volontairement incomplet) ;
 *   ⚠ HABILITATION 401/403 — le persona n'a pas le droit ; comportement, pas défaut ;
 *   ▸ REFUS CONTRAT 4xx typé sans règle métier (identifiant malformé, champ requis absent) ;
 *   ✗ DÉFAUT       404 sur la route ou 500 — un plantage n'est jamais un refus.
 *
 * CE QU'IL NE FAIT PAS. Il ne vérifie pas que l'effet MÉTIER est le bon (qu'un hit qualifié
 * est bien dans le bon état) : il vérifie que l'acte ARRIVE au moteur et que le moteur répond
 * quelque chose de sensé. C'est la marche suivante, et elle demande un scénario par acte.
 *
 * IL MUTE LA BASE — à lancer contre une base JETABLE, jamais contre la démonstration :
 *
 *   OLIVE_API=http://127.0.0.1:3011 OLIVE_TOKEN=$(cat /tmp/tok-actes) \
 *     node scripts/verifier-actes-api.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI2 = join(RACINE, "src", "ui2");
const API = process.env.OLIVE_API ?? "http://127.0.0.1:3011";
const TOKEN = process.env.OLIVE_TOKEN ?? "";

// ── 1. Lire les actes déclarés par les écrans ────────────────────────────────────────────────

function fichiersUi2() {
  const out = [];
  const visiter = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { visiter(p); continue; }
      if (!/\.tsx?$/.test(e.name) || /\.test\./.test(e.name)) continue;
      out.push({ nom: e.name, src: readFileSync(p, "utf8") });
    }
  };
  visiter(UI2);
  return out;
}

/** Même extraction que la garde de contrat AC-01..04 — un acte = { cle, route, champs, garde }. */
function actesDeclares() {
  const actes = [];
  for (const { nom, src } of fichiersUi2()) {
    for (const bloc of src.matchAll(/\{\s*cle:\s*"[^"]*",[\s\S]{0,1400}?garde:\s*"/g)) {
      const texte = bloc[0];
      const route = texte.match(/route:\s*"([^"]+)"/);
      if (!route) continue;
      const champsBloc = texte.match(/champs:\s*\[([\s\S]*?)\]/);
      const champs = champsBloc
        ? [...champsBloc[1].matchAll(/\{\s*cle:\s*"([^"]+)"(?:[^}]*?exemple:\s*"([^"]*)")?/g)]
          .map((m) => ({ cle: m[1], exemple: m[2] })) : [];
      actes.push({ fichier: nom, cle: texte.match(/cle:\s*"([^"]+)"/)?.[1] ?? "",
        libelle: texte.match(/libelle:\s*"([^"]+)"/)?.[1] ?? "", route: route[1], champs });
    }
  }
  return actes;
}

// ── 2. Résoudre les paramètres de route sur des données vivantes ─────────────────────────────

const entetes = () => ({ "content-type": "application/json",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) });

async function lire(route) {
  try {
    const r = await fetch(API + route, { headers: entetes() });
    const t = await r.text();
    try { return { statut: r.status, corps: JSON.parse(t) }; } catch { return { statut: r.status, corps: null }; }
  } catch { return { statut: 0, corps: null }; }
}

const liste = (v) => Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data
  : Array.isArray(v?.lignes) ? v.lignes : Array.isArray(v?.items) ? v.items : [];

/**
 * Les identifiants VIVANTS du tenant. Sans eux, chaque acte à paramètre partirait sur la
 * chaîne « :id » et rendrait un 404 qui ne dit rien du moteur — un faux défaut, le pire des
 * rapports : il fait perdre du temps sur un problème qui n'existe pas.
 */
async function identifiants() {
  const [clients, kyc, hits, cas, mros, trips] = await Promise.all([
    lire("/v1/clients"), lire("/v1/kyc"), lire("/v1/screening/hits"),
    lire("/v1/riskcases"), lire("/v1/mros"), lire("/v1/trips"),
  ]);
  const p = (r, champ = "id") => liste(r.corps)[0]?.[champ];
  return {
    clientId: p(clients), kycCode: p(kyc, "code"), hitId: p(hits), riskCaseId: p(cas),
    mrosId: p(mros), tripId: p(trips),
  };
}

/** `POST /v1/screening/hits/:id/qualify` → route concrète + méthode. */
function concretiser(route, ids) {
  const m = route.match(/^(POST|GET|PUT|PATCH|DELETE)\s+(.*)$/);
  const methode = m ? m[1] : "POST";
  let chemin = m ? m[2] : route;
  const parSegment = {
    "screening/hits": ids.hitId, riskcases: ids.riskCaseId, mros: ids.mrosId,
    clients: ids.clientId, kyc: ids.kycCode, trips: ids.tripId,
  };
  chemin = chemin.replace(/:(\w+)/g, (_, nom) => {
    for (const [prefixe, valeur] of Object.entries(parSegment))
      if (chemin.includes(`/${prefixe}/:${nom}`) && valeur) return valeur;
    return ids.clientId ?? `:${nom}`;                       // dernier recours : identifiable
  });
  return { methode, chemin };
}

// ── 3. Exécuter et CLASSER ───────────────────────────────────────────────────────────────────

const CITE_UNE_REGLE = /\bR\d{1,3}\b|\bCR-\d|\bXB-\d|\bOF-\d/;

async function executer(acte, ids) {
  const { methode, chemin } = concretiser(acte.route, ids);
  if (chemin.includes(":")) return { classe: "NON_RESOLU", detail: `paramètre non résolu : ${chemin}` };

  const corps = {};
  for (const c of acte.champs) {
    if (c.cle.startsWith(":") || c.cle === "asOf") continue;      // morceaux de route, pas de corps
    if (c.exemple !== undefined) corps[c.cle] = c.exemple;
  }
  let r, texte;
  try {
    r = await fetch(API + chemin, { method: methode, headers: entetes(),
      body: methode === "GET" ? undefined : JSON.stringify(corps) });
    texte = await r.text();
  } catch (e) { return { classe: "DEFAUT", detail: `injoignable : ${e.message}` }; }

  const message = (() => { try { return JSON.parse(texte).message ?? texte; } catch { return texte; } })();
  const msg = typeof message === "string" ? message : JSON.stringify(message);

  if (r.status >= 200 && r.status < 300) return { classe: "ACCEPTE", detail: `${r.status} ${chemin}` };
  if (r.status === 401 || r.status === 403) return { classe: "HABILITATION", detail: `${r.status} ${msg.slice(0, 120)}` };
  // Un 404 « introuvable » n'accuse PAS le moteur : il dit que le tenant n'a pas cet objet.
  // Le compter comme défaut ferait perdre du temps sur un problème qui n'existe pas — et
  // masquerait le vrai constat, qui est une lacune du SEED (E-V2-8), pas du code.
  if (r.status === 404 && /introuvable|inconnu|aucun|not found/i.test(msg))
    return { classe: "OBJET_ABSENT", detail: `404 ${msg.slice(0, 110)}` };
  if (r.status === 404 && !CITE_UNE_REGLE.test(msg))
    return { classe: "DEFAUT", detail: `404 ${methode} ${chemin} — ${msg.slice(0, 120)}` };
  if (r.status >= 500) return { classe: "DEFAUT", detail: `${r.status} ${methode} ${chemin} — ${msg.slice(0, 160)}` };
  if (CITE_UNE_REGLE.test(msg)) return { classe: "REFUS_TYPE", detail: `${r.status} ${msg.slice(0, 150)}` };
  // 4xx typé sans règle métier citée : c'est une violation de CONTRAT (identifiant mal formé,
  // champ requis absent), pas une garde métier. Elle n'a pas de numéro R et ne doit pas en
  // recevoir un d'office : inventer une règle pour faire joli au rapport serait pire que le
  // trou qu'on prétend combler.
  return { classe: "REFUS_CONTRAT", detail: `${r.status} ${msg.slice(0, 150)}` };
}

const gras = (s) => `[1m${s}[0m`;

async function principal() {
  if (!TOKEN) console.error("⚠ aucun OLIVE_TOKEN — tout répondra 401\n");
  const actes = actesDeclares();
  const ids = await identifiants();
  console.log("identifiants vivants : " + Object.entries(ids)
    .map(([k, v]) => `${k}=${v ? String(v).slice(0, 12) : "∅"}`).join(" · ") + "\n");

  const par = { ACCEPTE: [], REFUS_TYPE: [], HABILITATION: [], OBJET_ABSENT: [], REFUS_CONTRAT: [], DEFAUT: [], NON_RESOLU: [] };
  let courants = ids;
  for (const a of actes) {
    // Les identifiants sont RE-RÉSOLUS entre chaque acte : un acte qui crée un objet le rend
    // disponible au suivant, comme pour un humain qui enchaîne les écrans. Sans cela, l'ordre
    // de déclaration décidait de ce qui est testable, ce qui n'a aucun sens.
    courants = { ...ids, ...(await identifiants()) };
    const r = await executer(a, courants);
    par[r.classe].push(`${a.fichier} — ${a.libelle || a.cle} : ${r.detail}`);
  }

  const bloc = (titre, cle, glyphe) => {
    console.log(gras(`\n═ ${titre} (${par[cle].length}) ═`));
    for (const l of par[cle]) console.log(`  ${glyphe} ${l}`);
  };
  bloc("ACTES ACCEPTÉS PAR LE MOTEUR", "ACCEPTE", "✓");
  bloc("REFUS TYPÉS — la garde du moteur FONCTIONNE (ce n'est pas un échec)", "REFUS_TYPE", "⊘");
  bloc("HABILITATION — le persona n'a pas le droit (comportement, pas défaut)", "HABILITATION", "⚠");
  bloc("OBJET ABSENT — le tenant de démonstration n'a pas cet objet (lacune de SEED, pas de code)", "OBJET_ABSENT", "∅");
  bloc("REFUS DE CONTRAT — 400 typé et lisible (identifiant, champ requis) ; pas une garde métier", "REFUS_CONTRAT", "▸");
  bloc("DÉFAUTS", "DEFAUT", "✗");
  bloc("PARAMÈTRE NON RÉSOLU — aucune donnée vivante pour cet objet", "NON_RESOLU", "·");

  console.log(`\n${actes.length} actes exécutés · ${par.ACCEPTE.length} acceptés · ${par.REFUS_TYPE.length} refus typés · `
    + `${par.HABILITATION.length} habilitation · ${par.OBJET_ABSENT.length} objets absents · ${par.REFUS_CONTRAT.length} refus de contrat · `
    + `${par.DEFAUT.length} défauts · ${par.NON_RESOLU.length} non résolus`);
  process.exit(par.DEFAUT.length ? 1 : 0);
}

principal().catch((e) => { console.error(e); process.exit(2); });
