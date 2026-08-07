// Harnais P-L8-3 — gouvernance du module O (OO-01..05). Autonome, fakePrisma (tenant de démo).
import * as assert from "node:assert/strict";
import { GouvernanceOService, CAPACITES_O } from "./gouvernance-o.service";

let passed = 0; const t = async (nom: string, fn: () => Promise<void> | void) => { await fn(); passed++; console.log("  ✓ " + nom); };
const T = "55555555-5555-4555-8555-555555555555";
const CO = { tenantId: T, userId: "admin-1", role: "ADMIN" };

function fake() {
  const tenants: any[] = [{ id: T, settings: { locale: "fr" } }];   // tenant de DÉMO
  const events: any[] = [];
  const props: any[] = [
    { id: "P1", tenantId: T, statut: "ADOPTEE", type: "PARAM", createdAt: "2026-08-02T00:00:00Z" },
    { id: "P2", tenantId: T, statut: "PENDING", type: "PARAM", createdAt: "2026-08-03T00:00:00Z" },
    { id: "P3", tenantId: T, statut: "REJETEE", type: "REGLE", createdAt: "2026-07-15T00:00:00Z" }];  // hors mois
  const taches: any[] = [{ id: "K1", tenantId: T, origine: "olivia:relance", createdAt: "2026-08-05T00:00:00Z" }];
  const p: any = {
    tenant: { findFirst: async () => tenants[0],
      update: async ({ data }: any) => { tenants[0] = { ...tenants[0], ...data }; return tenants[0]; } },
    oliviaProposal: { findMany: async () => props },
    task: { findMany: async () => taches },
    domainEvent: { findMany: async ({ where }: any) =>
        events.filter((e) => (where.type?.in ?? []).includes(e.type)),
      create: async ({ data }: any) => { events.push({ ...data, at: data.at ?? new Date("2026-08-04").toISOString() }); return data; },
      findFirst: async () => null },
  };
  p.$transaction = async (fn: any) => fn(p);
  return { p, tenants, events };
}

(async () => {
console.log("Gouvernance module O (P-L8-3, OO) :");

await t("OO-01 curseur : défaut OBSERVE (O1) pour chaque capacité, niveaux exposés", async () => {
  const { p } = fake();
  const c = await new GouvernanceOService(p).curseur(CO);
  assert.equal(c.capacites.length, CAPACITES_O.length);
  assert.ok(c.capacites.every((x: any) => x.niveau === "observe"));
  assert.deepEqual(c.niveaux, ["observe", "suggere", "copilote_gouverne"]);
});

await t("OO-02 changer le curseur : persisté dans tenant.settings + ÉVÉNEMENT CATALOGUÉ (précédent inclus)", async () => {
  const { p, tenants, events } = fake();
  const svc = new GouvernanceOService(p);
  const r = await svc.changerCurseur(CO, { capacite: "PREREVUE_DOSSIER", niveau: "suggere" });
  assert.deepEqual(r, { capacite: "PREREVUE_DOSSIER", niveau: "suggere", precedent: "observe" });
  assert.equal(tenants[0].settings.oliviaAutonomie.PREREVUE_DOSSIER, "suggere");
  assert.equal(tenants[0].settings.locale, "fr");                  // les autres settings survivent
  const ev = events.find((e) => e.type === "olivia.curseur.change");
  assert.deepEqual(ev.payload, { capacite: "PREREVUE_DOSSIER", niveau: "suggere", precedent: "observe", par: "admin-1" });
  assert.equal((await svc.curseur(CO)).capacites.find((x: any) => x.capacite === "PREREVUE_DOSSIER")!.niveau, "suggere");
});

await t("OO-03 gardes : capacité inconnue et niveau inconnu REFUSÉS (aucune capacité nouvelle)", async () => {
  const svc = new GouvernanceOService(fake().p);
  await assert.rejects(svc.changerCurseur(CO, { capacite: "AUTO_PILOTE", niveau: "observe" }), /capacité inconnue/);
  await assert.rejects(svc.changerCurseur(CO, { capacite: "PREREVUE_DOSSIER", niveau: "autonome" }), /niveau inconnu/);
});

await t("OO-04 rapport de valeur (tenant de démo) : compté du journal + tables, définitions affichées", async () => {
  const { p } = fake();
  const svc = new GouvernanceOService(p);
  await svc.changerCurseur(CO, { capacite: "ANALYSE_CORRELATION", niveau: "suggere" });   // trace au journal
  const r = await svc.rapportValeur(CO, 2026, 8);
  assert.equal(r.mois, "2026-08");
  assert.deepEqual(r.suggestions, { emises: 2, parStatut: { ADOPTEE: 1, PENDING: 1 }, parType: { PARAM: 2 } });
  assert.equal(r.changementsCurseur, 1);
  assert.equal(r.relancesEtRepriorisations, 1);
  assert.ok(r.definitions.suggestions.includes("R254") && r.acteur.includes("R44"));
});

await t("OO-05 rapport : mois hors 1..12 refusé", async () => {
  await assert.rejects(new GouvernanceOService(fake().p).rapportValeur(CO, 2026, 13), /mois/);
});

console.log(`\n### ${passed}/${passed} specs gouvernance O P-L8-3 verts ###`);
})().catch((e) => { console.error(e); process.exit(1); });
