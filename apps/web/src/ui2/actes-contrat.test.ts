import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * GARDE DE CONTRAT ENTRE L'ÉCRAN ET LE MOTEUR (V2-M39).
 *
 * POURQUOI ELLE EXISTE. Aux lots V2-M36/M37 j'ai déclaré, pour chaque acte, « les champs que
 * le moteur exige — ceux du contrôleur, pas une invention d'écran ». C'était faux pour SIX
 * actes sur vingt et un : `courseId` au lieu de `formationCode`, `dueDate` au lieu de
 * `echeance`, `depuis`/`jusqu` là où l'export attend `aggregateId`/`type`, `riskCaseId` et
 * `pieces` oubliés sur la décision MROS, `reverseSolicitation` au lieu de
 * `qualificationInitiativeClient`, `objetId` manquant sur le pré-acte — sans lui le verdict
 * n'est pas consigné.
 *
 * Ces erreurs ne se voient pas en mode démonstration : le moteur n'est pas là pour refuser.
 * Elles se seraient vues le jour du branchement, une par une, en production de démonstration.
 * Une affirmation qui n'est pas vérifiée par un test n'est pas une garantie, c'est un vœu.
 *
 * CE QUE LA GARDE VÉRIFIE, en lisant les DEUX côtés :
 *   1. toute route d'acte déclarée dans `src/ui2` existe dans un contrôleur de `apps/api` ;
 *   2. tout champ déclaré est effectivement lu par le moteur — soit dans le corps du
 *      contrôleur (`b?.champ`), soit dans le type du DTO du service.
 *
 * Elle lit le code du moteur, pas une copie : le jour où une route est renommée côté API,
 * c'est ce test qui rougit, pas un utilisateur.
 */

const RACINE_API = join(process.cwd(), "..", "api", "src", "modules");
const RACINE_UI2 = join(process.cwd(), "src", "ui2");

type RouteMoteur = { methode: string; chemin: string; clesCorps: Set<string> };

/** Parcourt récursivement un dossier et rend le contenu des fichiers TypeScript. */
function fichiersTs(racine: string): { nom: string; src: string }[] {
  const out: { nom: string; src: string }[] = [];
  const visiter = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { visiter(p); continue; }
      if (!/\.tsx?$/.test(e.name)) continue;
      out.push({ nom: e.name, src: readFileSync(p, "utf8") });
    }
  };
  visiter(racine);
  return out;
}

/**
 * Extrait les routes du moteur. Un contrôleur Nest déclare son préfixe (`@Controller("x")`)
 * puis ses routes (`@Post("y")`). Les clés du corps se lisent à deux endroits : en ligne dans
 * le contrôleur (`b?.motif`) et dans le type du DTO du service (`dto: { a: T; b?: T }`).
 */
