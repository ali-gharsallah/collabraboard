// Harnais générateur CANON-MASTER — GC-01..06. Autonome (Node natif), déterministe (aucune I/O
// réelle : fixtures en mémoire). Prouve que le document faisant foi est ASSEMBLÉ depuis le repo,
// que les anomalies sont RAPPORTÉES (jamais corrigées) et que le mapping n'est JAMAIS déduit.
import assert from "node:assert/strict";
import { indexerArtefacts, lierFamillesSuites, extraireRQ, lireSeed, lireExceptions, detecterAnomalies,
  comparerSession, extraireSection, resumerPlages, assembler, normaliserPourCheck,
  blocStamp, stampCourant, injecterStamp } from "./generate.mjs";

let passed = 0; const t = (nom, fn) => { fn(); passed++; console.log("  ✓ " + nom); };
console.log("Générateur CANON-MASTER (GC) :");

const artefacts = [
  { chemin: "spec/canon-industrialisation-R331-R334.md",
    contenu: "# Canon industrialisation\n**Statut : RATIFIÉ.** Règles R331–R334, familles IX-01..05, FB-01..04, MG-01..05." },
  { chemin: "spec/canon-robustesse-v2.md",
    contenu: "# Canon robustesse v2\n**Statut : RATIFIÉ.** R335–R339, familles RB-01..05, LK-01, EV-01, PJ-01, ZZ-09." },
];

t("GC-01 inventaire : chaque artefact → règles/familles/statut/titre, trié par 1re règle", () => {
  const idx = indexerArtefacts(artefacts);
  assert.equal(idx[0].chemin, "spec/canon-industrialisation-R331-R334.md");   // R331 < R335
  assert.deepEqual(idx[0].regles, [331, 332, 333, 334]);
  assert.ok(idx[0].familles.includes("IX") && idx[0].familles.includes("MG"));
  assert.equal(idx[0].statut, "RATIFIÉ");
  assert.ok(idx[1].familles.includes("RB") && idx[1].familles.includes("PJ"));
});

t("GC-02 seed : SEULE la section 1 « CONFIRMÉS » est consommée (jamais À CONFIRMER / DIVERGENCES)", () => {
  const seedMd = [
    "# Mapping", "## 1. Mappings CONFIRMÉS",
    "| Session | Repo | Objet | Familles | Preuve |",
    "|--|--|--|--|--|",
    "| R325 | R328 | Clôture JWT | JW-01..06 | x |",
    "| R222 | R248 | Porte CPSI | PC-01..14 | y |",
    "## 2. À CONFIRMER",
    "| R253 | R253 | Olivia | — |",           // NE DOIT PAS être lu
  ].join("\n");
  const seed = lireSeed(seedMd);
  assert.equal(seed.length, 2);
  assert.deepEqual(seed.map((s) => s.session), ["R325", "R222"]);
  assert.ok(!seed.some((s) => s.session === "R253"));     // section 2 ignorée
});

t("GC-03 liaison famille→suite : présente si une suite contient la famille, vide sinon", () => {
  const tests = [
    { chemin: "apps/api/test/e2e/optimistic-lock.e2e-spec.ts", contenu: "it('LK-02 ...')" },
    { chemin: "apps/api/test/e2e/idempotency.e2e-spec.ts", contenu: "it('IDM-04 ...')" },
  ];
  const liens = lierFamillesSuites(["LK", "IDM", "ZZ"], tests);
  assert.deepEqual(liens.LK, ["apps/api/test/e2e/optimistic-lock.e2e-spec.ts"]);
  assert.deepEqual(liens.IDM, ["apps/api/test/e2e/idempotency.e2e-spec.ts"]);
  assert.deepEqual(liens.ZZ, []);                          // aucune suite → sera une anomalie
});

t("GC-04 anomalies RAPPORTÉES, jamais corrigées : doublon divergent · famille sans suite · règle sans scénario · trous", () => {
  const idx = indexerArtefacts([
    { chemin: "canon-R10-R11-a.md", contenu: "# A\nR10 R11, familles AA-01." },
    { chemin: "canon-R10-b.md", contenu: "# B différent\nR10, familles BB-01." }, // possède R10 aussi, titre divergent
    { chemin: "canon-R13-c.md", contenu: "# C\nR13." },                            // règle SANS famille
  ]);
  const liens = lierFamillesSuites(["AA", "BB"], [{ chemin: "t.ts", contenu: "AA-01" }]);
  const a = detecterAnomalies(idx, liens);
  assert.ok(a.doublons.some((d) => d.numero === 10));      // doublon signalé
  assert.deepEqual(a.famillesSansSuite, ["BB"]);           // BB sans suite
  assert.ok(a.reglesSansScenario.some((r) => r.chemin === "canon-R13-c.md"));  // R13 sans scénario
  assert.ok(a.numerosAbsents.includes(12));                // trou R12 dans [1..13]
  assert.equal(a.maxRegle, 13);
});

t("GC-05 divergences session↔repo : mapping JAMAIS déduit ; hors seed = testé en identité et signalé", () => {
  const ref = "R325 fait la clôture ; R999 n'existe nulle part.";
  const seed = lireSeed("## 1. Mappings CONFIRMÉS\n|s|r|o|f|p|\n|-|-|-|-|-|\n| R325 | R328 | JWT | — | x |\n## 2.");
  const c = comparerSession(ref, seed, /* reglesRepo */ [328]);   // R328 présent (mappé), R999 absent
  assert.equal(c.divergences.length, 1);
  assert.equal(c.divergences[0].session, 999);
  assert.equal(c.divergences[0].mappe, false);             // hors seed : non mappé, signalé
});

