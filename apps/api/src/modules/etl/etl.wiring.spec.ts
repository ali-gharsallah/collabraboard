// Câblage ETL core banking (ET-01..08, R480→R489) — harnais autonome, sans base (fakePrisma).
// Spec-first, PHASE ROUGE : ces 8 tests encodent la spec ARBITRÉE (PO 10.08.2026 — Q1 générique
// CSV/SFTP, Q2 clients+comptes+transactions, Q3 EOD, Q4 tout-ou-rien, Q5 R480-R489 ratifiés)
// AVANT l'implémentation. Ils doivent être ROUGES sur le squelette, verts au lot suivant.
process.env.AUDIT_HMAC_SECRET = process.env.AUDIT_HMAC_SECRET || "0".repeat(64);
import { EtlService, PortEtl } from "./etl.service";

declare const process: { env: Record<string, string | undefined>; exit(n: number): void };

let passed = 0, failed = 0; const fails: string[] = [];
const it = (name: string, fn: () => Promise<void>): Promise<void> =>
  fn().then(() => { passed++; }, (e: any) => { failed++; fails.push(`✗ ${name} — ${e?.message ?? e}`); });
const ok = (c: boolean, m = "assertion") => { if (!c) throw new Error(m); };
const eq = (a: any, b: any, m = "") => { if (a !== b) throw new Error(`${m} attendu ${b}, obtenu ${a}`); };
async function rejects(p: Promise<unknown>, part: string): Promise<void> {
  try { await p; } catch (e: any) { if (String(e?.message ?? e).includes(part)) return;
    throw new Error(`attendu «${part}», obtenu «${e?.message ?? e}»`); }
  throw new Error(`refus «${part}» attendu`);
}

// ── fakePrisma : etlContrat (versions) + etlLot + etlLigne (staging) + domainEvent (append) ──
function fakePrisma() {
  let seq = 0; const id = (p: string) => `${p}-${++seq}`;
  const db = { contrats: [] as any[], lots: [] as any[], lignes: [] as any[], events: [] as any[] };
  const match = (row: any, where: any = {}) => Object.entries(where).every(([k, v]: any) => {
    if (v && typeof v === "object" && "lte" in v) return row[k] != null && new Date(row[k]) <= new Date(v.lte);
    return row[k] === v;
  });
  const table = (rows: any[], prefix: string) => ({
    findMany: async ({ where }: any = {}) => rows.filter((x) => match(x, where)),
    findFirst: async ({ where }: any = {}) => rows.find((x) => match(x, where)) ?? null,
    create: async ({ data }: any) => { const r = { id: id(prefix), createdAt: new Date().toISOString(), ...data }; rows.push(r); return r; },
    update: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id); Object.assign(r, data); return r; },
  });
  const p: any = { _db: db, etlContrat: table(db.contrats, "CT"), etlLot: table(db.lots, "LOT"),
    etlLigne: table(db.lignes, "LG"),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; },
      findMany: async ({ where }: any = {}) => db.events.filter((x) => match(x, where)) } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const portOk: PortEtl = { secretPresent: () => true };
const portSansSecret: PortEtl = { secretPresent: () => false };
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);
const CO = { tenantId: "t1", userId: "co.1", role: "CO" };
const mk = (port: PortEtl = portOk) => { const p = fakePrisma(); return { p, s: new EtlService(p, fakeAudit(), port) }; };

// Mapping déclaratif minimal (R487) : champs source→cible, aucune expression exécutable.
const MAPPING_TX = { champs: { date: "valueDate", montant: "amount", devise: "currency", contrepartie: "counterparty" },
  requis: ["date", "montant", "devise"] };
const L = (ref: string, montant = 1000): { externalRef: string; data: Record<string, unknown> } =>
  ({ externalRef: ref, data: { valueDate: "2026-08-10", amount: montant, currency: "CHF", counterparty: "ACME" } });

