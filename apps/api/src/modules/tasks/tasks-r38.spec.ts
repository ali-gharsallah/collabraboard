// R38 — routage rôle→personne in-scope. Port fidèle de creer_tache / deleguer_tache
// (test_bloc5_taches.py T-02/T-03). Autonome (node:assert), sans DB. Nominal ⊕ violation.
process.env.AUDIT_HMAC_SECRET = process.env.AUDIT_HMAC_SECRET || "0".repeat(64);
import * as assert from "node:assert/strict";
import { TasksService } from "./tasks.module";

const audit = { log: async () => undefined } as any;
const workload = { reassigner: async () => undefined } as any;

// Fake Prisma : users (id/role), clients (rmUserId), tasks (create/find/update), tenant.settings.
// Modèle du test Python : KYC-A servi par RM1 ; CO/CF sont voit-tout ; RM2 ignore la relation A.
function fake() {
  const users = [
    { id: "RM1", tenantId: "t1", role: "RM" }, { id: "RM2", tenantId: "t1", role: "RM" },
    { id: "ARM1", tenantId: "t1", role: "ARM" },
    { id: "CO1", tenantId: "t1", role: "CO" }, { id: "CF1", tenantId: "t1", role: "CF" }];
  const clients = [{ id: "CA", tenantId: "t1", rmUserId: "RM1" }];           // KYC-A → client CA, RM = RM1
  const kycFiles = [{ id: "KA", code: "KYC-A", tenantId: "t1", clientId: "CA" }];
  const tasks: any[] = [];
  const events: any[] = [];
  const first = (arr: any[], where: any) => arr.find((r) => Object.entries(where).every(([k, v]: any) => {
    if (k === "OR") return (v as any[]).some((o) => Object.entries(o).every(([kk, vv]: any) => r[kk] === vv));
    return r[k] === v;
  })) ?? null;
  const p: any = {
    user: { findFirst: async ({ where }: any) => first(users, where),
      findMany: async ({ where, orderBy }: any) => { let ms = users.filter((u) => u.tenantId === where.tenantId && u.role === where.role);
        if (orderBy?.id === "asc") ms = [...ms].sort((a, b) => a.id.localeCompare(b.id)); return ms; } },
    client: { findFirst: async ({ where }: any) => first(clients, where) },
    kycFile: { findFirst: async ({ where }: any) => first(kycFiles, where) },
    tenant: { findFirst: async () => ({ id: "t1", settings: { taskVisibiliteRoles: ["CO", "CF", "ADMIN"] } }) },
    task: { create: async ({ data }: any) => { const k = { id: "T" + (tasks.length + 1), ...data }; tasks.push(k); return k; },
      findFirst: async ({ where }: any) => first(tasks, where),
      update: async ({ where, data }: any) => { const k = tasks.find((x) => x.id === where.id); Object.assign(k, data); return k; } },
    domainEvent: { create: async ({ data }: any) => { events.push(data); return data; } },
    _tasks: tasks, _events: events,
  };
  p.$transaction = async (fn: any) => fn(p);
  return p;
}
const svc = (p: any) => new TasksService(p, audit, workload);
const CO = { tenantId: "t1", userId: "CO1", role: "CO" };
const rejects = async (pr: Promise<any>, needle: string) => {
  try { await pr; assert.fail("attendu un refus contenant « " + needle + " »"); }
  catch (e: any) { if (e?.code === "ERR_ASSERTION" && String(e.message).startsWith("attendu")) throw e;
    assert.ok(String(e?.message ?? e).includes(needle), `message « ${e?.message} » doit contenir « ${needle} »`); }
};

(async () => {
  let passed = 0;
  const t = async (nom: string, fn: () => Promise<void>) => { await fn(); passed++; console.log("  ✓ " + nom); };
  console.log("Routage des tâches R38 (rôle → personne in-scope) :");

  await t("T-02 : rôle « RM » → auto-affecté au RM in-scope (RM1), jamais à RM2 qui ignore la relation", async () => {
    const p = fake();
    const r: any = await svc(p).creerRoutee(CO, { type: "collecter_passeport", role: "RM", subjectType: "KYC", subjectId: "KYC-A" });
    assert.equal(r.assignee, "RM1");                          // RM1 sert la relation CA
    assert.notEqual(r.assignee, "RM2");                       // RM2 hors périmètre
    assert.equal(p._tasks[0].roleCible, "RM");               // le rôle visé est enregistré
    assert.ok(p._events.some((e: any) => e.type === "task.routed"));
  });
  await t("T-02 : ciblage explicite hors périmètre (RM2) → routage interdit (403 typé)", async () => {
    await rejects(svc(fake()).creerRoutee(CO, { type: "collecter_facture", role: "RM", subjectType: "KYC", subjectId: "KYC-A", cible: "RM2" }), "[R38]");
  });
  await t("T-02 : ciblage explicite in-scope (RM1) → accepté", async () => {
    const r: any = await svc(fake()).creerRoutee(CO, { type: "collecter_facture", role: "RM", subjectType: "KYC", subjectId: "KYC-A", cible: "RM1" });
    assert.equal(r.assignee, "RM1");
  });
  await t("R38 : un rôle voit-tout (CO) est in-scope de toute relation (auto-affectation permise)", async () => {
    const r: any = await svc(fake()).creerRoutee(CO, { type: "revue", role: "CO", subjectType: "KYC", subjectId: "KYC-A" });
    assert.equal(r.assignee, "CO1");                          // CO voit-tout → in-scope sans être RM
  });
  await t("R38 : aucun membre du rôle en périmètre → refus typé (le titulaire est obligatoire)", async () => {
    // rôle « ARM » : ARM1 n'est ni voit-tout ni RM de CA → aucun in-scope.
    await rejects(svc(fake()).creerRoutee(CO, { type: "x", role: "ARM", subjectType: "KYC", subjectId: "KYC-A" }), "[R38]");
  });

  await t("T-03 : délégation native RM1 → ARM1 (fonctionnement normal, tracée de→vers)", async () => {
    const p = fake();
    const r0: any = await svc(p).creerRoutee(CO, { type: "collecter_passeport", role: "RM", subjectType: "KYC", subjectId: "KYC-A" });
    const r1: any = await svc(p).deleguer({ tenantId: "t1", userId: "RM1", role: "RM" }, r0.id, "ARM1");
    assert.equal(r1.assignee, "ARM1");
    const ev = p._events.find((e: any) => e.type === "task.delegated");
    assert.ok(ev && ev.payload.de === "RM1" && ev.payload.vers === "ARM1");
  });

  console.log(`\n### ${passed}/${passed} tests tasks-r38 verts ###`);
})().catch((e) => { console.error(e); process.exit(1); });
