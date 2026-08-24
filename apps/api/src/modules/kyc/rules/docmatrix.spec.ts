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
      // orderBy accepte la forme objet ET la forme TABLEAU (tri à plusieurs clés) — le fake doit
      // trier comme Prisma, sinon il prouverait un déterminisme que la base ne donne pas.
      const cles = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
      if (cles.length) ms = [...ms].sort((a, b) => {
        for (const c of cles) {
          const [k, sens] = Object.entries(c)[0] as [string, string];
          const d = typeof a[k] === "number" ? (b[k] as number) - (a[k] as number) : sortDesc(a, b, k);
          if (d !== 0) return sens === "desc" ? d : -d;
        }
        return 0;
      });
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

  await t("R48 : à date de vigueur ÉGALE, la version la plus récemment publiée gagne (rejeu déterministe)", async () => {
    // Cas réel : corriger la matrice le jour même de sa prise d'effet crée deux versions à la
    // même date. Sans second critère de tri, « en vigueur » dépend de l'ordre de la base.
    const p = fake([
      { version: 1, enVigueurLe: new Date("2026-01-01"), contenu: { exigences: { PM: { entite: ["A"] } } } },
      { version: 2, enVigueurLe: new Date("2026-01-01"), contenu: { exigences: { PM: { entite: ["A", "B"] } } } }]);
    assert.equal((await svc(p).enVigueur(CO_SR, new Date("2026-03-01")))!.version, 2);
  });

  // ══ R26 — AXE RÔLE (enrichissement du contrat, arbitré PO 12.08.2026) ══════════════════════
  // R26 dit « les documents requis se déduisent du croisement type d'entité × juridiction ×
  // RÔLE » et le scénario S-03 nomme les rôles des personnes liées (« BE, signataire »). Le
  // moteur ne connaissait que le PORTEUR (entite / personne_liee / compte) : un bénéficiaire
  // effectif et un signataire exigeaient exactement les mêmes pièces. Le contrat gagne
  // `parRole`, exigences ADDITIONNELLES ; le socle `personne_liee` reste ce qu'il était.
  const matriceRoles = { version: 1, enVigueurLe: new Date("2026-01-01"), contenu: { exigences: {
    SA: {
      entite: ["REGISTRE_COMMERCE"],
      personne_liee: ["PASSEPORT"],                                  // socle : TOUT intervenant
      parRole: {
        UBO: ["FORMULAIRE_A", "FORMULAIRE_K"],                       // CDB 20 art. 27 / art. 20
        SIGNATAIRE: ["PROCURATION"],
      },
    } } } };

  await t("R26/rôle : parRole AJOUTE aux exigences du socle (union, jamais remplacement)", async () => {
    const p = fake([matriceRoles]);
    const manque = await svc(p).evaluerCompletude(CO_SR, { typeEntite: "SA", juridiction: "CH",
      titulaire: "E1", personnesLiees: [{ id: "P1", roles: ["UBO"] }], documentsPresents: [] } as any,
      new Date("2026-03-01"));
    const deP1 = manque.filter((m) => m.porteur === "P1").map((m) => m.document).sort();
    assert.deepEqual(deP1, ["FORMULAIRE_A", "FORMULAIRE_K", "PASSEPORT"]);   // socle ⊕ rôle
  });
  await t("R26/rôle : deux rôles sur la même personne CUMULENT, sans doublon du socle", async () => {
    const p = fake([matriceRoles]);
    const manque = await svc(p).evaluerCompletude(CO_SR, { typeEntite: "SA", juridiction: "CH",
      titulaire: "E1", personnesLiees: [{ id: "P1", roles: ["UBO", "SIGNATAIRE"] }], documentsPresents: [] } as any,
      new Date("2026-03-01"));
    const deP1 = manque.filter((m) => m.porteur === "P1").map((m) => m.document).sort();
    assert.deepEqual(deP1, ["FORMULAIRE_A", "FORMULAIRE_K", "PASSEPORT", "PROCURATION"]);
    assert.equal(deP1.filter((d) => d === "PASSEPORT").length, 1);           // le socle ne compte qu'une fois
  });
  await t("R26/rôle : un rôle absent de la matrice n'ajoute RIEN (défaut neutre, aucune exigence inventée)", async () => {
    const p = fake([matriceRoles]);
    const manque = await svc(p).evaluerCompletude(CO_SR, { typeEntite: "SA", juridiction: "CH",
      titulaire: "E1", personnesLiees: [{ id: "P1", roles: ["PROTECTEUR"] }], documentsPresents: [] } as any,
      new Date("2026-03-01"));
    assert.deepEqual(manque.filter((m) => m.porteur === "P1").map((m) => m.document), ["PASSEPORT"]);
  });
  await t("R26/rôle : personne SANS rôle déclaré ⇒ socle seul (le rôle n'est jamais deviné)", async () => {
    const p = fake([matriceRoles]);
    const manque = await svc(p).evaluerCompletude(CO_SR, { typeEntite: "SA", juridiction: "CH",
      titulaire: "E1", personnesLiees: [{ id: "P1" }], documentsPresents: [] } as any, new Date("2026-03-01"));
    assert.deepEqual(manque.filter((m) => m.porteur === "P1").map((m) => m.document), ["PASSEPORT"]);
  });
  await t("R26/rôle : forme HISTORIQUE (personnesLiees: string[]) ⇒ comportement strictement inchangé", async () => {
    // Compatibilité ascendante : un appelant qui n'a pas encore les rôles n'obtient QUE le socle.
    const p = fake([matriceRoles]);
    const manque = await svc(p).evaluerCompletude(CO_SR, { typeEntite: "SA", juridiction: "CH",
      titulaire: "E1", personnesLiees: ["P1", "P2"], documentsPresents: [] } as any, new Date("2026-03-01"));
    assert.deepEqual(manque.filter((m) => m.porteur === "P1").map((m) => m.document), ["PASSEPORT"]);
    assert.deepEqual(manque.filter((m) => m.porteur === "P2").map((m) => m.document), ["PASSEPORT"]);
  });
  await t("R29/rôle : une matrice publiée SANS parRole évalue EXACTEMENT comme avant (grandfathering)", async () => {
    // La garde qui protège les dossiers déjà validés : l'enrichissement du contrat ne doit rien
    // exiger de plus sur une version qui ne connaissait pas les rôles, même si le dossier, lui,
    // porte désormais des rôles. Sinon un dossier conforme deviendrait rétroactivement incomplet.
    const base = { typeEntite: "PM", juridiction: "CH", titulaire: "E1", comptes: [], documentsPresents: [] };
    const avecRoles = { ...base, personnesLiees: [{ id: "P1", roles: ["UBO", "SIGNATAIRE"] }] };
    const sansRoles = { ...base, personnesLiees: ["P1"] };
    // La comparaison porte sur les DEUX évaluations : porter des rôles ne change RIEN quand la
    // version en vigueur ne les connaît pas. C'est l'énoncé exact du grandfathering.
    assert.deepEqual(await svc(fake([matrice])).evaluerCompletude(CO_SR, avecRoles as any, new Date("2026-03-01")),
      await svc(fake([matrice])).evaluerCompletude(CO_SR, sansRoles as any, new Date("2026-03-01")));
  });
  await t("R26/R27 : la juridiction résout AUSSI les exigences de rôle (groupe d'équivalence)", async () => {
    const m = { version: 1, enVigueurLe: new Date("2026-01-01"), contenu: { exigences: { SA: {
      parRole: { UBO: [{ groupe: "preuve_ubo", parJuridiction: { CH: "FORM_A_CH", "*": "UBO_DECL" } }] } } } } };
    const pCH = fake([m]); const pDE = fake([m]);
    const d = (j: string) => ({ typeEntite: "SA", juridiction: j, titulaire: "E1",
      personnesLiees: [{ id: "P1", roles: ["UBO"] }], documentsPresents: [] });
    assert.equal((await svc(pCH).evaluerCompletude(CO_SR, d("CH") as any, new Date("2026-03-01")))[0].document, "FORM_A_CH");
    assert.equal((await svc(pDE).evaluerCompletude(CO_SR, d("DE") as any, new Date("2026-03-01")))[0].document, "UBO_DECL");
  });
  await t("R26 : parRole malformé refusé À LA PUBLICATION (jamais découvert à l'évaluation)", async () => {
    await rejects(svc(fake()).publier(CO_SR, { exigences: { SA: { parRole: ["UBO"] } } }, new Date()), "[R26]");
    await rejects(svc(fake()).publier(CO_SR, { exigences: { SA: { parRole: { UBO: "FORM_A" } } } }, new Date()), "[R26]");
  });
  await t("R26 : un même document exigé deux fois pour le MÊME porteur ne se signale qu'une fois", async () => {
    // Sans déduplication, un intervenant cumulant deux rôles qui exigent la même pièce
    // apparaîtrait deux fois dans la liste des manquants — un bruit qui se lit comme deux trous.
    const m = { version: 1, enVigueurLe: new Date("2026-01-01"), contenu: { exigences: { SA: {
      personne_liee: ["PASSEPORT"], parRole: { UBO: ["PASSEPORT"], SIGNATAIRE: ["PASSEPORT"] } } } } };
    const manque = await svc(fake([m])).evaluerCompletude(CO_SR, { typeEntite: "SA", juridiction: "CH",
      titulaire: "E1", personnesLiees: [{ id: "P1", roles: ["UBO", "SIGNATAIRE"] }], documentsPresents: [] } as any,
      new Date("2026-03-01"));
    assert.deepEqual(manque, [{ porteur: "P1", document: "PASSEPORT" }]);
  });

  console.log(`\n### ${passed}/${passed} tests docmatrix verts ###`);
})().catch((e) => { console.error(e); process.exit(1); });