t("GC-06 assemblage : anomalies EN TÊTE + toutes les sections a–f + invariants verbatim + normalisation CI", () => {
  const idx = indexerArtefacts(artefacts);
  const liens = lierFamillesSuites(["IX", "RB"], [{ chemin: "apps/api/x.spec.ts", contenu: "RB-01" }]);
  const seed = lireSeed("## 1. Mappings CONFIRMÉS\n|s|r|o|f|p|\n|-|-|-|-|-|\n| R325 | R328 | JWT | JW | x |\n## 2.");
  const anomalies = detecterAnomalies(idx, liens);
  const comparaison = comparerSession("R331 R335 R999", seed, [331, 335]);
  const invariants = extraireSection("# 3. LES INVARIANTS\n1. Rien ne change par effet de bord.\n# 4. SUITE", "3");
  const md = assembler({ dateISO: "2026-07-29", commit: "abc1234", artefacts: idx, liens,
    rq: extraireRQ("**R4** Qui valide ?   Visa\n**R5** Délais ?   SLA"),
    seed, anomalies, comparaison, invariantsVerbatim: invariants,
    gelsVerbatim: "K8s/Kafka : ≥25 tenants / >1M évts/j.", ecransResume: "72/72 (67+4+1)." });
  // anomalies AVANT le mapping (en tête)
  assert.ok(md.indexOf("Rapport d'anomalies") < md.indexOf("Mapping session → repo"));
  for (const h of ["a) Mapping", "b) Inventaire", "c) Paramètres tenant R-Q", "d) Écrans",
    "e) Gels", "f) Invariants"]) assert.ok(md.includes(h), "section absente : " + h);
  assert.ok(md.includes("Rien ne change par effet de bord"));   // invariants verbatim
  assert.ok(resumerPlages([331, 332, 333, 334]).includes("R331–R334"));
  // normalisation CI : l'en-tête VOLATIL (ligne « Généré le … commit … ») disparaît → diff stable.
  // (La date dans le nom de fichier de référence est stable, elle, et n'a pas à disparaître.)
  const norm = normaliserPourCheck(md);
  assert.ok(!norm.includes("> **Généré le"));      // la ligne volatile (date + hash) est retirée
  assert.ok(!norm.includes("abc1234"));            // aucun hash de commit ne subsiste → diff stable
});

t("GC-07 exceptions DOCUMENTÉES reclassées (jamais masquées) : erratum ≠ collision · histo hors couverture · réserve ≠ trou · placeholder ≠ coquille", () => {
  const exMd = [
    "# Exceptions",
    "## Motifs ERRATA", "- `erratum-`",
    "## Motifs HISTORIQUE", "- `catalogue-patch-`",
    "## Numéros RÉSERVÉS", "| Numéro | Motif | Référence |", "|--|--|--|", "| R247 | Read-model CAS B non applicable | ECARTS §A3 |",
    "## Numéros PLACEHOLDER", "| Numéro | Motif | Référence |", "|--|--|--|", "| R999 | Test négatif OL-14 | home-olivia |",
  ].join("\n");
  const ex = lireExceptions(exMd);
  assert.deepEqual(ex.errata, ["erratum-"]);
  assert.deepEqual(ex.historique, ["catalogue-patch-"]);
  assert.equal(ex.reserves[0].numero, 247);
  assert.equal(ex.placeholders[0].numero, 999);

  const idx = indexerArtefacts([
    { chemin: "canon-R119-onboarding.md", contenu: "# Onboarding\nR119." },
    { chemin: "erratum-R119-validated.md", contenu: "# Erratum R119 différent\nR119." },  // erratum : PAS une collision
    { chemin: "catalogue-patch-v4.9.md", contenu: "# Patch\nR40, DB-01." },               // histo : DB hors couverture
    { chemin: "canon-R248-porte.md", contenu: "# Porte\nR248, familles PC-01." },         // R247 = trou → réservé
  ]);
  const liens = lierFamillesSuites(["PC"], [{ chemin: "t.ts", contenu: "PC-01" }]);       // DB exclu en amont (histo)
  const a = detecterAnomalies(idx, liens, ex);
  assert.equal(a.doublons.length, 0);                                  // erratum ne collisionne pas
  assert.ok(!a.numerosAbsents.includes(247));                          // R247 réservé, pas un trou
  assert.ok(!(a.numerosHorsPlage ?? []).includes(999));                // R999 placeholder, pas une coquille
  assert.ok(a.exceptions.reserves.some((r) => r.numero === 247));      // mais TRACÉ dans les cas connus
});

t("GC-08 stamp de fraîcheur : injecté entre marqueurs, stable, détecté périmé (garde no-drift prose)", () => {
  const bloc = blocStamp({ maxR: 339, nArtefacts: 96, nFamilles: 101, lien: "docs/CANON-MASTER.md" });
  assert.ok(bloc.includes("R1–R339") && bloc.includes("96 artefacts") && bloc.includes("101 familles"));
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(bloc), "stamp STABLE : pas de date (sinon churn par commit)");
  const doc = "# Titre\n<!-- CANON-STAMP:START -->\nvieux\n<!-- CANON-STAMP:END -->\ncorps";
  const out = injecterStamp(doc, bloc);
  assert.equal(stampCourant(out), bloc);                       // le bloc a remplacé l'ancien
  assert.ok(out.includes("# Titre") && out.includes("corps")); // la prose autour est intacte
  assert.equal(injecterStamp("# sans marqueurs", bloc), null); // marqueurs absents → non stampé
  const perime = blocStamp({ maxR: 206, nArtefacts: 96, nFamilles: 101, lien: "docs/CANON-MASTER.md" });
  assert.notEqual(stampCourant(out), perime);                  // un plafond périmé (R206) est détecté
});

console.log(`\n### ${passed}/${passed} tests canon-master verts ###`);
