/**
 * FAT — SOLDE 4 ÉCARTS partie 4 (2026-07-29) : EN-TÊTES de sécurité — vérification ciblée
 * du cadrage OWASP (ASVS V14.4) à re-prouver AVANT le prestataire. Les en-têtes se posent
 * SERVEUR, sur TOUTE réponse (y compris les refus) — jamais un réglage de reverse-proxy
 * seul (le proxy ajoute HSTS en prod, l'app reste sûre sans lui).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { boot, bearer } from "./util";
import { OutboxWorker } from "../../src/modules/events/outbox.worker";

describe("FAT SÉCURITÉ — en-têtes sur toute réponse (ASVS V14.4, partie 4)", () => {
  let app: INestApplication; let http: any;
  beforeAll(async () => { ({ app } = await boot()); http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy(); });
  afterAll(async () => { await app.close(); });

  it("SEC-01 : nosniff, frame-deny, CSP et no-referrer présents — sur un 200 ET sur un refus", async () => {
    const T = randomUUID();
    const ok = await request(http).get("/v1/tasks").set(bearer(T, randomUUID(), "CO"));
    const refus = await request(http).get("/v1/clients");                   // sans jeton → 401
    for (const r of [ok, refus]) {
      expect(r.headers["x-content-type-options"]).toBe("nosniff");
      expect(r.headers["x-frame-options"]).toBe("DENY");
      expect(r.headers["content-security-policy"]).toContain("default-src 'none'");  // une API ne sert pas de HTML
      expect(r.headers["referrer-policy"]).toBe("no-referrer");
    }
    expect(refus.status).toBe(401);
    console.log("SEC-01 PASS — en-têtes présents sur 200 et 401");
  });
});
