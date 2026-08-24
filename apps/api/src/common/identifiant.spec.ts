/**
 * Câblage Identifiants — ID-01..05 (V2-M44). Un identifiant MALFORMÉ ne fait jamais tomber
 * le moteur : il produit un refus TYPÉ, lisible, que l'écran peut afficher tel quel.
 *
 * Harnais : compiler identifiant.ts + ce fichier ;
 *   echo "── Identifiants malformés (ID-01..05) ──"; run identifiant.spec.js
 *
 * D'OÙ VIENT CE FICHIER. Le balayage d'exécution des actes contre une API vivante (V2-M44,
 * `apps/web/scripts/verifier-actes-api.mjs`) a posé les 24 actes déclarés par les écrans. Cinq
 * ont rendu **500 Internal server error** — pas un refus, un plantage. Cause unique, quatre
 * fois sur cinq : un identifiant venu de la requête (`CLI-00001`, `u-marc`) atteint un `where`
 * Prisma sur une colonne UUID, et le driver lève une erreur brute.
 *
 * Pourquoi c'est un vrai défaut et pas un artefact de test : l'écran rend le message du moteur
 * VERBATIM (FE-04). Sur un 500 il affiche « Internal server error » — le contraire d'un refus
 * opposable. Et n'importe quel appelant peut le déclencher.
 *
 * CE QUE LA CORRECTION NE FAIT PAS : elle ne déplace AUCUNE garde métier. La validation se
 * pose au point de LECTURE de l'identifiant, jamais en tête de méthode — sinon un appel sans
 * motif ET avec un identifiant douteux rendrait « identifiant invalide » là où il rendait
 * « R7 : motif requis », et la précédence des refus est un comportement contractuel.
 */
import { uuidOuRefus, estUuid } from "./identifiant";
declare const process: { exit(n: number): void };

let passed = 0, failed = 0; const fails: string[] = [];
function it(nom: string, fn: () => void): void {
  try { fn(); passed++; } catch (e) { failed++; fails.push(`✗ ${nom} — ${(e as Error).message}`); }
}
const ok = (c: boolean, m = "assertion") => { if (!c) throw new Error(m); };
const refuse = (fn: () => unknown, part: string) => {
  try { fn(); } catch (e) { const msg = String((e as Error).message);
    ok(msg.includes(part), `message « ${msg} » doit contenir « ${part} »`); return; }
  throw new Error(`refus « ${part} » attendu`);
};

const UUID = "9b1de001-0000-4000-8000-00000000006b";

(async () => {
  it("ID-01 un UUID valide traverse inchangé (aucune friction sur le chemin nominal)", () => {
    ok(uuidOuRefus(UUID, "client") === UUID);
    ok(estUuid(UUID));
    ok(estUuid(UUID.toUpperCase()), "la casse ne change rien");
  });

  it("ID-02 les identifiants de MAQUETTE sont refusés typé, jamais passés à la base", () => {
    // Ce sont EXACTEMENT les valeurs que les écrans déclarent en `exemple` — celles qui ont
    // produit les cinq 500 du balayage.
    for (const faux of ["CLI-00001", "u-marc", "RC-2026-0104", "MROS-2026-0007", "off-1"])
      refuse(() => uuidOuRefus(faux, "client"), "identifiant");
  });

  it("ID-03 le refus NOMME l'objet et la valeur reçue — un refus qui n'aide pas est un défaut", () => {
    refuse(() => uuidOuRefus("CLI-00001", "client"), "client");
    refuse(() => uuidOuRefus("CLI-00001", "client"), "CLI-00001");
  });

  it("ID-04 vide, absent, non-chaîne : refusés aussi, sans jamais lever de TypeError", () => {
    for (const rien of [undefined, null, "", 42, {}, []])
      refuse(() => uuidOuRefus(rien as any, "dossier"), "identifiant");
  });

  it("ID-05 une chaîne de longueur d'UUID mais mal formée ne passe pas", () => {
    refuse(() => uuidOuRefus("9b1de001-0000-4000-8000-00000000006Z", "client"), "identifiant");
    refuse(() => uuidOuRefus("9b1de00100004000800000000000006b", "client"), "identifiant");   // sans tirets
  });

  console.log(`\n### ${passed}/${passed + failed} tests identifiants ###`);
  if (failed) { fails.forEach((f) => console.error(f)); process.exit(1); }
})();
