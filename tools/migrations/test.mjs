// Harnais migrations — MG-01..05 (R334). Autonome (Node natif), déterministe. Verrouille le
// cadre expand/contract : expand-only, plan à vérifs obligatoires, backfill idempotent,
// aucune mutation append-only, et l'analyse RÉELLE des migrations du dépôt.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyserExpandOnly, tablesAppendOnly, analyserMutationAppendOnly,
  verifierPlan, backfillIdempotent } from "./lib.mjs";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..", "..");
let passed = 0; const t = (nom, fn) => { fn(); passed++; console.log("  ✓ " + nom); };
console.log("Migrations (R334/MG) :");

t("MG-01 expand-only : les ordres destructifs sont refusés, les additifs passent", () => {
  assert.deepEqual(analyserExpandOnly("ALTER TABLE clients ADD COLUMN note text;"), []);
  assert.deepEqual(analyserExpandOnly("CREATE TABLE t (id int); CREATE INDEX i ON t(id);"), []);
  assert.ok(analyserExpandOnly("ALTER TABLE clients DROP COLUMN note;").some((v) => v.motif === "DROP COLUMN"));
  assert.ok(analyserExpandOnly("DROP TABLE clients;").some((v) => v.motif === "DROP TABLE"));
  assert.ok(analyserExpandOnly("ALTER TABLE t ADD COLUMN x int NOT NULL;").length, "NOT NULL sans DEFAULT refusé");
  assert.deepEqual(analyserExpandOnly("ALTER TABLE t ADD COLUMN x int NOT NULL DEFAULT 0;"), []);   // avec DEFAULT : ok
});

t("MG-02 plan : les sections de vérification (pré/post/contract) sont OBLIGATOIRES", () => {
  const bon = readFileSync(join(ici, "plan-template.md"), "utf8");
  assert.deepEqual(verifierPlan(bon), [], "le gabarit lui-même porte les 3 sections");
  const mauvais = "# Plan\n## Objet\nfaire un truc\n";
  assert.ok(verifierPlan(mauvais).length >= 3, "plan sans vérif → sections manquantes signalées");
});

t("MG-03 backfill idempotent à filigrane : rejouable, jamais de doublon, reprend", () => {
  const r1 = backfillIdempotent(0, [3, 1, 2, 5, 4]);
  assert.deepEqual(r1.aTraiter, [1, 2, 3, 4, 5]);
  assert.equal(r1.nouveauFiligrane, 5);
  // Rejouer avec le nouveau filigrane ne retraite RIEN (idempotence).
  const r2 = backfillIdempotent(r1.nouveauFiligrane, [3, 1, 2, 5, 4]);
  assert.deepEqual(r2.aTraiter, []);
  assert.equal(r2.nouveauFiligrane, 5);
  // Reprise : de nouveaux ids au-delà du filigrane sont pris, les anciens non.
  const r3 = backfillIdempotent(5, [4, 5, 6, 7]);
  assert.deepEqual(r3.aTraiter, [6, 7]);
});

t("MG-04 append-only : aucune migration ne mute une table de journal (liste = source unique)", () => {
  const tablesAO = tablesAppendOnly(readFileSync(join(racine, "apps", "api", "prisma", "post-deploy-v2.sql"), "utf8"));
  assert.ok(tablesAO.has("domain_events") && tablesAO.has("transactions"), "liste extraite de post-deploy-v2");
  assert.ok(analyserMutationAppendOnly("UPDATE transactions SET x=1;", tablesAO).length, "UPDATE journal refusé");
  assert.ok(analyserMutationAppendOnly("DELETE FROM domain_events WHERE id=1;", tablesAO).length, "DELETE journal refusé");
  assert.deepEqual(analyserMutationAppendOnly("UPDATE clients SET x=1;", tablesAO), [], "UPDATE table mutable ok");
});

t("MG-05 migrations RÉELLES du dépôt : toutes expand-only, aucune mutation append-only", () => {
  const dirMig = join(racine, "apps", "api", "prisma", "migrations");
  const tablesAO = tablesAppendOnly(readFileSync(join(racine, "apps", "api", "prisma", "post-deploy-v2.sql"), "utf8"));
  let total = 0;
  for (const d of existsSync(dirMig) ? readdirSync(dirMig) : []) {
    const f = join(dirMig, d, "migration.sql");
    if (!existsSync(f)) continue;
    total++;
    const sql = readFileSync(f, "utf8");
    assert.deepEqual(analyserExpandOnly(sql), [], `${d} : ordre destructif en phase N`);
    assert.deepEqual(analyserMutationAppendOnly(sql, tablesAO), [], `${d} : mutation append-only`);
  }
  assert.ok(total >= 1, "au moins une migration analysée (la baseline)");
});

console.log(`\n### ${passed}/${passed} tests migrations verts ###`);
