/**
 * Câblage Calendrier réglementaire — CR-01..CR-10 (R490→R492).
 * Miroir strict de `spec/CALENDRIER-REGLEMENTAIRE-R490-R492.md`. Faux Prisma en mémoire.
 *
 * Harnais : compiler reglementaire.service.ts + ce fichier ;
 *   echo "── Câblage calendrier réglementaire (CR-01..10, R490→R492) ──"; run reglementaire.wiring.spec.js
 *
 * Ce que ces tests protègent, en une phrase : le moteur MESURE et SIGNALE, il ne dépose rien,
 * il n'invente aucune échéance, et il ne déclare jamais en retard une obligation que la loi
 * n'a pas datée.
 */
import { ReglementaireService } from "./reglementaire.service";
declare const process: { exit(n: number): void };

let passed = 0, failed = 0; const fails: string[] = [];
function it(name: string, fn: () => Promise<void>): Promise<void> {
  return fn().then(() => { passed++; }, (e: Error) => { failed++; fails.push(`✗ ${name} — ${e.message}`); });
}
const ok = (c: boolean, m = "assertion") => { if (!c) throw new Error(m); };
const eq = (a: unknown, b: unknown, m = "") => ok(a === b, `${m} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`);
async function rejects(p: Promise<unknown>, part: string): Promise<void> {
  try { await p; } catch (e) { if ((e as Error).message.includes(part)) return;
    throw new Error(`attendu «${part}», obtenu «${(e as Error).message}»`); }
  throw new Error(`refus «${part}» attendu`);
}

const CTX = { tenantId: "t1", userId: "u-co", role: "CO" };

// Calendrier de TEST (contenu fictif — le vrai est arbitré banque, cf. Q-CR-1 de la spec).
const CALENDRIER = [
  { code: "LBA-9", obligation: "Communication au MROS", periode: "au fil de l'eau",
    echeance: null, base: "LBA art. 9", responsable: "MLRO" },
  { code: "RAP-LBA-2025", obligation: "Rapport annuel LBA à la direction", periode: "2025",
    echeance: "2026-03-31", base: "OBA-FINMA", responsable: "MLRO" },
  { code: "AEOI-2025", obligation: "Auto-déclaration AEOI/CRS", periode: "2025",
    echeance: "2026-06-30", base: "LEAR", responsable: "Fiscalité" },
];

/** Faux socle : paramètres à date (registre R-Q) + journal append-only. */
function fake(calendrier: any = CALENDRIER, preavisJours = 30) {
  const events: any[] = [];
  const params: Record<string, any> = { calendrierReglementaire: calendrier, reglementairePreavisJours: preavisJours };
  const prisma: any = {
    domainEvent: {
      create: async ({ data }: any) => { events.push(data); return data; },
      findMany: async ({ where }: any = {}) => events.filter((e) =>
        (!where?.tenantId || e.tenantId === where.tenantId)
        && (!where?.type || (where.type.in ? where.type.in.includes(e.type) : e.type === where.type))),
    },
    _events: events,
  };
  prisma.$transaction = async (fn: any) => fn(prisma);
  const parametres: any = { valeurEffective: async (_c: any, cle: string) => params[cle] ?? null };
  const audit: any = { log: async () => undefined };
  return { svc: new ReglementaireService(prisma, parametres, audit), prisma, params };
}

