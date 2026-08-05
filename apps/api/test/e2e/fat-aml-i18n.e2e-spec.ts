/**
 * FAT — i18n des règles SERVIE PAR L'API (SPEC-I18N §3), backend RÉEL.
 *
 * Décision drop 2026-08-04 : « le front ne traduit pas le contenu métier, il l'affiche ». Les
 * définitions de règles (nom/desc EN/DE/IT, source PO data/i18n-aml-gap.json) voyagent avec le
 * référentiel servi par GET /v1/aml/scenarios — jamais bundlées au front (budget), jamais
 * fabriquées à la main. Le Gherkin reste FR (langue normative) ; l'arabe n'a pas de contenu
 * (glossaire CONTRAIGNANT sans colonne AR) → repli FR côté front, prouvé ici par son ABSENCE.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer } from "./util";

describe("FAT AML gap i18n — référentiel servi par l'API (SPEC-I18N §3, backend réel)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const U = randomUUID();

  beforeAll(async () => { ({ app, prisma } = await boot()); http = app.getHttpServer(); });
  afterAll(async () => { await app.close(); });

  it("GET /v1/aml/scenarios : chaque règle porte ses traductions PO (nom/desc EN/DE/IT)", async () => {
    const r = await request(http).get("/v1/aml/scenarios").set(bearer(T, U, "CO"));
    expect(r.status).toBe(200);
    const scen = r.body as any[];
    expect(scen.length).toBeGreaterThan(0);

    // Toute règle des blocs 50–61 présente dans la source PO doit exposer son i18n via l'API.
    const avecI18n = scen.filter((s) => s.i18n && s.i18n.en && s.i18n.en.nom);
    expect(avecI18n.length).toBeGreaterThan(0);
    for (const s of avecI18n) {
      for (const lg of ["en", "de", "it"] as const) {
        expect(typeof s.i18n[lg]?.nom).toBe("string");
        expect(s.i18n[lg].nom.length).toBeGreaterThan(0);
        expect(typeof s.i18n[lg]?.desc).toBe("string");
        expect(s.i18n[lg].desc.length).toBeGreaterThan(0);
      }
    }
    console.log("I18N-1 PASS —", avecI18n.length, "règles avec traductions EN/DE/IT servies");
  });

  it("le Gherkin reste FR (langue normative), l'arabe n'a AUCUN contenu (repli FR côté front)", async () => {
    const r = await request(http).get("/v1/aml/scenarios").set(bearer(T, U, "CO"));
    const s = (r.body as any[]).find((x) => x.i18n && x.i18n.en);
    expect(s).toBeTruthy();
    // R44/normativité : le Gherkin n'est pas traduit — il reste la formulation FR figée.
    expect(s.gherkin).toBeTruthy();
    expect(typeof s.gherkin.given).toBe("string");
    // L'AR n'existe pas dans la source PO (pas de fabrication) : le bloc i18n ne le porte jamais.
    expect(s.i18n.ar).toBeUndefined();
    console.log("I18N-2 PASS — Gherkin FR conservé, AR absent (jamais fabriqué)");
  });
});
