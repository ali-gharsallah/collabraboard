/**
 * FAT — CANON DES DEUX DERNIERS ÉCARTS (R284–R287, ratifié le 2026-07-28 —
 * spec/canon-so-et-transport-async.md). Partie transport (livrée en premier) :
 * R285 l'outbox précède tout message (AS-01, AS-02) · R286 at-least-once, idempotent,
 * échec visible (AS-03..05) · R287 SSE projection éphémère (AS-06..08).
 * Famille AS (vérifiée libre). Le rôle SO (R284, famille SO après mapping ratifié
 * AU→SO) suit dans ce même fichier, livré en second.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";
import { OutboxWorker, messageDeTransport } from "../../src/modules/events/outbox.worker";

describe("FAT CANON DERNIERS — R285 : rien ne part qui ne soit d'abord ÉCRIT (AS-01, AS-02)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any; let worker: OutboxWorker;
  const T = randomUUID();
  const RM = randomUUID();
  const clientId = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    worker = app.get(OutboxWorker);
    worker.onModuleDestroy();                        // le TEST contrôle le relais — plus aucun tick spontané
    // Hygiène de fixture : la base e2e réutilisée porte un backlog d'événements d'anciens runs ;
    // on le solde pour que le drain (LIMIT 20, ordre id) atteigne LES événements de CE test.
    await prisma.$executeRawUnsafe(`UPDATE domain_events SET published_at = NOW() WHERE published_at IS NULL`);
    await seedTenantClient(prisma, T, clientId);
  });
  afterAll(async () => { await app.close(); });

  it("AS-01 [R285] l'outbox précède tout message : l'événement naît DANS la transaction métier, rien n'est émis avant le relais — le crash ne perd rien", async () => {
    // Transaction métier réelle : créer un dossier KYC → kyc.created DANS la même transaction
    const kyc = (await request(http).post("/v1/kyc").set(bearer(T, RM, "RM"))
      .send({ clientId, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM })).body;
    const ev = await prisma.domainEvent.findFirst({ where: { tenantId: T, type: "kyc.created", aggregateId: kyc.id } });
    expect(ev).toBeTruthy();                                                // (1) l'événement EST écrit
    expect(ev!.publishedAt).toBeNull();                                     // (2) rien n'est encore parti — fenêtre de crash sans perte
    // « Redémarrage » : le relais rattrape depuis l'outbox — rien de perdu
    await worker.tick();
    const apres = await prisma.domainEvent.findFirst({ where: { id: ev!.id } });
    expect(apres!.publishedAt).not.toBeNull();                              // (3) publié PAR le relais, jamais avant
    // Revue de code AUTOMATISÉE : aucune primitive d'émission hors du module events (le relais est UNIQUE)
    const racine = path.resolve(__dirname, "..", "..", "src", "modules");
    const fautifs: string[] = [];
    const balayer = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== "events") balayer(p); continue; }
        if (!p.endsWith(".ts") || p.includes(".spec.")) continue;
        const src = fs.readFileSync(p, "utf8");
        for (const prim of ["text/event-stream", "EventSource", "WebSocket", "amqplib", "kafkajs"])
          if (src.includes(prim)) fautifs.push(`${p} : ${prim}`);
      }
    };
    balayer(racine);
    expect(fautifs).toEqual([]);                                            // émission directe hors relais = INTERDIT
    console.log("AS-01 PASS — événement écrit avant tout message, relais unique, rattrapage au redémarrage");
  });

  it("AS-02 [R285] le transport porte des RÉFÉRENCES, jamais le payload métier — et la relecture applique les droits", async () => {
    // Le message de transport se construit d'UNE fonction — inspectée ici avec un payload sensible
    const m: any = messageDeTransport({ id: BigInt(42), tenant_id: T, type: "kyc.validated",
      aggregate_id: "AGG-1", payload: { nomClient: "NOM_CLIENT_CONFIDENTIEL", riskLevel: "HIGH" } } as any);
    expect(JSON.stringify(m)).not.toContain("NOM_CLIENT_CONFIDENTIEL");     // AUCUN payload métier
    expect(m.event_id).toBe("evt_42");
    expect(m.seq).toBe(42);
    expect(m.type).toBe("kyc.validated");
    expect(m.aggregate_id).toBe("AGG-1");                                   // la RÉFÉRENCE — le consommateur relit la source
    expect(Object.keys(m).sort()).toEqual(["aggregate_id", "event_id", "occurred_at", "seq", "tenant_id", "type"]);
    // Le relais UTILISE cette fonction (revue de code : plus jamais `data: ev.payload` dans un corps sortant)
    const src = fs.readFileSync(path.resolve(__dirname, "..", "..", "src", "modules", "events", "outbox.worker.ts"), "utf8");
    expect(src).toContain("messageDeTransport(ev)");
    expect(src).not.toContain("data: ev.payload");
    // La relecture de la référence APPLIQUE les droits : un autre tenant ne relit rien
    const kyc = await prisma.kycFile.findFirst({ where: { tenantId: T, clientId } });
    await request(http).get(`/v1/kyc/${kyc!.code}`).set(bearer(randomUUID(), randomUUID(), "CO_SR")).expect(404);
    console.log("AS-02 PASS — références seules au transport, relecture sous RBAC/RLS");
  });
});
