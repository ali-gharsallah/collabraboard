/** Tests provisioning MFA — secret, URI otpauth, enrôlement en deux temps. Harnais autonome. */
import { SecretBox } from "../../common/secret-box";
import { MfaService } from "./mfa.service";
import { Totp } from "./totp";
declare const process: any;

function fakePrisma(user: any) { const st: any = { user }; return { _st: st, user: {
  findFirst: async ({ where }: any) => (st.user && st.user.id === where.id) ? st.user : null,
  update: async ({ data }: any) => { st.user = { ...st.user, ...data }; return st.user; } } } as any; }
const U = () => ({ id: "u1", tenantId: "t1", email: "co@gwb.ch", role: "CO_SR", active: true, mfaEnabled: false, mfaSecret: null });

let passed = 0, failed = 0; const fails: string[] = [];
function it(n: string, fn: () => Promise<void>): Promise<void> { return fn().then(() => { passed++; }, (e: Error) => { failed++; fails.push(`✗ ${n} — ${e.message}`); }); }
function ok(c: boolean, m = "assertion"): void { if (!c) throw new Error(m); }
async function rejects(p: Promise<unknown>, part: string): Promise<void> {
  try { await p; } catch (e) { const n = (e as any).constructor.name; if ((e as Error).message.includes(part) || n.includes("Unauthorized") || n.includes("BadRequest")) return; throw new Error(`rejet «${part}» attendu`); } throw new Error(`rejet «${part}» attendu`); }

(async () => {
  await it("MF-01 secret base32 (160 bits → 20 octets)", () => {
    const s = new MfaService(fakePrisma(U())).generateSecret();
    ok(/^[A-Z2-7]+$/.test(s) && Totp.base32Decode(s).length === 20);
    return Promise.resolve();
  });
  await it("MF-02 URI otpauth valide", () => {
    const uri = new MfaService(fakePrisma(U())).otpauthUri("JBSWY3DP", "co@gwb.ch", "O-Live");
    ok(uri.startsWith("otpauth://totp/") && uri.includes("secret=JBSWY3DP") && uri.includes("issuer=O-Live") && uri.includes("period=30"));
    return Promise.resolve();
  });
  await it("MF-03 beginEnrollment pose le secret, MFA pas encore active", async () => {
    const p = fakePrisma(U()); const r = await new MfaService(p).beginEnrollment("t1", "u1");
    const box = new SecretBox(process.env.MFA_ENC_KEY);
    ok(!!r.secret && r.otpauthUri.includes(r.secret)
      && p._st.user.mfaSecret.startsWith("enc:v1:")              // chiffré au repos (SB-01)
      && box.open(p._st.user.mfaSecret) === r.secret             // et déchiffrable
      && p._st.user.mfaEnabled === false);
  });
  await it("MF-04 confirmEnrollment code valide → activée", async () => {
    const p = fakePrisma(U()); const svc = new MfaService(p);
    const { secret } = await svc.beginEnrollment("t1", "u1");
    const code = Totp.generate(Totp.base32Decode(secret), Date.now(), 30, 6);
    const r = await svc.confirmEnrollment("t1", "u1", code);
    ok(r.enabled === true && p._st.user.mfaEnabled === true);
  });
  await it("MF-05 confirmEnrollment code faux → 401, non activée", async () => {
    const p = fakePrisma(U()); const svc = new MfaService(p);
    await svc.beginEnrollment("t1", "u1");
    await rejects(svc.confirmEnrollment("t1", "u1", "000000"), "invalide");
    ok(p._st.user.mfaEnabled === false);
  });
  await it("MF-06 confirm sans enrôlement → 400", async () => {
    await rejects(new MfaService(fakePrisma(U())).confirmEnrollment("t1", "u1", "123456"), "enrôlement");
  });
  console.log(`\nProvisioning MFA — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
})();