(async () => {
  const { svc, prisma } = fake();

  // ── R490 : le calendrier vient de la CONFIG, jamais du code ──
  await it("CR-01 [R490] le calendrier lu est celui du registre R-Q — aucune obligation n'est codée en dur", async () => {
    const vide = fake([]).svc;
    const r = await vide.calendrier(CTX, new Date("2026-08-12"));
    eq(r.obligations.length, 0, "sans config, AUCUNE obligation n'est fabriquée");
    const plein = await svc.calendrier(CTX, new Date("2026-08-12"));
    eq(plein.obligations.length, 3, "les 3 obligations de la config");
  });

  // ── R491 : le statut est CALCULÉ à la date d'observation ──
  await it("CR-02 [R491] A_VENIR / DUE / EN_RETARD se calculent par rapport à la date d'observation", async () => {
    const au = (d: string) => svc.calendrier(CTX, new Date(d));
    const statut = async (d: string, code: string) =>
      (await au(d)).obligations.find((o: any) => o.code === code)!.statut;
    eq(await statut("2026-01-15", "AEOI-2025"), "A_VENIR", "loin de l'échéance");
    eq(await statut("2026-06-10", "AEOI-2025"), "DUE", "dans le préavis de 30 jours");
    eq(await statut("2026-06-30", "AEOI-2025"), "DUE", "le JOUR de l'échéance n'est pas un retard");
    eq(await statut("2026-07-01", "AEOI-2025"), "EN_RETARD", "le lendemain, si");
  });

  await it("CR-03 [R490/R491] une obligation SANS échéance n'est JAMAIS déclarée en retard", async () => {
    // « Sans délai » (LBA art. 9) n'est pas une date. Fabriquer une échéance pour pouvoir
    // afficher un retard serait un jugement juridique que personne n'a demandé au moteur.
    for (const d of ["2020-01-01", "2026-08-12", "2099-12-31"]) {
      const o = (await svc.calendrier(CTX, new Date(d))).obligations.find((x: any) => x.code === "LBA-9")!;
      eq(o.statut, "SANS_ECHEANCE", `à la date ${d}`);
    }
  });

  await it("CR-04 [R491] le préavis est gouverné : le changer déplace la frontière A_VENIR/DUE", async () => {
    const large = fake(CALENDRIER, 90).svc;
    const o = (await large.calendrier(CTX, new Date("2026-04-15"))).obligations.find((x: any) => x.code === "AEOI-2025")!;
    eq(o.statut, "DUE", "avec 90 jours de préavis, mi-avril est déjà DUE");
    const o30 = (await svc.calendrier(CTX, new Date("2026-04-15"))).obligations.find((x: any) => x.code === "AEOI-2025")!;
    eq(o30.statut, "A_VENIR", "avec 30 jours, non");
  });

  // ── R492 : le dépôt est un acte humain motivé ──
  await it("CR-05 [R492/R7] consigner un dépôt SANS motif est refusé", async () => {
    await rejects(svc.consignerDepot(CTX, "AEOI-2025", { periode: "2025", reference: "ACK-1" } as any), "R7");
  });
  await it("CR-05b [R492] consigner un dépôt sans RÉFÉRENCE est refusé — un dépôt sans accusé n'est pas une preuve", async () => {
    await rejects(svc.consignerDepot(CTX, "AEOI-2025", { periode: "2025", motif: "déposé au portail" } as any), "reference");
  });

  await it("CR-06 [R492] un code absent du calendrier en vigueur est refusé (le nom du code est dit)", async () => {
    await rejects(svc.consignerDepot(CTX, "INEXISTANT", { periode: "2025", reference: "X", motif: "m" }), "INEXISTANT");
  });

  await it("CR-07 [R492/R49] le dépôt produit un ÉVÉNEMENT append-only, et rien d'autre", async () => {
    const avant = prisma._events.length;
    const r = await svc.consignerDepot(CTX, "AEOI-2025",
      { periode: "2025", reference: "ACK-AEOI-42", motif: "dépôt portail AFC du 12.06" });
    eq(r.code, "AEOI-2025");
    eq(prisma._events.length, avant + 1, "exactement UN événement");
    const e = prisma._events[prisma._events.length - 1];
    eq(e.type, "reglementaire.depot.consigne");
    eq((e.payload as any).reference, "ACK-AEOI-42");
    eq((e.payload as any).par, "u-co", "l'auteur est nominatif");
  });

  await it("CR-08 [R491] après dépôt, le statut devient DEPOSEE — même après l'échéance", async () => {
    const o = (await svc.calendrier(CTX, new Date("2026-12-31"))).obligations.find((x: any) => x.code === "AEOI-2025")!;
    eq(o.statut, "DEPOSEE", "un dépôt consigné prime sur le calendrier");
    eq(o.depot.reference, "ACK-AEOI-42", "la référence du dépôt est rendue à l'écran");
  });

  await it("CR-09 [R492] un SECOND dépôt pour la même période est refusé, et le refus NOMME le premier", async () => {
    await rejects(svc.consignerDepot(CTX, "AEOI-2025", { periode: "2025", reference: "ACK-99", motif: "re-dépôt" }),
      "ACK-AEOI-42");
  });
  await it("CR-09b [R492] le même code sur une AUTRE période reste déposable", async () => {
    const r = await svc.consignerDepot(CTX, "AEOI-2025", { periode: "2024", reference: "ACK-2024", motif: "exercice précédent" });
    eq(r.periode, "2024");
  });

  await it("CR-10 [R39/R44] le signalement MESURE le retard — il ne dépose ni ne régularise rien", async () => {
    const { svc: s2, prisma: p2 } = fake();
    const avant = p2._events.length;
    const sig = await s2.signaler(CTX, new Date("2026-07-01"));
    // au 01.07 : le rapport annuel (31.03) ET l'AEOI (30.06) sont dépassés — les DEUX sont
    // nommés dans le signalement, avec leur base légale : un compteur sans les codes ne sert
    // à personne, et c'est le responsable qu'il faut pouvoir appeler.
    eq(sig.parStatut.EN_RETARD, 2, "RAP-LBA-2025 et AEOI-2025 sont dépassées au 01.07");
    eq(sig.enRetard.map((o: any) => o.code).sort().join(","), "AEOI-2025,RAP-LBA-2025");
    eq(sig.enRetard.find((o: any) => o.code === "AEOI-2025").base, "LEAR", "la base légale voyage");
    eq(sig.parStatut.SANS_ECHEANCE, 1, "LBA-9 n'est pas comptée en retard");
    // un seul événement : le signalement lui-même. AUCUN dépôt n'a été posé par le moteur.
    eq(p2._events.length, avant + 1, "un seul événement émis");
    eq(p2._events[p2._events.length - 1].type, "reglementaire.retard.signale");
    ok(!p2._events.some((e: any) => e.type === "reglementaire.depot.consigne"),
      "le moteur n'a consigné AUCUN dépôt de sa propre initiative (R44)");
  });

  console.log(`\n### ${passed}/${passed + failed} tests calendrier réglementaire ###`);
  if (failed) { fails.forEach((f) => console.error(f)); process.exit(1); }
})();
