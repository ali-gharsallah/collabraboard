/** Tests RBAC — RolesGuard confronte les rôles requis (@Roles) à req.ctx.role. Harnais autonome. */
import { RolesGuard } from "./roles.guard";
declare const process: any;

const ctx = (role?: string) => ({
  getHandler: () => ({}), getClass: () => ({}),
  switchToHttp: () => ({ getRequest: () => ({ ctx: role ? { role } : {} }) }),
} as any);
const reflector = (required?: string[]) => ({ getAllAndOverride: () => required } as any);

let passed = 0, failed = 0; const fails: string[] = [];
function it(name: string, fn: () => void): void { try { fn(); passed++; } catch (e) { failed++; fails.push(`✗ ${name} — ${(e as Error).message}`); } }
function ok(c: boolean, m = "assertion"): void { if (!c) throw new Error(m); }
function forbids(fn: () => void): void {
  try { fn(); } catch (e) { if ((e as any).constructor.name.includes("Forbidden")) return; throw new Error(`Forbidden attendu, obtenu ${(e as Error).message}`); }
  throw new Error("ForbiddenException attendue");
}

// RG-01 — endpoint non restreint (aucun @Roles) → passe
it("RG-01 aucun rôle requis → autorisé", () => {
  ok(new RolesGuard(reflector(undefined)).canActivate(ctx("RM")) === true);
  ok(new RolesGuard(reflector([])).canActivate(ctx("RM")) === true);
});
// RG-02 — rôle dans la liste → passe
it("RG-02 rôle autorisé → passe", () => {
  ok(new RolesGuard(reflector(["CO_SR", "MLRO", "DIR", "ADMIN"])).canActivate(ctx("CO_SR")) === true);
});
// RG-03 — rôle hors liste → refus
it("RG-03 rôle non autorisé → Forbidden", () => {
  forbids(() => new RolesGuard(reflector(["CO_SR", "MLRO"])).canActivate(ctx("RM")));
});
// RG-04 — pas de rôle (ctx absent) → refus
it("RG-04 rôle absent → Forbidden", () => {
  forbids(() => new RolesGuard(reflector(["ADMIN"])).canActivate(ctx(undefined)));
});

console.log(`\nRBAC (RolesGuard) — ${passed}/${passed + failed} tests verts`);
if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
