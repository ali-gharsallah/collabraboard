// Harnais idempotence — IDM-01..03 + filtre (Bloc B, R337/IDM). Autonome (node:assert), sans DB :
// prisma factice (Map). Le rejeu réel + l'atomicité (IDM-04/05) sont prouvés en e2e.
import * as assert from "node:assert/strict";
import { executerIdempotent, IdempotencyKeyReuseError, IdempotencyReuseFilter } from "./idempotency";

function fakePrisma() {
  const store = new Map<string, any>();
  const pc = {
    findUnique: async ({ where }: any) => store.get(where.commandId) ?? null,
    create: async ({ data }: any) => { store.set(data.commandId, data); return data; },
  };
  return { store, processedCommand: pc, $transaction: async (fn: any) => fn({ processedCommand: pc }) };
}

(async () => {
  let passed = 0; const t = async (nom: string, fn: () => Promise<void>) => { await fn(); passed++; console.log("  ✓ " + nom); };
  console.log("Idempotence (R337/IDM) :");
  const C = "11111111-1111-1111-1111-111111111111", T = "22222222-2222-2222-2222-222222222222";

  const p = fakePrisma(); let effets = 0;
  const cmd = (payload: unknown) => executerIdempotent(p as any, { commandId: C, tenantId: T, aggregateId: "a", payload },
    async () => { effets++; return { ok: true, n: effets }; }, { enforce: true });

  await t("IDM-01 clé neuve → exécute la commande UNE fois et la consomme", async () => {
    const r = await cmd({ x: 1 });
    assert.equal(r.replayed, false);
    assert.equal(effets, 1);
    assert.ok(p.store.has(C));                                     // clé consommée
  });

  await t("IDM-02 rejeu (même clé, même payload) → réponse snapshotée, AUCUN nouvel effet", async () => {
    const r = await cmd({ x: 1 });
    assert.equal(r.replayed, true);
    assert.equal(effets, 1);                                       // fn NON réexécuté
    assert.deepEqual(r.response, { ok: true, n: 1 });              // la réponse d'origine
  });

  await t("IDM-03 même clé, payload DIFFÉRENT → IdempotencyKeyReuseError (collision client)", async () => {
    await assert.rejects(() => cmd({ x: 2 }), (e: any) => e instanceof IdempotencyKeyReuseError && e.commandId === C);
    assert.equal(effets, 1);                                       // rien exécuté
  });

  await t("IDM-filtre : IdempotencyKeyReuseError → HTTP 422 typé", async () => {
    const cap: any = {};
    const host: any = { switchToHttp: () => ({ getResponse: () => ({
      status(c: number) { cap.code = c; return this; }, json(b: any) { cap.body = b; return this; } }) }) };
    new IdempotencyReuseFilter().catch(new IdempotencyKeyReuseError(C), host);
    assert.equal(cap.code, 422);
    assert.equal(cap.body.error, "idempotency_key_reuse");
    assert.equal(cap.body.command_id, C);
  });

  console.log(`\n### ${passed}/${passed} tests idempotency verts ###`);
})().catch((e) => { console.error(e); process.exit(1); });
