// COHÉRENCE PEP ↔ CPSI (P-L4-2, ADR-PEP-001). Le poids CPSI `pep` lit l'ATTRIBUT STRUCTUREL de la
// fiche personne (statique.pep, contaminé post-validation KYC) — JAMAIS un hit de screening. Ce banc
// le prouve sur le VRAI moteur via le pont (bridge.py, contrat R248) :
//   1) statique.pep=true  → un driver `statique:pep` contribue au score ;
//   2) statique.pep=false → aucun driver `statique:pep` (le screening n'y injecte rien) ;
//   3) un événement de hit de screening glissé dans le journal CPSI est REFUSÉ (default-deny) —
//      structurellement, le CPSI ne PEUT PAS lire les hits : sa seule source PEP est la fiche.
// Conséquence documentée (docs/notes/L4.md) : un PEP détecté par liste n'entre au score qu'APRÈS la
// décision humaine (declarerPep) et la mise à jour de la fiche — c'est le comportement VOULU (R44).
//
//   node services/cpsi-server-py/pep-coherence.test.mjs
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const pont = (env) => JSON.parse(execFileSync("python3", ["bridge.py"], { cwd: DIR, input: JSON.stringify(env), encoding: "utf8" }));
const enrolement = (pep) => ({ type: "cpsi.client.registered", client: "C1",
  statique: { pays_risque: 0, structure_risque: 1, pep, secteur_risque: 0 }, at: "2026-01-01T00:00:00" });
const score = (journal) => pont({ contract_version: "1", tenant_id: "t1", as_of: null, config: {},
  journal, commande: "score", payload: { client: "C1", at: "2026-03-01T00:00:00" } });

let echecs = [];
const check = (c, m) => { if (!c) echecs.push(m); };
console.log("COHÉRENCE PEP ↔ CPSI — le score lit la FICHE (statique.pep), jamais les hits\n");

// ── 1) fiche PEP → driver structurel présent ──
const avec = score([enrolement(true)]);
const driverPep = (avec.resultat?.drivers ?? []).find((d) => d.source === "statique:pep");
console.log(`1. statique.pep=true  → driver statique:pep = ${driverPep ? driverPep.contribution : "ABSENT"}`);
check(!!driverPep && driverPep.contribution > 0, "fiche PEP : le driver statique:pep doit contribuer au score");

// ── 2) fiche non-PEP → aucun driver pep (rien d'autre ne l'injecte) ──
const sans = score([enrolement(false)]);
const driverAbsent = (sans.resultat?.drivers ?? []).find((d) => d.source === "statique:pep");
console.log(`2. statique.pep=false → driver statique:pep = ${driverAbsent ? driverAbsent.contribution : "absent"}`);
check(!driverAbsent || driverAbsent.contribution === 0, "fiche non-PEP : aucune contribution pep (le screening n'injecte rien)");
check((avec.resultat?.score ?? 0) > (sans.resultat?.score ?? 0), "le score PEP doit dépasser le score non-PEP (poids structurel)");

// ── 3) un hit de screening dans le journal CPSI = REFUSÉ (default-deny) — la fiche est la SEULE source ──
const rejet = score([enrolement(false), { type: "screening.hit.qualifie", client: "C1", hitId: "H1", at: "2026-02-01T00:00:00" }]);
console.log(`3. événement de hit glissé au journal → ${rejet.erreur_typee ? rejet.erreur_typee.type : "ACCEPTÉ (!)"}`);
check(!!rejet.erreur_typee && /inconnu|default-deny/i.test(rejet.erreur_typee.message ?? ""),
  "un hit de screening doit être REFUSÉ du journal CPSI (default-deny) — seule la fiche fait autorité");

const total = 3;
if (echecs.length) {
  console.log(`\n✗ COHÉRENCE PEP↔CPSI ROUGE — ${echecs.length} invariant(s) cassé(s) :`);
  echecs.forEach((m) => console.log(`   ✗ ${m}`));
  process.exit(1);
}
console.log(`\n✓ le score CPSI lit statique.pep (autorité fiche) ; les hits ne peuvent pas l'atteindre (default-deny).`);
console.log(`### ${total}/${total} cohérence PEP↔CPSI verts (L4 · ADR-PEP-001) ###`);
