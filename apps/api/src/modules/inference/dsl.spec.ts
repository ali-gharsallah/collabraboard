// Harnais P-L7-2 — DSL d'activation sûr (DS-01..14). Autonome (node:assert).
// Trois familles : expressions VALIDES (sémantique exacte), INVALIDES (rejet à la COMPILATION,
// donc au chargement du profil), et INJECTION (tout ce qui ressemble à du code est refusé —
// invariant 8 : pas d'eval, pas de résolution dynamique).
import * as assert from "node:assert/strict";
import { compilerExpression, evaluerExpression, ExpressionInvalide } from "./dsl";
import { chargerProfils, ConfigurationProfilInvalide } from "./profils.loader";
import { CaseFacts } from "./case-facts";

let passed = 0; const t = (nom: string, fn: () => void) => { fn(); passed++; console.log("  ✓ " + nom); };
console.log("Inférence P-L7-2 — DSL d'activation sûr (DS) :");

const FAITS: CaseFacts = {
  entityType: "TRUST", jurisdiction: "CH", riskLevel: "HIGH",
  relatedPersons: [
    { role: "SETTLOR", pep: true, sanctioned: false },
    { role: "TRUSTEE", pep: false, sanctioned: false },
  ],
  documents: ["FORMULAIRE_T", "PASSEPORT"],
  checks: ["SCREENING_OK"],
};
const evalue = (src: string, faits: CaseFacts = FAITS) => evaluerExpression(compilerExpression(src), faits);
const refuse = (src: string, motif?: RegExp) => {
  try { compilerExpression(src); assert.fail(`« ${src} » aurait dû être refusée à la compilation`); }
  catch (e) {
    assert.ok(e instanceof ExpressionInvalide, `ExpressionInvalide attendue pour « ${src} », reçu : ${e}`);
    if (motif) assert.ok(motif.test((e as Error).message), `motif ${motif} attendu : ${(e as Error).message}`);
  }
};

t("DS-01 comparaisons : ==, != sur attributs scalaires whitelistés", () => {
  assert.equal(evalue("entityType == 'TRUST'"), true);
  assert.equal(evalue("entityType != 'TRUST'"), false);
  assert.equal(evalue("jurisdiction == 'LI'"), false);
});

t("DS-02 and/or/not + parenthèses : précédence correcte", () => {
  assert.equal(evalue("entityType == 'TRUST' and riskLevel == 'HIGH'"), true);
  assert.equal(evalue("entityType == 'X' or riskLevel == 'HIGH'"), true);
  assert.equal(evalue("not (entityType == 'X') and not riskLevel == 'LOW'"), true);
  assert.equal(evalue("entityType == 'X' and riskLevel == 'HIGH' or jurisdiction == 'CH'"), true); // (a and b) or c
});

t("DS-03 in (littéraux) : appartenance à une liste fermée", () => {
  assert.equal(evalue("riskLevel in ('HIGH', 'CRITICAL')"), true);
  assert.equal(evalue("riskLevel in ('LOW', 'MEDIUM')"), false);
});

t("DS-04 in (collection de valeurs) : documents et checks", () => {
  assert.equal(evalue("'FORMULAIRE_T' in documents"), true);
  assert.equal(evalue("'FORMULAIRE_A' in documents"), false);
  assert.equal(evalue("'SCREENING_OK' in checks"), true);
});

t("DS-05 any() sur relatedPersons : props whitelistées, prop booléenne nue autorisée", () => {
  assert.equal(evalue("any(relatedPersons, p => p.pep)"), true);
  assert.equal(evalue("any(relatedPersons, p => p.role == 'SETTLOR' and p.pep == true)"), true);
  assert.equal(evalue("any(relatedPersons, p => p.sanctioned)"), false);
});

t("DS-06 all() sur relatedPersons", () => {
  assert.equal(evalue("all(relatedPersons, p => p.sanctioned == false)"), true);
  assert.equal(evalue("all(relatedPersons, p => p.pep)"), false);
});

t("DS-07 any/all sur liste VIDE : any → false, all → true (vérité vide, documentée)", () => {
  const vide: CaseFacts = { ...FAITS, relatedPersons: [], documents: [] };
  assert.equal(evalue("any(relatedPersons, p => p.pep)", vide), false);
  assert.equal(evalue("all(relatedPersons, p => p.sanctioned == false)", vide), true);
  assert.equal(evalue("any(documents, d => d == 'FORMULAIRE_T')", vide), false);
});

t("DS-08 quantificateur sur collection de valeurs : la variable EST la valeur", () => {
  assert.equal(evalue("any(documents, d => d == 'PASSEPORT')"), true);
  refuse("any(documents, d => d.role == 'X')", /valeur simple/);   // pas de propriété sur une string
});

t("DS-09 attribut hors whitelist : rejeté à la COMPILATION avec l'attendu", () => {
  refuse("statutPep == true", /hors whitelist/);
  refuse("tenantId == 'x'", /hors whitelist/);
});

t("DS-10 propriété hors whitelist d'une variable : rejetée", () => {
  refuse("any(relatedPersons, p => p.motDePasse == 'x')", /hors whitelist de relatedPersons/);
  refuse("any(relatedPersons, p => p.constructor == 'x')", /hors whitelist/);   // anti-prototype
});

t("DS-11 INJECTION : tout caractère/construction de code est refusé", () => {
  refuse("entityType == 'X'; process.exit(1)", /caractère interdit/);
  refuse("__proto__ == 'x'", /hors whitelist/);
  refuse("entityType == `TRUST`", /caractère interdit/);
  refuse("entityType == 'X' + 'Y'", /caractère interdit/);
  refuse("eval('1')", /variable|collection|whitelist|attendu/);
  refuse("entityType['constructor'] == 'x'", /caractère interdit/);
});

t("DS-12 malformations : chaîne non fermée, opérateur pendu, séquence après la fin", () => {
  refuse("entityType == 'TRUST", /chaîne non fermée/);
  refuse("entityType ==", /valeur attendue/);
  refuse("entityType == 'X' entityType", /séquence inattendue/);
  refuse("", /expression vide/);
  refuse("any(relatedPersons, entityType => entityType.pep)", /masque un attribut/);
});

t("DS-13 valeur nue non booléenne : refusée (un scalaire n'est pas une condition)", () => {
  refuse("entityType", /valeur nue n'est pas un booléen/);
  refuse("riskLevel and entityType == 'X'", /valeur nue/);
});

t("DS-14 chargeur (P-L7-1×P-L7-2) : un when invalide est refusé AU CHARGEMENT, chemin exact", () => {
  const yaml = `
profils:
  - profil: trust-ch
    entityType: TRUST
    jurisdiction: CH
    requirements:
      - id: REQ-1
        kind: document
        basis: "CDB 20"
        severity: bloquant
        params: {}
        when: "champInconnu == 'x'"
`;
  try { chargerProfils(yaml); assert.fail("aurait dû refuser"); }
  catch (e) {
    assert.ok(e instanceof ConfigurationProfilInvalide);
    const err = (e as ConfigurationProfilInvalide).erreurs;
    assert.ok(err.some((x) => x.chemin === "profils.0.requirements.0.when" && /hors whitelist/.test(x.message)),
      `chemin when attendu, reçu : ${JSON.stringify(err)}`);
  }
});

console.log(`\n### ${passed}/${passed} specs DSL P-L7-2 verts ###`);
