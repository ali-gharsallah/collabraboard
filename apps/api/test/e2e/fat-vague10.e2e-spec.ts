/**
 * FAT — Tests d'Acceptation Fonctionnelle Vague 10 (Front-câblage v2, phase 1 : Ports).
 * Exécutés contre le VRAI backend. Écran : Ports (FE-PORT) — « pas de secret = refus gracieux ».
 * Zéro invention : projection LISIBLE en lecture seule des ports RÉELLEMENT ratifiés
 * (core banking R167, IA R163, coffre/stockage R180). Le statut se déduit de la PRÉSENCE de la
 * configuration tenant (registre R-Q), jamais du secret — qui ne transite jamais.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT Vague 10 — Ports (backend réel)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const TID = randomUUID(); const ADMIN = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, TID, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  it("FAT-PORT-01 [Admin] le registre expose les ports RATIFIÉS ; tenant nu → tous NOT_CONFIGURED, aucun secret", async () => {
    const r = await request(http).get("/v1/ports").set(bearer(TID, ADMIN, "ADMIN"));
    expect(r.status).toBe(200);
    const ids = r.body.map((p: any) => p.portId).sort();
    expect(ids).toEqual(["core-banking", "ia", "storage"]);           // ports ratifiés uniquement
    // fx / custody / mobile ne sont PAS ratifiés → jamais listés (écart signalé)
    expect(ids).not.toContain("fx");
    expect(ids).not.toContain("custody");
    // Tenant nu : aucune référence configurée → tout NOT_CONFIGURED
    for (const p of r.body) {
      expect(p.status).toBe("NOT_CONFIGURED");
      expect(p).toHaveProperty("regle");
      // aucun secret ne transite : la charge n'expose que status/label/regle/date
      expect(JSON.stringify(p)).not.toMatch(/secret|password|token|apiKey/i);
    }
    console.log(`FAT-PORT-01 PASS — ${ids.length} ports ratifiés (${ids.join(", ")}), tenant nu → NOT_CONFIGURED, aucun secret exposé`);
  });

  it("FAT-PORT-02 [Admin] configurer un port au registre (R167/R126) → CONFIGURED reflété ; port inconnu → 404", async () => {
    // Déclarer le connecteur core banking = acte gouverné au registre (motivé, R126) — pas un secret côté front
    await request(http).post("/v1/parametres/valeur/coreSystemeRef").set(bearer(TID, ADMIN, "ADMIN"))
      .send({ valeur: "AVALOQ-CH v2026.1 (comptes, positions)", motif: "Déclaration du port core banking." }).expect(201);
    const reg = await request(http).get("/v1/ports").set(bearer(TID, ADMIN, "ADMIN"));
    const core = reg.body.find((p: any) => p.portId === "core-banking");
    expect(core.status).toBe("CONFIGURED");
    // Health du port configuré
    const h = await request(http).get("/v1/ports/core-banking/health").set(bearer(TID, ADMIN, "ADMIN"));
    expect(h.status).toBe(200);
    expect(h.body.status).toBe("CONFIGURED");
    expect(typeof h.body.checkedAt).toBe("string");
    // Port inconnu (fx non ratifié) → 404, jamais un port fabriqué
    const nf = await request(http).get("/v1/ports/fx/health").set(bearer(TID, ADMIN, "ADMIN"));
    expect(nf.status).toBe(404);
    console.log(`FAT-PORT-02 PASS — core-banking déclaré au registre → CONFIGURED ; health OK ; port inconnu 'fx' → 404 (jamais inventé)`);
  });
});
