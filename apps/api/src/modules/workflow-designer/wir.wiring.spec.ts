// Harnais bloc WD — validateur R434 + schéma WIR v1 (WD-01/03/04/05/06, unitaires purs).
import * as assert from "node:assert/strict";
import { creerWir, validerWir, schemaWir } from "./wir.schema";

let passed = 0; const t = async (nom: string, fn: () => void) => { fn(); passed++; console.log("  ✓ " + nom); };
const ROLES = ["ARM", "RM", "CO", "CO_SR"];
const base = () => ({ label: "T", nodes: [
  { id: "n0", type: "start", label: "In", role: null },
  { id: "n1", type: "step", label: "Étape", role: "ARM" },
  { id: "n2", type: "end", label: "Out", role: "CO" }],
  edges: [{ from: "n0", to: "n1" }, { from: "n1", to: "n2" }] });

(async () => {
console.log("Bloc WD — WIR v1 + validateur R434 :");

await t("WD-01 schéma v1 : le WIR créé VALIDE le schéma versionné (zod strict)", () => {
  const w = creerWir(base(), { source: "image", importePar: "u" });
  assert.equal(schemaWir.safeParse(w).success, true);
  assert.equal(w.version, 1);
  assert.equal(w.meta.status, "DRAFT_AI");
});

await t("WD-12 seuil Q-WD-3 : confidence < seuil ⇒ aVerifier, rien corrigé", () => {
  const e = base(); (e.nodes[1] as any).confidence = 0.5;
  const w = creerWir(e, { source: "image", importePar: "u" }, 0.6);
  assert.equal(w.nodes[1].aVerifier, true);
  assert.equal(w.nodes[1].confidence, 0.5);
});

await t("WD-03 connexité : nœud isolé ⇒ NON_CONNEXE (listée, bloquante)", () => {
  const e = base(); e.nodes.push({ id: "n9", type: "step", label: "Perdu", role: "CO" });
  const a = validerWir(creerWir(e, { source: "t", importePar: "u" }), ROLES);
  assert.ok(a.some((x) => x.code === "NON_CONNEXE" && x.noeud === "n9" && x.bloquant));
});

await t("WD-04 initial : multiple ⇒ INITIAL_MULTIPLE · aucun ⇒ INITIAL_ABSENT", () => {
  const e = base(); e.nodes.push({ id: "n8", type: "step", label: "Bis", role: "CO" });
  e.edges.push({ from: "n8", to: "n2" });
  assert.ok(validerWir(creerWir(e, { source: "t", importePar: "u" }), ROLES)
    .some((x) => x.code === "INITIAL_MULTIPLE"));
  const e2 = base(); e2.edges.push({ from: "n2", to: "n0" });
  assert.ok(validerWir(creerWir(e2, { source: "t", importePar: "u" }), ROLES)
    .some((x) => x.code === "INITIAL_ABSENT"));
});

await t("WD-05 terminal : cycle complet ⇒ TERMINAL_ABSENT", () => {
  const e = base(); e.edges.push({ from: "n2", to: "n0" });
  assert.ok(validerWir(creerWir(e, { source: "t", importePar: "u" }), ROLES)
    .some((x) => x.code === "TERMINAL_ABSENT"));
});

await t("WD-06 rôles : hors référentiel tenant ⇒ ROLE_NON_MAPPE bloquant (nœud + rôle nommés)", () => {
  const e = base(); (e.nodes[1] as any).role = "SORCIER";
  const a = validerWir(creerWir(e, { source: "t", importePar: "u" }), ROLES);
  const x = a.find((y) => y.code === "ROLE_NON_MAPPE")!;
  assert.deepEqual({ noeud: x.noeud, role: x.role, bloquant: x.bloquant },
    { noeud: "n1", role: "SORCIER", bloquant: true });
});

console.log(`\n### ${passed}/${passed} specs WIR bloc WD verts ###`);
})().catch((e) => { console.error(e); process.exit(1); });
