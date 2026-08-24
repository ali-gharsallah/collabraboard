/**
 * ES-4 (docs/SURVEILLANCE-ES.md §3 inv. 6) — recette du parallel run (shadow), ES4-01..04.
 *   • ES4-01 réconciliation exacte : concordantes / seulement-ES / seulement-existantes, et
 *     critères évalués EXPLICITEMENT (oui/non) — ici alerte existante manquée → bascule NON ;
 *   • ES4-02 corpus couvrant + écarts diagnostiqués → les deux critères OUI, basculePermise ;
 *   • ES4-03 écart additionnel SANS diagnostic → critère 2 NON (l'inexpliqué bloque) ;
 *   • ES4-04 AUCUNE émission réelle : rien au stream `alerte`, aucune tâche créée, et le
 *     service n'importe pas le canal de proposition (structurel) ; run reproductible (deja).
 */
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { EsEventStore } from "../../src/modules/surveillance-es/es-event-store.service";
import { EsShadow, STREAM_SHADOW } from "../../src/modules/surveillance-es/es-shadow.service";
import { STREAM_FAITS } from "../../src/modules/surveillance-es/es-subscriber.service";

const URL_OWNER = process.env.DATABASE_URL ?? "postgresql://olive:olive@localhost:5433/olive_test";

describe("ES-4 — parallel run (shadow) + réconciliation (jalon de vérité)", () => {
  let owner: PrismaClient; let store: EsEventStore; let shadow: EsShadow;
  const T = randomUUID(); const ctx = { tenantId: T };
  const evaluateur = (f: any) => ({ declenche: Number(f.payload?.donnees?.montant ?? 0) >= 10_000 });

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: URL_OWNER } } });
    store = new EsEventStore(owner as any);
    shadow = new EsShadow(store);
    let seq = 0;
    for (const [cle, montant] of [["evt-X", 15_000], ["evt-Y", 20_000], ["evt-Z", 100]] as const)
      await store.append(ctx, STREAM_FAITS, `${T}:tx`, [{ type: "fait.tx.flux.importee",
        sourceEventId: cle, payload: { donnees: { montant } } }], seq++);
  });
  afterAll(async () => { await owner.$disconnect(); });

  it("ES4-01 réconciliation exacte + alerte existante manquée → bascule NON", async () => {
    const { rapport } = await shadow.executerShadow(ctx, { corpusId: "corpus-1", evaluateur,
      existantes: [{ cle: "evt-X", source: "aml-2g" }, { cle: "evt-W", source: "aml-2g" }],
      diagnostics: { "evt-Y": "seuil ES plus sensible que le scénario 2G historique (assumé)" } });
    expect(rapport.concordantes).toEqual(["evt-X"]);
    expect(rapport.seulementEs).toEqual([{ cle: "evt-Y", diagnostic: expect.stringContaining("seuil ES") }]);
    expect(rapport.seulementExistantes).toEqual([{ cle: "evt-W", source: "aml-2g", diagnostic: null }]);
    expect(rapport.criteres).toEqual({ zeroAlerteExistanteManqueeParEs: false,
      ecartsAdditionnelsTousExpliques: true, basculePermise: false });   // evt-W manquée → NON, explicite
  });

  it("ES4-02 corpus couvrant + écarts diagnostiqués → critères OUI/OUI, basculePermise", async () => {
    const { rapport } = await shadow.executerShadow(ctx, { corpusId: "corpus-2", evaluateur,
      existantes: [{ cle: "evt-X", source: "aml-2g" }],
      diagnostics: { "evt-Y": "détection additionnelle ES, revue et assumée" } });
    expect(rapport.criteres).toEqual({ zeroAlerteExistanteManqueeParEs: true,
      ecartsAdditionnelsTousExpliques: true, basculePermise: true });
  });

  it("ES4-03 écart additionnel SANS diagnostic → critère 2 NON (l'inexpliqué bloque)", async () => {
    const { rapport } = await shadow.executerShadow(ctx, { corpusId: "corpus-3", evaluateur,
      existantes: [{ cle: "evt-X", source: "aml-2g" }] });                // evt-Y sans diagnostic
    expect(rapport.criteres.ecartsAdditionnelsTousExpliques).toBe(false);
    expect(rapport.criteres.basculePermise).toBe(false);
  });

  it("ES4-04 AUCUNE émission réelle (structurel) + run reproductible", async () => {
    const reelles: any[] = await owner.$queryRaw`SELECT count(*)::int AS n FROM "es"."events"
      WHERE "tenant_id" = ${T}::uuid AND "stream_type" = 'alerte'`;
    expect(reelles[0].n).toBe(0);                                        // rien au stream alerte
    const taches: any[] = await owner.$queryRaw`SELECT count(*)::int AS n FROM tasks
      WHERE tenant_id = ${T}::uuid`;
    expect(taches[0].n).toBe(0);                                         // aucune tâche monolithe
    const src = readFileSync(join(__dirname, "..", "..", "src", "modules", "surveillance-es", "es-shadow.service.ts"), "utf8");
    expect(src).not.toMatch(/from "\.\.\/tasks\//);                       // impossibilité ARCHITECTURALE (aucun import du canal)
    const encore = await shadow.executerShadow(ctx, { corpusId: "corpus-2", evaluateur,
      existantes: [{ cle: "evt-X", source: "aml-2g" }] });
    expect(encore.deja).toBe(true);                                      // le run relit SON rapport
    const s: any[] = await owner.$queryRaw`SELECT count(*)::int AS n FROM "es"."events"
      WHERE "tenant_id" = ${T}::uuid AND "stream_type" = ${STREAM_SHADOW}`;
    expect(s[0].n).toBeGreaterThan(0);                                   // tout vit dans shadow
  });
});
