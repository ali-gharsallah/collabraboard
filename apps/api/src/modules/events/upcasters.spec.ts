// Harnais upcasting — EV-02/EV-03 (Bloc E, R339/EV). Autonome (node:assert). Prouve que les
// événements historiques (fixtures figées) restent LISIBLES et que la chaîne d'upcasters marche.
import * as assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { deserialiser, enregistrerUpcaster, versionCible, _reinitRegistre } from "./upcasters";

let passed = 0; const t = (nom: string, fn: () => void) => { fn(); passed++; console.log("  ✓ " + nom); };
console.log("Upcasting événements (R339/EV) :");

t("EV-02 fixtures legacy : chaque payload v1 figé se désérialise sans erreur (aucune fixture modifiée)", () => {
  _reinitRegistre();                                                // registre vide : v1 passe tel quel
  const dir = join(process.cwd(), "test", "fixtures", "legacy_events");  // cwd = apps/api (harnais)
  const fichiers = readdirSync(dir).filter((f) => f.endsWith(".json"));
  assert.ok(fichiers.length >= 3, "des fixtures legacy existent");
  for (const f of fichiers) {
    const evt = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const out = deserialiser(evt);
    assert.equal(out.type, evt.type);
    assert.ok(out.version >= 1);
    assert.ok(out.payload && typeof out.payload === "object");      // lisible
  }
});

t("EV-03 chaîne d'upcasters v1→v2→v3 : additive, appliquée à la lecture, résultat conforme", () => {
  _reinitRegistre();
  enregistrerUpcaster("test.evt", 1, (p) => ({ ...p, champV2: "défaut" }));         // v1→v2 : nouveau champ + défaut
  enregistrerUpcaster("test.evt", 2, (p) => ({ ...p, champV3: (p.champV2 as string).toUpperCase() }));
  assert.equal(versionCible("test.evt"), 3);
  const out = deserialiser({ type: "test.evt", eventVersion: 1, payload: { a: 1 } });
  assert.equal(out.version, 3);
  assert.deepEqual(out.payload, { a: 1, champV2: "défaut", champV3: "DÉFAUT" });     // v1 lu → v3
  // un événement déjà v2 ne rejoue QUE v2→v3
  const out2 = deserialiser({ type: "test.evt", eventVersion: 2, payload: { a: 1, champV2: "x" } });
  assert.deepEqual(out2.payload, { a: 1, champV2: "x", champV3: "X" });
  _reinitRegistre();
});

t("EV-03b immuabilité du registre : un upcaster déjà enregistré ne se redéfinit pas", () => {
  _reinitRegistre();
  enregistrerUpcaster("t", 1, (p) => p);
  assert.throws(() => enregistrerUpcaster("t", 1, (p) => p), /déjà enregistré/);
  _reinitRegistre();
});

console.log(`\n### ${passed}/${passed} tests upcasters verts ###`);
