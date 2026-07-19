/** Tests API admin users — création (hash), liste, activation, rôle, reset MFA. Harnais autonome. */
import { UsersService } from "./users.service";
import { PasswordHasher } from "./password";
declare const process: any;

function fakePrisma(seed: any[] = []) {
  const st: any = { users: [...seed] };
  return { _st: st, user: {
    findFirst: async ({ where }: any) => st.users.find((u: any) =>
      (where.id ? u.id === where.id : true) && (where.email ? u.email === where.email : true) && u.tenantId === where.tenantId) ?? null,
    findMany: async ({ where }: any) => st.users.filter((u: any) => u.tenantId === where.tenantId),
    create: async ({ data }: any) => { const u = { id: "u" + (st.users.length + 1), mfaEnabled: false, ...data }; st.users.push(u); return u; },
    update: async ({ where, data }: any) => { const u = st.users.find((x: any) => x.id === where.id); Object.assign(u, data); return u; },
  } } as any;
}
let passed = 0, failed = 0; const fails: string[] = [];
function it(n: string, fn: () => Promise<void>): Promise<void> { return fn().then(() => { passed++; }, (e: Error) => { failed++; fails.push(`✗ ${n} — ${e.message}`); }); }
function ok(c: boolean, m = "assertion"): void { if (!c) throw new Error(m); }
async function rejects(p: Promise<unknown>, part: string): Promise<void> {
  try { await p; } catch (e) { const n = (e as any).constructor.name; if ((e as Error).message.includes(part) || n.includes("Conflict") || n.includes("NotFound")) return; throw new Error(`rejet «${part}» attendu`); } throw new Error(`rejet «${part}» attendu`); }

(async () => {
  await it("AD-01 create : mot de passe haché, pas de hash en sortie", async () => {
    const p = fakePrisma(); const r: any = await new UsersService(p).create("t1", { email: "x@gwb.ch", name: "X", role: "RM", password: "pw12345" });
    ok(r.role === "RM" && (r as any).passwordHash === undefined);
    ok(PasswordHasher.verify("pw12345", p._st.users[0].passwordHash) === true);   // haché, vérifiable
  });
  await it("AD-02 create : email dupliqué → 409", async () => {
    const p = fakePrisma([{ id: "u1", tenantId: "t1", email: "x@gwb.ch", role: "RM", active: true }]);
    await rejects(new UsersService(p).create("t1", { email: "x@gwb.ch", name: "X", role: "RM", password: "pw" }), "déjà utilisé");
  });
  await it("AD-03 setActive false → désactivé", async () => {
    const p = fakePrisma([{ id: "u1", tenantId: "t1", email: "x@gwb.ch", role: "RM", active: true, mfaEnabled: false }]);
    const r = await new UsersService(p).setActive("t1", "u1", false);
    ok(r.active === false);
  });
  await it("AD-04 setRole → rôle changé", async () => {
    const p = fakePrisma([{ id: "u1", tenantId: "t1", email: "x@gwb.ch", role: "RM", active: true, mfaEnabled: false }]);
    const r = await new UsersService(p).setRole("t1", "u1", "CO_SR");
    ok(r.role === "CO_SR");
  });
  await it("AD-05 resetMfa → secret purgé, MFA désactivée", async () => {
    const p = fakePrisma([{ id: "u1", tenantId: "t1", email: "x@gwb.ch", role: "RM", active: true, mfaEnabled: true, mfaSecret: "SECRET" }]);
    const r = await new UsersService(p).resetMfa("t1", "u1");
    ok(r.mfaEnabled === false && p._st.users[0].mfaSecret === null);
  });
  await it("AD-06 setRole user inconnu → 404", async () => {
    await rejects(new UsersService(fakePrisma()).setRole("t1", "ghost", "ADMIN"), "introuvable");
  });
  console.log(`\nAPI admin users — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
