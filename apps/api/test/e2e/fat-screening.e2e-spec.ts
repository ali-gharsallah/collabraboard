/**
 * E2E — R267 : la voie HTTP réelle rejoue le golden set et se comporte comme le MOTEUR testé au
 * gate (R260, services/screening/gate.test.mjs). Preuve de bout en bout que `POST /v1/screening/run`
 * — client Prisma → index trigramme (R264) → score composite (R263) → hit persisté avec décomposition
 * (R266) — donne les MÊMES verdicts que rapprocher() mesuré hors-ligne. Aucun mock : NestFactory +
 * supertest + Postgres jetable, JWT RS256 (TenantMiddleware).
 *
 * 10 cas figés du golden set (graine 20260715, seuil 85, forme MAPPED `dates_naissance[0]→
 * date_naissance`, identique au gate) : 6 correspondances certaines (exact, alias, typo, ordre,
 * diacritiques, translittération), 2 translittérations au score PARTIEL (97/98 — prouvent que le
 * score persisté n'est plus le binaire 100|0), 1 homonyme au nom EXACT mais date incompatible (à
 * rejeter par le discriminant DOB à travers HTTP), 1 client sans rapport (aucun hit).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer } from "./util";

const body = (r: request.Response) => JSON.stringify(r.body);

// Liste de sanctions synthétique + mapping APPELANT identique au gate (services/screening/
// gate.test.mjs:33) : DOB simple + alias en chaînes. AUCUNE modification moteur — c'est la forme
// qui active le discriminant DOB et sur laquelle les cibles du cahier sont tenues.
const FIX = join(__dirname, "../../../../services/screening/fixtures");
const san = JSON.parse(readFileSync(join(FIX, "sanctions-synth.json"), "utf8"));
// Projetée sur la forme EntreeListe (uid/nom/alias/dob/type) : les seuls champs que lisent le
// moteur et hashEntree. Réduit la charge (413 sinon) sans altérer ni les 625 entrées ni le verdict.
const ENTRIES = san.entries.map((e: any) => ({
  uid: e.uid, nom_complet: e.nom_complet, type: e.type,
  date_naissance: e.dates_naissance ? e.dates_naissance[0] : e.date_naissance,
  alias: (e.alias || []).map((a: any) => (typeof a === "string" ? a : a.nom)),
}));

// 10 cas du golden set (mêmes id/requête/attendu que fixtures/golden-set.json). `partiel` marque
// les scores composites < 100 : ils prouvent que la voie HTTP persiste un vrai 0-100, pas 100|0.
type Cas = { id: string; nom: string; dob: string; attendu: string | null; categorie: string; partiel?: boolean };
const CAS: Cas[] = [
  { id: "G-EXACT-SYN-SAN-P-100000",    nom: "Muhammad Haddad",  dob: "1980-05-22", attendu: "SYN-SAN-P-100000", categorie: "exact" },
  { id: "G-ALIAS-SYN-SAN-P-100000",    nom: "Mohammed Haddad",  dob: "1980-05-22", attendu: "SYN-SAN-P-100000", categorie: "alias_connu" },
  { id: "G-TYPO-SYN-SAN-P-100029",     nom: "Aleksand Sokolov", dob: "1973-12-15", attendu: "SYN-SAN-P-100029", categorie: "typo" },
  { id: "G-ORDRE-SYN-SAN-P-100016",    nom: "Yang Wei",         dob: "1986",       attendu: "SYN-SAN-P-100016", categorie: "ordre_nom" },
  { id: "G-DIACRIT-SYN-SAN-P-100004",  nom: "Katarzyna Muller", dob: "1979-09-19", attendu: "SYN-SAN-P-100004", categorie: "diacritiques" },
  { id: "G-TRANSLIT-SYN-SAN-P-100000", nom: "Mohamad Haddad",   dob: "1980-05-22", attendu: "SYN-SAN-P-100000", categorie: "translitteration_hors_liste" },
  { id: "G-TRANSLIT-SYN-SAN-P-100010", nom: "Tarek Al-Habib",   dob: "1988-06-24", attendu: "SYN-SAN-P-100010", categorie: "translitteration_hors_liste", partiel: true },
  { id: "G-TRANSLIT-SYN-SAN-P-100018", nom: "Umar Al-Sayed",    dob: "1978",       attendu: "SYN-SAN-P-100018", categorie: "translitteration_hors_liste", partiel: true },
  { id: "G-HOMONYME-SYN-SAN-P-100000", nom: "Muhammad Haddad",  dob: "2002-05-22", attendu: null,               categorie: "homonyme" },
  { id: "G-NEUTRE-0",                  nom: "Jean Dupont",      dob: "1970-01-10", attendu: null,               categorie: "client_ordinaire" },
];

describe("Screening — R267 : la voie HTTP rejoue le golden set (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: any;
  const TID = randomUUID(), CO = randomUUID();
  const clientId: Record<string, string> = {};   // id de cas → uuid client
  let run: any, hits: any[];

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await prisma.$executeRaw`INSERT INTO tenants (id, name, created_at) VALUES (${TID}::uuid, 'GWB', NOW())
      ON CONFLICT (id) DO NOTHING`;
    // Un client réel par cas : name = requête, date_naissance = DOB (discriminant), structure = PP.
    for (const c of CAS) {
      const id = randomUUID(); clientId[c.id] = id;
      await prisma.$executeRaw`INSERT INTO clients (id, tenant_id, name, structure, country, risk_level, date_naissance, created_at)
        VALUES (${id}::uuid, ${TID}::uuid, ${c.nom}, 'PP', 'CH', 'LOW', ${c.dob}, NOW())
        ON CONFLICT (id) DO NOTHING`;
    }
    // La voie HTTP RÉELLE, seuil 85, pré-filtre = défauts du cahier (R264).
    const res = await request(http).post("/v1/screening/run").set(bearer(TID, CO, "CO")).send({
      liste: "SECO", version: "2026-07-15", seuil: 85,
      prefiltre: { minPartages: 2, maxTrigrammes: 12, plafond: 400 },
      entries: ENTRIES, clientIds: Object.values(clientId),
    });
    expect(res.status).toBeLessThan(300);
    run = res.body.run; hits = res.body.hits;
  }, 60_000);
  afterAll(async () => { await app.close(); });

  const hitDe = (casId: string) => hits.find((h) => h.clientId === clientId[casId]);

  // ── 6 correspondances certaines : hit sur l'UID attendu, score composite ≥ seuil, détail présent (R266) ──
  for (const c of CAS.filter((x) => x.attendu)) {
    it(`R267 ${c.categorie} — ${c.nom} → ${c.attendu} (hit HTTP, score composite, détail)`, () => {
      const h = hitDe(c.id);
      expect(h).toBeDefined();
      expect(h.entreeUid).toBe(c.attendu);            // même verdict que le moteur du gate
      expect(h.score).toBeGreaterThanOrEqual(85);     // R263 : score composite ≥ seuil
      expect(h.score).toBeLessThanOrEqual(100);
      expect(h.statut).toBe("BRUT");                  // R100 : hit brut, jamais une alerte
      expect(h.detail).toBeTruthy();                  // R266 : décomposition explicable persistée
      expect(typeof h.detail.via).toBe("string");
      expect(typeof h.detail.nameScore).toBe("number");
    });
  }

  // ── R263 — le score persisté est un VRAI composite 0-100, plus jamais le binaire 100|0 ──
  it("R263 — au moins un hit au score partiel (< 100) : la binaire est morte", () => {
    const partiels = CAS.filter((x) => x.partiel).map((x) => hitDe(x.id)).filter(Boolean);
    expect(partiels.length).toBeGreaterThan(0);
    for (const h of partiels) { expect(h.score).toBeGreaterThan(85); expect(h.score).toBeLessThan(100); }
  });

  // ── Discriminant DOB à travers HTTP : nom EXACT mais date incompatible → AUCUN hit (homonyme) ──
  it("R267 homonyme — Muhammad Haddad / 2002 : nom exact, date incompatible → rejeté (0 hit)", () => {
    expect(hitDe("G-HOMONYME-SYN-SAN-P-100000")).toBeUndefined();
    // et le VRAI Muhammad Haddad (1980) est bien retenu : le rejet vient de la DATE, pas du nom.
    expect(hitDe("G-EXACT-SYN-SAN-P-100000")).toBeDefined();
  });

  // ── Client sans rapport avec la liste : aucun hit (pré-filtre + seuil) ──
  it("R267 client_ordinaire — Jean Dupont : aucun hit", () => {
    expect(hitDe("G-NEUTRE-0")).toBeUndefined();
  });

  // ── R103 — la trace de passage est écrite, le périmètre couvre les 10 clients, nbHits = hits reçus ──
  it("R103/R264 — run tracé : périmètre 10, nbHits cohérent, pré-filtre figé", async () => {
    expect(run.perimetre).toBe(CAS.length);
    expect(run.nbHits).toBe(hits.length);
    expect(run.prefiltre).toMatchObject({ minPartages: 2, maxTrigrammes: 12, plafond: 400 });
    const enBase = await prisma.screeningRun.findFirst({ where: { id: run.id } });
    expect(enBase).toBeTruthy();
  });

  // ── R266 — la décomposition est bien PERSISTÉE en base (colonne detail Json), relue telle quelle ──
  it("R266 — le détail est relu depuis Postgres (score, via, DOB, type)", async () => {
    const h = hitDe("G-EXACT-SYN-SAN-P-100000");
    const enBase: any = await prisma.screeningHit.findFirst({ where: { id: h.id } });
    expect(enBase.detail).toBeTruthy();
    expect(enBase.detail).toHaveProperty("via");
    expect(enBase.detail).toHaveProperty("nameScore");
    expect(enBase.detail).toHaveProperty("dobContribution");
    expect(enBase.detail).toHaveProperty("typePenalty");
  });
});
