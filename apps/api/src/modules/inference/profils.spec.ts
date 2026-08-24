// Harnais P-L7-1 — modèle Requirements + chargeur YAML strict + résolveur de profil (IN-01..11).
// Autonome (node:assert), TDD : les erreurs de CONFIG sont des cas de première classe — un champ
// inconnu, un kind hors liste ou un id dupliqué doivent échouer AVEC LE CHEMIN du champ fautif.
import * as assert from "node:assert/strict";
import { chargerProfils, ConfigurationProfilInvalide } from "./profils.loader";
import { resoudreProfil, ProfilIntrouvable } from "./profils.resolver";

let passed = 0; const t = (nom: string, fn: () => void) => { fn(); passed++; console.log("  ✓ " + nom); };
console.log("Inférence P-L7-1 — profils Requirements (IN) :");

const YAML_VALIDE = `
profils:
  - profil: trust-ch
    entityType: TRUST
    jurisdiction: CH
    requirements:
      - id: REQ-T-01
        kind: document
        basis: "CDB 20 art. 41 · R26"
        severity: bloquant
        params: { document: FORMULAIRE_T, validiteJours: 365 }
      - id: REQ-T-02
        kind: approval
        basis: "OBA-FINMA · R14"
        severity: bloquant
        params: { role: CO, section: FINAL }
        when: "riskLevel == 'HIGH'"
  - profil: trust-defaut
    entityType: TRUST
    jurisdiction: "*"
    requirements:
      - id: REQ-T-01
        kind: document
        basis: "CDB 20 art. 41 · R26"
        severity: bloquant
        params: { document: FORMULAIRE_T }
  - profil: pp-ch
    entityType: INDIVIDUAL
    jurisdiction: CH
    requirements:
      - id: REQ-P-01
        kind: check
        basis: "LBA art. 6 · R100"
        severity: non_bloquant
        params: { source: screening }
`;

const attendErreur = (yaml: string, cheminAttendu: string, motMessage?: RegExp) => {
  try { chargerProfils(yaml); assert.fail("aurait dû refuser"); }
  catch (e) {
    assert.ok(e instanceof ConfigurationProfilInvalide, `erreur typée attendue, reçu : ${e}`);
    const err = (e as ConfigurationProfilInvalide).erreurs;
    assert.ok(err.some((x) => x.chemin === cheminAttendu),
      `chemin « ${cheminAttendu} » attendu, reçu : ${err.map((x) => x.chemin).join(" | ")}`);
    if (motMessage) assert.ok(err.some((x) => motMessage.test(x.message)), `message ${motMessage} attendu`);
  }
};

t("IN-01 chargement valide : 3 profils, champs conformes, params et when portés tels quels", () => {
  const p = chargerProfils(YAML_VALIDE);
  assert.equal(p.length, 3);
  assert.deepEqual(p[0].requirements[0].params, { document: "FORMULAIRE_T", validiteJours: 365 });
  assert.equal(p[0].requirements[1].when, "riskLevel == 'HIGH'");   // chaîne OPAQUE (DSL en P-L7-2)
  assert.equal(p[2].requirements[0].severity, "non_bloquant");
});

t("IN-02 champ inconnu à la RACINE d'un profil : refus avec le chemin exact", () => {
  attendErreur(YAML_VALIDE.replace("entityType: INDIVIDUAL", "entityType: INDIVIDUAL\n    juridiction: CH"),
    "profils.2", /inconnu.*juridiction/);
});

t("IN-03 champ inconnu dans un REQUIREMENT : refus avec le chemin indexé", () => {
  attendErreur(YAML_VALIDE.replace("params: { role: CO, section: FINAL }",
    "params: { role: CO }\n        severty: bloquant"),
    "profils.0.requirements.1", /inconnu.*severty/);
});

t("IN-04 kind hors liste : refus avec le chemin du champ", () => {
  attendErreur(YAML_VALIDE.replace("kind: check", "kind: verification"),
    "profils.2.requirements.0.kind");
});

t("IN-05 severity hors liste : refus avec le chemin du champ", () => {
  attendErreur(YAML_VALIDE.replace("severity: non_bloquant", "severity: critique"),
    "profils.2.requirements.0.severity");
});

t("IN-06 id de requirement DUPLIQUÉ dans un profil : refus nominatif", () => {
  attendErreur(YAML_VALIDE.replace("id: REQ-T-02", "id: REQ-T-01"),
    "profils.0.requirements.1.id", /dupliqué.*REQ-T-01/);
});

t("IN-07 profil DUPLIQUÉ pour un même (entityType, jurisdiction) : refus", () => {
  attendErreur(YAML_VALIDE.replace("profil: pp-ch\n    entityType: INDIVIDUAL", "profil: trust-ch-bis\n    entityType: TRUST"),
    "profils.2", /dupliqué|déjà défini/);
});

t("IN-08 YAML illisible : erreur typée, jamais une exception brute du parseur", () => {
  try { chargerProfils("profils:\n  - profil: [non fermé"); assert.fail("aurait dû refuser"); }
  catch (e) {
    assert.ok(e instanceof ConfigurationProfilInvalide);
    assert.ok((e as ConfigurationProfilInvalide).erreurs[0].chemin === "(document)");
  }
});

t("IN-09 résolveur : correspondance EXACTE (TRUST, CH) → trust-ch", () => {
  const p = chargerProfils(YAML_VALIDE);
  assert.equal(resoudreProfil(p, { entityType: "TRUST", jurisdiction: "CH" }).profil, "trust-ch");
});

t("IN-10 résolveur : repli de JURIDICTION (TRUST, LI) → trust-defaut (« * ») — jamais un autre entityType", () => {
  const p = chargerProfils(YAML_VALIDE);
  assert.equal(resoudreProfil(p, { entityType: "TRUST", jurisdiction: "LI" }).profil, "trust-defaut");
  // INDIVIDUAL n'a PAS de profil « * » : une juridiction inconnue doit échouer, pas hériter du trust.
  assert.throws(() => resoudreProfil(p, { entityType: "INDIVIDUAL", jurisdiction: "LI" }), ProfilIntrouvable);
});

t("IN-11 résolveur : aucun profil pour l'entityType → erreur franche nominative", () => {
  const p = chargerProfils(YAML_VALIDE);
  assert.throws(() => resoudreProfil(p, { entityType: "FOUNDATION", jurisdiction: "CH" }),
    /aucun CompletionProfile pour \(FOUNDATION, CH\)/);
});

console.log(`\n### ${passed}/${passed} specs inférence P-L7-1 verts ###`);
