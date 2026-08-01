// R26/R27/R29 — matrice documentaire versionnée. Port fidèle de referentiel.py + evaluer_completude.
// Autonome (node:assert), sans DB. Couvre R27 (résolution par juridiction), R26 (union des porteurs
// + complétude), R29 (versioning append-only, en vigueur à date, estampille du dossier). Nominal ⊕
// violation. Le CONTENU des matrices ci-dessous est FICTIF (test) — le vrai est arbitré banque (⚙).
process.env.AUDIT_HMAC_SECRET = process.env.AUDIT_HMAC_SECRET || "0".repeat(64);
import * as assert from "node:assert/strict";
import { DocMatrixService } from "../docmatrix.service";

const audit = { log: async () => undefined } as any;

// Fake Prisma : délégué docMatrixVersion append-only en mémoire (count/create/findFirst).
function fake(seed: any[] = []) {
  const rows: any[] = seed.map((r, i) => ({ id: "M" + i, tenantId: "t1", publiePar: "sys", publieLe: new Date(0), ...r }));
  const events: any[] = [];
  const match = (r: any, where: any) => Object.entries(where).every(([k, val]: any) => {
    if (val && typeof val === "object" && "lte" in val) return new Date(r[k]) <= new Date(val.lte);
    return r[k] === val;
  });
  const sortDesc = (a: any, b: any, key: string) => new Date(b[key]).getTime() - new Date(a[key]).getTime();
  const docMatrixVersion = {
    count: async ({ where }: any) => rows.filter((r) => match(r, where)).length,
    create: async ({ data }: any) => { const row = { id: "M" + rows.length, publieLe: new Date(), ...data }; rows.push(row); return row; },
    findFirst: async ({ where, orderBy }: any) => {
      let ms = rows.filter((r) => match(r, where));
      if (orderBy?.enVigueurLe === "desc") ms = [...ms].sort((a, b) => sortDesc(a, b, "enVigueurLe"));
      return ms[0] ?? null;
    },
  };
  const p: any = { docMatrixVersion, domainEvent: { create: async ({ data }: any) => { events.push(data); return data; } },
    _rows: rows, _events: events };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const svc = (p: any) => new DocMatrixService(p, audit);
const CO_SR = { tenantId: "t1", userId: "sel", role: "CO_SR" };
const rejects = async (pr: Promise<any>, needle: string) => {
  try { await pr; assert.fail("attendu un refus contenant « " + needle + " »"); }
  catch (e: any) { if (e?.code === "ERR_ASSERTION" && String(e.message).startsWith("attendu")) throw e;
    assert.ok(String(e?.message ?? e).includes(needle), `message « ${e?.message} » doit contenir « ${needle} »`); }
};

(async () => {
  let passed = 0;
  const t = async (nom: string, fn: () => Promise<void>) => { await fn(); passed++; console.log("  ✓ " + nom); };
  console.log("Matrice documentaire versionnée (R26/R27/R29) :");

  // ── R27 : la juridiction résout le document ──
  await t("R27 : exigence string simple → passe telle quelle (pas de résolution)", async () => {
    assert.equal(DocMatrixService.resoudreDocument("PASSEPORT", "CH"), "PASSEPORT");
  });
  await t("R27 : groupe d'équivalence résolu par la juridiction du cas", async () => {
    const e = { groupe: "preuve_identite", parJuridiction: { CH: "PASSEPORT_CH", FR: "CNI_FR", "*": "PASSEPORT" } };
    assert.equal(DocMatrixService.resoudreDocument(e, "CH"), "PASSEPORT_CH");
    assert.equal(DocMatrixService.resoudreDocument(e, "FR"), "CNI_FR");
    assert.equal(DocMatrixService.resoudreDocument(e, "DE"), "PASSEPORT");   // repli « * »
  });
  await t("R27 : juridiction inconnue sans repli « * » → refus typé", async () => {
    const e = { parJuridiction: { CH: "X" } };
    assert.throws(() => DocMatrixService.resoudreDocument(e as any, "FR"), /\[R27\]/);
  });

  // ── R29 : versioning append-only + en vigueur à date ──
  await t("R29 : publier incrémente la version, journalise, append-only", async () => {
    const p = fake();
    const a = await svc(p).publier(CO_SR, { exigences: {} }, new Date("2026-01-01"));
    const b = await svc(p).publier(CO_SR, { exigences: {} }, new Date("2026-06-01"));
    assert.equal(a.version, 1);
    assert.equal(b.version, 2);
    assert.equal(p._rows.length, 2);
    assert.ok(p._events.some((e: any) => e.type === "matrice_documentaire.publiee"));
  });
  await t("R29 : contenu invalide (sans exigences) refusé", async () => {
    await rejects(svc(fake()).publier(CO_SR, { autre: 1 }, new Date()), "[R26]");
  });
  await t("R29 : en vigueur à date = la plus récente dont la vigueur ≤ at (rejeu R48)", async () => {
    const p = fake([
      { version: 1, enVigueurLe: new Date("2026-01-01"), contenu: { exigences: { PM: { entite: ["A"] } } } },
      { version: 2, enVigueurLe: new Date("2026-06-01"), contenu: { exigences: { PM: { entite: ["A", "B"] } } } }]);
    assert.equal((await svc(p).enVigueur(CO_SR, new Date("2026-03-01")))!.version, 1);   // avant v2 → v1
    assert.equal((await svc(p).enVigueur(CO_SR, new Date("2026-09-01")))!.version, 2);   // après v2 → v2
    assert.equal(await svc(p).enVigueur(CO_SR, new Date("2025-12-01")), null);           // avant toute vigueur
  });

  // ── R26 : union des porteurs + complétude ──
  const matrice = { version: 1, enVigueurLe: new Date("2026-01-01"), contenu: { exigences: {
    PM: { entite: ["REGISTRE"], personne_liee: ["PASSEPORT"], compte: ["FORM_A"] } } } };

  await t("R26 : union entité ⊕ personnes liées ⊕ comptes ; manquants remontés par porteur", async () => {
    const p = fake([matrice]);
    const dossier = { typeEntite: "PM", juridiction: "CH", titulaire: "E1",
      personnesLiees: ["P1", "P2"], comptes: ["C1"], documentsPresents: [] };
    const manque = await svc(p).evaluerCompletude(CO_SR, dossier, new Date("2026-03-01"));
    // 1 (entité) + 2 (personnes) + 1 (compte) = 4 exigences, toutes manquantes
    assert.equal(manque.length, 4);
    assert.ok(manque.some((m) => m.porteur === "E1" && m.document === "REGISTRE"));
    assert.ok(manque.some((m) => m.porteur === "P1" && m.document === "PASSEPORT"));
    assert.ok(manque.some((m) => m.porteur === "P2" && m.document === "PASSEPORT"));
    assert.ok(manque.some((m) => m.porteur === "C1" && m.document === "FORM_A"));
  });
  await t("R26 : un document présent pour LE bon porteur satisfait l'exigence (pas les autres porteurs)", async () => {
    const p = fake([matrice]);
    const dossier = { typeEntite: "PM", juridiction: "CH", titulaire: "E1",
      personnesLiees: ["P1", "P2"], comptes: [],
      documentsPresents: [{ porteur: "E1", nom: "REGISTRE" }, { porteur: "P1", nom: "PASSEPORT" }] };
    const manque = await svc(p).evaluerCompletude(CO_SR, dossier, new Date("2026-03-01"));
    assert.equal(manque.length, 1);                                  // seul P2 manque son passeport
    assert.deepEqual(manque[0], { porteur: "P2", document: "PASSEPORT" });
  });
  await t("R26/R27 : la juridiction du dossier choisit le document du groupe", async () => {
    const m = { version: 1, enVigueurLe: new Date("2026-01-01"), contenu: { exigences: {
      PP: { entite: [{ groupe: "id", parJuridiction: { CH: "PASSEPORT_CH", "*": "PASSEPORT" } }] } } } };
    const pCH = fake([m]); const pDE = fake([m]);
    const dCH = { typeEntite: "PP", juridiction: "CH", titulaire: "E1", documentsPresents: [{ porteur: "E1", nom: "PASSEPORT_CH" }] };
    const dDE = { typeEntite: "PP", juridiction: "DE", titulaire: "E1", documentsPresents: [{ porteur: "E1", nom: "PASSEPORT_CH" }] };
    assert.equal((await svc(pCH).evaluerCompletude(CO_SR, dCH, new Date("2026-03-01"))).length, 0);   // CH → PASSEPORT_CH présent
    const manqueDE = await svc(pDE).evaluerCompletude(CO_SR, dDE, new Date("2026-03-01"));
    assert.equal(manqueDE.length, 1);                                // DE → attend PASSEPORT (« * »), le CH ne compte pas
    assert.equal(manqueDE[0].document, "PASSEPORT");
  });
  await t("R26 : type d'entité hors matrice ⇒ aucune exigence (défaut neutre)", async () => {
    const p = fake([matrice]);
    const manque = await svc(p).evaluerCompletude(CO_SR, { typeEntite: "INCONNU", juridiction: "CH", titulaire: "E1" }, new Date("2026-03-01"));
    assert.equal(manque.length, 0);
  });
  await t("R26 : aucune matrice publiée ⇒ aucune exigence (le mécanisme ne fabrique aucun seuil)", async () => {
    const manque = await svc(fake()).evaluerCompletude(CO_SR, { typeEntite: "PM", juridiction: "CH", titulaire: "E1" }, new Date());
    assert.equal(manque.length, 0);
  });

  // ── R29 : grandfathering — le dossier est évalué contre SA version estampillée ──
  await t("R29 : estampille du dossier → évaluation contre la version figée, pas la courante", async () => {
    const p = fake([
      { version: 1, enVigueurLe: new Date("2026-01-01"), contenu: { exigences: { PM: { entite: ["REGISTRE"] } } } },
      { version: 2, enVigueurLe: new Date("2026-06-01"), contenu: { exigences: { PM: { entite: ["REGISTRE", "FISCAL"] } } } }]);
    const dossier: any = { typeEntite: "PM", juridiction: "CH", titulaire: "E1", matriceVersion: 1,
      documentsPresents: [{ porteur: "E1", nom: "REGISTRE" }] };
    // Évalué en 2026-09 (v2 en vigueur) mais estampillé v1 → FISCAL n'est PAS exigé (grandfathering).
    assert.equal((await svc(p).evaluerCompletude(CO_SR, dossier, new Date("2026-09-01"))).length, 0);
    // Sans estampille, la version en vigueur (v2) exige FISCAL en plus → 1 manquant.
    const courant = { ...dossier, matriceVersion: undefined };
    assert.equal((await svc(p).evaluerCompletude(CO_SR, courant, new Date("2026-09-01"))).length, 1);
  });
  await t("R29 : estampille pointant une version inexistante → refus typé", async () => {
    const p = fake([matrice]);
    await rejects(svc(p).evaluerCompletude(CO_SR, { typeEntite: "PM", juridiction: "CH", titulaire: "E1", matriceVersion: 99 } as any, new Date()), "introuvable");
  });

  console.log(`\n### ${passed}/${passed} tests docmatrix verts ###`);
})().catch((e) => { console.error(e); process.exit(1); });
