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

  it("R29 : une traduction tenant VERSIONNÉE est grandfathered à la date (défaut PO avant vigueur)", async () => {
    // Le tenant re-traduit SF-01 (ex. terminologie régulateur), en vigueur au 2026-06-01. Une
    // traduction de règle est un changement VERSIONNÉ par date de vigueur (SPEC-I18N §3, R29).
    const trad = {
      en: { nom: "SF-01 (tenant wording)", desc: "tenant-specific EN description" },
      de: { nom: "SF-01 (Mandanten-Wortlaut)", desc: "de" },
      it: { nom: "SF-01 (dicitura tenant)", desc: "it" },
    };
    await prisma.$executeRaw`INSERT INTO tenants (id, name, created_at)
      VALUES (${T}::uuid, 'GWB', NOW()) ON CONFLICT (id) DO NOTHING`;
    await prisma.amlScenario.create({
      data: {
        tenantId: T, code: "SF-01", ruleRef: "R340", fam: "SF", version: 2,
        effectiveFrom: new Date("2026-06-01T00:00:00.000Z"), params: {}, i18n: trad, active: true,
      },
    });

    // AVANT vigueur (mars) → défaut PO généré, PAS l'override tenant ; version 1.
    const avant = await request(http).get("/v1/aml/scenarios?date=2026-03-01").set(bearer(T, U, "CO"));
    const aSF = (avant.body as any[]).find((x) => x.code === "SF-01");
    expect(aSF.i18n.en.nom).not.toBe("SF-01 (tenant wording)");
    expect(aSF.version).toBe(1);

    // APRÈS vigueur (septembre) → override tenant servi, version 2 portée.
    const apres = await request(http).get("/v1/aml/scenarios?date=2026-09-01").set(bearer(T, U, "CO"));
    const pSF = (apres.body as any[]).find((x) => x.code === "SF-01");
    expect(pSF.i18n.en.nom).toBe("SF-01 (tenant wording)");
    expect(pSF.i18n.de.nom).toBe("SF-01 (Mandanten-Wortlaut)");
    expect(pSF.version).toBe(2);
    // Surcharge CIBLÉE : les autres scénarios gardent le défaut PO (version 1).
    const other = (apres.body as any[]).find((x) => x.code !== "SF-01" && x.i18n?.en);
    expect(other.version).toBe(1);
    console.log("I18N-3 PASS — traduction tenant grandfatherée par date (R29), surcharge ciblée");
  });
});
