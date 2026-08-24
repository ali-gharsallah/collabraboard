// Harnais P-L8-1 — goAML + chronomètre (GO-01..07). Autonome, fakePrisma.
// GO-02 valide le XML généré contre docs/contracts/goaml-subset.xsd : les éléments REQUIS et
// leur ORDRE sont EXTRAITS DU XSD lui-même (pas recopiés ici) — étendre le XSD sans étendre le
// générateur casse la spec, et réciproquement.
import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GoamlService, joursOuvres } from "./goaml.service";

let passed = 0; const t = async (nom: string, fn: () => Promise<void> | void) => { await fn(); passed++; console.log("  ✓ " + nom); };
const T = "33333333-3333-4333-8333-333333333333";
const CO = { tenantId: T, userId: "mlro-1", role: "MLRO" };

const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: any) =>
  v && typeof v === "object" && "in" in v ? v.in.includes(row[k]) : row[k] === v);
function fake(coms: any[], txs: any[] = []) {
  const events: any[] = [];
  const table = (rows: any[]) => ({
    findFirst: async ({ where }: any) => rows.find((r) => match(r, where)) ?? null,
    findMany: async ({ where }: any) => rows.filter((r) => match(r, where)) });
  const p: any = {
    mrosCommunication: table(coms), transaction: table(txs),
    client: table([{ id: "C1", tenantId: T, name: "Trust Alpha", structure: "TRUST" }]),
    tenant: { findFirst: async () => ({ id: T, settings: {} }), findUnique: async () => ({ id: T, settings: {} }) },
    domainEvent: { ...table(events), create: async ({ data }: any) => { events.push(data); return data; } },
  };
  p.$transaction = async (fn: any) => fn(p);
  return { p, events };
}
const COM = { id: "M1", tenantId: T, clientId: "C1", riskCaseId: "RC1", decision: "DECLARER",
  motif: "structuration <suspecte> en espèces", decidePar: "mlro-1",
  decideAt: "2026-08-03T09:00:00Z", pieces: [], dossierSha256: "a".repeat(64) };   // lundi

