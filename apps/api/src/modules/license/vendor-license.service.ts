import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from "@nestjs/common";
import { createHmac } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { Tx } from "../../common/tx";

/**
 * Le module est une licence — R177→R179 (LC-01..05). Écrit APRÈS l'amendement, APRÈS les
 * tests. Console VENDOR : chaque instance on-premise d'O-Live (id + version) reçoit son
 * périmètre de modules par un DOCUMENT SIGNÉ. Registre des modules DÉCLARÉ — on ne
 * licencie pas ce qui n'existe pas (R177). Défaut-refus uniforme par module, périmètre
 * lisible par la banque (R178). Changer = ÉMETTRE une nouvelle licence : acte vendor,
 * motivé, daté, jamais rétroactif ; l'historique est append-only (R179).
 * Convergence : la garde existante ModuleLicensed branchera assertModule (déploiement).
 */

export const MODULES_PRODUIT = [
  "GED", "OCR", "KYC", "AML", "COC", "ACCREV", "WORKFLOWS", "ONBOARDING", "SCREENING", "PMS", "IA",
] as const;

type VendorCtx = { userId: string; role: string };
type LicenceDto = { instanceId: string; version: string; modules: string[];
  effetAt: string; expiry: string; motif: string };

@Injectable()
export class VendorLicenseService {
  private cle: string;
  constructor(private prisma: PrismaService, private audit: AuditService, env: any = process.env) {
    this.cle = env.VENDOR_LICENSE_KEY ?? "";
  }
  private signer(l: { instanceId: string; version: string; modules: string[]; effetAt: string; expiry: string }) {
    if (!this.cle) throw new BadRequestException("R177 : clé de signature vendor absente — pas de licence fantôme");
    return createHmac("sha256", this.cle)
      .update(JSON.stringify({ i: l.instanceId, v: l.version, m: [...l.modules].sort(), e: l.effetAt, x: l.expiry }))
      .digest("hex");
  }
  private emit(tx: Tx, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId: null, type, aggregateId, payload, at: new Date().toISOString() } });
  }
  private async courante(tx: Tx, instanceId: string) {
    const ls = (await tx.vendorLicense.findMany({ where: { instanceId } }))
      .filter((l: any) => new Date(l.effetAt).getTime() <= Date.now())
      .sort((a: any, b: any) => String(a.effetAt).localeCompare(String(b.effetAt)));
    return ls.length ? ls[ls.length - 1] : null;
  }
  private verifierSignature(l: any) {
    if (this.signer(l) !== l.signature)
      throw new ForbiddenException("R177 : licence invalide — la signature ne correspond pas au contenu");
  }

  // ── R177/R179 : émettre — l'acte vendor qui fait le périmètre ──
  async emettre(ctx: VendorCtx, dto: LicenceDto) {
    return this.prisma.$transaction(async (tx: Tx) => {
      if (ctx.role !== "VENDOR") {
        await this.emit(tx, "vendor.licence.acces.refuse", dto.instanceId, { par: ctx.userId, role: ctx.role });
        throw new ForbiddenException("R179 : émettre une licence est un acte vendor");
      }
      const inconnus = dto.modules.filter((m) => !(MODULES_PRODUIT as readonly string[]).includes(m));
      if (inconnus.length)
        throw new BadRequestException(`R177 : module inconnu du registre produit — ${inconnus.join(", ")}`);
      if (!dto.motif || !dto.motif.trim()) throw new BadRequestException("R7 : émettre se motive — motif obligatoire");
      if (new Date(dto.effetAt).getTime() < Date.now() - 86_400_000)
        throw new BadRequestException("R179 : effet rétroactif refusé — on ne réécrit pas le passé");
      const signature = this.signer(dto);
      const l = await tx.vendorLicense.create({ data: { instanceId: dto.instanceId, version: dto.version,
        modules: dto.modules, effetAt: dto.effetAt, expiry: dto.expiry, signature,
        motif: dto.motif.trim(), emisPar: ctx.userId, at: new Date().toISOString() } });
      await this.emit(tx, "vendor.licence.emise", dto.instanceId,
        { version: dto.version, modules: dto.modules, effetAt: dto.effetAt, par: ctx.userId, motif: dto.motif.trim() });
      await this.audit.log("VENDOR", ctx.userId, "LICENSE_ISSUED", dto.instanceId);
      return { licenceId: l.id };
    });
  }

  // ── R177/R178 : le périmètre — vérifié à CHAQUE lecture ──
  async perimetre(instanceId: string) {
    const l = await this.courante(this.prisma, instanceId);
    if (!l) throw new NotFoundException(`Aucune licence pour l'instance ${instanceId}`);
    this.verifierSignature(l);
    return { instanceId, version: l.version, modules: l.modules, effetAt: l.effetAt, expiry: l.expiry };
  }

  async assertModule(instanceId: string, module: string) {
    if (!(MODULES_PRODUIT as readonly string[]).includes(module))
      throw new BadRequestException(`R178 : module inconnu du registre produit — ${module}`);
    const l = await this.courante(this.prisma, instanceId);
    if (!l) throw new ForbiddenException(`R178 : module ${module} non licencié — aucune licence pour ${instanceId}`);
    this.verifierSignature(l);
    if (!(l.modules as string[]).includes(module))
      throw new ForbiddenException(`R178 : module ${module} non licencié pour ${instanceId}`);
    if (new Date(l.expiry).getTime() < Date.now())
      throw new ForbiddenException(`R178 : licence expirée pour ${instanceId}`);
  }

  // ── R179 : l'historique — qui avait quoi, quand ──
  async historique(instanceId: string) {
    const ls = await this.prisma.vendorLicense.findMany({ where: { instanceId } });
    return ls.sort((a: any, b: any) => String(a.effetAt).localeCompare(String(b.effetAt)));
  }
}