(async () => {
  // ── ET-01 (R480/R29) : un lot est validé contre le contrat en vigueur À SA DATE de réception ──
  await it("ET-01 : contrat v1 puis v2 — un lot reçu AVANT l'effet de v2 se valide contre v1", async () => {
    const { s } = mk();
    await s.publierContrat(CO, { connecteur: "GENERIQUE", famille: "TRANSACTIONS", mapping: MAPPING_TX, enVigueurLe: "2026-01-01" });
    await s.publierContrat(CO, { connecteur: "GENERIQUE", famille: "TRANSACTIONS",
      mapping: { ...MAPPING_TX, requis: [...MAPPING_TX.requis, "counterparty"] }, enVigueurLe: "2026-09-01" });
    const c: any = await s.contratEnVigueur(CO, "GENERIQUE", "TRANSACTIONS", "2026-08-10");
    eq(c.version, 1, "en vigueur au 10.08 = v1");
    const c2: any = await s.contratEnVigueur(CO, "GENERIQUE", "TRANSACTIONS", "2026-09-02");
    eq(c2.version, 2, "en vigueur au 02.09 = v2");
  });

  // ── ET-02 (R481) : réimport du même lot → 100 % no-op consignés, zéro doublon ──
  await it("ET-02 : réimporter les mêmes externalRef → no-op consignés, zéro doublon", async () => {
    const { p, s } = mk();
    await s.publierContrat(CO, { connecteur: "GENERIQUE", famille: "TRANSACTIONS", mapping: MAPPING_TX, enVigueurLe: "2026-01-01" });
    const lot1: any = await s.recevoirLot(CO, { connecteur: "GENERIQUE", famille: "TRANSACTIONS", lignes: [L("TX-1"), L("TX-2")] });
    await s.validerLot(CO, lot1.id); await s.dryRun(CO, lot1.id);
    const a1: any = await s.appliquerLot(CO, lot1.id);
    eq(a1.appliques, 2, "1er passage : 2 appliqués");
    const lot2: any = await s.recevoirLot(CO, { connecteur: "GENERIQUE", famille: "TRANSACTIONS", lignes: [L("TX-1"), L("TX-2")] });
    await s.validerLot(CO, lot2.id);
    const a2: any = await s.appliquerLot(CO, lot2.id);
    eq(a2.appliques, 0, "2e passage : zéro appliqué"); eq(a2.noop, 2, "2e passage : 2 no-op");
  });

  // ── ET-03 (R482/R49) : l'application passe par emitEvent — types etl.*, jamais d'état direct ──
  await it("ET-03 : appliquer émet etl.lot.applique ; aucune table métier écrite par l'ETL", async () => {
    const { p, s } = mk();
    await s.publierContrat(CO, { connecteur: "GENERIQUE", famille: "TRANSACTIONS", mapping: MAPPING_TX, enVigueurLe: "2026-01-01" });
    const lot: any = await s.recevoirLot(CO, { connecteur: "GENERIQUE", famille: "TRANSACTIONS", lignes: [L("TX-3")] });
    await s.validerLot(CO, lot.id); await s.dryRun(CO, lot.id);
    await s.appliquerLot(CO, lot.id);
    eq(evts(p, "etl.lot.recu").length, 1, "réception consignée");
    eq(evts(p, "etl.lot.applique").length, 1, "application consignée");
    ok(p._db.events.every((e: any) => typeof e.type === "string"), "journal append-only, types nommés");
  });

  // ── ET-04 (R483/Q4) : ligne invalide → rejet motivé ; tout-ou-rien par défaut ──
  await it("ET-04 : ligne sans champ requis → rejet motivé typé ; défaut TOUT-OU-RIEN : rien n'est appliqué", async () => {
    const { s } = mk();
    await s.publierContrat(CO, { connecteur: "GENERIQUE", famille: "TRANSACTIONS", mapping: MAPPING_TX, enVigueurLe: "2026-01-01" });
    const lot: any = await s.recevoirLot(CO, { connecteur: "GENERIQUE", famille: "TRANSACTIONS",
      lignes: [L("TX-4"), { externalRef: "TX-5", data: { amount: 10 } }] });   // TX-5 : date/devise manquantes
    const v: any = await s.validerLot(CO, lot.id);
    eq(v.rejets.length, 1, "un rejet"); ok(String(v.rejets[0].motif).includes("requis"), "motif typé (champ requis)");
    await rejects(s.appliquerLot(CO, lot.id), "[R483]");                       // tout-ou-rien : lot non applicable
  });

  // ── ET-05 (R484) : appliquer sans dry-run préalable (contrat v1 jamais simulé) → refus ──
  await it("ET-05 : première version de contrat jamais simulée → appliquer refuse [R484]", async () => {
    const { s } = mk();
    await s.publierContrat(CO, { connecteur: "GENERIQUE", famille: "TRANSACTIONS", mapping: MAPPING_TX, enVigueurLe: "2026-01-01" });
    const lot: any = await s.recevoirLot(CO, { connecteur: "GENERIQUE", famille: "TRANSACTIONS", lignes: [L("TX-6")] });
    await s.validerLot(CO, lot.id);
    await rejects(s.appliquerLot(CO, lot.id), "[R484]");
  });

  // ── ET-06 (R485) : réconciliation — source = appliqué + rejeté + no-op ; sinon INCIDENT ──
  await it("ET-06 : réconciliation chiffrée consignée ; divergence = incident, jamais silencieuse", async () => {
    const { p, s } = mk();
    await s.publierContrat(CO, { connecteur: "GENERIQUE", famille: "TRANSACTIONS", mapping: MAPPING_TX, enVigueurLe: "2026-01-01" });
    const lot: any = await s.recevoirLot(CO, { connecteur: "GENERIQUE", famille: "TRANSACTIONS", lignes: [L("TX-7"), L("TX-8")] });
    await s.validerLot(CO, lot.id); await s.dryRun(CO, lot.id); await s.appliquerLot(CO, lot.id);
    const r: any = await s.reconcilier(CO, lot.id);
    eq(r.ok, true, "source = appliqué + rejeté + no-op");
    eq(evts(p, "etl.lot.reconcilie").length, 1, "réconciliation au journal");
  });

  // ── ET-07 (R486) : port sans secret → refus GRACIEUX typé, message actionnable ──
  await it("ET-07 : pas de secret = refus gracieux [R486], jamais une erreur brute", async () => {
    const { s } = mk(portSansSecret);
    await rejects(s.recevoirLot(CO, { connecteur: "GENERIQUE", famille: "TRANSACTIONS", lignes: [L("TX-9")] }), "[R486]");
  });

  // ── ET-08 (R489/R44) : l'ETL ne pose AUCUN verdict — les conséquences passent aux moteurs ──
  await it("ET-08 : une transaction appliquée ne porte AUCUN verdict ETL ; le portail R140 décidera", async () => {
    const { p, s } = mk();
    await s.publierContrat(CO, { connecteur: "GENERIQUE", famille: "TRANSACTIONS", mapping: MAPPING_TX, enVigueurLe: "2026-01-01" });
    const lot: any = await s.recevoirLot(CO, { connecteur: "GENERIQUE", famille: "TRANSACTIONS", lignes: [L("TX-10")] });
    await s.validerLot(CO, lot.id); await s.dryRun(CO, lot.id); await s.appliquerLot(CO, lot.id);
    ok(p._db.events.every((e: any) => !String(e.type).includes("verdict")), "aucun événement de verdict émis par l'ETL");
    const applique = evts(p, "etl.lot.applique")[0];
    ok(applique && !("verdict" in ((applique.payload as any) ?? {})), "payload sans décision (R489)");
  });

  console.log(`\nCâblage ETL core banking (ET-01..08, R480→R489) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
