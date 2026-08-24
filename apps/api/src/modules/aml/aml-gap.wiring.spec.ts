// Câblage AML Gap Wave 1 (R340–R377, blocs 50–56) — harnais autonome, sans base (fakePrisma).
// Spec-first : un invariant par bloc + corpus GT. Le worker `aml-eval` (BullMQ/outbox) et l'e2e
// Postgres sont DIFFÉRÉS (mêmes contraintes d'environnement que les blocs précédents) ; ici on
// prouve la gouvernance : version en vigueur (R29), signal append-only, aml.block.requested pour
// les 6 bloquantes SANS effet de bord, qualification 4-yeux + motif (R7), idempotence (R48).
process.env.AUDIT_HMAC_SECRET = process.env.AUDIT_HMAC_SECRET || "0".repeat(64);
import { AmlGapService } from "./aml-gap.service";
import { AML_GAP_REFERENTIEL } from "./aml-gap.referentiel.gen";
import { AML_GAP_GT } from "./aml-gap.gt.gen";

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

// ── fakePrisma : amlScenario (versions) + amlGapSignal (append-only) + domainEvent (log) ──
function fakePrisma(seed: { scenarios?: any[] } = {}) {
  let seq = 0; const id = (p: string) => `${p}-${++seq}`;
  const db = { scenarios: seed.scenarios ?? [], signals: [] as any[], events: [] as any[] };
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
  const p: any = { _db: db, amlScenario: table(db.scenarios, "SC"), amlGapSignal: table(db.signals, "SG"),
    domainEvent: { create: async ({ data }: any) => { db.events.push(data); return data; } } };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const fakeAudit = () => ({ log: async () => undefined } as any);
const evts = (p: any, t: string) => p._db.events.filter((e: any) => e.type === t);
const CO_SR = { tenantId: "t1", userId: "co.sr", role: "CO_SR" };
const RM = { tenantId: "t1", userId: "rm.1", role: "RM" };
// Port CPSI stub : le pont Analytique 2G (bloc 61) est couvert par l'e2e réel (Postgres+CPSI) ;
// ici (fakePrisma, blocs 50–60) il n'est jamais appelé — un stub qui lève suffit à la construction.
const fakeCpsi: any = { evaluerAmlGap2G: async () => { throw new Error("CPSI non câblé dans le harnais fakePrisma"); } };
const mk = (seed: any = {}) => { const p = fakePrisma(seed); return { p, s: new AmlGapService(p, fakeAudit(), fakeCpsi) }; };

const BLOCKING = ["R344", "R346", "R363", "R365", "R367", "R373", "R390", "R393"];
const FAMILLES: Record<string, number> = {
  SF: 7, QO: 5, GU: 4, IP: 7, CR: 6, FT: 5, GV: 4,          // Wave 1 (R340–R377)
  TB: 8, CB: 7, PF: 3, IA: 3, AN: 5,                        // Wave 2 (R378–R403)
};

(async () => {
  // ── Corpus GT (contrat de l'en-tête de spec) ──
  await it("GT-CORPUS : 130 cas, 66 TP / 64 FP, chacun rattaché à un scénario du référentiel", async () => {
    eq(AML_GAP_GT.length, 130, "total GT");
    eq(AML_GAP_GT.filter((c) => c.label === "TP").length, 66, "TP");
    eq(AML_GAP_GT.filter((c) => c.label === "FP").length, 64, "FP");
    const codes = new Set(AML_GAP_REFERENTIEL.map((r) => r.id));
    ok(AML_GAP_GT.every((c) => codes.has(c.scenarioId)), "tout cas GT pointe un scénario connu");
    // chaque scénario a ≥ 1 TP et ≥ 1 FP (TP et FP déclenchent — corpus de recall)
    for (const r of AML_GAP_REFERENTIEL) {
      const cs = AML_GAP_GT.filter((c) => c.scenarioId === r.id);
      ok(cs.some((c) => c.label === "TP") && cs.some((c) => c.label === "FP"), `${r.id} : TP+FP requis`);
    }
    // exactement 1 FP placeholder (R377/GV-04) laissé vide par la spec — jamais comblé
    const ph = AML_GAP_GT.filter((c) => c.placeholder);
    eq(ph.length, 1, "placeholders"); eq(ph[0].ruleRef, "R377", "placeholder = R377");
  });

  await it("REFERENTIEL : 64 règles R340–R403 (Waves 1+2), familles aux effectifs, 8 bloquantes exactes", async () => {
    eq(AML_GAP_REFERENTIEL.length, 64, "règles");
    const seen: Record<string, number> = {};
    for (const r of AML_GAP_REFERENTIEL) seen[r.famille] = (seen[r.famille] || 0) + 1;
    for (const [f, n] of Object.entries(FAMILLES)) eq(seen[f], n, `famille ${f}`);
    const blk = AML_GAP_REFERENTIEL.filter((r) => r.blocking).map((r) => r.ruleRef).sort();
    eq(blk.join(","), BLOCKING.slice().sort().join(","), "bloquantes");
    // chaque règle porte ≥ 1 paramètre R-Q
    ok(AML_GAP_REFERENTIEL.every((r) => r.params.length >= 1), "params R-Q");
  });

  // ── Un invariant de câblage par BLOC : le scénario représentatif lève un signal tracé ──
  for (const fam of Object.keys(FAMILLES)) {
    const def = AML_GAP_REFERENTIEL.find((r) => r.famille === fam)!;
    await it(`BLOC ${def.bloc} (${fam}) : ${def.id} → signal append-only + aml.signal.raised`, async () => {
      const { p, s } = mk();
      const sig: any = await s.enregistrerSignal(CO_SR, { scenarioCode: def.id, clientId: "cli-1", faits: { x: 1 } });
      eq(sig.status, "NEW", "statut initial"); eq(sig.ruleRef, def.ruleRef, "ruleRef");
      eq(sig.emisPar, "co.sr", "auteur = jeton"); eq(sig.scenarioVer, 1, "version par défaut");
      eq(evts(p, "aml.signal.raised").length, 1, "événement raised");
    });
  }

  // ── R344 (SF-05) BLOQUANT : aml.block.requested émis, ZÉRO exécution ──
  await it("R344 (bloquant) : aml.signal.raised + aml.block.requested, aucun autre effet", async () => {
    const { p, s } = mk();
    const sig: any = await s.enregistrerSignal(CO_SR, { scenarioCode: "SF-05", clientId: "cli-2", faits: { ville: "Sébastopol" } });
    eq(sig.blocking, true, "signal bloquant");
    eq(evts(p, "aml.signal.raised").length, 1, "raised");
    eq(evts(p, "aml.block.requested").length, 1, "block.requested");
    // zéro effet de bord : un seul signal, aucun autre type d'événement de mutation
    eq(p._db.signals.length, 1, "un seul signal");
    const autres = p._db.events.filter((e: any) => !["aml.signal.raised", "aml.block.requested"].includes(e.type));
    eq(autres.length, 0, "aucun événement hors raised/block.requested");
  });

  await it("R340 (non bloquant) : PAS de aml.block.requested", async () => {
    const { p, s } = mk();
    await s.enregistrerSignal(CO_SR, { scenarioCode: "SF-01", clientId: "cli-3", faits: { score: 91 } });
    eq(evts(p, "aml.block.requested").length, 0, "aucun block.requested");
  });

  // ── Wave 2 : R390 (CB-07 shell bank) BLOQUANT — même mécanisme générique, dérivé du référentiel ──
  await it("R390 (Wave 2, shell bank, bloquant) : raised + block.requested", async () => {
    const { p, s } = mk();
    const sig: any = await s.enregistrerSignal(CO_SR, { scenarioCode: "CB-07", clientId: "cli-cb", faits: { bic: "SHELLXX" } });
    eq(sig.ruleRef, "R390", "ruleRef"); eq(sig.blocking, true, "bloquant");
    eq(evts(p, "aml.signal.raised").length, 1, "raised");
    eq(evts(p, "aml.block.requested").length, 1, "block.requested");
  });

  // ── Idempotence (R48) : même déclenchement rejoué → un seul signal ──
  await it("IDEMPOTENCE : (scénario, client, faits) rejoué ne crée pas de doublon", async () => {
    const { p, s } = mk();
    const a: any = await s.enregistrerSignal(CO_SR, { scenarioCode: "QO-02", clientId: "cli-4", faits: { tiers: 11 } });
    const b: any = await s.enregistrerSignal(CO_SR, { scenarioCode: "QO-02", clientId: "cli-4", faits: { tiers: 11 } });
    eq(a.id, b.id, "même signal retourné"); eq(p._db.signals.length, 1, "un seul signal en base");
  });

  // ── R29 : version en vigueur à la date (grandfathering) ──
  await it("R29 : version en vigueur résolue à la date de l'événement (grandfathering)", async () => {
    const seed = { scenarios: [
      { id: "x1", tenantId: "t1", code: "GU-01", version: 1, active: true, effectiveFrom: "2026-01-01T00:00:00.000Z", params: { seuil_agrege_ubo: 50000 } },
      { id: "x2", tenantId: "t1", code: "GU-01", version: 2, active: true, effectiveFrom: "2026-06-01T00:00:00.000Z", params: { seuil_agrege_ubo: 40000 } },
    ] };
    const { s } = mk(seed);
    const avant = await s.versionEnVigueur(CO_SR, "GU-01", new Date("2026-03-01T00:00:00.000Z"));
    eq(avant.version, 1, "avant v2 → v1"); eq((avant.params as any).seuil_agrege_ubo, 50000, "seuil v1");
    const apres = await s.versionEnVigueur(CO_SR, "GU-01", new Date("2026-09-01T00:00:00.000Z"));
    eq(apres.version, 2, "après v2 → v2"); eq((apres.params as any).seuil_agrege_ubo, 40000, "seuil v2");
  });

  await it("R29 : sans version tenant → défaut du référentiel (v1, params par défaut) — jamais inventé", async () => {
    const { s } = mk();
    const v = await s.versionEnVigueur(CO_SR, "IP-06");
    eq(v.version, 1, "v1 par défaut"); eq((v.params as any).nb_correlations_seuil, 3, "défaut R-Q");
  });

  // ── SPEC-I18N §3 : une traduction de règle est un changement VERSIONNÉ par date de vigueur (R29).
  // Le référentiel servi grandfather la traduction tenant ; défaut PO sinon. Jamais fabriqué. ──
  await it("R29/i18n : sans version tenant → référentiel sert la traduction PO par défaut (EN/DE/IT)", async () => {
    const { s } = mk();
    const ref = await s.referentielEnVigueur(CO_SR, new Date("2026-08-05T00:00:00.000Z"));
    const sf01 = ref.find((r) => r.code === "SF-01")!;
    ok(!!sf01.i18n?.en?.nom && !!sf01.i18n?.de?.nom && !!sf01.i18n?.it?.nom, "défaut PO EN/DE/IT servi");
    eq(sf01.version, 1, "version défaut = 1");
  });

  await it("R29/i18n : traduction tenant versionnée grandfathered à la date (défaut avant vigueur)", async () => {
    const trad = { en: { nom: "Tenant override EN", desc: "d" }, de: { nom: "de", desc: "d" }, it: { nom: "it", desc: "d" } };
    const seed = { scenarios: [
      { id: "i1", tenantId: "t1", code: "SF-01", version: 2, active: true,
        effectiveFrom: "2026-06-01T00:00:00.000Z", params: {}, i18n: trad },
    ] };
    const { s } = mk(seed);
    // AVANT la vigueur (mars) → défaut PO, PAS l'override tenant.
    const avant = await s.referentielEnVigueur(CO_SR, new Date("2026-03-01T00:00:00.000Z"));
    const sfAvant = avant.find((r) => r.code === "SF-01")!;
    ok(sfAvant.i18n?.en?.nom !== "Tenant override EN", "avant vigueur → défaut PO");
    eq(sfAvant.version, 1, "avant → v1");
    // APRÈS la vigueur (septembre) → override tenant servi, version portée.
    const apres = await s.referentielEnVigueur(CO_SR, new Date("2026-09-01T00:00:00.000Z"));
    const sfApres = apres.find((r) => r.code === "SF-01")!;
    eq(sfApres.i18n?.en?.nom, "Tenant override EN", "après → override tenant");
    eq(sfApres.version, 2, "après → v2");
    // Les AUTRES scénarios (non versionnés) gardent le défaut PO — surcharge ciblée, pas globale.
    const qo = apres.find((r) => r.code === "QO-01")!;
    ok(!!qo.i18n?.en?.nom && qo.version === 1, "QO-01 → défaut PO intact");
  });

  await it("R29/i18n : versionEnVigueur porte l'i18n en vigueur (override tenant → sinon défaut PO)", async () => {
    const trad = { en: { nom: "Override", desc: "d" } };
    const seed = { scenarios: [
      { id: "i2", tenantId: "t1", code: "GU-01", version: 3, active: true,
        effectiveFrom: "2026-01-01T00:00:00.000Z", params: { seuil_agrege_ubo: 40000 }, i18n: trad },
    ] };
    const { s } = mk(seed);
    const v: any = await s.versionEnVigueur(CO_SR, "GU-01", new Date("2026-09-01T00:00:00.000Z"));
    eq(v.i18n?.en?.nom, "Override", "i18n override tenant porté");
    const d: any = await s.versionEnVigueur(CO_SR, "SF-01"); // non versionné → défaut PO
    ok(!!d.i18n?.en?.nom && d.i18n.en.nom !== "Override", "SF-01 → défaut PO");
  });

  // ── Qualification 4-yeux + motif (R7/R13/R44) ──
  await it("QUALIF : CO_SR + motif → statut TP + aml.signal.qualified", async () => {
    const { p, s } = mk();
    const sig: any = await s.enregistrerSignal(CO_SR, { scenarioCode: "SF-01", clientId: "cli-5", faits: { s: 1 } });
    const q: any = await s.qualifier(CO_SR, sig.id, { outcome: "TP", motif: "origine politique confirmée" });
    eq(q.status, "TP", "statut"); eq(q.outcome, "TP", "outcome"); eq(q.motif, "origine politique confirmée", "motif");
    eq(evts(p, "aml.signal.qualified").length, 1, "événement qualified");
  });
  await it("QUALIF : rôle non habilité (RM) → refus [R13]", async () => {
    const { s } = mk();
    const sig: any = await s.enregistrerSignal(CO_SR, { scenarioCode: "SF-01", clientId: "cli-6", faits: { s: 2 } });
    await rejects(s.qualifier(RM, sig.id, { outcome: "TP", motif: "x" }), "[R13]");
  });
  await it("QUALIF : motif absent → refus [R7]", async () => {
    const { s } = mk();
    const sig: any = await s.enregistrerSignal(CO_SR, { scenarioCode: "SF-01", clientId: "cli-7", faits: { s: 3 } });
    await rejects(s.qualifier(CO_SR, sig.id, { outcome: "FP", motif: "  " }), "[R7]");
  });
  await it("QUALIF : outcome hors TP/FP → refus [R44]", async () => {
    const { s } = mk();
    const sig: any = await s.enregistrerSignal(CO_SR, { scenarioCode: "SF-01", clientId: "cli-8", faits: { s: 4 } });
    await rejects(s.qualifier(CO_SR, sig.id, { outcome: "MAYBE", motif: "x" }), "[R44]");
  });

  // ── Inbox filtrable ──
  await it("INBOX : filtre par famille et statut", async () => {
    const { s } = mk();
    await s.enregistrerSignal(CO_SR, { scenarioCode: "CR-01", clientId: "cli-9", faits: { a: 1 } });
    await s.enregistrerSignal(CO_SR, { scenarioCode: "FT-01", clientId: "cli-9", faits: { b: 1 } });
    const cr = await s.signaux(CO_SR, { fam: "CR" });
    eq(cr.length, 1, "un signal famille CR"); eq((cr[0] as any).ruleRef, "R363", "ruleRef CR-01");
  });

  console.log(`\nCâblage AML Gap Waves 1+2 (blocs 50–61, R340→R403) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
