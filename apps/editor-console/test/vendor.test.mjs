// Tests de la console éditeur (app VENDOR séparée) — R319/R320, VE-01..03 versant vendor.
// Autonome : Node natif (node:crypto, node:assert), aucun import de apps/api. La séparation
// des bases de code est structurelle. Runner minimal maison (comme le harnais de règles).
import assert from "node:assert/strict";
import { createVerify } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { ROLES_VENDOR, garderRoleVendor } from "../src/rbac.mjs";
import { RegistreInstances } from "../src/instances.mjs";
import { EmetteurLicences, genererPaireVendor, corpsLicence } from "../src/licence.mjs";

const ici = dirname(fileURLToPath(import.meta.url));
let passed = 0; const t = (nom, fn) => { fn(); passed++; console.log("  ✓ " + nom); };

console.log("Console Éditeur (vendor) — R319/R320 :");

// ── VE-01 (versant VENDOR) : EDITOR existe ICI ; et le RBAC TENANT l'ignore (négatif permanent) ──
t("VE-01 EDITOR est un rôle du RBAC VENDOR (et seulement ici)", () => {
  assert.ok(ROLES_VENDOR.includes("EDITOR"));
  garderRoleVendor("EDITOR");                                  // accepté ici
  assert.throws(() => garderRoleVendor("RM"), /R319/);         // un rôle tenant n'existe pas ici
});

t("VE-01 (négatif tenant) : l'enum Role de apps/api ne contient PAS EDITOR", () => {
  const schema = readFileSync(resolve(ici, "../../api/prisma/schema.prisma"), "utf8");
  const enumRole = schema.match(/enum Role \{([\s\S]*?)\}/);
  assert.ok(enumRole, "enum Role trouvé");
  assert.ok(!/\bEDITOR\b/.test(enumRole[1]), "EDITOR absent du RBAC tenant");
  // et les gardes tenant refusent EDITOR (miroir de la liste fermée)
  const users = readFileSync(resolve(ici, "../../api/src/modules/auth/users.service.ts"), "utf8");
  assert.ok(/ROLES_TENANT/.test(users) && !/\bEDITOR\b/.test(users.replace(/\/\/[^\n]*/g, "")));
});

// ── R319 : le registre des instances clientes ──
t("R319 registre : enregistrer une instance (version/modules/canal), idempotent par tenant", () => {
  const reg = new RegistreInstances();
  reg.enregistrer({ tenantId: "gwb", version: "2026.07.29", modules: ["kyc", "aml", "cpsi"], canal: "STABLE" });
  reg.enregistrer({ tenantId: "gwb", version: "2026.07.30", modules: ["kyc", "aml", "cpsi", "bi"] });  // mise à jour
  const liste = reg.lister();
  assert.equal(liste.length, 1);                               // un seul tenant, historisé
  assert.equal(liste[0].version, "2026.07.30");
  assert.deepEqual(liste[0].modules, ["kyc", "aml", "cpsi", "bi"]);
  assert.equal(reg.get("gwb").historique.length, 2);           // append-only
});

// ── R320 / VE-02 : la licence émise par le VENDOR est VÉRIFIABLE côté tenant ──
t("R320/VE-02 licence signée vendor → vérifiable par l'algorithme du LicenseService tenant", () => {
  const { publicKeyPem, privateKeyPem } = genererPaireVendor();  // la publique se dépose en OLIVE_LICENSE_PUBKEY
  const emetteur = new EmetteurLicences(privateKeyPem);
  const lic = emetteur.emettre({ tenantId: "gwb", modules: ["kyc", "aml", "cpsi"],
    issuedAt: "2026-07-29T00:00:00.000Z", expiresAt: "2027-07-29T00:00:00.000Z" });
  // Rejeu EXACT de la vérification tenant (license.service.ts) — sans importer apps/api
  const body = corpsLicence(lic);
  const ok = createVerify("SHA256").update(body).verify(publicKeyPem, lic.signature, "base64");
  assert.equal(ok, true);                                      // le tenant PEUT vérifier ce que le vendor a signé
});

t("R320/VE-02 une licence ALTÉRÉE après signature est REJETÉE (clé publique la démasque)", () => {
  const { publicKeyPem, privateKeyPem } = genererPaireVendor();
  const lic = new EmetteurLicences(privateKeyPem).emettre({ tenantId: "gwb", modules: ["kyc"],
    issuedAt: "2026-07-29T00:00:00.000Z", expiresAt: "2027-07-29T00:00:00.000Z" });
  lic.modules = ["kyc", "cpsi", "bi"];                         // altération après signature
  const ok = createVerify("SHA256").update(corpsLicence(lic)).verify(publicKeyPem, lic.signature, "base64");
  assert.equal(ok, false);                                    // refus net
});

t("R320 émettre exige issuedAt/expiresAt (émission tracée, jamais Date.now() implicite)", () => {
  const { privateKeyPem } = genererPaireVendor();
  assert.throws(() => new EmetteurLicences(privateKeyPem).emettre({ tenantId: "x", modules: [] }), /issuedAt/);
});

console.log(`\n### ${passed}/${passed} tests vendor verts ###`);
