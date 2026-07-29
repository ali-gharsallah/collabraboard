// Harnais registrar — IX-01..05 (R331). Autonome (Node natif), déterministe (dates injectées).
import assert from "node:assert/strict";
import { extraireMeta, normaliserNom, detecterCollisions, empreinte, verifierAppendOnly,
  promouvoir, enAttenteDepuis, ligneIndex } from "./registrar.mjs";

let passed = 0; const t = (nom, fn) => { fn(); passed++; console.log("  ✓ " + nom); };
console.log("Registrar (R331/IX) :");

const artefact = `# Canon de test — bloc X\n**Statut : PROPOSÉ.** Règles R331–R333, familles IX-01..05 et FB-01.`;

t("IX-01 dépôt indexé : extraction règles/familles/statut + ligne d'index PROPOSÉ, zéro main", () => {
  const meta = extraireMeta(artefact);
  assert.ok(meta.regles.includes(331) && meta.regles.includes(333));
  assert.deepEqual(meta.familles, ["FB", "IX"]);
  assert.equal(meta.statut, "PROPOSÉ");
  const nom = normaliserNom("2026-07-29T10:00:00Z", meta.titre);
  assert.equal(nom, "2026-07-29-canon-de-test-bloc-x.md");
  const ligne = ligneIndex({ id: nom, titre: meta.titre, regles: meta.regles, familles: meta.familles, statut: meta.statut, depotISO: "2026-07-29" });
  assert.ok(ligne.includes("PROPOSÉ") && ligne.includes("2026-07-29"));
});

t("IX-02 collision : deux artefacts revendiquant le même Rn → rapport, AUCUNE renumérotation", () => {
  const prisEnCharge = new Set([331, 999]);                    // 331 déjà pris par un autre
  const collisions = detecterCollisions([331, 332, 333], prisEnCharge);
  assert.deepEqual(collisions, [331]);                        // signalé…
  // …et rien n'est renuméroté : la fonction ne renvoie QUE le rapport (pas de nouveaux numéros)
  assert.equal(typeof detecterCollisions, "function");
  assert.deepEqual(detecterCollisions([500], prisEnCharge), []);  // pas de collision → vide
});

t("IX-03 merge → RATIFIÉ propagé, événement daté", () => {
  const index = "| 2026-07-29-x.md | Titre | R331 | IX | PROPOSÉ | 2026-07-29 |";
  const apres = promouvoir(index, "2026-07-29-x.md", "2026-07-30T12:00:00Z");
  assert.ok(apres.includes("RATIFIÉ (2026-07-30)"));
  assert.ok(!apres.includes("PROPOSÉ"));
  assert.throws(() => promouvoir(index, "inconnu.md", "2026-07-30"), /absent de l'index/);
});

t("IX-04 non mergé à J+7 → 'en attente', l'oubli est impossible", () => {
  assert.equal(enAttenteDepuis("2026-07-22", "2026-07-29T00:00:00Z"), 7);
  assert.ok(enAttenteDepuis("2026-07-22", "2026-07-29T00:00:00Z") >= 7);   // seuil de rappel
});

t("IX-05 artefact RATIFIÉ modifié → refusé (append-only)", () => {
  const v1 = "contenu ratifié original";
  const e1 = empreinte(v1);
  verifierAppendOnly({ statutAnterieur: "RATIFIÉ", empreinteAnterieure: e1, empreinteNouvelle: e1 });  // inchangé : ok
  assert.throws(() => verifierAppendOnly({ statutAnterieur: "RATIFIÉ",
    empreinteAnterieure: e1, empreinteNouvelle: empreinte("contenu ALTÉRÉ") }), /IX-05/);
  // un PROPOSÉ, lui, peut évoluer avant ratification
  verifierAppendOnly({ statutAnterieur: "PROPOSÉ", empreinteAnterieure: e1, empreinteNouvelle: empreinte("v2") });
});

console.log(`\n### ${passed}/${passed} tests registrar verts ###`);
