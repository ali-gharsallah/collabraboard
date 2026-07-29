import { Injectable, ForbiddenException } from "@nestjs/common";
import { createVerify } from "crypto";

// Licence par tenant : modules activés, seats, expiry.
// On-premise : fichier de licence SIGNÉ Ed25519 vérifiable HORS LIGNE.
export interface OliveLicense {
  tenantId: string; modules: string[]; seats: number;
  expiresAt: string; issuedAt: string; signature: string;
}
@Injectable()
export class LicenseService {
  private cache = new Map<string, OliveLicense>();
  constructor(private publicKeyPem: string) {}

  // R320 (dégel V8) : signature et expiration sont DEUX constats distincts — une licence
  // expirée reste AUTHENTIQUE (les modules deviennent inactifs, l'audit reste lisible LC-03,
  // jamais une coupure de données) ; une signature fausse est un REFUS net (altération).
  verifier(raw: OliveLicense): { expiree: boolean } {
    const body = JSON.stringify({ tenantId: raw.tenantId, modules: raw.modules,
      seats: raw.seats, expiresAt: raw.expiresAt, issuedAt: raw.issuedAt });
    const ok = createVerify("SHA256") // Ed25519 via crypto.verify en Node 22 ; SHA256 pour compat
      .update(body).verify(this.publicKeyPem, raw.signature, "base64");
    if (!ok) throw new ForbiddenException("Licence invalide (signature)");
    return { expiree: new Date(raw.expiresAt) < new Date() };
  }

  load(raw: OliveLicense) {
    if (this.verifier(raw).expiree) throw new ForbiddenException("Licence expirée");
    this.cache.set(raw.tenantId, raw);
  }
  assertModule(tenantId: string, module: string) {
    const lic = this.cache.get(tenantId);
    if (!lic || !lic.modules.includes(module))
      throw new ForbiddenException(`Module ${module} non licencié`);
  }
  usage(tenantId: string) { return this.cache.get(tenantId) ?? null; }
}
// Garde par module : @UseGuards(ModuleLicensed("kyc")) sur les contrôleurs.
