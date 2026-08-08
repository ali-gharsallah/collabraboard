/**
 * Bloc 62 — Offboarding AU MOTEUR (repo R439–R445 · session R432–R438).
 * Spec exécutable : spec/BLOC-62-OFFBOARDING-R432-R438.md §3, OF-01..OF-14 transcrits
 * SANS adoucissement. Suite DISTINCTE du corpus historique OF-01..12 (R267–R271,
 * fat-offboarding.e2e-spec.ts) — collision d'IDs consignée : docs/ECARTS-FRONT.md E-OFF-3.
 * A2 : ces 14 tests sont ROUGES avant tout code moteur (squelette BLOC62_NON_IMPLEMENTE).
 */
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { AuditService } from "../../src/common/audit.service";
import { OffboardingMoteurService } from "../../src/modules/offboarding/offboarding-moteur.service";

const URL_OWNER = process.env.DATABASE_URL ?? "postgresql://olive:olive@localhost:5433/olive_test";
const j = (d: string) => new Date(d + "T12:00:00.000Z").toISOString();

describe("Bloc 62 — offboarding au moteur (R439–R445, spec/BLOC-62 §3)", () => {
  let owner: PrismaClient; let svc: OffboardingMoteurService;
  const T = randomUUID();
  const u = (role: string) => ({ tenantId: T, userId: randomUUID(), role });
  const RM1 = u("RM"), RM2 = u("RM"), CO1 = u("CO"), CO2 = u("CO"),
    CO_SR1 = u("CO_SR"), MLRO1 = u("MLRO"), DIR1 = u("DIR"), ADMIN1 = u("ADMIN");
  let C1: string, C2: string, C3: string, C4: string;

  const client = async (nom: string) => {
    const c = await owner.client.create({ data: { tenantId: T, name: nom } as any });
    return c.id;
  };

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: URL_OWNER } } });
    await owner.tenant.create({ data: { id: T, name: "B62-T" } as any });
    svc = new OffboardingMoteurService(owner as any, new AuditService(owner as any));
    C1 = await client("B62 Client Un"); C2 = await client("B62 Client Deux");
    C3 = await client("B62 Client Trois"); C4 = await client("B62 Client Quatre");
  });
  afterAll(async () => { await owner.$disconnect(); });

  const evs = (aggregateId: string) => owner.domainEvent.findMany({
    where: { tenantId: T, aggregateId }, orderBy: { id: "asc" } });

  it("OF-01 [R442/R439] — initiation par un rôle habilité : instance créée, WORKFLOW_STARTED, état « Création »", async () => {
    const r = await svc.initier(RM1, { clientId: C1, motif: "Demande du client" });
    expect(r.instanceId).toBeTruthy();
    expect(r.etat).toBe("Création");
    const e = await evs(r.instanceId);
    expect(e.some((x: any) => x.type === "WORKFLOW_STARTED"
      && (x.payload as any).par === RM1.userId && (x.payload as any).clientId === C1)).toBe(true);
  });

  it("OF-02 [R442] — rôle non habilité pour le motif « Sanctions » : refus explicite, aucune instance, aucun événement", async () => {
    const avant = await owner.domainEvent.count({ where: { tenantId: T, type: "WORKFLOW_STARTED" } });
    await expect(svc.initier(RM1, { clientId: C1, motif: "Sanctions" }))
      .rejects.toThrow(/R442.*RM.*non habilité|non habilité.*motif/i);
    const apres = await owner.domainEvent.count({ where: { tenantId: T, type: "WORKFLOW_STARTED" } });
    expect(apres).toBe(avant);                                    // aucun événement d'état émis
  });

  it("OF-03 [R439] — la progression est une TRANSITION : visa R15 dans TRANSITION_FIRED, aucun champ d'index sur la projection", async () => {
    const r = await svc.initier(RM1, { clientId: C1, motif: "Demande du client" });
    await svc.viser(RM2, r.instanceId);                           // maillon RM : Collecte→Review (Création→Collecte auto au 1er visa)
    const avant = await svc.etat(RM1, r.instanceId);
    expect(avant.etat).toBe("Review");
    await svc.viser(CO1, r.instanceId);                           // maillon CO : Review→Validation
    const e = await evs(r.instanceId);
    const tf: any = e.filter((x: any) => x.type === "TRANSITION_FIRED").pop();
    expect(tf.payload.from).toBe("Review");
    expect(tf.payload.to).toBe("Validation");
    expect(tf.payload.visa).toMatchObject({ validateur: CO1.userId, role: "CO" });   // objet R15 nommé
    expect(tf.payload.visa.at).toBeTruthy();                                          // horodaté
    const p = await svc.etat(RM1, r.instanceId);
    for (const champ of ["approvalIdx", "index", "idx", "compteur", "step"])          // OF-03 : PAS de compteur
      expect(p).not.toHaveProperty(champ);
  });

  it("OF-04 [R440] — Account Review non clôturée : transition refusée, GUARD_BLOCKED avec raison nommée, état inchangé", async () => {
    const r = await svc.initier(RM1, { clientId: C2, motif: "Demande du client" });
    await svc.viser(RM2, r.instanceId);
    const ar = await owner.reviewDeadline.create({ data: { tenantId: T, clientId: C2,
      sourceKycId: randomUUID(), ddlLevel: "CDD", cadenceMois: 12,
      dueDate: new Date("2026-01-01"), statut: "PLANIFIEE" } as any });     // échue = « OVERDUE »
    await expect(svc.viser(CO1, r.instanceId)).rejects.toThrow(/Account Review/i);
    const e = await evs(r.instanceId);
    const gb: any = e.filter((x: any) => x.type === "GUARD_BLOCKED").pop();
    expect(gb.payload.reason).toMatch(/Account Review non clôturée/);
    expect((await svc.etat(RM1, r.instanceId)).etat).toBe("Review");        // inchangé
    (svc as any)._arOF04 = { instanceId: r.instanceId, arId: ar.id };       // contexte partagé OF-05
  });

  it("OF-05 [R440] — bloqueur levé : la MÊME transition passe au prochain essai, sans intervention manuelle", async () => {
    const cx = (svc as any)._arOF04;
    await owner.reviewDeadline.update({ where: { id: cx.arId }, data: { statut: "REALISEE" } });
    await svc.viser(CO1, cx.instanceId);                          // même transition, guard réévalué
    const e = await evs(cx.instanceId);
    expect(e.some((x: any) => x.type === "TRANSITION_FIRED" && (x.payload as any).to === "Validation")).toBe(true);
  });

  it("OF-06 [R13/R441] — exclusion 4-yeux : l'initiateur ne vise JAMAIS (toute la chaîne) ; un autre porteur du rôle passe", async () => {
    const r = await svc.initier(CO1, { clientId: C1, motif: "Demande du client" });   // initiateur de rôle CO
    await svc.viser(RM1, r.instanceId);                           // maillon RM
    await expect(svc.viser(CO1, r.instanceId)).rejects.toThrow(/R13|4-yeux|initiateur/i);   // son propre dossier
    await svc.viser(CO2, r.instanceId);                           // un AUTRE CO passe
    expect((await svc.etat(CO1, r.instanceId)).etat).toBe("Validation");
  });

  it("OF-07 [R441] — forçage par motif : client LOW + « Sanctions » ⇒ chaîne HIGH, origine tracée dans l'événement de création", async () => {
    const r = await svc.initier(CO_SR1, { clientId: C2, motif: "Sanctions" });        // CO_SR habilité (défaut)
    const e = await evs(r.instanceId);
    const ws: any = e.find((x: any) => x.type === "WORKFLOW_STARTED");
    expect(ws.payload.chaine).toEqual(["RM", "CO_SR", "MLRO", "DIR"]);                // chains.HIGH
    expect(ws.payload.origineNiveau).toMatch(/forçage.*Sanctions/i);
  });

  it("OF-08 [R29/R441] — modification de chaîne versionnée : D1 (01.06) garde l'ancienne, D2 (02.07) applique la nouvelle", async () => {
    const d1 = await svc.initier(CO_SR1, { clientId: C3, motif: "Sanctions", dateInitiation: j("2026-06-01") });
    await svc.modifierParametre(ADMIN1, { cle: "chains.HIGH", valeur: ["RM", "CO_SR", "DIR"],
      enVigueurLe: j("2026-07-01"),
      confirmation: { engagementTexte: "Je confirme la portée : dossiers futurs (R29).", auteur: ADMIN1.userId } });
    expect((await evs("offboarding-params")).some((x: any) => x.type === "PARAM_CHANGED")).toBe(true);
    const d2 = await svc.initier(CO_SR1, { clientId: C3, motif: "Sanctions", dateInitiation: j("2026-07-02") });
    expect((await svc.etat(CO_SR1, d1.instanceId)).chaine).toEqual(["RM", "CO_SR", "MLRO", "DIR"]);   // grandfathering
    expect((await svc.etat(CO_SR1, d2.instanceId)).chaine).toEqual(["RM", "CO_SR", "DIR"]);
  });

  it("OF-09 [R443/R440] — item obligatoire non coché : GUARD_BLOCKED nommé, l'instance reste en « Validation »", async () => {
    const r = await svc.initier(RM1, { clientId: C1, motif: "Demande du client" });
    await svc.viser(RM2, r.instanceId); await svc.viser(CO1, r.instanceId);           // chaîne LOW visée → Validation
    await expect(svc.viser(CO2, r.instanceId)).rejects.toThrow(/obligatoire/i);       // clôture tentée, checklist incomplète
    const gb: any = (await evs(r.instanceId)).filter((x: any) => x.type === "GUARD_BLOCKED").pop();
    expect(gb.payload.reason).toMatch(/Item obligatoire non validé/);
    expect((await svc.etat(RM1, r.instanceId)).etat).toBe("Validation");
    (svc as any)._of09 = r.instanceId;                            // repris par OF-10
  });

  it("OF-10 [R439/R444/R16/R49] — clôture : WORKFLOW_COMPLETED, état « Clôturé », rien de modifié, écritures refusées", async () => {
    const id = (svc as any)._of09;
    const p = await svc.parametres(RM1);
    for (const item of p.checklistPP.filter((i: any) => i.obligatoire))
      await svc.cocherItem(CO1, id, item.label);                  // checklist complétée (événements, pas d'UPDATE)
    const avant = (await evs(id)).map((e: any) => e.id);
    await svc.viser(CO2, id);                                     // transition finale
    const e = await evs(id);
    expect(e.some((x: any) => x.type === "WORKFLOW_COMPLETED")).toBe(true);
    expect((await svc.etat(RM1, id)).etat).toBe("Clôturé");
    expect(e.map((x: any) => x.id).slice(0, avant.length)).toEqual(avant);            // rien modifié/supprimé (R49)
    await expect(svc.cocherItem(CO1, id, "n'importe")).rejects.toThrow(/Clôturé|lecture seule/i);
    (svc as any)._of10 = id;
  });

  it("OF-11 [R48/R51/R444] — rejeu à date d'un dossier clôturé : paramètres de la date d'initiation, audit trail par requête", async () => {
    const d1 = (svc as any)._of10;
    const rejeu = await svc.etat(RM1, d1, new Date("2026-08-08T23:59:59Z"));
    expect(rejeu.chaine).toEqual(["RM", "CO"]);                   // chaîne LOW figée à l'initiation
    expect(rejeu.checklist.some((i: any) => i.obligatoire)).toBe(true);
    const trail = await svc.auditTrail(RM1, d1);                  // requête directe, pas une reconstruction
    expect(trail.length).toBeGreaterThanOrEqual(3);
    expect(trail.every((x: any) => x.aggregateId === d1)).toBe(true);
  });

  it("OF-12 [R440/art. 10a] — MROS en attente : motif NEUTRE pour RM, détail pour CO_SR/MLRO/DIR, clôture refusée, zéro notification client", async () => {
    await owner.mrosCommunication.create({ data: { tenantId: T, riskCaseId: randomUUID(),
      clientId: C3, decision: "COMMUNIQUER", motif: "soupçon fondé", decidePar: CO_SR1.userId,
      decideAt: new Date().toISOString(), pieces: [], dossierSha256: "a".repeat(64),
      notification: null } as any });                             // EN ATTENTE DE TRANSMISSION
    const r = await svc.initier(RM1, { clientId: C3, motif: "Demande du client" });
    const hcRM = await svc.healthCheck(RM1, r.instanceId);
    const gRM = hcRM.guards.find((g: any) => g.guard === "MROS");
    expect(gRM.motif).toBe("Vérifications compliance en cours"); // neutre (tipping-off)
    expect(JSON.stringify(hcRM)).not.toMatch(/MROS/i);           // le mot n'apparaît nulle part pour RM
    const hcSR = await svc.healthCheck(CO_SR1, r.instanceId);
    expect(hcSR.guards.find((g: any) => g.guard === "MROS").motif).toMatch(/Déclaration MROS en attente/);
    await svc.viser(RM2, r.instanceId);
    await expect(svc.viser(CO1, r.instanceId)).rejects.toThrow(); // BLOQUANT par défaut
    expect((await evs(r.instanceId)).some((x: any) => x.type === "GUARD_BLOCKED")).toBe(true);
    const notifs = await owner.domainEvent.count({ where: { tenantId: T,
      type: { contains: "notification" }, aggregateId: r.instanceId } });
    expect(notifs).toBe(0);                                       // aucune notification client générée
  });

  it("OF-13 [R445/R440] — modification de guard SANS confirmation : refus 409 + payload pop-up ; AVEC : PARAM_CHANGED complet", async () => {
    await expect(svc.modifierParametre(ADMIN1, { cle: "guards.MROS", valeur: "AVERTISSEMENT",
      enVigueurLe: j("2026-08-08") })).rejects.toMatchObject({
        response: expect.objectContaining({ popup: expect.objectContaining({
          ancien: "BLOQUANT", nouveau: "AVERTISSEMENT",
          portee: expect.stringMatching(/dossiers futurs/i),
          rappelLBA: expect.stringMatching(/LBA/) }) }) });       // sans confirmation : AUCUNE écriture
    expect((await evs("offboarding-params")).filter((x: any) =>
      x.type === "PARAM_CHANGED" && (x.payload as any).cle === "guards.MROS").length).toBe(0);
    await svc.modifierParametre(ADMIN1, { cle: "guards.MROS", valeur: "AVERTISSEMENT",
      enVigueurLe: j("2026-08-08"),
      confirmation: { engagementTexte: "J'engage ma responsabilité — obligations LBA rappelées.", auteur: ADMIN1.userId } });
    const pc: any = (await evs("offboarding-params")).filter((x: any) =>
      x.type === "PARAM_CHANGED" && (x.payload as any).cle === "guards.MROS").pop();
    expect(pc.payload).toMatchObject({ auteur: ADMIN1.userId, ancien: "BLOQUANT",
      nouveau: "AVERTISSEMENT", engagementTexte: expect.stringMatching(/responsabilité/) });
  });

  it("OF-14 [R440] — guard AVERTISSEMENT : GUARD_WARNING émis (distinct de GUARD_BLOCKED), la transition PASSE, trail par ID", async () => {
    await owner.mrosCommunication.create({ data: { tenantId: T, riskCaseId: randomUUID(),
      clientId: C4, decision: "COMMUNIQUER", motif: "soupçon", decidePar: CO_SR1.userId,
      decideAt: new Date().toISOString(), pieces: [], dossierSha256: "b".repeat(64),
      notification: null } as any });
    const r = await svc.initier(RM1, { clientId: C4, motif: "Demande du client" });   // APRÈS OF-13 → sévérité AVERTISSEMENT
    await svc.viser(RM2, r.instanceId);
    await svc.viser(CO1, r.instanceId);                           // le guard MROS averti ne bloque plus
    const e = await evs(r.instanceId);
    const gw: any = e.filter((x: any) => x.type === "GUARD_WARNING").pop();
    expect(gw).toBeTruthy();
    expect(gw.payload.reason).toMatch(/MROS/);
    expect(e.some((x: any) => x.type === "GUARD_BLOCKED")).toBe(false);               // distinct, pas confondu
    expect(e.some((x: any) => x.type === "TRANSITION_FIRED" && (x.payload as any).to === "Validation")).toBe(true);
    const trail = await svc.auditTrail(RM1, r.instanceId);        // extractible par ID (R51)
    expect(trail.some((x: any) => x.type === "GUARD_WARNING")).toBe(true);
  });
});