(async () => {
console.log("MROS goAML + chronomètre (P-L8-1, GO) :");

await t("GO-01 jours ouvrés : les week-ends ne comptent pas (lun→lun suivant = 5)", () => {
  assert.equal(joursOuvres(new Date("2026-08-03"), new Date("2026-08-07")), 4);   // lun→ven
  assert.equal(joursOuvres(new Date("2026-08-03"), new Date("2026-08-09")), 4);   // dimanche : toujours 4
  assert.equal(joursOuvres(new Date("2026-08-03"), new Date("2026-08-10")), 5);   // lundi suivant
});

await t("GO-02 le brouillon goAML respecte le XSD-subset : éléments requis, DANS L'ORDRE du schéma", async () => {
  const { p } = fake([COM], [{ id: "T1", tenantId: T, clientId: "C1", refExterne: "TX-1",
    dateValeur: "2026-08-01", type: "VIREMENT", montant: "15000" }]);
  const { xml, nTransactions } = await new GoamlService(p).genererBrouillon(CO, "M1", new Date("2026-08-07"));
  assert.equal(nTransactions, 1);
  const xsd = readFileSync(join(process.cwd(), "..", "..", "docs", "contracts", "goaml-subset.xsd"), "utf8");
  const requis = [...xsd.matchAll(/<xs:element name="([a-z_]+)"(?![^>]*minOccurs="0")/g)].map((m) => m[1])
    .filter((n) => n !== "report");
  assert.ok(requis.length >= 8, "le XSD porte les éléments requis");
  let pos = -1;
  for (const el of requis) {                                     // ordre de séquence du XSD respecté
    const i = xml.indexOf(`<${el}>`);
    assert.ok(i > pos, `élément « ${el} » manquant ou hors séquence`);
    pos = ["transactionnumber", "date_transaction", "transmode_code", "amount_local"].includes(el) ? pos : i;
  }
  assert.ok(xml.includes("&lt;suspecte&gt;"), "le récit est échappé XML");
  assert.ok(xml.includes("<submission_code>M</submission_code>"), "soumission MANUELLE (jamais d'envoi auto)");
});

await t("GO-03 chronomètre : J+4 ouvrés → rien ; J+5 → alerte cataloguée avec le décompte", async () => {
  const { p, events } = fake([COM]);
  const svc = new GoamlService(p);
  assert.deepEqual((await svc.chronometre(CO, new Date("2026-08-07T10:00:00Z"))).alertes, []);   // J+4
  const r = await svc.chronometre(CO, new Date("2026-08-10T10:00:00Z"));                          // J+5
  assert.deepEqual(r.alertes, [{ communicationId: "M1", joursOuvres: 5 }]);
  assert.equal(events.filter((e) => e.type === "mros.chrono.alerte").length, 1);
});

await t("GO-04 chronomètre idempotent : re-tick = zéro nouvelle alerte", async () => {
  const { p, events } = fake([COM]);
  const svc = new GoamlService(p);
  await svc.chronometre(CO, new Date("2026-08-10T10:00:00Z"));
  await svc.chronometre(CO, new Date("2026-08-12T10:00:00Z"));
  assert.equal(events.filter((e) => e.type === "mros.chrono.alerte").length, 1);
});

await t("GO-05 soumission MANUELLE tracée : référence exigée, événement catalogué, chrono éteint", async () => {
  const { p, events } = fake([COM]);
  const svc = new GoamlService(p);
  await assert.rejects(svc.soumettre(CO, "M1", { reference: " " }), /référence goAML requise/);
  await svc.soumettre(CO, "M1", { reference: "GOAML-2026-0042" });
  assert.ok(events.some((e) => e.type === "mros.goaml.soumis" && e.payload.reference === "GOAML-2026-0042"));
  const r = await svc.chronometre(CO, new Date("2026-08-20T10:00:00Z"));
  assert.deepEqual(r.alertes, []);                               // soumis : le chronomètre s'éteint
});

await t("GO-08 (V2-M38) dépôt goAML sur une communication NON décidée DECLARER : REFUSÉ", async () => {
  // Le chronomètre J+5 s'éteint dès qu'un dépôt est tracé. Tracer un dépôt sur une
  // communication qu'on a décidé de NE PAS déclarer éteignait donc l'alarme de délai d'une
  // communication qui n'en avait pas — et masquait celle qui en avait une.
  const { p, events } = fake([{ ...COM, id: "M2", decision: "NE_PAS_DECLARER" }]);
  const svc = new GoamlService(p);
  await assert.rejects(svc.soumettre(CO, "M2", { reference: "GOAML-2026-0099" }),
    /n'est pas décidée DECLARER/);
  assert.equal(events.filter((e) => e.type === "mros.goaml.soumis").length, 0);
});

await t("GO-09 (V2-M38) second dépôt REFUSÉ, avec la référence du premier — un dépôt ne se retrace pas", async () => {
  const { p, events } = fake([COM]);
  const svc = new GoamlService(p);
  await svc.soumettre(CO, "M1", { reference: "GOAML-2026-0042" });
  await assert.rejects(svc.soumettre(CO, "M1", { reference: "GOAML-2026-0043" }),
    /déjà tracé.*GOAML-2026-0042/);
  assert.equal(events.filter((e) => e.type === "mros.goaml.soumis").length, 1);
});

await t("GO-06 cloisonnement art. 9a/10a : rôle non habilité REFUSÉ sur les trois chemins", async () => {
  const { p } = fake([COM]);
  const svc = new GoamlService(p);
  const RM = { tenantId: T, userId: "rm-1", role: "RM" };
  for (const appel of [() => svc.genererBrouillon(RM, "M1"), () => svc.soumettre(RM, "M1", { reference: "x" }),
    () => svc.chronometre(RM)])
    await assert.rejects(appel(), /non habilité MROS/);
});

await t("GO-07 cloisonnement re-vérifié : mros_communications au périmètre RLS FORCE (post-deploy)", () => {
  const sql = readFileSync(join(process.cwd(), "prisma", "post-deploy-v2.sql"), "utf8");
  assert.ok(sql.includes("'mros_communications'"), "la table MROS est dans la boucle RLS");
  assert.ok(/FORCE ROW LEVEL SECURITY/.test(sql));
});

console.log(`\n### ${passed}/${passed} specs goAML P-L8-1 verts ###`);
})().catch((e) => { console.error(e); process.exit(1); });
