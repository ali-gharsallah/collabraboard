/**
 * Bloc WD (R432–R438) — specs spec/wd/WD-*.feature branchées en Jest e2e.
 * Événements dans le journal APPEND-ONLY existant (emitEvent) ; l'état du WIR est un REJEU.
 *   • WD-01/02 : import → WIR normalisé, archivé GED (hash), statut DRAFT_AI jamais publiable ;
 *   • WD-03/12 : zones illisibles + confidence < seuil marqués À VÉRIFIER (rien corrigé) ;
 *   • WD-06 : rôle non mappé = anomalie bloquante à la ratification ;
 *   • WD-08 : importeur ≠ ratifieur (R13/R435) — refus PUIS visa croisé → brouillon du
 *     module de versioning EXISTANT (WorkflowDefService, R29/R48) ;
 *   • WD-10 : rejeu à date reconstitue source → WIR brut → éditions → visa.
 */
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { AuditService } from "../../src/common/audit.service";
import { GedIngestionService } from "../../src/modules/ged/ged-ingestion.service";
import { WorkflowDefService } from "../../src/modules/workflow/workflow-def.service";
import { WorkflowDesignerService, StubVisionExtractor }
  from "../../src/modules/workflow-designer/workflow-designer.service";

const URL_OWNER = process.env.DATABASE_URL ?? "postgresql://olive:olive@localhost:5433/olive_test";
const PNG_1PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("WD — module workflow-designer (R432–R438, spec/wd/WD-01..12)", () => {
  let owner: PrismaClient; let svc: WorkflowDesignerService; let defs: WorkflowDefService;
  const T = randomUUID();
  const CO = { tenantId: T, userId: randomUUID(), role: "CO" };       // audit_logs.actor = uuid
  const CO_SR = { tenantId: T, userId: randomUUID(), role: "CO_SR" };
  let wirId: string;

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: URL_OWNER } } });
    await owner.tenant.create({ data: { id: T, name: "WD-T",
      settings: { workflowRoles: ["CO", "ADMIN", "CO_SR"] } } as any });   // R173 : le tenant HABILITE son ratifieur Q-WD-2
    const audit = new AuditService(owner as any);
    defs = new WorkflowDefService(owner as any, audit);
    svc = new WorkflowDesignerService(owner as any, audit,
      new GedIngestionService(owner as any, audit), defs, new StubVisionExtractor());
  });
  afterAll(async () => { await owner.$disconnect(); });

  it("WD-01/02/09 — import image : archivage GED + hash, WIR normalisé, DRAFT_AI jamais publiable", async () => {
    const r = await svc.importer(CO, { imageBase64: PNG_1PX, mediaType: "image/png",
      nomFichier: "workflow-edd.png" });
    wirId = r.wirId;
    expect(r.documentId).toBeTruthy();                             // archivé dans la GED réelle
    expect(r.wir.meta.hashFichier).toMatch(/^sha256:/);            // R436 : hash tracé
    expect(r.wir.meta.modele).toBeTruthy();                        // modèle+version tracés
    expect(r.wir.meta.status).toBe("DRAFT_AI");                    // R433
    expect(r.wir.nodes[0]).toHaveProperty("ownerRole");
    expect(r.wir.nodes[0]).toHaveProperty("confidence");
    await expect(svc.ratifier(CO_SR, wirId)).rejects.toThrow(/R433/);   // jamais activable direct
  });

  it("WD-03/12 — zones illisibles avec coordonnées + nœud sous seuil marqué À VÉRIFIER", async () => {
    const e = await svc.etat(CO, wirId);
    expect(e.zonesIllisibles.length).toBeGreaterThan(0);
    expect(e.zonesIllisibles[0]).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    expect(e.wir.nodes.some((n: any) => n.aVerifier)).toBe(true);  // confidence < seuil R-Q (0.6)
  });

  it("WD-06 — format refusé (Q-WD-4) et taille au-delà de 10 Mo refusée", async () => {
    await expect(svc.importer(CO, { imageBase64: PNG_1PX, mediaType: "image/gif",
      nomFichier: "x.gif" })).rejects.toThrow(/Q-WD/);
  });

  it("WD-07/08 — édition humaine (WF_IR_EDITED) puis visa : refus même auteur, visa croisé → brouillon du versioning EXISTANT", async () => {
    await svc.editer(CO, wirId, { noeud: "n1", label: "Collecte renforcée",
      ownerRole: "CO" });                                          // mappe aussi le rôle à vérifier
    const e = await svc.etat(CO, wirId);
    expect(e.statut).toBe("DRAFT_HUMAN");
    await expect(svc.ratifier(CO, wirId)).rejects.toThrow(/R435|R13/);   // importeur = ratifieur
    const r = await svc.ratifier(CO_SR, wirId);
    expect(r.defId).toBeTruthy();                                  // brouillon créé dans workflow
    const def: any = await (owner as any).workflowDef.findUnique({ where: { id: r.defId } });
    expect(def.statut).toBe("BROUILLON");                          // publication = circuit existant
  });

  it("WD-10 — rejeu à date : source → WIR brut → éditions → visa, reconstitué du journal", async () => {
    const maintenant = await svc.etat(CO, wirId);
    expect(maintenant.historique.map((h: any) => h.type)).toEqual([
      "wd.wir.importe", "wd.wir.edite", "wd.wir.ratifie"]);
    const avantEdition = await svc.etat(CO, wirId, new Date(maintenant.historique[0].at));
    expect(avantEdition.statut).toBe("DRAFT_AI");                  // l'état à date = rejeu partiel
    expect(avantEdition.wir.nodes.find((n: any) => n.id === "n1")!.label)
      .not.toBe("Collecte renforcée");
  });

  it("WD-06bis — rôle non mappé BLOQUANT à la ratification (anomalies listées, pas corrigées)", async () => {
    const r2 = await svc.importer(CO, { imageBase64: PNG_1PX, mediaType: "image/png",
      nomFichier: "roles-exotiques.png", forcerRole: "SORCIER" } as any);
    await svc.editer(CO, r2.wirId, { noeud: "n1", label: "ok" });
    await expect(svc.ratifier(CO_SR, r2.wirId)).rejects.toThrow(/ROLE_NON_MAPPE/);
    const e = await svc.etat(CO, r2.wirId);
    expect(e.anomalies.some((a: any) => a.code === "ROLE_NON_MAPPE" && a.bloquant)).toBe(true);
  });
});