function routesDuMoteur(): RouteMoteur[] {
  const routes: RouteMoteur[] = [];
  const fichiers = fichiersTs(RACINE_API);
  const tousLesServices = fichiers.map((f) => f.src).join("\n");

  for (const { src } of fichiers) {
    const prefixes = [...src.matchAll(/@Controller\("([^"]*)"\)/g)].map((m) => m[1]);
    if (!prefixes.length) continue;
    for (const ligne of src.split("\n")) {
      const m = ligne.match(/@(Post|Get|Put|Patch|Delete)\("?([^")]*)"?\)/);
      if (!m) continue;
      const [, verbe, sousChemin] = m;
      // clés lues en ligne dans le contrôleur : b?.cle / body.cle
      const clesCorps = new Set<string>(
        [...ligne.matchAll(/\bb\??\.(\w+)/g)].map((x) => x[1]));
      // clés du DTO du service appelé sur cette ligne
      const appel = ligne.match(/this\.\w+\.(\w+)\(/);
      if (appel) {
        const nomMethode = appel[1];
        const motif = new RegExp(`async\\s+${nomMethode}\\s*\\([^)]*?dto\\s*:\\s*\\{([^}]*)\\}`, "s");
        // On cherche le service D'ABORD dans le module courant : deux modules peuvent porter
        // une méthode de même nom (`proposer` existe en veille ET en gouvernance), et prendre
        // la mauvaise fait accuser l'écran de champs qu'il déclare correctement.
        const sig = src.match(motif) ?? tousLesServices.match(motif);
        if (sig) for (const c of sig[1].matchAll(/(\w+)\??\s*:/g)) clesCorps.add(c[1]);
      }
      for (const prefixe of prefixes) {
        const chemin = [prefixe, sousChemin].filter(Boolean).join("/").replace(/\/+/g, "/");
        routes.push({ methode: verbe.toUpperCase(), chemin, clesCorps });
      }
    }
  }
  return routes;
}

/** Les actes déclarés par les écrans v2 — route, méthode, champs. */
function actesDeclares(): { fichier: string; route: string; methode: string; champs: string[] }[] {
  const actes: { fichier: string; route: string; methode: string; champs: string[] }[] = [];
  for (const { nom, src } of fichiersTs(RACINE_UI2)) {
    if (nom.endsWith(".test.ts") || nom.endsWith(".test.tsx")) continue;
    // Un acte = un objet littéral portant `route:` et `garde:`.
    for (const bloc of src.matchAll(/\{\s*cle:\s*"[^"]*",[\s\S]{0,1400}?garde:\s*"/g)) {
      const texte = bloc[0];
      const route = texte.match(/route:\s*"([^"]+)"/);
      if (!route) continue;
      const methode = texte.match(/methode:\s*"(POST|GET)"/);
      // Les champs se lisent DANS le tableau `champs: [...]` — pas ailleurs : l'acte lui-même
      // porte un `cle:` suivi d'un `libelle:`, et le confondre avec un champ faisait accuser
      // le moteur de ne pas lire une clé qui n'a jamais été un champ.
      const bloc2 = texte.match(/champs:\s*\[([\s\S]*?)\]/);
      const champs = bloc2
        ? [...bloc2[1].matchAll(/\{\s*cle:\s*"([^"]+)"/g)].map((m) => m[1]) : [];
      actes.push({ fichier: nom, route: route[1], methode: methode?.[1] ?? "", champs });
    }
  }
  return actes;
}

/** `/v1/crossborder/derogations/:id/visa` → `crossborder/derogations/:id/visa` */
const normaliser = (r: string) => r.replace(/^(POST|GET)\s+/, "").replace(/^\/v1\//, "")
  .replace(/\?.*$/, "").replace(/^\//, "");

/** Compare deux chemins en traitant les segments `:param` comme des jokers. */
function memeChemin(a: string, b: string): boolean {
  const sa = a.split("/"), sb = b.split("/");
  if (sa.length !== sb.length) return false;
  return sa.every((s, i) => s === sb[i] || s.startsWith(":") || sb[i].startsWith(":"));
}

/** Les LECTURES déclarées par les écrans : `useApiOrSeed<T>("route", SEED)`. */
function lecturesDeclarees(): { fichier: string; route: string }[] {
  const out: { fichier: string; route: string }[] = [];
  for (const { nom, src } of fichiersTs(RACINE_UI2)) {
    if (/\.test\./.test(nom)) continue;
    for (const m of src.matchAll(/useApiOrSeed<[^>]*>\(\s*"([^"]+)"/g))
      out.push({ fichier: nom, route: m[1] });
  }
  return out;
}

describe("Contrat écran ↔ moteur (V2-M39)", () => {
  const routes = routesDuMoteur();
  const actes = actesDeclares();

  it("AC-01 le moteur est bien lu : les routes des contrôleurs sont extraites", () => {
    // Garde de la garde : si l'extraction casse (refactor, renommage de dossier), les deux
    // tests suivants passeraient à vide et ne garantiraient plus rien.
    expect(routes.length).toBeGreaterThan(50);
    expect(actes.length).toBeGreaterThanOrEqual(20);
  });

  it("AC-02 toute route d'acte déclarée à l'écran EXISTE au moteur", () => {
    const orphelines = actes.filter((a) => {
      const chemin = normaliser(a.route);
      const methode = a.methode || (a.route.startsWith("GET") ? "GET" : "POST");
      return !routes.some((r) => r.methode === methode && memeChemin(r.chemin, chemin));
    }).map((a) => `${a.fichier} — ${a.route}`);
    expect(orphelines).toEqual([]);
  });

  it("AC-03 tout champ déclaré est effectivement LU par le moteur", () => {
    // `:id`, `:empreinte` et `asOf` sont des morceaux de route, pas des clés de corps.
    const DANS_LA_ROUTE = [":id", ":empreinte", "asOf"];
    const inconnus: string[] = [];
    for (const a of actes) {
      if ((a.methode || "POST") !== "POST") continue;
      const chemin = normaliser(a.route);
      const r = routes.find((x) => x.methode === "POST" && memeChemin(x.chemin, chemin));
      if (!r || r.clesCorps.size === 0) continue;      // corps non typé : rien à comparer
      for (const c of a.champs) {
        if (DANS_LA_ROUTE.includes(c)) continue;
        if (!r.clesCorps.has(c)) inconnus.push(`${a.fichier} — ${a.route} : « ${c} » n'est lu nulle part (le moteur lit ${[...r.clesCorps].join(", ")})`);
      }
    }
    expect(inconnus).toEqual([]);
  });

  it("AC-04 toute LECTURE déclarée existe au moteur EN GET — un GET manquant retombe sur le seed en silence", () => {
    // Trouvé par cette garde : `/v1/bi/annuaire` n'était exposé qu'en POST. L'écran le
    // demandait en GET, recevait une erreur, et `apiGetSourced` retombait sur le seed. Le
    // bandeau « données maquette » disait vrai mais taisait la CAUSE — c'est la pire forme
    // d'honnêteté : exacte et inutile. Le GET a été ajouté au moteur (V2-M40).
    const lectures = lecturesDeclarees();
    expect(lectures.length).toBeGreaterThanOrEqual(25);
    const introuvables = lectures.filter((l) => {
      const chemin = normaliser(l.route);
      return !routes.some((r) => r.methode === "GET" && memeChemin(r.chemin, chemin));
    }).map((l) => `${l.fichier} — ${l.route}`);
    expect(introuvables).toEqual([]);
  });

  it("AC-05 un acte POST dont le moteur LIT un corps doit déclarer au moins un champ", () => {
    // Trouvé par l'EXÉCUTION, pas par la lecture (V2-M44) : « Modifier un paramètre §CrossBorder »
    // ne déclarait aucun champ. Le bouton existait, le formulaire était vide, et le moteur
    // refusait « cle attendue ». AC-03 ne pouvait pas le voir — elle vérifie que les champs
    // DÉCLARÉS sont lus, jamais que ce que le moteur EXIGE est déclaré. Cette garde couvre le
    // cas extrême et vérifiable statiquement : zéro champ face à un contrôleur qui lit un corps.
    const muets = actes.filter((a) => {
      if ((a.methode || "POST") !== "POST" || a.champs.length) return false;
      const chemin = normaliser(a.route);
      const r = routes.find((x) => x.methode === "POST" && memeChemin(x.chemin, chemin));
      return !!r && r.clesCorps.size > 0;                 // le moteur attend un corps, l'écran n'en propose pas
    }).map((a) => `${a.fichier} — ${a.route} : le moteur lit un corps, l'acte ne déclare aucun champ`);
    expect(muets).toEqual([]);
  });

  // CE QUE CES GARDES NE VÉRIFIENT PAS, et qu'il ne faut pas croire vérifié : la FORME des
  // réponses. Un seed peut avoir les bonnes clés et le moteur en renvoyer d'autres — seule une
  // API vivante le dirait. Ces gardes couvrent le contrat d'APPEL (route, verbe, champs
  // envoyés), pas le contrat de RETOUR.
});
